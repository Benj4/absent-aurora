import { useCallback, useEffect, useRef, useState } from 'react';
import type { MacroEvent } from '../../lib/macro-events';
import { changeMacroEventStatus, deleteMacroEvent, fetchMacroEvents } from '../../lib/macro-events';
import { useAuthSession } from '../../lib/use-auth-session';
import MacroEventForm from './MacroEventForm';
import MacroEventCard from './MacroEventCard';

export default function MacroEventsPage() {
  const { user } = useAuthSession();
  const roles = user?.app_metadata?.role;
  const canChange = Array.isArray(roles) && (roles.includes('editor') || roles.includes('admin'));
  const canDelete = Array.isArray(roles) && roles.includes('admin');
  const [events, setEvents] = useState<MacroEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'valid' | 'invalid'>('all');
  const [linkedEventId, setLinkedEventId] = useState<string | null>(null);
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

  const load = useCallback(async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const { data, error } = await fetchMacroEvents();
      if (error) setFetchError(true);
      else setEvents(data ?? []);
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    function followHash() {
      if (window.location.hash.startsWith('#event-')) {
        setFilter('all');
        setLinkedEventId(window.location.hash.slice('#event-'.length));
      }
    }
    followHash();
    window.addEventListener('hashchange', followHash);
    return () => window.removeEventListener('hashchange', followHash);
  }, []);

  useEffect(() => {
    if (!linkedEventId || loading || fetchError) return;
    const target = document.getElementById(`event-${linkedEventId}`);
    if (target) {
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: 'start' });
      setLinkedEventId(null);
    }
  }, [linkedEventId, loading, fetchError, filter, events]);

  function followEvent(id: string) {
    setFilter('all');
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
      await load();
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
      await load();
    } catch {
      setActionError('No se pudo eliminar el evento. Los eventos usados en un análisis o con correcciones vinculadas no se pueden eliminar; comprueba también tus permisos.');
      deleteDialog.current?.close();
      setDeleteTarget(null);
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  const visible = filter === 'all' ? events : events.filter(event => event.status === filter);
  const eventsById = new Map(events.map(event => [event.id, event]));
  const correctionsByEvent = new Map<string, MacroEvent[]>();
  for (const event of events) {
    if (!event.corrects_event_id) continue;
    const corrections = correctionsByEvent.get(event.corrects_event_id) ?? [];
    corrections.push(event);
    correctionsByEvent.set(event.corrects_event_id, corrections);
  }
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 rounded-box border border-base-300 bg-base-100 px-5 py-4 lg:px-6">
        <label className="flex w-full flex-col gap-1.5 text-xs font-semibold sm:w-52">
          Estado
          <select className="select w-full font-normal" value={filter} onChange={event => setFilter(event.target.value as typeof filter)}>
            <option value="all">Todos</option><option value="valid">Válidos</option><option value="invalid">Invalidados</option>
          </select>
        </label>
        {user && <button type="button" className="btn btn-primary w-full sm:w-auto" aria-expanded={panelOpen} aria-controls="event-form-panel" onClick={() => { setCorrection(null); setPanelOpen(true); }}>Nuevo evento</button>}
      </div>
      {user && panelOpen && <div id="event-form-panel" className="mb-6"><MacroEventForm isOpen event={correction} onClose={() => { setPanelOpen(false); setCorrection(null); }} onSaved={() => { setPanelOpen(false); setCorrection(null); void load(); }} /></div>}
      {actionError && <div role="alert" className="alert alert-error m-5 text-sm lg:mx-8">{actionError}</div>}
      {loading ? <p role="status" className="flex items-center gap-3 px-5 py-10 text-sm text-base-content/70 lg:px-8"><span className="loading loading-spinner loading-sm" aria-hidden="true" />Cargando eventos…</p> : fetchError ? (
        <div role="alert" className="alert alert-error m-5 lg:mx-8"><span>No se pudieron cargar los eventos.</span><button className="btn btn-outline" onClick={() => void load()}>Reintentar</button></div>
      ) : events.length === 0 ? <p className="px-5 py-10 text-sm text-base-content/70 lg:px-8">No hay eventos registrados.</p> : visible.length === 0 ? <p className="px-5 py-10 text-sm text-base-content/70 lg:px-8">No hay eventos que coincidan con el filtro.</p> : (
        <div className="grid items-start gap-5 lg:grid-cols-2">
          {visible.map(event => {
            const original = event.corrects_event_id ? eventsById.get(event.corrects_event_id) : null;
            const corrections = correctionsByEvent.get(event.id) ?? [];
            return (
            <MacroEventCard key={event.id} event={event} original={original ?? null} corrections={corrections} onFollowEvent={followEvent} actions={user && (
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
              )} />
          );
          })}
        </div>
      )}
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
