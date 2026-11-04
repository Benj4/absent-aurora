import { supabase } from './supabase';
import type { Tables, Enums } from './supabase';

export type MacroEventTopic = Enums<'macro_event_topic'>;
export type MacroEvent = Tables<'macro_events'>;
export type MacroEventDraft = Omit<MacroEvent, 'id' | 'created_at' | 'status'>;

export async function fetchMacroEvents() {
  return supabase
    .from('macro_events')
    .select('*')
    .order('start_date', { ascending: false });
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
