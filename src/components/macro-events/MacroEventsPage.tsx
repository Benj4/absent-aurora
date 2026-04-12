import { useCallback, useEffect, useRef, useState } from 'react';
import type { MacroEvent, MacroEventTopic } from '../../lib/macro-events';
import { deleteMacroEvent, fetchMacroEvents } from '../../lib/macro-events';
import MacroEventForm from './MacroEventForm';

const TOPIC: Record<MacroEventTopic, { label: string; cls: string }> = {
  politics: { label: 'Política', cls: 'badge-secondary' },
  economy: { label: 'Economía', cls: 'badge-primary' },
  nature: { label: 'Naturaleza', cls: 'badge-success' },
  health: { label: 'Salud', cls: 'badge-error' },
  social: { label: 'Social', cls: 'badge-warning' },
};

const dateFormatter = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

function fmtDate(raw: string | null): string {
  if (!raw) return '—';
  try {
    const [y, m, d] = raw.split('-').map(Number);
    return dateFormatter.format(new Date(Date.UTC(y, m - 1, d)));
  } catch {
    return raw;
  }
}

export default function MacroEventsPage() {
  const [events, setEvents] = useState<MacroEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<MacroEvent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MacroEvent | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deleteModalRef = useRef<HTMLDialogElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await fetchMacroEvents();
    setLoading(false);
    if (error) setFetchError(error.message);
    else setEvents(data ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setEditing(null);
    setPanelOpen(true);
  }

  function openEdit(evt: MacroEvent) {
    setEditing(evt);
    setPanelOpen(true);
  }

  function closePanel() {
    setPanelOpen(false);
    setEditing(null);
  }

  function handleSaved(saved: MacroEvent) {
    setEvents(prev => {
      const idx = prev.findIndex(e => e.id === saved.id);
      const next = idx >= 0
        ? prev.map(e => (e.id === saved.id ? saved : e))
        : [saved, ...prev];
      return next.sort((a, b) => b.start_date.localeCompare(a.start_date));
    });
    closePanel();
  }

  function promptDelete(evt: MacroEvent) {
    setDeleteTarget(evt);
    deleteModalRef.current?.showModal();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await deleteMacroEvent(deleteTarget.id);
    setDeleting(false);
    if (error) {
      setFetchError(error.message);
    } else {
      setEvents(prev => prev.filter(e => e.id !== deleteTarget.id));
    }
    setDeleteTarget(null);
    deleteModalRef.current?.close();
  }

  return (
    <>
      <div className="space-y-4">

        {/* <div className="flex flex-col gap-3 rounded-box border border-base-200 bg-base-100 px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-5"> */}
          <button
            type="button"
            onClick={openNew}
            className="btn btn-primary btn-sm self-start gap-1.5 sm:self-auto"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z" />
            </svg>
            Nuevo evento
          </button>
        {/* </div> */}

        {panelOpen && (
          <MacroEventForm
            isOpen={panelOpen}
            event={editing}
            onClose={closePanel}
            onSaved={handleSaved}
          />
        )}

        {/* Fetch error */}
        {fetchError && (
          <div role="alert" aria-live="polite" className="alert alert-error text-sm shadow-sm">
            <span>{fetchError}</span>
          </div>
        )}

        {/* Table card */}
        <div className="overflow-hidden rounded-box border border-base-200 bg-base-100 shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <span
                className="loading loading-spinner loading-md text-primary"
                aria-label="Cargando eventos…"
              />
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 px-8 py-24 text-center">
              <div className="rounded-full bg-base-200 p-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="h-8 w-8 opacity-40"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium">Sin eventos registrados</p>
                <p className="mt-1 text-xs opacity-50">
                  Añade el primero para contextualizar tus series temporales.
                </p>
              </div>
              <button type="button" onClick={openNew} className="btn btn-primary btn-sm mt-1">
                Crear primer evento
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="table table-zebra">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide opacity-60">
                      <th>Nombre</th>
                      <th>Tema</th>
                      <th>Inicio</th>
                      <th>Fin</th>
                      <th>Geografía</th>
                      <th className="text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map(evt => {
                      const t = TOPIC[evt.topic] ?? { label: evt.topic, cls: 'badge-neutral' };
                      const geo = [evt.geo_scope, evt.geo_region].filter(Boolean).join(' · ');
                      return (
                        <tr key={evt.id} className="hover">
                          <td className="min-w-0 max-w-xs">
                            <div className="min-w-0 truncate font-medium">{evt.name}</div>
                            {evt.description && (
                              <div className="mt-0.5 min-w-0 truncate text-xs opacity-50">
                                {evt.description}
                              </div>
                            )}
                          </td>
                          <td>
                            <span className={`badge badge-sm font-normal ${t.cls}`}>
                              {t.label}
                            </span>
                          </td>
                          <td className="whitespace-nowrap text-sm tabular-nums">
                            {fmtDate(evt.start_date)}
                          </td>
                          <td className="whitespace-nowrap text-sm tabular-nums opacity-60">
                            {fmtDate(evt.end_date)}
                          </td>
                          <td className="text-sm">
                            {geo ? geo : <span className="opacity-30">—</span>}
                          </td>
                          <td>
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => openEdit(evt)}
                                aria-label={`Editar ${evt.name}`}
                                className="btn btn-ghost btn-xs"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => promptDelete(evt)}
                                aria-label={`Eliminar ${evt.name}`}
                                className="btn btn-ghost btn-xs text-error hover:bg-error/10"
                              >
                                Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-base-200 px-4 py-2.5 text-right text-xs opacity-40">
                {events.length} {events.length === 1 ? 'evento' : 'eventos'}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      <dialog ref={deleteModalRef} className="modal">
        <div className="modal-box max-w-sm">
          <h3 className="text-base font-semibold">¿Eliminar evento?</h3>
          <p className="py-4 text-sm opacity-70">
            Se eliminarán permanentemente los datos de{' '}
            <strong className="text-base-content">"{deleteTarget?.name}"</strong>.
            Esta acción no se puede deshacer.
          </p>
          <div className="modal-action gap-2">
            <form method="dialog">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setDeleteTarget(null)}
              >
                Cancelar
              </button>
            </form>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={deleting}
              className="btn btn-error btn-sm min-w-25"
            >
              {deleting ? (
                <>
                  <span className="loading loading-spinner loading-xs" aria-hidden="true" />
                  Eliminando…
                </>
              ) : 'Eliminar'}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button onClick={() => setDeleteTarget(null)}>close</button>
        </form>
      </dialog>
    </>
  );
}
