// filepath: src/components/AnalysisViewer.tsx
import { useState, useEffect, useMemo } from 'react';
import type { FC } from 'react';
import { supabase } from '../lib/supabase';
import type { Analysis } from '../lib/supabase';
import { deleteDraftAnalysis, loadAnalysis } from '../lib/analysis';
import { loadSavedPoints } from '../lib/analysis-sources';
import { loadAnalysisValidity, sourceStatus } from '../lib/analysis-validity';
import type { AnalysisValidity } from '../lib/analysis-validity';
import { fetchMacroEvents } from '../lib/macro-events';
import type { MacroEvent } from '../lib/macro-events';
import { withBase } from '../lib/paths';
import { useAuthSession } from '../lib/use-auth-session';
import AnalysisContainer from './analysis/AnalysisContainer';
import AnalysisSources from './analysis/AnalysisSources';
import {
  buildDataRows,
  fmt,
  getDefaultMacroEventColor,
} from './analysis-builder/analysis-builder.utils';
import { INDICATOR_MAP } from './analysis-builder/analysis-builder.data';
import type { AnalisisState, ModoAlineacion, RawPoint } from './analysis-builder/analysis-builder.types';

type LoadState = 'loading' | 'error' | 'ready';
type Version = Pick<Analysis, 'id' | 'title' | 'status'>;
type PreviousVersion = Pick<Version, 'id' | 'title'>;

function publicationStatus(status: string): string {
  return ({ public: 'Público', hidden: 'Oculto', draft: 'Borrador' } as Record<string, string>)[status] ?? 'Desconocido';
}

function versionValidity(value?: AnalysisValidity): string {
  if (!value) return 'Desconocida';
  if (value.sources.length || value.events.length) return value.unknown ? 'Inválida; comprobación incompleta' : 'Inválida';
  return value.unknown || value.referencesUnverified ? 'Desconocida' : 'Válida';
}

interface TableRow {
  date: string;
  indicator: string;
  period: string;
  color: string;
  value: number;
  postId: string;
  sourceName: string;
  status: string;
}

function changeDate(value?: string | null): string {
  if (!value) return 'No disponible';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'No disponible' : date.toLocaleString('es-CL');
}

function changeReason(value?: string | null): string {
  return value?.trim() || 'No disponible';
}

function historyStatus(value: string): string {
  const translated = sourceStatus(value);
  return translated === value ? 'Estado no disponible' : translated;
}

