// filepath: src/components/AnalysisViewer.tsx
import { useState, useEffect, useMemo } from 'react';
import type { FC } from 'react';
import { supabase } from '../lib/supabase';
import { deleteDraftAnalysis, loadAnalysis } from '../lib/analysis';
import { loadSavedPoints } from '../lib/analysis-sources';
import { loadAnalysisValidity, sourceStatus } from '../lib/analysis-validity';
import type { AnalysisValidity } from '../lib/analysis-validity';
import { fetchMacroEvents } from '../lib/macro-events';
import type { MacroEvent } from '../lib/macro-events';
import { withBase } from '../lib/paths';
import { useAuthSession } from '../lib/use-auth-session';
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

type LoadState = 'loading' | 'error' | 'ready';

interface TableRow {
  date: string;
  indicator: string;
  period: string;
  color: string;
  value: number;
  postId: string;
  sourceName: string;
  status?: string;
}

const AnalysisViewer: FC = () => {

  const analysisId = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('id') ?? ''
    : '';

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [state, setState] = useState<AnalisisState | null>(null);
  const [createdBy, setCreatedBy] = useState<string | null>(null);
  const { user } = useAuthSession();
  const currentUserId = user?.id ?? null;
  const isAdmin = Array.isArray(user?.app_metadata?.role) && user.app_metadata.role.includes('admin');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [rawData, setRawData] = useState<RawPoint[]>([]);
  const [macroEvents, setMacroEvents] = useState<MacroEvent[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState('');
  const [eventError, setEventError] = useState('');
  const [validity, setValidity] = useState<AnalysisValidity | null>(null);
  const [versions, setVersions] = useState<{ id: string; title: string }[]>([]);
  const [previousVersion, setPreviousVersion] = useState<string | null>(null);
  const [versionError, setVersionError] = useState('');
  const [creatingVersion, setCreatingVersion] = useState(false);
  const [changingVisibility, setChangingVisibility] = useState(false);
  const [visibilityError, setVisibilityError] = useState('');
  const [selectedMode, setSelectedMode] = useState<ModoAlineacion>('calendario');

  // Phase 1: parallel fetch — analysis state and creator metadata
  useEffect(() => {
    let cancelled = false;
    supabase.from('analysis').select('id, title').eq('previous_version_id', analysisId).then(({ data, error }) => {
      if (!cancelled) { if (error) setVersionError('No se pudieron cargar las versiones vinculadas.'); else setVersions(data ?? []); }
    });
    supabase.from('analysis').select('previous_version_id').eq('id', analysisId).single().then(({ data, error }) => {
      if (!cancelled) { if (error) setVersionError('No se pudieron cargar las versiones vinculadas.'); else setPreviousVersion(data.previous_version_id); }
    });
    loadAnalysisValidity([analysisId]).then(result => {
      if (!cancelled) setValidity(result[analysisId]);
    }).catch(() => {
      if (!cancelled) setValidity({ sources: [], events: [], history: [], unknown: true });
    });

    Promise.all([
      loadAnalysis(analysisId),
      supabase.from('analysis').select('created_by').eq('id', analysisId).single(),
    ]).then(([analysisResult, creatorRes]) => {
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

      setLoadState('ready');
    });

    return () => { cancelled = true; };
  }, [analysisId]);

  async function handleCreateVersion() {
    setCreatingVersion(true);
    setVersionError('');
    const { data, error } = await supabase.rpc('create_analysis_version', { p_id: analysisId });
    if (error || !data) { setVersionError('No se pudo crear la nueva versión.'); setCreatingVersion(false); return; }
    window.location.href = withBase(`/analisis/editar?id=${data}`);
  }

  async function handleDelete() {
    if (!window.confirm('¿Eliminar este borrador? Esta acción no se puede deshacer.')) return;
    setDeleting(true);
    setDeleteError('');
    const result = await deleteDraftAnalysis(analysisId);
    if ('error' in result) {
      setDeleteError(result.error);
      setDeleting(false);
      return;
    }
    window.location.href = withBase(`/user/analisis?userId=${currentUserId}`);
  }

  async function handleVisibilityChange() {
    if (!state || (state.status !== 'public' && state.status !== 'hidden')) return;
    const status = state.status === 'public' ? 'hidden' : 'public';
    setChangingVisibility(true);
    setVisibilityError('');
    const { data, error } = await supabase.from('analysis').update({ status })
      .eq('id', analysisId).select('id').maybeSingle();
    if (error || !data) setVisibilityError('No se pudo cambiar la visibilidad del análisis.');
    else setState(current => current ? { ...current, status } : current);
    setChangingVisibility(false);
  }

  useEffect(() => {
    if (!state) return;
    setSelectedMode(state.modoAlineacion);
  }, [state]);

  // Phase 2: fetch series data + macro events (depends on analysis state)
  useEffect(() => {
    if (!state) return;

    let cancelled = false;
    if (state.macroEventIds.length) {
      fetchMacroEvents().then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) setEventError('No se pudieron cargar los eventos originales. Su estado es desconocido.');
        else {
          setMacroEvents(data);
          if (state.macroEventIds.some(id => !data.some(event => event.id === id)))
            setEventError('No se pudieron recuperar algunos eventos originales. Su estado es desconocido.');
        }
      }).catch(() => {
        if (!cancelled) setEventError('No se pudieron cargar los eventos originales. Su estado es desconocido.');
      });
    }
    setDataLoading(true);
    loadSavedPoints(state.sourceSelections ?? {}).then(({ data, error }) => {
      if (cancelled) return;
      setRawData(data);
      setDataError(error ?? '');
      setDataLoading(false);
    }).catch(() => {
      if (!cancelled) { setDataError('No se pudieron cargar las fuentes originales. Su estado es desconocido.'); setDataLoading(false); }
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
          status: d.status,
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

            {validity && (validity.sources.length > 0 || validity.events.length > 0) && (
              <div className="alert alert-warning mt-3 block" role="alert">
                <div className="flex items-center gap-2 font-semibold">
                  <span aria-hidden="true">⚠</span>
                  <span>Este análisis contiene fuentes o eventos invalidados.</span>
                </div>
                <p className="mt-1 text-sm">Sus conclusiones pueden basarse en información invalidada.</p>
                <ul className="mt-2 list-disc space-y-2 pl-5 text-sm">
                  {validity.sources.map(source => (
                    <li key={source.id}>
                      <strong>{INDICATOR_MAP.get(source.indicator_id) ?? source.indicator_id}</strong> — {source.data_source} (ID: {source.id})
                      <br />Estado: {sourceStatus(source.status)}. Motivo: {validity.history.find(item => item.record_type === 'series' && item.record_id === source.id && item.new_status === source.status)?.reason ?? 'no disponible'}. Fecha del cambio: {validity.history.find(item => item.record_type === 'series' && item.record_id === source.id && item.new_status === source.status)?.changed_at ? new Date(validity.history.find(item => item.record_type === 'series' && item.record_id === source.id && item.new_status === source.status)!.changed_at).toLocaleString('es-CL') : 'no disponible'}.
                    </li>
                  ))}
                  {validity.events.map(event => <li key={event.id}><strong>Evento: {event.name}</strong> — Invalidado. Motivo: {validity.history.find(item => item.record_type === 'event' && item.record_id === event.id && item.new_status === event.status)?.reason ?? 'no disponible'}. Fecha del cambio: {validity.history.find(item => item.record_type === 'event' && item.record_id === event.id && item.new_status === event.status)?.changed_at ? new Date(validity.history.find(item => item.record_type === 'event' && item.record_id === event.id && item.new_status === event.status)!.changed_at).toLocaleString('es-CL') : 'no disponible'}.</li>)}
                </ul>
                <details className="mt-3"><summary className="cursor-pointer font-medium">Consultar historial de cambios</summary>
                  {validity.history.length ? <ul className="mt-2 list-disc pl-5 text-sm">{validity.history.map(item => <li key={item.id}>{item.record_type === 'event' ? 'Evento' : 'Serie'} {item.record_id}: {sourceStatus(item.old_status)} → {sourceStatus(item.new_status)}; {new Date(item.changed_at).toLocaleString('es-CL')}; responsable: {item.changed_by}; motivo: {item.reason ?? 'no indicado'}.</li>)}</ul> : <p className="text-sm">No hay cambios registrados.</p>}
                </details>
              </div>
            )}
            {validity?.referencesUnverified && <p className="alert alert-warning mt-3" role="alert"><span aria-hidden="true">⚠</span> No se puede confirmar que este análisis conserve todas sus referencias originales. Solo se muestran los registros guardados; no se han reconstruido datos con el catálogo actual.</p>}
            {validity?.unknown && <p className="alert alert-error mt-3" role="alert">No se pudo comprobar la validez de algunas fuentes. Su estado es desconocido.</p>}

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

          <div className="flex flex-wrap gap-2">
          {isAuthor && (state.status === 'public' || state.status === 'hidden') && (
            <button type="button" className="btn btn-sm btn-outline" disabled={changingVisibility} onClick={handleVisibilityChange}>
              {changingVisibility ? 'Guardando…' : state.status === 'public' ? 'Ocultar análisis' : 'Hacer público'}
            </button>
          )}
          {isAuthor && (state.status === 'public' || state.status === 'hidden') && (
            <button type="button" className="btn btn-sm btn-primary" disabled={creatingVersion} onClick={handleCreateVersion}>{creatingVersion ? 'Creando…' : 'Crear nueva versión'}</button>
          )}
          {isAuthor && state.status === 'draft' && (
            <a
              href={withBase(`/analisis/editar?id=${analysisId}`)}
              className="btn btn-sm btn-outline shrink-0"
            >
              Editar
            </a>
          )}
          {state.status === 'draft' && (isAuthor || isAdmin) && (
            <button type="button" className="btn btn-sm btn-error btn-outline" disabled={deleting} onClick={handleDelete}>
              {deleting ? 'Eliminando…' : 'Eliminar borrador'}
            </button>
          )}
          </div>
        </div>
        {(previousVersion || versions.length > 0) && <nav aria-label="Versiones del análisis" className="mt-4 flex flex-wrap gap-3 text-sm">
          {previousVersion && <a className="link link-primary" href={withBase(`/analisis?id=${previousVersion}`)}>← Versión anterior</a>}
          {versions.map(version => <a key={version.id} className="link link-primary" href={withBase(`/analisis?id=${version.id}`)}>Versión posterior: {version.title} →</a>)}
        </nav>}
        {versionError && <p className="mt-2 text-sm text-error" role="alert">{versionError}</p>}
        {visibilityError && <p className="mt-2 text-sm text-error" role="alert">{visibilityError}</p>}
        {deleteError && <p className="mt-2 text-sm text-error" role="alert">{deleteError}</p>}

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

        {dataError && <p role="alert" className="alert alert-error mb-4">{dataError}</p>}
        {eventError && <p role="alert" className="alert alert-error mb-4">{eventError}</p>}
        {rawData.some(point => point.status !== 'approved') && <p className="text-sm text-warning mb-3">Los rombos identifican datos cuya fuente ya no está aprobada.</p>}
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
              No se encontraron datos originales para esta combinación de indicadores y fechas.
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
                          {event.status === 'invalid' && <span className="badge badge-warning badge-xs">⚠ Invalidado</span>}
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
                    <th>Período</th>
                    <th>Fecha</th>
                    <th>Indicador</th>
                    <th style={{ fontVariantNumeric: 'tabular-nums' }}>Valor</th>
                    <th>Fuente</th>
                    <th>Estado</th>
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
                      <td>{row.status && row.status !== 'approved' ? <span className="badge badge-warning">Sin aprobación ({row.status === 'disabled' ? 'deshabilitada' : row.status === 'rejected' ? 'rechazada' : 'pendiente'})</span> : 'Aprobada'}</td>
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
