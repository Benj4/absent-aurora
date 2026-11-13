import { useCallback, useEffect, useRef, useState } from 'react';
import type { MacroEvent } from '../../lib/macro-events';
import { changeMacroEventStatus, deleteMacroEvent } from '../../lib/macro-events';
import { EMPTY_EVENT_FILTERS, fetchEventPage, fetchEventLocations, fetchLinkedEvent, type EventFilters, type EventContext, type EventCursor } from '../../lib/macro-event-catalog';
import { useAuthSession } from '../../lib/use-auth-session';
import MacroEventForm from './MacroEventForm';
import MacroEventCard from './MacroEventCard';
import EventCatalogFilters from './EventCatalogFilters';

export default function MacroEventsPage() {
  const { user } = useAuthSession();
  const roles = user?.app_metadata?.role;
  const canChange = Array.isArray(roles) && (roles.includes('editor') || roles.includes('admin'));
  const canDelete = Array.isArray(roles) && roles.includes('admin');
  const [events, setEvents] = useState<MacroEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const filters = useRef<EventFilters>(EMPTY_EVENT_FILTERS);
  const [context, setContext] = useState<Record<string, EventContext>>({});
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const cursor = useRef<EventCursor | undefined>(undefined);
  const request = useRef(0);
  const pageBusy = useRef(false);
  const [revision, setRevision] = useState(0);
  const [locations, setLocations] = useState<{ scope: string[]; region: string[] }>({ scope: [], region: [] });
  const [locationError, setLocationError] = useState(false);
  const locationRequest = useRef(0);
  const [linkedEventId, setLinkedEventId] = useState<string | null>(null);
  const [linked, setLinked] = useState<Awaited<ReturnType<typeof fetchLinkedEvent>> | null>(null);
  const [linkError, setLinkError] = useState(false);
  const [linkRetry, setLinkRetry] = useState(0);
  const focusedTarget = useRef<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [correction, setCorrection] = useState<MacroEvent | null>(null);
  const [statusTarget, setStatusTarget] = useState<MacroEvent | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MacroEvent | null>(null);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const statusDialog = useRef<HTMLDialogElement>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);

  const load = useCallback(async (append = false) => {
    if (append && pageBusy.current) return;
    const token = append ? request.current : ++request.current;
    pageBusy.current = true;
    setMoreError(false);
    if (append) setLoadingMore(true);
    else {
      setLoading(true);
      setFetchError(false);
      setEvents([]);
      setContext({});
      setHasMore(false);
      setLoadingMore(false);
      cursor.current = undefined;
      setRevision(value => value + 1);
    }
    try {
      const page = await fetchEventPage(filters.current, append ? cursor.current : undefined);
      if (token !== request.current) return;
      setEvents(previous => [...new Map([...(append ? previous : []), ...page.events].map(event => [event.id, event])).values()]);
      setContext(previous => ({ ...(append ? previous : {}), ...page.context }));
      cursor.current = page.events.at(-1);
      setHasMore(page.hasMore);
    } catch {
      if (token !== request.current) return;
      if (append) setMoreError(true); else setFetchError(true);
    } finally {
      if (token === request.current) {
        pageBusy.current = false;
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, []);
  const loadLocations = useCallback(async () => {
    const token = ++locationRequest.current;
    setLocationError(false);
    try {
      const options = await fetchEventLocations();
      if (token === locationRequest.current) setLocations(options);
    } catch { if (token === locationRequest.current) setLocationError(true); }
  }, []);
  useEffect(() => {
    void load();
    void loadLocations();
    return () => { request.current++; locationRequest.current++; };
  }, [load, loadLocations]);

  function refresh() {
    void loadLocations();
    setLinkRetry(value => value + 1);
    return load();
  }

  function applyFilters(next: EventFilters) {
    filters.current = next;
    setLinkedEventId(null);
    setLinked(null);
    setLinkError(false);
    focusedTarget.current = null;
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    void load();
  }

  useEffect(() => {
    function followHash() {
      if (window.location.hash.startsWith('#event-')) {
        setLinkedEventId(window.location.hash.slice('#event-'.length));
      } else { setLinkedEventId(null); setLinked(null); }
    }
    followHash();
    window.addEventListener('hashchange', followHash);
    return () => window.removeEventListener('hashchange', followHash);
  }, []);

  useEffect(() => {
    if (!linkedEventId) { setLinkError(false); focusedTarget.current = null; return; }
    let cancelled = false;
    setLinked(null);
    setLinkError(false);
    void fetchLinkedEvent(linkedEventId).then(result => {
      if (!cancelled) setLinked(result);
    }).catch(() => { if (!cancelled) setLinkError(true); });
    return () => { cancelled = true; };
  }, [linkedEventId, linkRetry]);

  useEffect(() => {
    if (!linkedEventId || linked?.event.id !== linkedEventId || focusedTarget.current === linkedEventId) return;
    const target = document.getElementById(`event-${linkedEventId}`);
    if (target) {
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: 'start' });
      focusedTarget.current = linkedEventId;
    }
  }, [linkedEventId, linked, events]);

  function followEvent(id: string) {
    focusedTarget.current = null;
    setLinkedEventId(id);
  }

  function openStatus(event: MacroEvent) {
    setActionError(null);
    setReason('');
    setReasonError(false);
    setStatusTarget(event);
    statusDialog.current?.showModal();
  }

  async function confirmStatus() {
    if (!statusTarget || !canChange || pendingRef.current) return;
    const next = statusTarget.status === 'valid' ? 'invalid' : 'valid';
    if ((canDelete || next === 'invalid') && !reason.trim()) { setReasonError(true); return; }
    pendingRef.current = true;
    setPending(true);
    try {
      const { error } = await changeMacroEventStatus(statusTarget.id, next, reason.trim());
      if (error) throw error;
      statusDialog.current?.close();
      setStatusTarget(null);
      await refresh();
    } catch {
      setActionError('No se pudo cambiar el estado del evento. Inténtalo de nuevo.');
      statusDialog.current?.close();
      setStatusTarget(null);
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || !canDelete || pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    try {
      const { error } = await deleteMacroEvent(deleteTarget.id);
      if (error) throw error;
      deleteDialog.current?.close();
      setDeleteTarget(null);
      await refresh();
    } catch {
      setActionError('No se pudo eliminar el evento. Los eventos usados en un análisis o con correcciones vinculadas no se pueden eliminar; comprueba también tus permisos.');
      deleteDialog.current?.close();
      setDeleteTarget(null);
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  function renderEvent(event: MacroEvent, metadata: Record<string, EventContext>) {
    const details = metadata[event.id];
    const original = event.corrects_event_id && details?.original_name ? { id: event.corrects_event_id, name: details.original_name } : null;
    return <MacroEventCard key={`${revision}-${event.id}`} event={event} original={original} correctionCount={details?.correction_count ?? 0} onFollowEvent={followEvent} actions={user && (
                <details className="dropdown dropdown-end shrink-0" onKeyDown={e => { if (e.key === 'Escape') { e.currentTarget.open = false; e.currentTarget.querySelector('summary')?.focus(); } }}>
                  <summary className="btn btn-ghost btn-square" aria-label={`Acciones para ${event.name || 'el evento'}`}>
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="size-5"><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></svg>
                  </summary>
                  <ul className="menu dropdown-content z-10 mt-1 w-48 rounded-box bg-base-100 p-2 shadow-lg border border-base-200">
                    <li><button type="button" onClick={e => { e.currentTarget.closest('details')?.removeAttribute('open'); setCorrection(event); setPanelOpen(true); }}>Crear corrección</button></li>
                    {canChange && <li><button type="button" disabled={pending} onClick={e => { e.currentTarget.closest('details')?.removeAttribute('open'); openStatus(event); }}>{event.status === 'valid' ? 'Invalidar' : 'Restablecer'}</button></li>}
                    {canDelete && <li><button type="button" className="text-error" disabled={pending} onClick={e => { e.currentTarget.closest('details')?.removeAttribute('open'); setActionError(null); setDeleteTarget(event); deleteDialog.current?.showModal(); }}>Eliminar</button></li>}
                  </ul>
                </details>
              )} />;
  }
  const pinned = linked?.event.id === linkedEventId && !events.some(event => event.id === linked.event.id) ? linked : null;
  return (
    <div>
      <EventCatalogFilters onApply={applyFilters} locations={locations} locationError={locationError} onRetryLocations={() => void loadLocations()} actions={user && <button type="button" className="btn btn-outline btn-sm w-full sm:w-auto" aria-expanded={panelOpen} aria-controls="event-form-panel" onClick={() => { setCorrection(null); setPanelOpen(true); }}>Nuevo evento</button>} />
      {user && panelOpen && <div id="event-form-panel" className="mb-6"><MacroEventForm isOpen event={correction} onClose={() => { setPanelOpen(false); setCorrection(null); }} onSaved={() => { setPanelOpen(false); setCorrection(null); void refresh(); }} /></div>}
      {actionError && <div role="alert" className="alert alert-error mb-5 text-sm">{actionError}</div>}
      {linkedEventId && !linked && !linkError && <p role="status" className="py-4 text-sm">Cargando evento vinculado…</p>}
      {linkError && <div role="alert" className="alert alert-error mb-5"><span>No se pudo cargar el evento vinculado.</span><button type="button" className="btn btn-outline" onClick={() => setLinkRetry(value => value + 1)}>Reintentar</button></div>}
      {pinned && <section className="mb-8 space-y-3" aria-label="Evento vinculado">
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-base-content/70">Evento vinculado · Se muestra fuera de los resultados actuales.</p><button type="button" className="btn btn-ghost" onClick={() => { setLinkedEventId(null); setLinked(null); window.history.replaceState(null, '', window.location.pathname + window.location.search); }}>Cerrar evento vinculado</button></div>
        <div className="grid lg:grid-cols-2">{renderEvent(pinned.event, pinned.context)}</div>
      </section>}
      {loading ? <p role="status" className="flex items-center gap-3 px-5 py-10 text-sm text-base-content/70"><span className="loading loading-spinner loading-sm" aria-hidden="true" />Cargando eventos…</p> : fetchError ? (
        <div role="alert" className="alert alert-error"><span>No se pudieron cargar los eventos.</span><button type="button" className="btn btn-outline" onClick={() => void load()}>Reintentar</button></div>
      ) : events.length === 0 ? <p role="status" className="px-5 py-10 text-sm text-base-content/70">No hay eventos que coincidan con los filtros.</p> : <>
        <p role="status" className="mb-4 text-sm text-base-content/70">{events.length} eventos cargados · Más recientes por fecha del evento</p>
        <div className="grid items-start gap-3 lg:grid-cols-2">{events.map(event => renderEvent(event, context))}</div>
        <div className="mt-6 flex flex-col items-center gap-3">
          {moreError && <p role="alert" className="text-sm text-error">No se pudieron cargar más eventos. Los resultados anteriores se conservan.</p>}
          {(hasMore || moreError) && <button type="button" className="btn btn-outline" disabled={loadingMore} onClick={() => void load(true)}>{loadingMore ? 'Cargando…' : moreError ? 'Reintentar' : 'Cargar más'}</button>}
          {loadingMore && <span role="status" className="sr-only">Cargando más eventos…</span>}
          {!hasMore && <p className="text-xs text-base-content/70">No hay más eventos para estos filtros.</p>}
        </div>
      </>}
      <dialog ref={statusDialog} className="modal" aria-labelledby="status-title" onCancel={event => { if (pendingRef.current) event.preventDefault(); }} onClose={() => setStatusTarget(null)}>
        <div className="modal-box">
          <h2 id="status-title" className="font-semibold">{statusTarget?.status === 'valid' ? '¿Invalidar evento?' : '¿Restablecer evento?'}</h2>
          <p className="py-3">{statusTarget?.name}</p>
          {(canDelete || statusTarget?.status === 'valid') && <label className="flex flex-col gap-2 text-sm">Motivo del cambio<textarea className="textarea w-full" value={reason} onChange={event => { setReason(event.target.value); setReasonError(false); }} aria-invalid={reasonError} aria-describedby={reasonError ? 'reason-error' : undefined} disabled={pending} required />{reasonError && <span id="reason-error" role="alert" className="text-error">El motivo es obligatorio.</span>}</label>}
          <div className="modal-action"><button className="btn btn-ghost" disabled={pending} onClick={() => statusDialog.current?.close()}>Cancelar</button><button className="btn btn-primary" disabled={pending} onClick={() => void confirmStatus()}>{pending ? 'Guardando…' : 'Confirmar'}</button></div>
        </div>
      </dialog>
      <dialog ref={deleteDialog} className="modal" aria-labelledby="delete-title" onCancel={event => { if (pendingRef.current) event.preventDefault(); }} onClose={() => setDeleteTarget(null)}>
        <div className="modal-box"><h2 id="delete-title" className="font-semibold">¿Eliminar evento?</h2><p className="py-4">Se eliminará permanentemente «{deleteTarget?.name}». Esta acción no se puede deshacer.</p><div className="modal-action"><button className="btn btn-ghost" disabled={pending} onClick={() => deleteDialog.current?.close()}>Cancelar</button><button className="btn btn-error" disabled={pending} onClick={() => void confirmDelete()}>{pending ? 'Eliminando…' : 'Eliminar'}</button></div></div>
      </dialog>
    </div>
  );
}
