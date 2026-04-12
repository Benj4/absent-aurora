import { supabase } from './supabase';

export type MacroEventTopic = 'politics' | 'economy' | 'nature' | 'health' | 'social';

export interface MacroEvent {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  geo_scope: string | null;
  geo_region: string | null;
  topic: MacroEventTopic;
  source_url: string;
  created_at: string;
}

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
