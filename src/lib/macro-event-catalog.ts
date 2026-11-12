import { supabase } from './supabase';
import type { Database } from './supabase';
import type { MacroEvent, MacroEventTopic } from './macro-events';

export interface EventFilters {
  status: '' | 'valid' | 'invalid';
  topic: '' | MacroEventTopic;
  scope: string;
  region: string;
  dateMode: 'range' | 'day';
  from: string;
  until: string;
  day: string;
}

export const EMPTY_EVENT_FILTERS: EventFilters = {
  status: '', topic: '', scope: '', region: '', dateMode: 'range', from: '', until: '', day: '',
};
export const EVENT_TOPICS: Record<MacroEventTopic, string> = {
  politics: 'Política', economy: 'Economía', nature: 'Naturaleza', health: 'Salud', social: 'Social',
};
export type EventContext = Database['public']['Functions']['macro_event_context']['Returns'][number];
export type EventCursor = Pick<MacroEvent, 'start_date' | 'id'>;

export async function fetchEventContext(events: MacroEvent[]) {
  if (!events.length) return {} as Record<string, EventContext>;
  const { data, error } = await supabase.rpc('macro_event_context', { p_ids: events.map(event => event.id) });
  if (error) throw error;
  if (data.length !== events.length) throw new Error('Incomplete event context');
  return Object.fromEntries(data.map(context => [context.event_id, context]));
}

export async function fetchEventPage(filters: EventFilters, cursor?: EventCursor) {
  const { data, error } = await supabase.rpc('search_macro_events', {
    p_status: filters.status || undefined,
    p_topic: filters.topic || undefined,
    p_scope: filters.scope || undefined,
    p_region: filters.region || undefined,
    p_from: (filters.dateMode === 'day' ? filters.day : filters.from) || undefined,
    p_until: (filters.dateMode === 'day' ? filters.day : filters.until) || undefined,
    p_cursor_date: cursor?.start_date,
    p_cursor_id: cursor?.id,
  });
  if (error) throw error;
  // This JSON envelope is produced by search_macro_events from table rows.
  const page = data as unknown as { events: MacroEvent[]; has_more: boolean };
  if (!page || !Array.isArray(page.events) || typeof page.has_more !== 'boolean') throw new Error('Invalid event page');
  return { events: page.events, hasMore: page.has_more, context: await fetchEventContext(page.events) };
}

export async function fetchEventLocations() {
  const options: { scope: string[]; region: string[] } = { scope: [], region: [] };
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.rpc('macro_event_locations').order('field').order('value').range(offset, offset + 499);
    if (error) throw error;
    for (const row of data) {
      if (row.field === 'scope' || row.field === 'region') options[row.field].push(row.value);
    }
    if (data.length < 500) return options;
  }
}

export async function fetchLinkedEvent(id: string) {
  const { data, error } = await supabase.from('macro_events').select('*').eq('id', id).single();
  if (error) throw error;
  return { event: data, context: await fetchEventContext([data]) };
}

export async function fetchEventCorrections(id: string, cursor?: EventCursor) {
  let query = supabase.from('macro_events').select('id, name, created_at, status, start_date')
    .eq('corrects_event_id', id).order('start_date', { ascending: false }).order('id', { ascending: false }).limit(20);
  if (cursor) query = query.or(`start_date.lt.${cursor.start_date},and(start_date.eq.${cursor.start_date},id.lt.${cursor.id})`);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export type EventCorrection = Awaited<ReturnType<typeof fetchEventCorrections>>[number];
