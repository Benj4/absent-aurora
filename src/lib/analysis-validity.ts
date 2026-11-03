import { supabase } from './supabase';
import type { SeriePost, Tables } from './supabase';

type Source = Pick<SeriePost, 'id' | 'indicator_id' | 'data_source' | 'status'>;
export interface AnalysisValidity {
  sources: Source[];
  events: Pick<Tables<'macro_events'>, 'id' | 'name' | 'status'>[];
  history: Tables<'status_change_history'>[];
  unknown: boolean;
  referencesUnverified?: boolean;
}

/** Check recorded sources independently of the observations used by the chart. */
export async function loadAnalysisValidity(ids: string[]): Promise<Record<string, AnalysisValidity>> {
  const result: Record<string, AnalysisValidity> = Object.fromEntries(ids.map(id => [id, { sources: [], events: [], history: [], unknown: false }]));
  if (!ids.length) return result;
  const [sourceResult, eventResult, provenanceResult] = await Promise.all([
    supabase.from('analysis_source_selections').select('analysis_id, post_id').in('analysis_id', ids),
    supabase.from('analysis_macro_events').select('analysis_id, macro_event_id').in('analysis_id', ids),
    supabase.from('analysis').select('id, reference_capture_version').in('id', ids),
  ]);
  const provenance = provenanceResult.error ? [] : provenanceResult.data ?? [];
  for (const id of ids) {
    const root = provenance.find(analysis => analysis.id === id);
    if (!root) result[id].unknown = true;
    else if (root.reference_capture_version !== 1) {
      result[id].referencesUnverified = true;
      result[id].unknown = true;
    }
  }
  const selections = sourceResult.data;
  const eventSelections = eventResult.data;
  if (sourceResult.error || !selections || eventResult.error || !eventSelections) {
    ids.forEach(id => { result[id].unknown = true; });
    return result;
  }
  const postIds = [...new Set(selections.map(selection => selection.post_id))];
  const eventIds = [...new Set(eventSelections.map(selection => selection.macro_event_id))];
  const [postsResult, eventsResult, historyResult] = await Promise.all([
    postIds.length ? supabase.from('serie_posts').select('id, indicator_id, data_source, status').in('id', postIds) : Promise.resolve({ data: [], error: null }),
    eventIds.length ? supabase.from('macro_events').select('id, name, status').in('id', eventIds) : Promise.resolve({ data: [], error: null }),
    postIds.length || eventIds.length ? supabase.from('status_change_history').select('*').in('record_id', [...postIds, ...eventIds]).order('changed_at', { ascending: false }) : Promise.resolve({ data: [], error: null }),
  ]);
  // Preserve confirmed problems even if another resource fails to load.
  const posts = postsResult.error ? [] : postsResult.data ?? [];
  const events = eventsResult.error ? [] : eventsResult.data ?? [];
  if (postsResult.error || !postsResult.data || eventsResult.error || !eventsResult.data) {
    ids.forEach(id => { result[id].unknown = true; });
  }
  const byId = new Map(posts.map(post => [post.id, post]));
  for (const selection of selections) {
    const validity = result[selection.analysis_id];
    const post = byId.get(selection.post_id);
    if (!post) validity.unknown = true;
    else if (post.status !== 'approved' && !validity.sources.some(source => source.id === post.id)) validity.sources.push(post);
  }
  const eventsById = new Map(events.map(event => [event.id, event]));
  for (const selection of eventSelections) {
    const validity = result[selection.analysis_id];
    const event = eventsById.get(selection.macro_event_id);
    if (!event) validity.unknown = true;
    else if (event.status === 'invalid') validity.events.push(event);
  }
  if (historyResult.error || !historyResult.data) ids.forEach(id => { result[id].unknown = true; });
  else for (const id of ids) {
    const sourceIds = new Set(result[id].sources.map(source => source.id));
    const affectedEventIds = new Set(result[id].events.map(event => event.id));
    result[id].history = historyResult.data.filter(entry => entry.record_type === 'series' ? sourceIds.has(entry.record_id) : affectedEventIds.has(entry.record_id));
  }
  return result;
}

export function sourceStatus(status: string): string {
  return ({ disabled: 'Deshabilitada', rejected: 'Rechazada', pending: 'Pendiente', approved: 'Aprobada', valid: 'Válido', invalid: 'Invalidado' } as Record<string, string>)[status] ?? status;
}
