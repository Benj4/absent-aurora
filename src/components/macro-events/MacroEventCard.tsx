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
  const [year, month, day] = date.split('-');
  const monthName = new Intl.DateTimeFormat('es-ES', { month: 'short', timeZone: 'UTC' })
    .format(new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))));
  return (
    <time dateTime={date} aria-label={`${label}: ${formatDate(date)}`} className="flex min-w-0 items-center gap-2.5 tabular-nums">
      <span aria-hidden="true" className="text-3xl font-semibold leading-none">{day}</span>
      <span aria-hidden="true" className="text-xs leading-snug"><span className="block font-semibold">{monthName}</span><span className="text-base-content/70">{year}</span></span>
    </time>
  );
}

function Description({ description }: { description: string | null }) {
  const [expanded, setExpanded] = useState(false);
  const text = description?.trim() || 'Sin descripción.';
  const truncated = text.length > 240;
  const excerpt = truncated ? text.slice(0, 240).replace(/\s+\S*$/, '').trimEnd() || text.slice(0, 240) : text;
  return (
    <div className="text-sm leading-relaxed">
      <p className="whitespace-pre-wrap wrap-anywhere">{expanded || !truncated ? text : `${excerpt}…`}</p>
      {truncated && <button type="button" className="link link-primary inline-flex min-h-11 items-center" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? 'Ver menos' : 'Ver más'}</button>}
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
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3 rounded-t-box border-b border-base-300 bg-base-200/50 px-5 py-4">
        <div className="flex flex-wrap items-center gap-4">
          <EventDate date={event.start_date} label={event.end_date ? 'Inicio' : 'Fecha'} />
          {event.end_date && <>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-5 shrink-0 text-base-content/60"><path d="M4 12h16m-6-6 6 6-6 6" /></svg>
            <EventDate date={event.end_date} label="Fin" />
          </>}
        </div>
        <span className="text-xs text-base-content/70">{event.end_date ? 'Período' : 'Hito puntual'}</span>
      </div>

      <div className="card-body gap-4 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 id={`event-title-${event.id}`} className="card-title min-w-0 text-xl font-bold leading-snug wrap-anywhere">{event.name || 'Sin nombre'}</h2>
          {actions}
        </div>
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <span className={`badge badge-sm badge-soft ${event.status === 'valid' ? 'badge-success' : 'badge-error'}`}>{event.status === 'valid' ? 'Válido' : 'Invalidado'}</span>
          <span className="text-base-content/70">{TOPICS[event.topic] ?? event.topic ?? 'Sin tema'}</span>
        </div>
        <Description description={event.description} />

        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-base-300 pt-3 text-sm">
          <span className="flex min-w-0 items-start gap-2 text-base-content/70">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mt-0.5 size-4 shrink-0"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>
            <span className="wrap-anywhere">{geography || 'Sin geografía indicada'}</span>
          </span>
          {event.source_url ? <a className="link link-primary inline-flex min-h-11 items-center gap-1.5" href={event.source_url} target="_blank" rel="noopener noreferrer">
            Fuente del evento
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-4"><path d="M14 4h6v6m0-6L10 14m0-10H4v16h16v-6" /></svg>
          </a> : <span className="text-xs text-base-content/70">Sin fuente disponible.</span>}
        </div>
      </div>

      {(event.corrects_event_id || correctionCount > 0) && <div className="rounded-b-box border-t border-base-300 bg-base-200/30 px-5 py-3 text-sm sm:px-6">
        {event.corrects_event_id && <p className="py-1 wrap-anywhere">
          <span className="font-semibold">Corrección de: </span>
          {original ? <a className="link link-primary" href={`#event-${original.id}`} onClick={() => onFollowEvent(original.id)}>{original.name || 'Sin nombre'}</a> : <span className="text-base-content/70">Evento original no disponible.</span>}
        </p>}
        {correctionCount > 0 && <EventCorrections id={event.id} count={correctionCount} onFollowEvent={onFollowEvent} />}
      </div>}
    </article>
  );
}
