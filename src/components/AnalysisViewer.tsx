// filepath: src/components/AnalysisViewer.tsx
import { useState, useEffect, useMemo } from 'react';
import type { FC } from 'react';
import { supabase } from '../lib/supabase';
import { loadAnalysis } from '../lib/analysis';
import { fetchMacroEvents } from '../lib/macro-events';
import type { MacroEvent } from '../lib/macro-events';
import { withBase } from '../lib/paths';
import AnalysisChart from './analysis-builder/AnalysisChart';
import {
  buildChartSeries,
  buildBase100OverlaySeries,
  buildMacroEventMarkers,
  filterByPeriod,
  fmt,
  getDefaultMacroEventColor,
} from './analysis-builder/analysis-builder.utils';
import { INDICATOR_MAP } from './analysis-builder/analysis-builder.data';
import type { AnalisisState, ModoAlineacion, RawPoint } from './analysis-builder/analysis-builder.types';

interface AnalysisViewerProps {
  analysisId: string;
}

type LoadState = 'loading' | 'error' | 'ready';

interface TableRow {
  date: string;
  indicator: string;
  period: string;
  color: string;
  value: number;
  postId: string;
  sourceName: string;
}

const AnalysisViewer: FC<AnalysisViewerProps> = ({ analysisId }) => {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [state, setState] = useState<AnalisisState | null>(null);
  const [createdBy, setCreatedBy] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [rawData, setRawData] = useState<RawPoint[]>([]);
  const [macroEvents, setMacroEvents] = useState<MacroEvent[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [selectedMode, setSelectedMode] = useState<ModoAlineacion>('calendario');

  // Phase 1: parallel fetch — analysis state, creator metadata, auth session
  useEffect(() => {
    let cancelled = false;

    Promise.all([
      loadAnalysis(analysisId),
      supabase.from('analysis').select('created_by').eq('id', analysisId).single(),
      supabase.auth.getSession(),
    ]).then(([analysisResult, creatorRes, sessionRes]) => {
      if (cancelled) return;

      if ('error' in analysisResult) {
        setErrorMsg(analysisResult.error);
        setLoadState('error');
        return;
      }

      setState(analysisResult);

      if (!creatorRes.error && creatorRes.data) {
        setCreatedBy(creatorRes.data.created_by as string);
      }

      const user = sessionRes.data?.session?.user;
      if (user) setCurrentUserId(user.id);

      setLoadState('ready');
    });

    return () => { cancelled = true; };
  }, [analysisId]);

  useEffect(() => {
    if (!state) return;
    setSelectedMode(state.modoAlineacion);
  }, [state]);

  // Phase 2: fetch series data + macro events (depends on analysis state)
  useEffect(() => {
    if (!state) return;

    // Fetch all macro events so we can resolve the selected ones
    fetchMacroEvents().then(({ data, error }) => {
      if (!error && data) setMacroEvents(data as MacroEvent[]);
    });

    const activePeriods = state.periodos.filter(p => p.fechaInicio && p.fechaFin);
    if (state.indicadores.length === 0 || activePeriods.length === 0) return;

    const allDates = activePeriods.flatMap(p => [p.fechaInicio, p.fechaFin]).sort();
    const minDate = allDates[0];
    const maxDate = allDates[allDates.length - 1];

    let cancelled = false;
    setDataLoading(true);

    supabase
      .from('approved_series_view')
      .select('indicator_id, date, value, data_source, post_id')
      .in('indicator_id', state.indicadores)
      .gte('date', minDate)
      .lte('date', maxDate)
      .order('date', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) setRawData(data as RawPoint[]);
        setDataLoading(false);
      });

    return () => { cancelled = true; };
  }, [state]);

  // Derived values
  const selectedMacroEvents = useMemo(
    () => macroEvents.filter(ev => state?.macroEventIds.includes(ev.id)),
    [macroEvents, state],
  );

  const chartState = useMemo<AnalisisState | null>(() => {
    if (!state) return null;
    return {
      ...state,
      modoAlineacion: selectedMode,
    };
  }, [selectedMode, state]);

  const chartSeries = useMemo(() => {
    if (!chartState) return [];
    const base100Overlay = (chartState.showBase100Line ?? true)
      ? buildBase100OverlaySeries(rawData, chartState)
      : [];
    return [...buildChartSeries(rawData, chartState), ...base100Overlay];
  }, [chartState, rawData]);

  const chartMarkers = useMemo(() => {
    if (!chartState) return [];
    return buildMacroEventMarkers(
      selectedMacroEvents,
      chartState,
      chartState.markerModeByEventId ?? {},
      chartState.markerColorByEventId ?? {},
    );
  }, [chartState, selectedMacroEvents]);

  const tableRows = useMemo<TableRow[]>(() => {
    if (!state) return [];
    return state.periodos.flatMap(periodo =>
      state.indicadores.flatMap(indicId =>
        filterByPeriod(rawData, indicId, periodo, state.sourceSelections).map(d => ({
          date: d.date,
          indicator: INDICATOR_MAP.get(indicId) ?? indicId,
          period: periodo.nombre,
          color: periodo.color,
          value: d.value,
          postId: d.post_id ?? '',
          sourceName: d.data_source ?? 'Fuente',
        })),
      ),
    );
  }, [rawData, state]);

  const hasData = rawData.length > 0;
  const isAuthor = Boolean(currentUserId && createdBy && currentUserId === createdBy);

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (loadState === 'loading') {
    return (
      <div className="max-w-5xl mx-auto p-5 space-y-5">
        <div className="skeleton rounded-2xl h-40" />
        <div className="skeleton rounded-2xl" style={{ height: 420 }} />
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────────
  if (loadState === 'error' || !state) {
    return (
      <div className="max-w-5xl mx-auto p-5">
        <div className="bg-base-100 rounded-2xl border border-error/30 p-10 text-center space-y-2">
          <p className="font-semibold text-base-content/70">No se pudo cargar el análisis</p>
          <p className="text-sm text-base-content/50">{errorMsg || 'El análisis no existe o ocurrió un error inesperado.'}</p>
        </div>
      </div>
    );
  }

  const isConfigured = state.indicadores.length > 0 && state.periodos.some(p => p.fechaInicio && p.fechaFin);

  return (
    <div className="max-w-5xl mx-auto p-5 space-y-5">

      {/* ── Section 1: Header card ─────────────────────────────────────────── */}
      <section className="bg-base-100 rounded-2xl border border-base-200 p-5 lg:p-7">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <h1
              className="text-2xl lg:text-3xl font-bold leading-tight tracking-tight"
              style={{ textWrap: 'balance' } as React.CSSProperties}
            >
              {state.titulo || 'Análisis sin título'}
            </h1>

            {state.region && (
              <p className="mt-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-base-200 px-2.5 py-0.5 text-xs font-medium text-base-content/60">
                  {state.region}
                </span>
              </p>
            )}

            {state.descripcion && (
              <p className="mt-2 text-sm text-base-content/60 max-w-2xl leading-relaxed">
                {state.descripcion}
              </p>
            )}
          </div>

          {isAuthor && (
            <a
              href={withBase(`/analisis/editar?id=${analysisId}`)}
              className="btn btn-sm btn-outline shrink-0"
            >
              Editar
            </a>
          )}
        </div>

        {state.periodos.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {state.periodos.map(p => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                style={{
                  backgroundColor: `${p.color}1a`,
                  color: p.color,
                  border: `1px solid ${p.color}40`,
                }}
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: p.color }}
                  aria-hidden="true"
                />
                {p.nombre}
                {p.fechaInicio && p.fechaFin && (
                  <span className="opacity-60 font-normal">{p.fechaInicio} → {p.fechaFin}</span>
                )}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* ── Section 2: Chart card ──────────────────────────────────────────── */}
      <section aria-label="Gráfico comparativo" className="bg-base-100 rounded-2xl border border-base-200 p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-sm font-semibold text-base-content/60">Gráfico comparativo</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-base-content/60">Modo de alineación</span>
            <div className="join">
              <button
                type="button"
                className={`join-item btn btn-xs ${selectedMode === 'calendario' ? 'btn-primary' : 'btn-ghost border border-base-300'}`}
                onClick={() => setSelectedMode('calendario')}
                aria-pressed={selectedMode === 'calendario'}
              >
                Calendario
              </button>
              <button
                type="button"
                className={`join-item btn btn-xs ${selectedMode === 'indice_cero' ? 'btn-primary' : 'btn-ghost border border-base-300'}`}
                onClick={() => setSelectedMode('indice_cero')}
                aria-pressed={selectedMode === 'indice_cero'}
              >
                Índice 0
              </button>
            </div>
          </div>
        </div>

        {dataLoading ? (
          <div className="skeleton rounded-xl" style={{ height: 360 }} />
        ) : !isConfigured ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-base-content/30">
            <p className="text-sm text-center">
              Este análisis no tiene indicadores o períodos configurados.
            </p>
          </div>
        ) : !hasData ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-base-content/30">
            <p className="text-sm text-center">
              No se encontraron datos aprobados para esta combinación de indicadores y fechas.
            </p>
          </div>
        ) : (
          <AnalysisChart series={chartSeries} mode={selectedMode} markers={chartMarkers} />
        )}
      </section>

      {/* ── Section 3: Macro events table (read-only) ─────────────────────── */}
      {selectedMacroEvents.length > 0 && (
        <section aria-label="Tabla de eventos macro">
          <details className="bg-base-100 rounded-2xl border border-base-200 overflow-hidden group">
            <summary className="flex cursor-pointer select-none items-center justify-between px-5 py-4 hover:bg-base-200/40 transition-colors list-none">
              <span className="font-semibold text-sm">Eventos macro</span>
              <div className="flex items-center gap-2 text-xs text-base-content/40">
                <span className="badge badge-ghost badge-sm">{selectedMacroEvents.length} eventos</span>
                <svg
                  aria-hidden="true"
                  className="h-4 w-4 transition-transform duration-200 group-open:rotate-180"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </summary>

            <div className="border-t border-base-200 overflow-x-auto">
              <table className="table table-sm table-zebra w-full">
                <thead className="bg-base-200/70">
                  <tr>
                    <th>Color</th>
                    <th>Evento</th>
                    <th>Inicio</th>
                    <th>Fin</th>
                    <th>Tema</th>
                    <th>Región</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedMacroEvents.map((event, index) => {
                    const eventColor =
                      (state.markerColorByEventId ?? {})[event.id] ??
                      getDefaultMacroEventColor(event.id, index);
                    return (
                      <tr key={event.id}>
                        <td>
                          <span
                            className="inline-block h-4 w-4 rounded-full border border-base-300"
                            style={{ backgroundColor: eventColor }}
                            aria-label={`Color del evento: ${eventColor}`}
                          />
                        </td>
                        <td className="max-w-xs">
                          <p className="text-xs font-medium truncate" title={event.name}>
                            {event.name}
                          </p>
                        </td>
                        <td>
                          <span className="font-mono text-xs" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {event.start_date}
                          </span>
                        </td>
                        <td>
                          {event.end_date ? (
                            <span className="font-mono text-xs" style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {event.end_date}
                            </span>
                          ) : (
                            <span className="text-xs text-base-content/40">—</span>
                          )}
                        </td>
                        <td>
                          <span className="badge badge-ghost badge-xs capitalize">{event.topic}</span>
                        </td>
                        <td>
                          <span className="text-xs text-base-content/70">
                            {event.geo_region || event.geo_scope || 'Global'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </details>
        </section>
      )}

      {/* ── Section 4: Data table (collapsible) ───────────────────────────── */}
      {tableRows.length > 0 && (
        <section aria-label="Tabla de datos detallados">
          <details className="bg-base-100 rounded-2xl border border-base-200 overflow-hidden group">
            <summary className="flex cursor-pointer select-none items-center justify-between px-5 py-4 hover:bg-base-200/40 transition-colors list-none">
              <span className="font-semibold text-sm">Datos detallados</span>
              <div className="flex items-center gap-2 text-xs text-base-content/40">
                <span className="badge badge-ghost badge-sm">{tableRows.length} registros</span>
                <svg
                  aria-hidden="true"
                  className="h-4 w-4 transition-transform duration-200 group-open:rotate-180"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </summary>

            <div
              className="border-t border-base-200 overflow-x-auto overflow-y-auto"
              style={{ maxHeight: 400 }}
            >
              <table className="table table-sm table-zebra w-full">
                <thead className="sticky top-0 bg-base-200 z-10">
                  <tr>
                    <th></th>
                    <th>Período</th>
                    <th>Fecha</th>
                    <th>Indicador</th>
                    <th style={{ fontVariantNumeric: 'tabular-nums' }}>Valor</th>
                    <th>Fuente</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row, i) => (
                    <tr key={i}>
                      <td>
                        <span
                          className="inline-flex items-center gap-1.5 text-xs font-semibold"
                          style={{ color: row.color }}
                        >
                          <span
                            className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: row.color }}
                            aria-hidden="true"
                          />
                          {row.period}
                        </span>
                      </td>
                      <td>
                        <span className="font-mono text-xs">{row.date}</span>
                      </td>
                      <td className="max-w-xs">
                        <span className="text-xs truncate block" title={row.indicator}>
                          {row.indicator}
                        </span>
                      </td>
                      <td className="font-mono text-xs" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {fmt(row.value)}
                      </td>
                      <td>
                        {row.postId ? (
                          <a
                            href={withBase(`/post?id=${encodeURIComponent(row.postId)}`)}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-primary hover:bg-primary/10"
                          >
                            {row.sourceName}
                            <span aria-hidden="true">↗</span>
                          </a>
                        ) : (
                          <span className="text-xs text-base-content/40">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>
      )}

      {/* ── Empty state ────────────────────────────────────────────────────── */}
      {!isConfigured && !dataLoading && (
        <aside
          className="rounded-2xl border-2 border-dashed border-base-300 p-12 text-center text-base-content/30"
          aria-label="Análisis vacío"
        >
          <svg
            aria-hidden="true"
            className="mx-auto mb-3 h-10 w-10 opacity-40"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <p className="text-sm font-medium">Este análisis no contiene indicadores ni períodos configurados.</p>
        </aside>
      )}
    </div>
  );
};

export default AnalysisViewer;
