-- A version points to its immediate predecessor; published predecessors cannot be deleted as drafts.
ALTER TABLE public.analysis ADD COLUMN previous_version_id uuid REFERENCES public.analysis(id) ON DELETE RESTRICT;
CREATE INDEX analysis_previous_version_idx ON public.analysis(previous_version_id);

CREATE FUNCTION public.create_analysis_version(p_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE new_id uuid;
BEGIN
  INSERT INTO public.analysis (title, description, alignment_mode, region, show_base100, status, created_by, previous_version_id)
  SELECT title, description, alignment_mode, region, show_base100, 'draft', created_by, id
  FROM public.analysis WHERE id = p_id AND created_by = auth.uid() AND status = 'public'
  RETURNING id INTO new_id;
  IF new_id IS NULL THEN RAISE EXCEPTION 'Analysis unavailable'; END IF;
  INSERT INTO public.analysis_indicators SELECT new_id, indicator_id, sort_order FROM public.analysis_indicators WHERE analysis_id = p_id;
  INSERT INTO public.analysis_periods (id, analysis_id, name, start_date, end_date, color, sort_order)
    SELECT gen_random_uuid(), new_id, name, start_date, end_date, color, sort_order FROM public.analysis_periods WHERE analysis_id = p_id;
  INSERT INTO public.analysis_source_selections SELECT new_id, indicator_id, date, post_id FROM public.analysis_source_selections WHERE analysis_id = p_id;
  INSERT INTO public.analysis_macro_events SELECT new_id, macro_event_id, marker_mode, marker_color FROM public.analysis_macro_events WHERE analysis_id = p_id;
  RETURN new_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_analysis_version(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_analysis_version(uuid) TO authenticated;
