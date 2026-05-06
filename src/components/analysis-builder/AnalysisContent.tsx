import { useCallback, useEffect, useRef, useState } from 'react';
import type { FC } from 'react';
import { withBase } from '../../lib/paths';
import type { MacroEvent } from '../../lib/macro-events';
import type { AnalisisState, HCSeriesData, HCEventMarker, SourceConflict } from './analysis-builder.types';
import type { MacroMarkerMode } from './use-analisis-state';
import { fmt, getDefaultMacroEventColor } from './analysis-builder.utils';
import AnalysisChart from './AnalysisChart';
import SourceConflictResolver from './SourceConflictResolver';
import { supabase } from '../../lib/supabase';
import type { Analysis } from '../../types/database';

interface TableRow {
  date: string;
  indicator: string;
  period: string;
  color: string;
  value: number;
  postId: string;
  sourceName: string;
}

interface AnalysisContentProps {
  analysisId?: string;
  state: AnalisisState;
  loading: boolean;
  sourceConflicts: SourceConflict[];
  chartSeries: HCSeriesData[];
  selectedMacroEvents: MacroEvent[];
  chartMarkers: HCEventMarker[];
  // kpiRows: KPIRow[];
  hasData: boolean;
  isConfigured: boolean;
  displayTitle: string;
  periodsSummary: string;
  tableRows: TableRow[];
  onSetStatus: React.Dispatch<React.SetStateAction<Analysis['status']>>;
  onSelectSource: (key: string, sourceId: string) => void;
  markerModeByEventId: Record<string, MacroMarkerMode>;
  setMarkerModeByEventId: React.Dispatch<React.SetStateAction<Record<string, MacroMarkerMode>>>;
  markerColorByEventId: Record<string, string>;
  setMarkerColorByEventId: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

const AnalysisContent: FC<AnalysisContentProps> = ({
  analysisId,
  state,
  loading,
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
  onSetStatus,
  onSelectSource,
  markerModeByEventId,
  setMarkerModeByEventId,
  markerColorByEventId,
  setMarkerColorByEventId,
}) => {
  const [pendingMarkerColorByEventId, setPendingMarkerColorByEventId] = useState<Record<string, string>>({});
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const handleColorInputChange = useCallback((eventId: string, value: string) => {
    setPendingMarkerColorByEventId(prev => ({ ...prev, [eventId]: value }));
    if (debounceTimers.current[eventId]) clearTimeout(debounceTimers.current[eventId]);
    debounceTimers.current[eventId] = setTimeout(() => {
      setMarkerColorByEventId(prev => ({ ...prev, [eventId]: value }));
      delete debounceTimers.current[eventId];
    }, 180);
  }, [setMarkerColorByEventId]);

  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach(timer => clearTimeout(timer));
    };
  }, []);

  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  // Track last saved status to enable button only if changed
  const [lastSavedStatus, setLastSavedStatus] = useState(state.status);

  // Keep lastSavedStatus in sync with state.status if analysisId or state.status changes (e.g. on load)
  useEffect(() => {
    setLastSavedStatus(state.status);
  }, [analysisId]);

  // Opciones válidas de status
  const statusOptions: Analysis['status'][] = ['draft', 'public', 'hidden' ];

  // Actualiza el status en la base de datos
  const handleStatusChange = async () => {
    setStatusLoading(true);
    setStatusError(null);
    try {
      if (!analysisId) {
        setStatusError('ID de análisis no disponible.');
        setStatusLoading(false);
        return;
      }
      const { error } = await supabase.from('analysis').update({ status: state.status }).eq('id', analysisId);
      if (error) {
        setStatusError(error.message);
      } else {
        setLastSavedStatus(state.status);
      }
    } catch (err: any) {
      setStatusError(err.message || 'Error desconocido');
    } finally {
      setStatusLoading(false);
    }
  };

  return (
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
            <div className="flex flex-col gap-2 items-end">
              <div className="flex items-center gap-2 mt-2">
                <select
                  className="select select-sm select-bordered"
                  value={state.status}
                  onChange={e => onSetStatus(e.target.value as Analysis['status'])}
                  aria-label="Cambiar estado del análisis"
                  disabled={statusLoading}
                >
                  {statusOptions.map(opt => (
                    <option key={opt} value={opt}>{
                      opt === 'draft' ? 'Borrador' :
                      opt === 'public' ? 'Publico' :
                      opt === 'hidden' ? 'Oculto' : opt
                    }</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={handleStatusChange}
                  disabled={statusLoading || state.status === lastSavedStatus}
                >
                  {statusLoading ? 'Guardando...' : 'Confirmar'}
                </button>
              </div>
              {statusError && <span className="text-error text-xs mt-1">{statusError}</span>}
            </div>
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
          onSelectSource={onSelectSource}
        />
      )}

      <section aria-label="Gráfico comparativo" className="bg-base-100 rounded-2xl border border-base-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-base-content/60">Gráfico comparativo</h2>
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
          <AnalysisChart series={chartSeries} mode={state.modoAlineacion} markers={chartMarkers} />
        )}
      </section>

      {selectedMacroEvents.length > 0 && (
        <section aria-label="Tabla de eventos macro seleccionados" className="bg-base-100 rounded-2xl border border-base-200 p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <h2 className="text-sm font-semibold text-base-content/60">Eventos macro seleccionados</h2>
            <p className="text-xs text-base-content/50">Control individual de líneas por evento</p>
          </div>

          <div className="overflow-x-auto border border-base-200 rounded-xl">
            <table className="table table-sm table-zebra w-full">
              <thead className="bg-base-200/70">
                <tr>
                  <th>Color</th>
                  <th>Evento</th>
                  <th>Inicio</th>
                  <th>Fin</th>
                  <th>Mostrar</th>
                  <th>Tema</th>
                  <th>Región</th>
                </tr>
              </thead>
              <tbody>
                {selectedMacroEvents.map((event, index) => {
                  const hasDistinctEnd = Boolean(event.end_date && event.end_date !== event.start_date);
                  const rawMarkerMode = markerModeByEventId[event.id] ?? (hasDistinctEnd ? 'both' : 'start');
                  const markerMode = !hasDistinctEnd && (rawMarkerMode === 'end' || rawMarkerMode === 'both')
                    ? 'start'
                    : rawMarkerMode;
                  const eventColor = markerColorByEventId[event.id] ?? getDefaultMacroEventColor(event.id, index);

                  return (
                    <tr key={event.id}>
                      <td>
                        <label htmlFor={`event-color-${event.id}`} className="sr-only">
                          Elegir color para {event.name}
                        </label>
                        <input
                          id={`event-color-${event.id}`}
                          name={`event-color-${event.id}`}
                          type="color"
                          value={pendingMarkerColorByEventId[event.id] ?? eventColor}
                          onChange={e => handleColorInputChange(event.id, e.target.value)}
                          className="h-8 w-10 cursor-pointer rounded border border-base-300 bg-transparent p-1"
                          aria-label={`Elegir color para ${event.name}`}
                        />
                      </td>
                      <td className="max-w-xs">
                        <p className="text-xs font-medium truncate" title={event.name}>{event.name}</p>
                      </td>
                      <td><span className="font-mono text-xs" style={{ fontVariantNumeric: 'tabular-nums' }}>{event.start_date}</span></td>
                      <td>
                        {event.end_date ? (
                          <span className="font-mono text-xs" style={{ fontVariantNumeric: 'tabular-nums' }}>{event.end_date}</span>
                        ) : (
                          <span className="text-xs text-base-content/40">—</span>
                        )}
                      </td>
                      <td>
                        <label htmlFor={`event-line-mode-${event.id}`} className="sr-only">
                          Mostrar líneas para {event.name}
                        </label>
                        <select
                          id={`event-line-mode-${event.id}`}
                          name={`event-line-mode-${event.id}`}
                          className="select select-bordered select-xs w-full min-w-32"
                          value={markerMode}
                          onChange={e => setMarkerModeByEventId(prev => ({
                            ...prev,
                            [event.id]: e.target.value as MacroMarkerMode,
                          }))}
                          aria-label={`Seleccionar líneas visibles para ${event.name}`}
                        >
                          {hasDistinctEnd && <option value="both">Inicio y fin</option>}
                          <option value="start">Solo inicio</option>
                          {hasDistinctEnd && <option value="end">Solo fin</option>}
                          <option value="none">No mostrar</option>
                        </select>
                      </td>
                      <td><span className="badge badge-ghost badge-xs capitalize">{event.topic}</span></td>
                      <td><span className="text-xs text-base-content/70">{event.geo_region || event.geo_scope || 'Global'}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

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
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: row.color }}>
                          <span className="inline-block h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: row.color }} aria-hidden="true" />
                          {row.period}
                        </span>
                      </td>
                      <td><span className="font-mono text-xs">{row.date}</span></td>
                      <td className="max-w-xs"><span className="text-xs truncate block" title={row.indicator}>{row.indicator}</span></td>
                      <td className="font-mono text-xs" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(row.value)}</td>
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
  )
};

export default AnalysisContent;