function sourceName(source: AnalysisValidity['sources'][number]): string {
  const indicator = INDICATOR_MAP.get(source.indicator_id) || 'Indicador no disponible';
  return `${indicator} — ${source.data_source?.trim() || 'Fuente no disponible'}`;
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
  const [versions, setVersions] = useState<Version[]>([]);
  const [previousVersion, setPreviousVersion] = useState<PreviousVersion | null>(null);
  const [previousUnavailable, setPreviousUnavailable] = useState(false);
  const [versionsLoading, setVersionsLoading] = useState(true);
  const [versionValidities, setVersionValidities] = useState<Record<string, AnalysisValidity>>({});
  const [versionError, setVersionError] = useState('');
  const [creatingVersion, setCreatingVersion] = useState(false);
  const [changingVisibility, setChangingVisibility] = useState(false);
  const [visibilityError, setVisibilityError] = useState('');
  const [selectedIndicator, setSelectedIndicator] = useState<string | undefined>();
  const [selectedMode, setSelectedMode] = useState<ModoAlineacion>('calendario');

  // Phase 1: parallel fetch — analysis state and creator metadata
  useEffect(() => {
    let cancelled = false;
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
      setSelectedIndicator(analysisResult.indexZeroIndicatorId);

      if (!creatorRes.error && creatorRes.data) {
        setCreatedBy(creatorRes.data.created_by as string);
      }

      setLoadState('ready');
    });

    return () => { cancelled = true; };
  }, [analysisId]);

  useEffect(() => {
    let cancelled = false;
    setVersionsLoading(true);
    setVersions([]);
    setPreviousVersion(null);
    setPreviousUnavailable(false);
    setVersionValidities({});
    setVersionError('');
    async function loadVersions() {
      const [newer, current] = await Promise.all([
        supabase.from('analysis').select('id, title, status').eq('previous_version_id', analysisId).order('created_at', { ascending: false }),
        supabase.from('analysis').select('previous_version_id').eq('id', analysisId).maybeSingle(),
      ]);
      if (cancelled) return;
      if (newer.error || current.error || !current.data) setVersionError('No se pudieron cargar todas las versiones vinculadas.');
      const accessible = newer.error ? [] : newer.data ?? [];
      setVersions(accessible);
      let previousId: string | null = null;
      if (!current.error && current.data?.previous_version_id) {
        const previous = await supabase.from('analysis').select('id, title').eq('id', current.data.previous_version_id).maybeSingle();
        if (cancelled) return;
        if (previous.error) setVersionError('No se pudo cargar la versión anterior.');
        else if (previous.data) {
          setPreviousVersion(previous.data);
          previousId = previous.data.id;
        }
        else setPreviousUnavailable(true);
      }
      if (cancelled) return;
      setVersionsLoading(false);
      const versionIds = [...accessible.map(version => version.id), ...(previousId ? [previousId] : [])];
      if (versionIds.length) {
        try {
          const result = await loadAnalysisValidity(versionIds);
          if (!cancelled) setVersionValidities(result);
        } catch {
          if (!cancelled) setVersionError('No se pudo comprobar la validez de las versiones vinculadas.');
        }
      }
    }
    void loadVersions();
    return () => { cancelled = true; };
  }, [analysisId, currentUserId]);

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
      indexZeroIndicatorId: selectedIndicator,
    };
  }, [selectedMode, selectedIndicator, state]);

  const tableRows = useMemo<TableRow[]>(() => chartState ? buildDataRows(rawData, chartState) : [], [rawData, chartState]);

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
                  {validity.sources.map(source => {
                    const change = validity.history.find(item => item.record_type === 'series' && item.record_id === source.id && item.new_status === source.status);
                    return <li key={source.id} className="break-words"><strong>Serie: {sourceName(source)}</strong><br />Estado: {historyStatus(source.status)}<br />Motivo: {changeReason(change?.reason)}<br />Fecha del cambio: {changeDate(change?.changed_at)}</li>;
                  })}
                  {validity.events.map(event => {
                    const change = validity.history.find(item => item.record_type === 'event' && item.record_id === event.id && item.new_status === event.status);
                    return <li key={event.id} className="break-words"><strong>Evento: {event.name?.trim() || 'Nombre no disponible'}</strong><br />Estado: {historyStatus(event.status)}<br />Motivo: {changeReason(change?.reason)}<br />Fecha del cambio: {changeDate(change?.changed_at)}</li>;
                  })}
                </ul>
                <details className="mt-3"><summary className="cursor-pointer font-medium">Consultar historial de cambios</summary>
                  {validity.history.length ? <ul className="mt-3 space-y-3 text-sm">{validity.history.map(item => {
                    const event = validity.events.find(entry => item.record_type === 'event' && entry.id === item.record_id);
                    const source = validity.sources.find(entry => item.record_type === 'series' && entry.id === item.record_id);
                    const name = event ? event.name?.trim() || 'Nombre no disponible' : source ? sourceName(source) : 'Nombre no disponible';
                    return <li key={item.id} className="rounded-lg border border-current/20 p-3 break-words">
                      <p className="font-semibold">{item.record_type === 'event' ? 'Evento' : 'Serie'}: {name}</p>
                      <p className="mt-1"><span className="font-medium">Cambio de estado:</span> {historyStatus(item.old_status)} → {historyStatus(item.new_status)}</p>
                      <p className="mt-1"><span className="font-medium">Motivo:</span> {changeReason(item.reason)}</p>
                      <p><span className="font-medium">Fecha del cambio:</span> {changeDate(item.changed_at)}</p>
                      <p><span className="font-medium">Responsable:</span> No disponible</p>
                    </li>;
                  })}</ul> : <p className="mt-2 text-sm">Historial de cambios no disponible.</p>}
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
          {currentUserId && (state.status === 'public' || (isAuthor && state.status === 'hidden')) && (
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
        <nav aria-label="Versiones del análisis" className="mt-5 space-y-4 text-sm">
          {versionsLoading && <p role="status">Cargando versiones vinculadas…</p>}
          {previousVersion && <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="font-semibold">Versión anterior:</span>
            <a className="link link-primary break-words" href={withBase(`/analisis?id=${previousVersion.id}`)}>{previousVersion.title?.trim() || 'Análisis sin título'}</a>
            {(versionValidities[previousVersion.id]?.sources.length > 0 || versionValidities[previousVersion.id]?.events.length > 0) && <span className="text-warning" role="img" aria-label="Contiene referencias invalidadas" title="Contiene referencias invalidadas">⚠</span>}
          </p>}
          {previousUnavailable && <p>La versión anterior no está disponible.</p>}
          {versions.length === 1 && <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="font-semibold">Versión nueva:</span>
            <a className="link link-primary break-words" href={withBase(`/analisis?id=${versions[0].id}`)}>{versions[0].title?.trim() || 'Análisis sin título'}</a>
            <span className="text-base-content/70"> Estado: {publicationStatus(versions[0].status)} · {versionValidity(versionValidities[versions[0].id])}</span>
          </p>}
          {versions.length > 1 && <details>
            <summary className="cursor-pointer font-semibold">Ver {versions.length} versiones nuevas</summary>
            <ul className="mt-3 space-y-3">{versions.map(version => <li key={version.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <a className="link link-primary break-words" href={withBase(`/analisis?id=${version.id}`)}>{version.title?.trim() || 'Análisis sin título'}</a>
              <span className="text-base-content/70"> Estado: {publicationStatus(version.status)} · {versionValidity(versionValidities[version.id])}</span>
            </li>)}</ul>
          </details>}
        </nav>
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
        ) : (
          <AnalysisContainer configuration={chartState!} points={rawData} events={selectedMacroEvents} onSelectIndicator={setSelectedIndicator} />
        )}
      </section>

      <AnalysisSources rows={tableRows} mode={selectedMode} />

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
