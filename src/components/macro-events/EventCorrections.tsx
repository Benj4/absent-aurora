import { useEffect, useRef, useState } from 'react';
import { fetchEventCorrections, type EventCorrection } from '../../lib/macro-event-catalog';

export default function EventCorrections({ id, count, onFollowEvent }: {
  id: string; count: number; onFollowEvent: (id: string) => void;
}) {
  const [items, setItems] = useState<EventCorrection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [done, setDone] = useState(false);
  const busy = useRef(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);

  async function load() {
    if (busy.current || done) return;
    busy.current = true;
    setLoading(true);
    setError(false);
    try {
      const page = await fetchEventCorrections(id, items.at(-1));
      if (!active.current) return;
      setItems(previous => [...new Map([...previous, ...page].map(item => [item.id, item])).values()]);
      setDone(page.length < 20);
    } catch {
      if (active.current) setError(true);
    } finally {
      busy.current = false;
      if (active.current) setLoading(false);
    }
  }

  return <details className="group" onToggle={event => {
    if (event.currentTarget.open && !items.length && !error) void load();
  }}>
    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 font-semibold [&::-webkit-details-marker]:hidden">
      <span>{count === 1 ? 'Tiene 1 corrección' : `Tiene ${count} correcciones`}</span>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-4 shrink-0 group-open:rotate-180"><path d="m6 9 6 6 6-6" /></svg>
    </summary>
    <ul className="space-y-3 pb-2">
      {items.map(correction => <li key={correction.id} className="wrap-anywhere">
        <a className="link link-primary" href={`#event-${correction.id}`} onClick={() => onFollowEvent(correction.id)}>{correction.name || 'Sin nombre'}</a>
        <span className="mt-1 block text-xs text-base-content/70">Creada el {new Intl.DateTimeFormat('es-ES', { timeZone: 'UTC' }).format(new Date(correction.created_at))}{correction.status === 'invalid' ? ' · Invalidada' : ''}</span>
      </li>)}
    </ul>
    {error && <p role="alert" className="text-error">No se pudieron cargar las correcciones.</p>}
    {loading ? <p role="status" className="py-2 text-base-content/70">Cargando correcciones…</p> :
      (error || (!done && items.length < count)) && <button type="button" className="btn btn-ghost" onClick={() => void load()}>{error ? 'Reintentar' : items.length ? 'Cargar más correcciones' : 'Ver correcciones'}</button>}
  </details>;
}
