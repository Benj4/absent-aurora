-- Clear application data while preserving local Auth users and their roles.
-- Keep this list aligned with application tables added by migrations.
TRUNCATE TABLE
  public.analysis,
  public.analysis_indicators,
  public.analysis_macro_events,
  public.analysis_periods,
  public.analysis_source_selections,
  public.macro_events,
  public.serie_data,
  public.serie_posts,
  public.serie_validations,
  public.status_change_history
RESTART IDENTITY;
