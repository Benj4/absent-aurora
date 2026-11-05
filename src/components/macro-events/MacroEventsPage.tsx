import { useCallback, useEffect, useRef, useState } from 'react';
import type { MacroEvent, MacroEventTopic } from '../../lib/macro-events';
import { changeMacroEventStatus, deleteMacroEvent, fetchMacroEvents } from '../../lib/macro-events';
import { useAuthSession } from '../../lib/use-auth-session';
import MacroEventForm from './MacroEventForm';

const TOPIC: Record<MacroEventTopic, string> = {
  politics: 'Política', economy: 'Economía', nature: 'Naturaleza', health: 'Salud', social: 'Social',
};

function fmtDate(raw: string | null): string {
  if (!raw) return '—';
  const [year, month, day] = raw.split('-').map(Number);
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, day)));
}

function EventDescription({ description }: { description: string | null }) {
  const [expanded, setExpanded] = useState(false);
  const text = description?.trim() || 'Sin descripción.';
  const limit = 240;
  const truncated = text.length > limit;
  const excerpt = truncated ? text.slice(0, limit).replace(/\s+\S*$/, '').trimEnd() || text.slice(0, limit) : text;

  return (
    <div className="mt-2 text-sm">
      <p className="whitespace-pre-wrap break-words">{expanded || !truncated ? text : `${excerpt}…`}</p>
      {truncated && <button type="button" className="link link-primary mt-1" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? 'Ver menos' : 'Ver más'}</button>}
    </div>
  );
}

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
      setActionError('No se pudo eliminar el evento. Los eventos usados en un análisis no se pueden eliminar; comprueba también tus permisos.');
      deleteDialog.current?.close();
      setDeleteTarget(null);
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  const visible = filter === 'all' ? events : events.filter(event => event.status === filter);
  return (
    <div className="space-y-4">
      {user && <button type="button" className="btn btn-primary btn-sm" onClick={() => { setCorrection(null); setPanelOpen(true); }}>Nuevo evento</button>}
      {user && panelOpen && <MacroEventForm isOpen event={correction} onClose={() => { setPanelOpen(false); setCorrection(null); }} onSaved={() => { setPanelOpen(false); setCorrection(null); void load(); }} />}
      {actionError && <div role="alert" className="alert alert-error text-sm">{actionError}</div>}
      <label className="flex flex-wrap items-center gap-2 text-sm">
        Estado
        <select className="select select-sm" value={filter} onChange={event => setFilter(event.target.value as typeof filter)}>
          <option value="all">Todos</option><option value="valid">Válidos</option><option value="invalid">Invalidados</option>
        </select>
      </label>
      {loading ? <p role="status">Cargando eventos…</p> : fetchError ? (
        <div role="alert" className="alert alert-error"><span>No se pudieron cargar los eventos.</span><button className="btn btn-sm" onClick={() => void load()}>Reintentar</button></div>
      ) : events.length === 0 ? <p>No hay eventos registrados.</p> : visible.length === 0 ? <p>No hay eventos que coincidan con el filtro.</p> : (
        <div className="space-y-3">
          {visible.map(event => (
            <article key={event.id} className="rounded-box border border-base-200 bg-base-100 p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2"><h2 className="font-semibold break-words">{event.name || 'Sin nombre'}</h2><span className={`badge badge-sm ${event.status === 'valid' ? 'badge-success' : 'badge-error'}`}>{event.status === 'valid' ? 'Válido' : 'Invalidado'}</span><span className="badge badge-sm badge-outline">{TOPIC[event.topic] ?? event.topic ?? 'Sin tema'}</span></div>
                {user && <details className="dropdown dropdown-end" onKeyDown={e => { if (e.key === 'Escape') { e.currentTarget.open = false; e.currentTarget.querySelector('summary')?.focus(); } }}>
                  <summary className="btn btn-ghost btn-sm" aria-label={`Acciones para ${event.name || 'el evento'}`}>Acciones</summary>
                  <ul className="menu dropdown-content z-10 mt-1 w-48 rounded-box bg-base-100 p-2 shadow-lg border border-base-200">
                    <li><button type="button" onClick={e => { e.currentTarget.closest('details')?.removeAttribute('open'); setCorrection(event); setPanelOpen(true); }}>Crear corrección</button></li>
                    {canChange && <li><button type="button" disabled={pending} onClick={e => { e.currentTarget.closest('details')?.removeAttribute('open'); openStatus(event); }}>{event.status === 'valid' ? 'Invalidar' : 'Restablecer'}</button></li>}
                    {canDelete && <li><button type="button" className="text-error" disabled={pending} onClick={e => { e.currentTarget.closest('details')?.removeAttribute('open'); setActionError(null); setDeleteTarget(event); deleteDialog.current?.showModal(); }}>Eliminar</button></li>}
                  </ul>
                </details>}
              </div>
              <p className="mt-2 text-sm">Inicio: {fmtDate(event.start_date)} · Fin: {fmtDate(event.end_date)}</p>
              <p className="text-sm">Geografía: {[event.geo_scope, event.geo_region].filter(Boolean).join(' · ') || '—'}</p>
              <EventDescription description={event.description} />
              <p className="mt-2 break-all text-sm">{event.source_url ? <a className="link link-primary" href={event.source_url} target="_blank" rel="noopener noreferrer">Fuente del evento</a> : 'Sin fuente disponible.'}</p>
            </article>
          ))}
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
