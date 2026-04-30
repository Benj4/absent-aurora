// filepath: src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import type { SeriePost, SerieDataPoint, SerieValidation, UserRole, Analysis, AnalysisIndicator, AnalysisPeriod, AnalysisSourceSelection, AnalysisMacroEvent } from '../types/database';

// Supabase configuration from environment variables
const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

// Create a single instance of the Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export type { SeriePost, SerieDataPoint, SerieValidation, UserRole, Analysis, AnalysisIndicator, AnalysisPeriod, AnalysisSourceSelection, AnalysisMacroEvent };
