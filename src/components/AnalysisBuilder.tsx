import { useState, useEffect, useReducer, useCallback } from 'react';
import type { FC } from 'react';
import { supabase } from '../lib/supabase';
import { withBase } from '../lib/paths';

import type { RawPoint, AnalisisState } from './analysis-builder/analysis-builder.types';
import { ANALISIS_DRAFT_KEY, TRANSFORMACIONES } from './analysis-builder/analysis-builder.types';
import {
  makeInitialState,
  sanitizeState,
  reducer,
  isPercent,
  fmt,
  findSourceConflicts,
  filterByPeriod,
  buildKPIRows,
  buildChartSeries,
} from './analysis-builder/analysis-builder.utils';

import { INDICATOR_MAP } from './analysis-builder/analysis-builder.data';
import SidebarSection from './analysis-builder/SidebarSection';
import IndicatorSelector from './analysis-builder/IndicatorSelector';
import PeriodRow from './analysis-builder/PeriodRow';
import KPICard from './analysis-builder/KPICard';
import AnalysisChart from './analysis-builder/AnalysisChart';
import SourceConflictResolver from './analysis-builder/SourceConflictResolver';

const AnalysisBuilder: FC = () => {
  const [state, dispatch] = useReducer(reducer, undefined, makeInitialState);
  const [rawData, setRawData] = useState<RawPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isDraftReady, setIsDraftReady] = useState(false);

  useEffect(() => {
    let restored: AnalisisState | null = null;

    const encoded = new URLSearchParams(window.location.search).get('s');
    try {
      if (encoded) {
        const decoded = JSON.parse(atob(encoded));
        restored = sanitizeState(decoded);
      } else {
        const localRaw = window.localStorage.getItem(ANALISIS_DRAFT_KEY);
        if (localRaw) {
          restored = sanitizeState(JSON.parse(localRaw));
        }
      }
    } catch {
      // Ignore malformed state and continue with initial state.
    }

    if (restored) {
      dispatch({ type: 'LOAD_STATE', payload: restored });
    }

    setIsDraftReady(true);
  }, []);

  useEffect(() => {
    if (!isDraftReady) return;
    try {
      window.localStorage.setItem(ANALISIS_DRAFT_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage errors (quota/private mode).
    }
  }, [state, isDraftReady]);

  useEffect(() => {
    const { indicadores, periodos } = state;
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
  }, [JSON.stringify(state.indicadores), JSON.stringify(state.periodos.map(p => ({ i: p.fechaInicio, f: p.fechaFin })))]);

  const handleShare = useCallback(() => {
    const encoded = btoa(JSON.stringify(state));
    const url = `${window.location.origin}${window.location.pathname}?s=${encoded}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }, [state]);

  const pct = isPercent(state.transformacion);
  const sourceConflicts = findSourceConflicts(rawData);
  const chartSeries = buildChartSeries(rawData, state);
  const kpiRows = buildKPIRows(rawData, state);
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

  return (
    <div className="flex bg-base-200/20" style={{ height: 'calc(100svh - 7rem)', overflow: 'hidden' }}>
      <aside
        aria-label="Panel de configuración del escenario"
        className="w-72 lg:w-80 shrink-0 flex flex-col border-r border-base-200 bg-base-100 overflow-y-auto overscroll-contain"
      >
        <div className="sticky top-0 z-10 bg-base-100 border-b border-base-200 px-4 py-3.5 shrink-0">
          <h2 className="text-xs font-bold uppercase tracking-widest text-base-content/40">Constructor de Escenarios</h2>
        </div>

        <SidebarSection title="Contexto">
          <div>
            <label htmlFor="sb-titulo" className="label py-0 pb-1">
              <span className="label-text text-xs font-medium">Título del análisis</span>
            </label>
            <input
              id="sb-titulo"
              type="text"
              className="input input-sm w-full"
              placeholder="Ej. Comparativa inflación 2010-2020…"
              value={state.titulo}
              onChange={e => dispatch({ type: 'SET_TITULO', value: e.target.value })}
              maxLength={120}
              autoComplete="off"
            />
          </div>
          <div>
            <label htmlFor="sb-descripcion" className="label py-0 pb-1">
              <span className="label-text text-xs font-medium">Notas / hipótesis</span>
            </label>
            <textarea
              id="sb-descripcion"
              className="textarea textarea-sm w-full resize-none"
              placeholder="Contexto, hipótesis, fuentes adicionales…"
              rows={3}
              value={state.descripcion}
              onChange={e => dispatch({ type: 'SET_DESCRIPCION', value: e.target.value })}
              maxLength={500}
            />
          </div>
        </SidebarSection>

        <SidebarSection title="Datos">
          <div>
            <p className="label py-0 pb-1">
              <span className="label-text text-xs font-medium">
                Indicadores <span className="text-base-content/40 font-normal">({state.indicadores.length}/5)</span>
              </span>
            </p>
            <IndicatorSelector selected={state.indicadores} onToggle={id => dispatch({ type: 'TOGGLE_INDICATOR', id })} />
          </div>
          <div>
            <label htmlFor="sb-region" className="label py-0 pb-1">
              <span className="label-text text-xs font-medium">País / Región</span>
            </label>
            <input
              id="sb-region"
              type="text"
              className="input input-sm w-full"
              placeholder="Chile"
              value={state.region}
              onChange={e => dispatch({ type: 'SET_REGION', value: e.target.value })}
              maxLength={80}
              autoComplete="off"
            />
          </div>
        </SidebarSection>

        <SidebarSection title="Períodos">
          <div aria-live="polite" aria-label="Lista de períodos de análisis" className="space-y-3">
            {state.periodos.map(periodo => (
              <PeriodRow
                key={periodo.id}
                periodo={periodo}
                canRemove={state.periodos.length > 1}
                onChange={(field, value) => dispatch({ type: 'UPDATE_PERIODO', id: periodo.id, field, value })}
                onRemove={() => dispatch({ type: 'REMOVE_PERIODO', id: periodo.id })}
              />
            ))}
          </div>
          {state.periodos.length < 6 ? (
            <button
              type="button"
              className="btn btn-sm btn-outline btn-primary w-full"
              onClick={() => dispatch({ type: 'ADD_PERIODO' })}
            >+ Añadir período</button>
          ) : (
            <p className="text-xs text-base-content/40 text-center">Máximo 6 períodos</p>
          )}
        </SidebarSection>

        <SidebarSection title="Matemática">
          <div>
            <p className="label py-0 pb-1.5">
              <span className="label-text text-xs font-medium">Modo de alineación</span>
            </p>
            <div className="join w-full">
              <button
                type="button"
                className={`join-item btn btn-sm flex-1 ${state.modoAlineacion === 'calendario' ? 'btn-primary' : 'btn-ghost border border-base-300'}`}
                onClick={() => dispatch({ type: 'SET_MODO', value: 'calendario' })}
              >Calendario</button>
              <button
                type="button"
                className={`join-item btn btn-sm flex-1 ${state.modoAlineacion === 'indice_cero' ? 'btn-primary' : 'btn-ghost border border-base-300'}`}
                onClick={() => dispatch({ type: 'SET_MODO', value: 'indice_cero' })}
              >Índice 0</button>
            </div>
            <p className="text-xs text-base-content/40 mt-2 leading-relaxed">
              {state.modoAlineacion === 'calendario'
                ? 'Muestra todos los períodos con fechas reales en el eje X.'
                : 'Alinea el inicio de cada período al mes 0 para comparar ritmos, sin importar cuándo ocurrieron.'}
            </p>
          </div>
        </SidebarSection>

        <div className="px-4 pb-4 pt-2">
          <button
            type="button"
            className="btn btn-sm btn-outline btn-error w-full"
            onClick={() => {
              if (window.confirm('¿Estás seguro de que quieres reiniciar el formulario? Se perderán los cambios no guardados.')) {
                dispatch({ type: 'LOAD_STATE', payload: makeInitialState() });
                setRawData([]);
                try {
                  window.localStorage.removeItem(ANALISIS_DRAFT_KEY);
                } catch {
                  // Ignore storage errors.
                }
              }
            }}
          >
            Reiniciar formulario
          </button>
        </div>
      </aside>

      <main aria-label="Lienzo de resultados del análisis" className="flex-1 overflow-y-auto overscroll-contain min-w-0">
        <div className="max-w-5xl mx-auto p-5 space-y-5">
          <section className="bg-base-100 rounded-2xl border border-base-200 p-5 lg:p-7">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl lg:text-3xl font-bold leading-tight tracking-tight" style={{ textWrap: 'balance' } as React.CSSProperties}>{displayTitle}</h1>
                {(periodsSummary || state.region) && (
                  <p className="mt-1.5 text-base-content/50 text-sm">{periodsSummary} {state.region && <span>· {state.region}</span>}</p>
                )}
                {state.descripcion && (<p className="mt-2 text-sm text-base-content/60 max-w-2xl leading-relaxed">{state.descripcion}</p>)}
              </div>
              <button
                type="button"
                className="btn btn-sm btn-outline shrink-0"
                onClick={handleShare}
                aria-label="Copiar enlace compartible de este análisis"
              >{copied ? '✓ Copiado' : '⤴ Compartir URL'}</button>
            </div>
            {state.periodos.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {state.periodos.map(p => (
                  <span key={p.id} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: `${p.color}1a`, color: p.color, border: `1px solid ${p.color}40` }}>
                    <span className="inline-block h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} aria-hidden="true" />
                    {p.nombre}
                    {p.fechaInicio && p.fechaFin && (<span className="opacity-60 font-normal">{p.fechaInicio} → {p.fechaFin}</span>)}
                  </span>
                ))}
              </div>
            )}
          </section>

          {hasData && sourceConflicts.length > 0 && (
            <SourceConflictResolver
              conflicts={sourceConflicts}
              selections={state.sourceSelections ?? {}}
              onSelectSource={(key, sourceId) => dispatch({ type: 'SET_SOURCE_SELECTION', key, value: sourceId })}
            />
          )}

          {state.indicadores.length > 0 && (
            <section aria-label="Tarjetas de indicadores clave">
              {loading ? (
                <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
                  {Array.from({ length: state.indicadores.length * state.periodos.length }).map((_, i) => (
                    <div key={i} className="skeleton h-28 rounded-box" />
                  ))}
                </div>
              ) : (
                <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
                  {kpiRows.flatMap(row => row.cells.map(cell => (
                    <KPICard
                      key={`${row.indicadorId}-${cell.periodId}`}
                      label={row.label}
                      periodNombre={cell.periodNombre}
                      periodColor={cell.periodColor}
                      valor={cell.valor}
                      delta={cell.delta}
                      pct={pct}
                    />
                  )))}
                </div>
              )}
            </section>
          )}

          <section aria-label="Gráfico comparativo" className="bg-base-100 rounded-2xl border border-base-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-base-content/60">Gráfico comparativo</h2>
              {state.transformacion !== 'nominal' && (
                <span className="badge badge-ghost badge-sm text-xs">
                  {TRANSFORMACIONES.find(o => o.value === state.transformacion)?.label}
                </span>
              )}
            </div>
            {!isConfigured ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-base-content/25">
                <svg aria-hidden="true" className="h-14 w-14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p className="text-sm text-center max-w-xs">Selecciona al menos un indicador y define las fechas de inicio y fin de un período para ver el gráfico.</p>
              </div>
            ) : loading ? (
              <div className="skeleton rounded-xl" style={{ height: 360 }} />
            ) : !hasData ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-base-content/30">
                <p className="text-sm text-center">No se encontraron datos aprobados para esta combinación de indicadores y fechas.</p>
              </div>
            ) : (
              <AnalysisChart series={chartSeries} mode={state.modoAlineacion} />
            )}
          </section>

          {tableRows.length > 0 && (
            <section aria-label="Tabla de datos detallados">
              <details className="bg-base-100 rounded-2xl border border-base-200 overflow-hidden group">
                <summary className="flex cursor-pointer select-none items-center justify-between px-5 py-4 hover:bg-base-200/40 transition-colors list-none">
                  <span className="font-semibold text-sm">Datos detallados</span>
                  <div className="flex items-center gap-2 text-xs text-base-content/40">
                    <span className="badge badge-ghost badge-sm">{tableRows.length} registros</span>
                    <svg aria-hidden="true" className="h-4 w-4 transition-transform duration-200 group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </summary>
                <div className="border-t border-base-200 overflow-x-auto overflow-y-auto" style={{ maxHeight: 400 }}>
                  <table className="table table-sm table-zebra w-full">
                    <thead className="sticky top-0 bg-base-200 z-10">
                      <tr>
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
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: row.color }}>
                              <span className="inline-block h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: row.color }} aria-hidden="true" />
                              {row.period}
                            </span>
                          </td>
                          <td><span className="font-mono text-xs">{row.date}</span></td>
                          <td className="max-w-xs"><span className="text-xs truncate block" title={row.indicator}>{row.indicator}</span></td>
                          <td className="font-mono text-xs" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(row.value, pct)}</td>
                          <td className="">
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

          {!state.titulo && state.indicadores.length === 0 && (
            <aside className="rounded-2xl border-2 border-dashed border-base-300 p-12 text-center text-base-content/30" aria-label="Estado inicial">
              <svg aria-hidden="true" className="mx-auto mb-3 h-10 w-10 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <p className="text-sm font-medium">Comienza configurando el título y seleccionando indicadores en el panel de la izquierda.</p>
              <p className="text-xs mt-1 opacity-70">Los resultados se actualizarán automáticamente.</p>
            </aside>
          )}
        </div>
      </main>
    </div>
  );
};

export default AnalysisBuilder;
