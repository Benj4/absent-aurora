import { supabase } from './supabase';
import type { AnalisisState } from '../components/analysis-builder/analysis-builder.types';

export interface SaveAnalysisResult {
  id: string;
}

export interface SaveAnalysisError {
  error: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Loads a full AnalisisState from Supabase by analysis id.
 * Fetches all 5 tables in parallel and reassembles the state shape.
 */
export async function loadAnalysis(id: string): Promise<AnalisisState | SaveAnalysisError> {
  if (!UUID_RE.test(id)) return { error: 'ID de análisis no válido.' };

  const [rootRes, indicatorsRes, periodsRes, selectionsRes, eventsRes] = await Promise.all([
    supabase
      .from('analysis')
      .select('title, description, alignment_mode, region, show_base100')
      .eq('id', id)
      .single(),
    supabase
      .from('analysis_indicators')
      .select('indicator_id, sort_order')
      .eq('analysis_id', id)
      .order('sort_order'),
    supabase
      .from('analysis_periods')
      .select('id, name, start_date, end_date, color, sort_order')
      .eq('analysis_id', id)
      .order('sort_order'),
    supabase
      .from('analysis_source_selections')
      .select('indicator_id, date, post_id')
      .eq('analysis_id', id),
    supabase
      .from('analysis_macro_events')
      .select('macro_event_id, marker_mode, marker_color')
      .eq('analysis_id', id),
  ]);

  if (rootRes.error) return { error: rootRes.error.message };

  const root = rootRes.data;

  const indicadores = (indicatorsRes.data ?? []).map(r => r.indicator_id as string);

  const periodos = (periodsRes.data ?? []).map(r => ({
    id: r.id as string,
    nombre: r.name as string,
    fechaInicio: r.start_date as string,
    fechaFin: r.end_date as string,
    color: r.color as string,
  }));

  const sourceSelections: Record<string, string> = {};
  for (const r of selectionsRes.data ?? []) {
    sourceSelections[`${r.indicator_id}:${r.date}`] = r.post_id as string;
  }

  const macroEventIds = (eventsRes.data ?? []).map(r => r.macro_event_id as string);
  const markerModeByEventId: Record<string, 'none' | 'start' | 'end' | 'both'> = {};
  const markerColorByEventId: Record<string, string> = {};
  for (const r of eventsRes.data ?? []) {
    if (r.marker_mode) markerModeByEventId[r.macro_event_id as string] = r.marker_mode as 'none' | 'start' | 'end' | 'both';
    if (r.marker_color) markerColorByEventId[r.macro_event_id as string] = r.marker_color as string;
  }

  return {
    titulo: root.title as string,
    descripcion: (root.description as string) ?? '',
    modoAlineacion: root.alignment_mode as 'indice_cero' | 'calendario',
    region: (root.region as string) ?? '',
    indicadores,
    periodos,
    sourceSelections,
    macroEventIds,
    markerModeByEventId,
    markerColorByEventId,
    showBase100Line: root.show_base100 as boolean,
  };
}

/**
 * Persists a full AnalisisState to Supabase across 5 tables:
 *   analysis → analysis_indicators → analysis_periods
 *   → analysis_source_selections → analysis_macro_events
 *
 * Inserts are sequential so a failure at any step returns the error
 * and the orphaned parent rows cascade-delete on cleanup.
 */
export async function saveAnalysis(
  state: AnalisisState,
): Promise<SaveAnalysisResult | SaveAnalysisError> {
  // 1. Root record
  const { data: root, error: rootError } = await supabase
    .from('analysis')
    .insert({
      title: state.titulo,
      description: state.descripcion || null,
      alignment_mode: state.modoAlineacion,
      region: state.region || null,
      show_base100: state.showBase100Line ?? true,
    })
    .select('id')
    .single();

  if (rootError) return { error: rootError.message };
  const analysisId: string = root.id;

  // 2. Indicators
  if (state.indicadores.length > 0) {
    const { error } = await supabase.from('analysis_indicators').insert(
      state.indicadores.map((indicator_id, i) => ({
        analysis_id: analysisId,
        indicator_id,
        sort_order: i,
      })),
    );
    if (error) return { error: error.message };
  }

  // 3. Periods
  if (state.periodos.length > 0) {
    const { error } = await supabase.from('analysis_periods').insert(
      state.periodos.map((p, i) => ({
        id: p.id,
        analysis_id: analysisId,
        name: p.nombre,
        start_date: p.fechaInicio,
        end_date: p.fechaFin,
        color: p.color,
        sort_order: i,
      })),
    );
    if (error) return { error: error.message };
  }

  // 4. Source selections  —  key format: "INDICATOR_ID:YYYY-MM-DD"
  const selectionEntries = Object.entries(state.sourceSelections ?? {});
  if (selectionEntries.length > 0) {
    const { error } = await supabase.from('analysis_source_selections').insert(
      selectionEntries.map(([key, post_id]) => {
        const colonIndex = key.indexOf(':');
        const indicator_id = key.slice(0, colonIndex);
        const date = key.slice(colonIndex + 1);
        return { analysis_id: analysisId, indicator_id, date, post_id };
      }),
    );
    if (error) return { error: error.message };
  }

  // 5. Macro events  —  merge ids + mode map + color map into one row per event
  if (state.macroEventIds.length > 0) {
    const { error } = await supabase.from('analysis_macro_events').insert(
      state.macroEventIds.map(macro_event_id => ({
        analysis_id: analysisId,
        macro_event_id,
        marker_mode: state.markerModeByEventId?.[macro_event_id] ?? null,
        marker_color: state.markerColorByEventId?.[macro_event_id] ?? null,
      })),
    );
    if (error) return { error: error.message };
  }

  return { id: analysisId };
}

/**
 * Updates an existing analysis in-place.
 * UPDATEs the root row and replaces all child rows
 * (DELETE + re-INSERT) so the caller doesn't need to diff anything.
 */
export async function updateAnalysis(
  id: string,
  state: AnalisisState,
): Promise<SaveAnalysisResult | SaveAnalysisError> {
  if (!UUID_RE.test(id)) return { error: 'ID de análisis no válido.' };

  // 1. Update root
  const { error: rootError } = await supabase
    .from('analysis')
    .update({
      title: state.titulo,
      description: state.descripcion || null,
      alignment_mode: state.modoAlineacion,
      region: state.region || null,
      show_base100: state.showBase100Line ?? true,
    })
    .eq('id', id);

  if (rootError) return { error: rootError.message };

  // 2. Replace children — delete all, then re-insert
  const childTables = [
    'analysis_indicators',
    'analysis_periods',
    'analysis_source_selections',
    'analysis_macro_events',
  ] as const;

  for (const table of childTables) {
    const { error } = await supabase.from(table).delete().eq('analysis_id', id);
    if (error) return { error: error.message };
  }

  // 3. Re-insert indicators
  if (state.indicadores.length > 0) {
    const { error } = await supabase.from('analysis_indicators').insert(
      state.indicadores.map((indicator_id, i) => ({
        analysis_id: id,
        indicator_id,
        sort_order: i,
      })),
    );
    if (error) return { error: error.message };
  }

  // 4. Re-insert periods
  if (state.periodos.length > 0) {
    const { error } = await supabase.from('analysis_periods').insert(
      state.periodos.map((p, i) => ({
        id: p.id,
        analysis_id: id,
        name: p.nombre,
        start_date: p.fechaInicio,
        end_date: p.fechaFin,
        color: p.color,
        sort_order: i,
      })),
    );
    if (error) return { error: error.message };
  }

  // 5. Re-insert source selections
  const selectionEntries = Object.entries(state.sourceSelections ?? {});
  if (selectionEntries.length > 0) {
    const { error } = await supabase.from('analysis_source_selections').insert(
      selectionEntries.map(([key, post_id]) => {
        const colonIndex = key.indexOf(':');
        const indicator_id = key.slice(0, colonIndex);
        const date = key.slice(colonIndex + 1);
        return { analysis_id: id, indicator_id, date, post_id };
      }),
    );
    if (error) return { error: error.message };
  }

  // 6. Re-insert macro events
  if (state.macroEventIds.length > 0) {
    const { error } = await supabase.from('analysis_macro_events').insert(
      state.macroEventIds.map(macro_event_id => ({
        analysis_id: id,
        macro_event_id,
        marker_mode: state.markerModeByEventId?.[macro_event_id] ?? null,
        marker_color: state.markerColorByEventId?.[macro_event_id] ?? null,
      })),
    );
    if (error) return { error: error.message };
  }

  return { id };
}
