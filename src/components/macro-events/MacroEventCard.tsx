import { useState, type ReactNode } from 'react';
import type { MacroEvent, MacroEventTopic } from '../../lib/macro-events';
import EventCorrections from './EventCorrections';

const TOPICS: Record<MacroEventTopic, string> = {
  politics: 'Política', economy: 'Economía', nature: 'Naturaleza', health: 'Salud', social: 'Social',
};

function formatDate(raw: string) {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${raw.slice(0, 10)}T00:00:00Z`));
}

function EventDate({ date, label }: { date: string; label: string }) {
  return <time dateTime={date} aria-label={`${label}: ${formatDate(date)}`} className="tabular-nums">{formatDate(date)}</time>;
}

function Description({ description }: { description: string | null }) {
  const [expanded, setExpanded] = useState(false);
  const text = description?.trim() || 'Sin descripción.';
  const truncated = text.length > 180;
  const excerpt = truncated ? text.slice(0, 180).replace(/\s+\S*$/, '').trimEnd() || text.slice(0, 180) : text;
  return (
    <div className="text-sm leading-normal">
      <p className="whitespace-pre-wrap wrap-anywhere">{expanded || !truncated ? text : `${excerpt}…`}</p>
      {truncated && <button type="button" className="link link-primary inline-flex min-h-11 items-center sm:min-h-8" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? 'Ver menos' : 'Ver más'}</button>}
    </div>
  );
}

interface Props {
  event: MacroEvent;
  original: Pick<MacroEvent, 'id' | 'name'> | null;
  correctionCount: number;
  onFollowEvent: (id: string) => void;
  actions?: ReactNode;
}

export default function MacroEventCard({ event, original, correctionCount, onFollowEvent, actions }: Props) {
  const geography = [event.geo_scope, event.geo_region].filter(Boolean).join(' · ');
  return (
    <article id={`event-${event.id}`} tabIndex={-1} aria-labelledby={`event-title-${event.id}`} className="card min-w-0 scroll-mt-4 border border-base-300 bg-base-100 target:ring-2 target:ring-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
      <div className="card-body gap-3 p-4">
        <header className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <h2 id={`event-title-${event.id}`} className="min-w-0 text-base font-semibold leading-snug wrap-anywhere">{event.name || 'Sin nombre'}</h2>
            <p className="flex flex-wrap items-center gap-x-1.5 text-xs leading-normal text-base-content/70">
              <EventDate date={event.start_date} label={event.end_date ? 'Inicio' : 'Fecha'} />
              {event.end_date && <>
                <span aria-hidden="true">–</span>
                <EventDate date={event.end_date} label="Fin" />
              </>}
            </p>
          </div>
          {actions && <div className="-mt-1 -mr-1 shrink-0">{actions}</div>}
        </header>
        <Description description={event.description} />

        <footer className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-base-300 pt-2 text-xs">
          <span className={`badge badge-sm badge-soft ${event.status === 'valid' ? 'badge-success' : 'badge-error'}`}>{event.status === 'valid' ? 'Válido' : 'Invalidado'}</span>
          <span className="text-base-content/70">{TOPICS[event.topic] ?? event.topic ?? 'Sin tema'}</span>
          <span className="min-w-0 wrap-anywhere text-base-content/70">{geography || 'Sin geografía indicada'}</span>
          {event.source_url ? <a className="link link-primary ml-auto inline-flex min-h-11 items-center gap-1 sm:min-h-8" href={event.source_url} target="_blank" rel="noopener noreferrer">
            Fuente del evento
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-3.5"><path d="M14 4h6v6m0-6L10 14m0-10H4v16h16v-6" /></svg>
          </a> : <span className="text-base-content/70">Sin fuente disponible.</span>}
        </footer>
      </div>

      {(event.corrects_event_id || correctionCount > 0) && <div className="rounded-b-box border-t border-base-300 bg-base-200/30 px-4 py-2 text-xs">
        {event.corrects_event_id && <p className="py-1 wrap-anywhere">
          <span className="text-base-content/70">Corrección de: </span>
          {original ? <a className="link link-primary" href={`#event-${original.id}`} onClick={() => onFollowEvent(original.id)}>{original.name || 'Sin nombre'}</a> : <span className="text-base-content/70">Evento original no disponible.</span>}
        </p>}
        {correctionCount > 0 && <EventCorrections id={event.id} count={correctionCount} onFollowEvent={onFollowEvent} />}
      </div>}
    </article>
  );
}
