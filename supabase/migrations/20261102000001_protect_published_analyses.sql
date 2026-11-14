-- Published content remains unchanged even when its visibility changes.
CREATE FUNCTION public.protect_published_analysis() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.previous_version_id IS DISTINCT FROM OLD.previous_version_id THEN
    RAISE EXCEPTION 'Analysis ownership and version links are immutable';
  END IF;
  IF OLD.status <> 'draft' AND (
    NEW.status = 'draft'
    OR NEW.title IS DISTINCT FROM OLD.title
    OR NEW.description IS DISTINCT FROM OLD.description
    OR NEW.alignment_mode IS DISTINCT FROM OLD.alignment_mode
    OR NEW.region IS DISTINCT FROM OLD.region
    OR NEW.show_base100 IS DISTINCT FROM OLD.show_base100
  ) THEN
    RAISE EXCEPTION 'Published analysis content is immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_published_analysis BEFORE UPDATE ON public.analysis
FOR EACH ROW EXECUTE FUNCTION public.protect_published_analysis();

-- Configuration belongs to its author and can only change in a draft.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['analysis_indicators', 'analysis_periods', 'analysis_source_selections', 'analysis_macro_events'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('CREATE POLICY analysis_child_read ON public.%I FOR SELECT TO anon, authenticated USING (true)', table_name);
    EXECUTE format(
      'CREATE POLICY analysis_child_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.analysis a WHERE a.id = analysis_id AND a.created_by = (SELECT auth.uid()) AND a.status = ''draft''))', table_name);
    EXECUTE format(
      'CREATE POLICY analysis_child_update ON public.%I FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.analysis a WHERE a.id = analysis_id AND a.created_by = (SELECT auth.uid()) AND a.status = ''draft'')) WITH CHECK (EXISTS (SELECT 1 FROM public.analysis a WHERE a.id = analysis_id AND a.created_by = (SELECT auth.uid()) AND a.status = ''draft''))', table_name);
    EXECUTE format(
      'CREATE POLICY analysis_child_delete ON public.%I FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.analysis a WHERE a.id = analysis_id AND a.created_by = (SELECT auth.uid()) AND a.status = ''draft''))', table_name);
    EXECUTE format('REVOKE TRUNCATE ON public.%I FROM anon, authenticated', table_name);
  END LOOP;
END;
$$;
