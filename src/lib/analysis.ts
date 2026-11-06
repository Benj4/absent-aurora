import { supabase } from './supabase';
import type { AnalisisState } from '../components/analysis-builder/analysis-builder.types';

export interface SaveAnalysisResult {
  id: string;
}

export interface SaveAnalysisError {
  error: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function deleteDraftAnalysis(id: string): Promise<SaveAnalysisResult | SaveAnalysisError> {
  if (!UUID_RE.test(id)) return { error: 'ID de análisis no válido.' };
  const { data, error } = await supabase.from('analysis').delete()
    .eq('id', id).eq('status', 'draft').select('id').maybeSingle();
  if (error || !data) return { error: 'No se pudo eliminar el borrador. Comprueba su estado y tus permisos.' };
  return { id: data.id };
}

/**
 * Loads a full AnalisisState from Supabase by analysis id.
 * Fetches all 5 tables in parallel and reassembles the state shape.
 */
export async function loadAnalysis(id: string): Promise<AnalisisState | SaveAnalysisError> {
  if (!UUID_RE.test(id)) return { error: 'ID de análisis no válido.' };

  const [rootRes, indicatorsRes, periodsRes, selectionsRes, eventsRes] = await Promise.all([
    supabase
      .from('analysis')
      .select('title, description, status, alignment_mode, region, show_base100')
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

  for (const result of [rootRes, indicatorsRes, periodsRes, selectionsRes, eventsRes]) {
    if (result.error) return { error: 'No se pudo cargar el análisis.' };
  }

  const root = rootRes.data;
  if (!root) return { error: 'No se pudo cargar el análisis.' };

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
    status: (root.status as string) ?? 'draft',
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

/** Save the complete configuration in a single database transaction. */
async function persistAnalysis(id: string | null, state: AnalisisState): Promise<SaveAnalysisResult | SaveAnalysisError> {
  if (id && !UUID_RE.test(id)) return { error: 'ID de análisis no válido.' };
  const selections = Object.entries(state.sourceSelections ?? {}).map(([key, post_id]) => {
    const separator = key.indexOf(':');
    return { indicator_id: key.slice(0, separator), date: key.slice(separator + 1), post_id };
  });
  const { data, error } = await supabase.rpc('save_analysis', {
    p_id: id as string,
    p_config: {
      title: state.titulo, description: state.descripcion, status: state.status,
      alignment_mode: state.modoAlineacion, region: state.region,
      show_base100: state.showBase100Line ?? false,
      indicators: state.indicadores.map((indicator_id, sort_order) => ({ indicator_id, sort_order })),
      periods: state.periodos.map((period, sort_order) => ({
        id: period.id, name: period.nombre, start_date: period.fechaInicio,
        end_date: period.fechaFin, color: period.color, sort_order,
      })),
      selections,
      events: state.macroEventIds.map(macro_event_id => ({
        macro_event_id, marker_mode: state.markerModeByEventId?.[macro_event_id] ?? null,
        marker_color: state.markerColorByEventId?.[macro_event_id] ?? null,
      })),
    },
  });
  if (error || !data) return { error: 'No se pudo guardar el análisis. Comprueba los datos y tus permisos.' };
  return { id: data };
}

export function saveAnalysis(state: AnalisisState): Promise<SaveAnalysisResult | SaveAnalysisError> {
  return persistAnalysis(null, state);
}

export function updateAnalysis(id: string, state: AnalisisState): Promise<SaveAnalysisResult | SaveAnalysisError> {
  return persistAnalysis(id, state);
}
