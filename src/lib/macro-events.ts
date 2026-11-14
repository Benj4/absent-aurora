import { supabase } from './supabase';
import type { Tables, TablesInsert, Enums } from './supabase';

export type MacroEventTopic = Enums<'macro_event_topic'>;
export type MacroEvent = Tables<'macro_events'>;
export type MacroEventDraft = Omit<TablesInsert<'macro_events'>, 'id' | 'created_at' | 'status'>;

export async function fetchMacroEvents() {
  const events: MacroEvent[] = [];
  const pageSize = 500;
  // Load the whole catalog so correction links are not lost at the API row cap.
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('macro_events')
      .select('*')
      .order('start_date', { ascending: false })
      .order('id')
      .range(offset, offset + pageSize - 1);
    if (error) return { data: null, error };
    events.push(...data);
    if (data.length < pageSize) return { data: events, error: null };
  }
}

export async function createMacroEvent(draft: MacroEventDraft) {
  return supabase.from('macro_events').insert(draft).select().single();
}

export async function deleteMacroEvent(id: string) {
  return supabase.rpc('delete_series_or_event', { p_type: 'event', p_id: id });
}

export async function changeMacroEventStatus(id: string, status: 'valid' | 'invalid', reason: string) {
  return supabase.rpc('change_record_status', {
    p_type: 'event', p_id: id, p_status: status, p_reason: reason,
  });
}
