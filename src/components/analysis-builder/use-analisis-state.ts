import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { Analysis } from '../../lib/supabase';
import { fetchMacroEvents } from '../../lib/macro-events';
import { loadAnalysis } from '../../lib/analysis';
import type { MacroEvent } from '../../lib/macro-events';

import type { RawPoint, AnalisisState, Periodo, ModoAlineacion, MarkerMode } from './analysis-builder.types';
import { ANALISIS_DRAFT_KEY, PERIOD_COLORS, PERIOD_LETTERS, MAX_INDICATORS, MAX_PERIODS } from './analysis-builder.types';
import {
  makeInitialState,
  sanitizeState,
  findSourceConflicts,
  filterByPeriod,
  // buildKPIRows,
  buildChartSeries,
  buildBase100OverlaySeries,
  buildMacroEventMarkers,
  getDefaultMacroEventColor,
} from './analysis-builder.utils';
import { INDICATOR_MAP } from './analysis-builder.data';

export type MacroMarkerMode = MarkerMode;

export function useAnalisisState(analysisId?: string) {
  const initial = makeInitialState();

  const [titulo, setTitulo] = useState(initial.titulo);
  const [descripcion, setDescripcion] = useState(initial.descripcion);
  const [status, setStatus] = useState<Analysis['status']>(initial.status);
  const [region, setRegion] = useState(initial.region);
  const [modoAlineacion, setModoAlineacion] = useState<ModoAlineacion>(initial.modoAlineacion);
  const [indicadores, setIndicadores] = useState<string[]>(initial.indicadores);
  const [periodos, setPeriodos] = useState<Periodo[]>(initial.periodos);
  const [sourceSelections, setSourceSelections] = useState<Record<string, string>>(initial.sourceSelections ?? {});
  const [macroEventIds, setMacroEventIds] = useState<string[]>(initial.macroEventIds);
  const [markerModeByEventId, setMarkerModeByEventId] = useState<Record<string, MacroMarkerMode>>(initial.markerModeByEventId ?? {});
  const [markerColorByEventId, setMarkerColorByEventId] = useState<Record<string, string>>(initial.markerColorByEventId ?? {});
  const [showBase100Line, setShowBase100Line] = useState<boolean>(initial.showBase100Line ?? true);

  const state: AnalisisState = {
    titulo, descripcion, status, region, modoAlineacion,
    indicadores, periodos, sourceSelections, macroEventIds,
    markerModeByEventId, markerColorByEventId, showBase100Line,
  };

  // ── Draft persistence ──────────────────────────────────────────────────────

  const loadState = useCallback((s: AnalisisState) => {
    setTitulo(s.titulo);
    setDescripcion(s.descripcion);
    setStatus(s.status);
    setRegion(s.region);
    setModoAlineacion(s.modoAlineacion);
    setIndicadores(s.indicadores);
    setPeriodos(s.periodos);
    setSourceSelections(s.sourceSelections ?? {});
    setMacroEventIds(s.macroEventIds);
    setMarkerModeByEventId(s.markerModeByEventId ?? {});
    setMarkerColorByEventId(s.markerColorByEventId ?? {});
    setShowBase100Line(s.showBase100Line ?? true);
  }, []);

  const [isDraftReady, setIsDraftReady] = useState(false);

  useEffect(() => {
    // Edit mode: load from Supabase, skip localStorage entirely
    if (analysisId) {
      loadAnalysis(analysisId).then(result => {
        if (!('error' in result)) loadState(result);
        setIsDraftReady(true);
      });
      return;
    }

    let restored: AnalisisState | null = null;
    try {
      const localRaw = window.localStorage.getItem(ANALISIS_DRAFT_KEY);
      if (localRaw) restored = sanitizeState(JSON.parse(localRaw));
    } catch {
      // Ignore malformed state.
    }
    if (restored) loadState(restored);
    setIsDraftReady(true);
  }, [loadState, analysisId]);

  useEffect(() => {
    // Edit mode: don't persist to localStorage
    if (analysisId) return;
    if (!isDraftReady) return;
    try {
      window.localStorage.setItem(ANALISIS_DRAFT_KEY, JSON.stringify(state));
    } catch {
      // Ignore quota/private-mode errors.
    }
  }, [state, isDraftReady, analysisId]);

  // ── State mutations ────────────────────────────────────────────────────────

  const toggleIndicator = useCallback((id: string) => {
    setIndicadores(prev =>
      prev.includes(id)
        ? prev.filter(i => i !== id)
        : prev.length < MAX_INDICATORS ? [...prev, id] : prev
    );
  }, []);

  const addPeriodo = useCallback(() => {
    setPeriodos(prev => {
      if (prev.length >= MAX_PERIODS) return prev;
      const idx = prev.length;
      return [...prev, {
        id: crypto.randomUUID(),
        nombre: `Período ${PERIOD_LETTERS[idx]}`,
        fechaInicio: '',
        fechaFin: '',
        color: PERIOD_COLORS[idx % PERIOD_COLORS.length],
      }];
    });
  }, []);

  const updatePeriodo = useCallback((id: string, field: keyof Periodo, value: string) => {
    setPeriodos(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  }, []);

  const removePeriodo = useCallback((id: string) => {
    setPeriodos(prev => prev.length > 1 ? prev.filter(p => p.id !== id) : prev);
  }, []);

  const toggleMacroEvent = useCallback((id: string) => {
    setMacroEventIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  }, []);

  const setSourceSelection = useCallback((key: string, value: string) => {
    setSourceSelections(prev => ({ ...prev, [key]: value }));
  }, []);

  // ── Reset ──────────────────────────────────────────────────────────────────

  const [rawData, setRawData] = useState<RawPoint[]>([]);

  const onReset = useCallback(() => {
    if (!window.confirm('¿Estás seguro de que quieres reiniciar el formulario? Se perderán los cambios no guardados.')) return;
    loadState(makeInitialState());
    setRawData([]);
    try { window.localStorage.removeItem(ANALISIS_DRAFT_KEY); } catch { /* ignore */ }
  }, [loadState]);

  // ── Macro events ───────────────────────────────────────────────────────────

  const [macroEvents, setMacroEvents] = useState<MacroEvent[]>([]);
  const [macroEventsLoading, setMacroEventsLoading] = useState(false);
  const [macroEventsSearch, setMacroEventsSearch] = useState('');

  const addMacroEvent = useCallback((event: MacroEvent) => {
    setMacroEvents(prev => [event, ...prev.filter(item => item.id !== event.id)]
      .sort((a, b) => b.start_date.localeCompare(a.start_date)));
    setMacroEventIds(prev => prev.includes(event.id) ? prev : [...prev, event.id]);
    setMacroEventsSearch('');
  }, []);

  useEffect(() => {
    setMacroEventsLoading(true);
    fetchMacroEvents().then(({ data, error }) => {
      if (!error && data) setMacroEvents(data as MacroEvent[]);
      setMacroEventsLoading(false);
    });
  }, []);

  useEffect(() => {
    if (macroEventIds.length === 0) return;
    setMarkerColorByEventId(prev => {
      const next = { ...prev };
      let changed = false;

      macroEventIds.forEach((id, index) => {
        if (!next[id]) {
          next[id] = getDefaultMacroEventColor(id, index);
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [macroEventIds]);

  // ── Data fetch ─────────────────────────────────────────────────────────────

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const active = periodos.filter(p => p.fechaInicio && p.fechaFin);
    if (indicadores.length === 0 || active.length === 0) {
      setRawData([]);
      return;
    }

    const allDates = active.flatMap(p => [p.fechaInicio, p.fechaFin]).sort();
    const minDate = allDates[0];
    const maxDate = allDates[allDates.length - 1];

    let cancelled = false;
    setLoading(true);

    supabase
      .from('approved_series_view')
      .select('indicator_id, date, value, data_source, post_id')
      .in('indicator_id', indicadores)
      .gte('date', minDate)
      .lte('date', maxDate)
      .order('date', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) setRawData(data as RawPoint[]);
        setLoading(false);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(indicadores), JSON.stringify(periodos.map(p => ({ i: p.fechaInicio, f: p.fechaFin })))]);

  // ── Derived values ─────────────────────────────────────────────────────────

  const sourceConflicts = findSourceConflicts(rawData);
  const base100Overlay = (state.showBase100Line ?? true) ? buildBase100OverlaySeries(rawData, state) : [];
  const chartSeries = [...buildChartSeries(rawData, state), ...base100Overlay];
  const selectedMacroEvents = macroEvents.filter(ev => state.macroEventIds.includes(ev.id));
  const chartMarkers = buildMacroEventMarkers(selectedMacroEvents, state, markerModeByEventId, markerColorByEventId);
  // const kpiRows = buildKPIRows(rawData, state);
  const hasActivePeriods = state.periodos.some(p => p.fechaInicio && p.fechaFin);
  const hasData = rawData.length > 0;
  const isConfigured = state.indicadores.length > 0 && hasActivePeriods;
  const displayTitle = state.titulo.trim() || 'Análisis sin título';
  const periodsSummary = state.periodos.filter(p => p.nombre).map(p => p.nombre).join(' vs. ');

  const tableRows = state.periodos.flatMap(periodo =>
    state.indicadores.flatMap(indicId =>
      filterByPeriod(rawData, indicId, periodo, state.sourceSelections).map(d => ({
        date: d.date,
        indicator: INDICATOR_MAP.get(indicId) ?? indicId,
        period: periodo.nombre,
        color: periodo.color,
        value: d.value,
        postId: d.post_id ?? '',
        sourceName: d.data_source ?? 'Fuente',
      }))
    )
  );

  return {
    // State
    state,
    // Form callbacks
    onSetTitulo: setTitulo,
    onSetDescripcion: setDescripcion,
    onSetStatus: setStatus,
    onSetRegion: setRegion,
    onSetModo: setModoAlineacion,
    onSetShowBase100Line: setShowBase100Line,
    onToggleIndicator: toggleIndicator,
    onAddPeriodo: addPeriodo,
    onUpdatePeriodo: updatePeriodo,
    onRemovePeriodo: removePeriodo,
    onToggleMacroEvent: toggleMacroEvent,
    onSelectSource: setSourceSelection,
    onReset,
    // Macro events
    macroEvents,
    macroEventsLoading,
    macroEventsSearch,
    setMacroEventsSearch,
    onMacroEventCreated: addMacroEvent,
    // Marker modes
    markerModeByEventId,
    setMarkerModeByEventId,
    markerColorByEventId,
    setMarkerColorByEventId,
    // Data
    loading,
    // Derived
    sourceConflicts,
    chartSeries,
    selectedMacroEvents,
    chartMarkers,
    // kpiRows,
    hasData,
    isConfigured,
    displayTitle,
    periodsSummary,
    tableRows,
  };
}
