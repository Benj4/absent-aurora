// ============================================================================
// AUTOMATICALLY GENERATED — DO NOT EDIT MANUALLY
// ============================================================================
// Source:  database/schema.sql
// Script:  scripts/generate-types.ts
// Command: pnpm run generate:types
// Generated: 2026-04-30T20:03:28.549Z
// ============================================================================

/**
 * TypeScript interface declarations for all `public` schema tables.
 *
 * @example
 * ```typescript
 * import type { SeriePost, SerieDataPoint } from '@/types/database';
 * ```
 */
// ============================================================================
// SERIE_DATA
// ============================================================================
/**
 * Maps database table: `public.serie_data`
 * @pk id
 */
export interface SerieDataPoint {
  id: string;
  /** FK → public.serie_posts(id) */
  post_id: string;
  date: string;
  value: number;
}

// ============================================================================
// SERIE_POSTS
// ============================================================================
/**
 * Maps database table: `public.serie_posts`
 * @pk id
 */
export interface SeriePost {
  id: string;
  indicator_id: string;
  submitted_by: string;
  submitted_at: string;
  data_source: string;
  frequency: string;
  status: 'pending' | 'approved' | 'rejected' | 'disabled';
  notes?: string;
  created_at: string;
  updated_at: string;
  url?: string;
}

// ============================================================================
// SERIE_VALIDATIONS
// ============================================================================
/**
 * Maps database table: `public.serie_validations`
 * @pk id
 */
export interface SerieValidation {
  id: string;
  /** FK → public.serie_posts(id) */
  post_id: string;
  validated_by: string;
  validated_at: string;
  validation_status: 'approved' | 'rejected';
  validation_notes?: string;
  created_at: string;
}

// ============================================================================
// USER_ROLES
// ============================================================================
/**
 * Maps database table: `public.user_roles`
 * @pk user_id
 */
export interface UserRole {
  /** FK → auth.users(id) */
  user_id: string;
  role: 'admin' | 'editor' | 'user';
}

// ============================================================================
// ANALYSIS
// ============================================================================
/**
 * Maps database table: `public.analysis`
 * @pk id
 */
export interface Analysis {
  id: string;
  title: string;
  description?: string;
  alignment_mode: 'indice_cero' | 'calendario';
  region?: string;
  show_base100: boolean;
  /** FK → auth.users(id) */
  created_by: string;
  created_at: string;
  updated_at: string;
  status: string;
}

// ============================================================================
// ANALYSIS_INDICATORS
// ============================================================================
/**
 * Maps database table: `public.analysis_indicators`
 * @pk analysis_id, indicator_id
 */
export interface AnalysisIndicator {
  /** FK → public.analysis(id) */
  analysis_id: string;
  indicator_id: string;
  sort_order: number;
}

// ============================================================================
// ANALYSIS_PERIODS
// ============================================================================
/**
 * Maps database table: `public.analysis_periods`
 * @pk id
 */
export interface AnalysisPeriod {
  id: string;
  /** FK → public.analysis(id) */
  analysis_id: string;
  name: string;
  start_date: string;
  end_date: string;
  color: string;
  sort_order: number;
}

// ============================================================================
// ANALYSIS_SOURCE_SELECTIONS
// ============================================================================
/**
 * Maps database table: `public.analysis_source_selections`
 * @pk analysis_id, indicator_id, date
 */
export interface AnalysisSourceSelection {
  /** FK → public.analysis(id) */
  analysis_id: string;
  indicator_id: string;
  date: string;
  /** FK → public.serie_posts(id) */
  post_id: string;
}

// ============================================================================
// ANALYSIS_MACRO_EVENTS
// ============================================================================
/**
 * Maps database table: `public.analysis_macro_events`
 * @pk analysis_id, macro_event_id
 */
export interface AnalysisMacroEvent {
  /** FK → public.analysis(id) */
  analysis_id: string;
  /** FK → public.macro_events(id) */
  macro_event_id: string;
  marker_mode?: 'none' | 'start' | 'end' | 'both';
  marker_color?: string;
}
