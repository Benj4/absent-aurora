import { supabase } from './supabase';
import type { Tables, Enums } from './supabase';

export type MacroEventTopic = Enums<'macro_event_topic'>;
export type MacroEvent = Tables<'macro_events'>;
export type MacroEventDraft = Omit<MacroEvent, 'id' | 'created_at'>;

export async function fetchMacroEvents() {
  return supabase
    .from('macro_events')
    .select('*')
    .order('start_date', { ascending: false });
}

export async function createMacroEvent(draft: MacroEventDraft) {
  return supabase.from('macro_events').insert(draft).select().single();
}

export async function updateMacroEvent(id: string, draft: Partial<MacroEventDraft>) {
  return supabase.from('macro_events').update(draft).eq('id', id).select().single();
}

export async function deleteMacroEvent(id: string) {
  return supabase.from('macro_events').delete().eq('id', id);
}
