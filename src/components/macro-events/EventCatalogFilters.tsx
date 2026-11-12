import { useState, type ReactNode } from 'react';
import { EMPTY_EVENT_FILTERS, EVENT_TOPICS, type EventFilters } from '../../lib/macro-event-catalog';

export default function EventCatalogFilters({ onApply, locations, locationError, onRetryLocations, actions }: {
  onApply: (filters: EventFilters) => void;
  locations: { scope: string[]; region: string[] };
  locationError: boolean;
  onRetryLocations: () => void;
  actions: ReactNode;
}) {
  const [draft, setDraft] = useState<EventFilters>(EMPTY_EVENT_FILTERS);
  const [invalid, setInvalid] = useState(false);
  const update = <K extends keyof EventFilters>(key: K, value: EventFilters[K]) => {
    setDraft(previous => ({ ...previous, [key]: value }));
    setInvalid(false);
  };
  return <form className="mb-6 space-y-4 rounded-box border border-base-300 bg-base-100 p-5 lg:p-6" onSubmit={event => {
    event.preventDefault();
    if (draft.dateMode === 'range' && draft.from && draft.until && draft.from > draft.until) { setInvalid(true); return; }
    onApply({ ...draft });
  }}>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <label className="flex min-w-0 flex-col gap-1.5 text-xs font-semibold">Estado
        <select className="select w-full font-normal" value={draft.status} onChange={event => update('status', event.target.value as EventFilters['status'])}>
          <option value="">Todos</option><option value="valid">Válidos</option><option value="invalid">Invalidados</option>
        </select>
      </label>
      <label className="flex min-w-0 flex-col gap-1.5 text-xs font-semibold">Tema
        <select className="select w-full font-normal" value={draft.topic} onChange={event => update('topic', event.target.value as EventFilters['topic'])}>
          <option value="">Todos los temas</option>{Object.entries(EVENT_TOPICS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      {(['scope', 'region'] as const).map(field => <label key={field} className="flex min-w-0 flex-col gap-1.5 text-xs font-semibold">{field === 'scope' ? 'Ámbito geográfico' : 'Región o lugar'}
        <select className="select w-full font-normal" value={draft[field]} onChange={event => update(field, event.target.value)}>
          <option value="">Todos</option>{locations[field].map(value => <option key={value} value={value}>{value.charAt(0).toLocaleUpperCase('es') + value.slice(1)}</option>)}
        </select>
      </label>)}
    </div>
    {locationError && <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-error"><span>No se pudieron cargar los lugares.</span><button type="button" className="btn btn-ghost" onClick={onRetryLocations}>Reintentar</button></div>}
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <label className="flex min-w-0 flex-col gap-1.5 text-xs font-semibold">Fecha del evento
        <select className="select w-full font-normal" value={draft.dateMode} onChange={event => update('dateMode', event.target.value as EventFilters['dateMode'])}>
          <option value="range">Desde / hasta</option><option value="day">Fecha puntual</option>
        </select>
      </label>
      {draft.dateMode === 'day' ? <label className="flex min-w-0 flex-col gap-1.5 text-xs font-semibold">Fecha puntual
        <input className="input min-w-0 w-full font-normal" type="date" value={draft.day} onChange={event => update('day', event.target.value)} />
      </label> : <>
        <label className="flex min-w-0 flex-col gap-1.5 text-xs font-semibold">Desde
          <input className="input min-w-0 w-full font-normal" type="date" value={draft.from} aria-invalid={invalid} aria-describedby={invalid ? 'event-date-error' : undefined} onChange={event => update('from', event.target.value)} />
        </label>
        <label className="flex min-w-0 flex-col gap-1.5 text-xs font-semibold">Hasta
          <input className="input min-w-0 w-full font-normal" type="date" value={draft.until} aria-invalid={invalid} aria-describedby={invalid ? 'event-date-error' : undefined} onChange={event => update('until', event.target.value)} />
        </label>
      </>}
    </div>
    {invalid && <p id="event-date-error" role="alert" className="text-sm text-error">La fecha «Desde» debe ser anterior o igual a «Hasta».</p>}
    <p className="text-xs text-base-content/70">Incluye hitos y períodos que coincidan con las fechas elegidas. Puedes indicar solo desde o solo hasta.</p>
    <div className="flex flex-wrap justify-between gap-3 border-t border-base-300 pt-4">
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn btn-primary">Aplicar filtros</button>
        <button type="button" className="btn btn-ghost" onClick={() => { setDraft(EMPTY_EVENT_FILTERS); setInvalid(false); onApply({ ...EMPTY_EVENT_FILTERS }); }}>Limpiar filtros</button>
      </div>
      {actions}
    </div>
  </form>;
}
