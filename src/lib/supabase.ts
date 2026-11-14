// filepath: src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import type { Database, Tables } from '../types/database.types';

// Supabase configuration from environment variables
const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

// Create a single instance of the Supabase client
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);

export type { Database, Tables, TablesInsert, TablesUpdate, Enums } from '../types/database.types';
export type SeriePost = Tables<'serie_posts'>;
export type SerieDataPoint = Tables<'serie_data'>;
export type SerieValidation = Tables<'serie_validations'>;
export type UserRole = Tables<'user_roles'>;
export type Analysis = Tables<'analysis'>;
export type AnalysisIndicator = Tables<'analysis_indicators'>;
export type AnalysisPeriod = Tables<'analysis_periods'>;
export type AnalysisSourceSelection = Tables<'analysis_source_selections'>;
export type AnalysisMacroEvent = Tables<'analysis_macro_events'>;
