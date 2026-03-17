// filepath: src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

// Supabase configuration from environment variables
const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

// Create a single instance of the Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Type definitions for our database tables
export interface SeriePost {
  id?: string;
  indicator_id: string;
  submitted_by?: string;
  submitted_at?: string;
  data_source: string;
  url?: string | null;
  frequency: string;
  status?: 'pending' | 'approved' | 'rejected' | 'disabled';
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SerieDataPoint {
  id?: string;
  post_id: string;
  date: string;
  value: number;
}
