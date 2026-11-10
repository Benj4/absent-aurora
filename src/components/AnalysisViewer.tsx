// filepath: src/components/AnalysisViewer.tsx
import { useState, useEffect, useMemo, useId } from 'react';
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

type TableRow = ReturnType<typeof buildDataRows>[number];

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
  const [alignmentHelpOpen, setAlignmentHelpOpen] = useState(false);
  const alignmentHelpId = useId();

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
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-10 lg:py-8">
        <div className="skeleton rounded-box h-40 mb-5" />
        <div className="skeleton rounded-2xl" style={{ height: 420 }} />
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────────
  if (loadState === 'error' || !state) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-10">
        <div className="bg-base-100 rounded-box border border-error/30 p-10 text-center space-y-2">
          <p className="font-semibold text-base-content/70">No se pudo cargar el análisis</p>
          <p className="text-sm text-base-content/75">{errorMsg || 'El análisis no existe o ocurrió un error inesperado.'}</p>
        </div>
      </div>
    );
  }

  const isConfigured = state.indicadores.length > 0 && state.periodos.some(p => p.fechaInicio && p.fechaFin);

  return (
    <div className="bg-base-200/60">
      <article className="mx-auto max-w-7xl px-4 py-6 lg:px-10 lg:py-8">
        <div className="rounded-box border border-base-300 bg-base-100">

      {/* Report title, provenance, and saved configuration. */}
      <section className="p-5 lg:p-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <h1
              className="break-words text-2xl lg:text-[28px] font-bold leading-tight tracking-tight"
              style={{ textWrap: 'balance' } as React.CSSProperties}
            >
              {state.titulo || 'Análisis sin título'}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="badge badge-outline">{publicationStatus(state.status)}</span>
              {state.region && <span className="break-words text-base-content/75">{state.region}</span>}
            </div>

            {state.descripcion && (
              <p className="mt-4 max-w-prose whitespace-pre-wrap break-words text-base leading-relaxed text-base-content/80">
                {state.descripcion}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 [&_.btn]:min-h-11">
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
              Editar análisis
            </a>
          )}
          {state.status === 'draft' && (isAuthor || isAdmin) && (
            <button type="button" className="btn btn-sm btn-error btn-outline" disabled={deleting} onClick={handleDelete}>
              {deleting ? 'Eliminando…' : 'Eliminar borrador'}
            </button>
          )}
          </div>
        </div>
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

        <nav aria-label="Versiones del análisis" className="space-y-3 text-sm empty:hidden [&:not(:empty)]:mt-5">
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

        <div className="mt-6 grid gap-6 border-t border-base-300 pt-5 md:grid-cols-2">
          <section aria-labelledby="analysis-indicators">
            <h2 id="analysis-indicators" className="text-sm font-bold">Indicadores · {state.indicadores.length}</h2>
            {state.indicadores.length ? <ul className="mt-3 space-y-2 text-sm">
              {state.indicadores.map(id => <li key={id} className="break-words">{INDICATOR_MAP.get(id) ?? id}</li>)}
            </ul> : <p className="mt-2 text-sm text-base-content/75">Sin indicadores configurados.</p>}
          </section>
          <section aria-labelledby="analysis-periods">
            <h2 id="analysis-periods" className="text-sm font-bold">Períodos · {state.periodos.length}</h2>
            <ul className="mt-3 space-y-3 text-sm">
              {state.periodos.map(period => <li key={period.id} className="flex items-start gap-2">
                <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: period.color }} aria-hidden="true" />
                <div className="min-w-0">
                  <p className="break-words font-semibold">{period.nombre}</p>
                  <p className="mt-0.5 tabular-nums text-base-content/75">{period.fechaInicio || 'Sin inicio'} → {period.fechaFin || 'Sin fin'}</p>
                </div>
              </li>)}
            </ul>
          </section>
        </div>
      </section>

      {/* Interactive chart controls only affect this reading session. */}
      <section aria-label="Gráfico comparativo" className="border-t border-base-300 p-5 lg:p-8">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-base font-bold">Gráfico comparativo</h2>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-1">
              <span className="text-sm text-base-content/75">Alineación</span>
              <button
                type="button"
                className="btn btn-ghost btn-sm min-h-11"
                aria-label="Ayuda sobre la alineación"
                aria-expanded={alignmentHelpOpen}
                aria-controls={alignmentHelpId}
                onClick={() => setAlignmentHelpOpen(open => !open)}
              >
                Ayuda
              </button>
            </div>
            <div className="join">
              <button
                type="button"
                className={`join-item btn min-h-11 ${selectedMode === 'calendario' ? 'btn-active' : 'btn-outline'}`}
                onClick={() => setSelectedMode('calendario')}
                aria-pressed={selectedMode === 'calendario'}
              >
                Calendario
              </button>
              <button
                type="button"
                className={`join-item btn min-h-11 ${selectedMode === 'indice_cero' ? 'btn-active' : 'btn-outline'}`}
                onClick={() => setSelectedMode('indice_cero')}
                aria-pressed={selectedMode === 'indice_cero'}
              >
                Índice cero
              </button>
            </div>
          </div>
        </div>

        <div id={alignmentHelpId} hidden={!alignmentHelpOpen} className="mb-5 max-w-prose space-y-2 text-sm leading-relaxed text-base-content/75">
          <p><strong>Calendario:</strong> compara los indicadores por fecha, en su unidad original. Los colores identifican cada indicador.</p>
          <p><strong>Índice cero:</strong> compara un indicador desde el inicio de cada período. Los colores identifican los períodos.</p>
          <p>Esta selección solo cambia la vista actual.</p>
        </div>
        {dataError && <p role="alert" className="alert alert-error mb-4">{dataError}</p>}
        {eventError && <p role="alert" className="alert alert-error mb-4">{eventError}</p>}
        {rawData.some(point => point.status !== 'approved') && <p className="alert alert-warning mb-3 text-sm">Los rombos identifican datos cuya fuente ya no está aprobada.</p>}
        {dataLoading ? (
          <div className="skeleton rounded-xl" style={{ height: 360 }} />
        ) : !isConfigured ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-base-content/75">
            <p className="text-sm text-center">
              Este análisis no tiene indicadores o períodos configurados.
            </p>
          </div>
        ) : (
          <AnalysisContainer configuration={chartState!} points={rawData} events={selectedMacroEvents} onSelectIndicator={setSelectedIndicator} />
        )}
      </section>

      <div className="border-t border-base-300 p-5 lg:p-8">
        <AnalysisSources rows={tableRows} mode={selectedMode} layout="rows" />
        {!dataLoading && !tableRows.length && <p className="text-sm text-base-content/75" role="status">No hay datos guardados disponibles para esta vista. Revisa los indicadores, los períodos y los avisos de referencias.</p>}
      </div>

      {/* ── Section 3: Macro events table (read-only) ─────────────────────── */}
      {selectedMacroEvents.length > 0 && (
        <section aria-label="Tabla de eventos macro">
          <details open className="group border-t border-base-300">
            <summary className="flex cursor-pointer select-none items-center justify-between min-h-16 gap-3 px-5 py-4 lg:px-8 hover:bg-base-200/40 transition-colors list-none">
              <span className="font-bold text-base">Eventos macro</span>
              <div className="flex items-center gap-2 text-xs text-base-content/75">
                <span className="badge badge-ghost badge-sm">{selectedMacroEvents.length} {selectedMacroEvents.length === 1 ? 'evento' : 'eventos'}</span>
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

            <div className="border-t border-base-300 overflow-x-auto" tabIndex={0} role="region" aria-label="Eventos macro del análisis">
              <table className="table table-zebra w-full">
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
                        <td className="min-w-48 max-w-sm">
                          <p className="text-sm font-medium whitespace-normal break-words" title={event.name}>
                            {event.name}
                          </p>
                          {event.status === 'invalid' && <span className="badge badge-warning badge-xs">⚠ Invalidado</span>}
                        </td>
                        <td>
                          <span className="whitespace-nowrap text-right font-mono text-sm tabular-nums">
                            {event.start_date}
                          </span>
                        </td>
                        <td>
                          {event.end_date ? (
                            <span className="whitespace-nowrap text-right font-mono text-sm tabular-nums">
                              {event.end_date}
                            </span>
                          ) : (
                            <span className="text-xs text-base-content/75">—</span>
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

      {/* ── Section 4: Data table ───────────────────────────── */}
      {tableRows.length > 0 && (
        <section aria-label="Tabla de datos detallados">
          <details open className="group border-t border-base-300">
            <summary className="flex cursor-pointer select-none items-center justify-between min-h-16 gap-3 px-5 py-4 lg:px-8 hover:bg-base-200/40 transition-colors list-none">
              <span className="font-bold text-base">Datos detallados</span>
              <div className="flex items-center gap-2 text-xs text-base-content/75">
                <span className="badge badge-ghost badge-sm">{tableRows.length} {tableRows.length === 1 ? 'registro' : 'registros'}</span>
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
              className="border-t border-base-300 overflow-x-auto overflow-y-auto"
              tabIndex={0} role="region" aria-label="Registros del análisis"
              style={{ maxHeight: 400 }}
            >
              <table className="table table-zebra w-full">
                <thead className="sticky top-0 bg-base-200 z-10">
                  <tr>
                    <th>Período</th>
                    <th>Fecha</th>
                    <th>Indicador</th>
                    <th className="text-right tabular-nums">Valor</th>
                    <th>Fuente</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row, i) => (
                    <tr key={i}>
                      <td>
                        <span
                          className="inline-flex min-w-24 items-center gap-1.5 text-sm font-semibold"
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
                        <span className="whitespace-nowrap font-mono text-sm tabular-nums">{row.date}</span>
                      </td>
                      <td className="min-w-48 max-w-sm">
                        <span className="text-sm whitespace-normal break-words block" title={row.indicator}>
                          {row.indicator}
                        </span>
                      </td>
                      <td className="whitespace-nowrap text-right font-mono text-sm tabular-nums">
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
                          <span className="text-xs text-base-content/75">—</span>
                        )}
                      </td>
                      <td>{row.status !== 'approved' ? <span className="badge badge-warning">Sin aprobación ({row.status === 'disabled' ? 'deshabilitada' : row.status === 'rejected' ? 'rechazada' : row.status === 'pending' ? 'pendiente' : 'estado desconocido'})</span> : 'Aprobada'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>
      )}

        </div>
      </article>
    </div>
  );
};

export default AnalysisViewer;
