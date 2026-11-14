-- Draft and hidden analyses are visible only to their author.
ALTER TABLE public.analysis
  ADD CONSTRAINT analysis_status_check CHECK (status IN ('draft', 'public', 'hidden'));

DROP POLICY analysis_read ON public.analysis;
CREATE POLICY analysis_read ON public.analysis FOR SELECT TO anon, authenticated
  USING (status = 'public' OR created_by = (SELECT auth.uid()));

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['analysis_indicators', 'analysis_periods', 'analysis_source_selections', 'analysis_macro_events'] LOOP
    EXECUTE format('DROP POLICY analysis_child_read ON public.%I', table_name);
    EXECUTE format(
      'CREATE POLICY analysis_child_read ON public.%I FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.analysis a WHERE a.id = analysis_id AND (a.status = ''public'' OR a.created_by = (SELECT auth.uid()))))', table_name);
  END LOOP;
END;
$$;
