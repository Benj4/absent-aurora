-- Existing analyses have no reliable evidence of complete reference capture.
-- Version 1 identifies new saves using the full-reference capture workflow.
ALTER TABLE public.analysis ADD COLUMN reference_capture_version smallint NOT NULL DEFAULT 0
  CHECK (reference_capture_version IN (0, 1));
COMMENT ON COLUMN public.analysis.reference_capture_version IS
  '0: original reference completeness unknown; 1: full-reference capture workflow. Versions inherit provenance.';

-- Published content remains unchanged even when its visibility changes.
CREATE OR REPLACE FUNCTION public.protect_published_analysis() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.reference_capture_version IS DISTINCT FROM OLD.reference_capture_version THEN
    RAISE EXCEPTION 'Reference capture provenance is immutable';
  END IF;
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

CREATE OR REPLACE FUNCTION public.save_analysis(p_id uuid, p_config jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE result_id uuid; desired_status text := p_config->>'status';
BEGIN
  IF auth.uid() IS NULL OR desired_status IS NULL OR desired_status NOT IN ('draft', 'public', 'hidden') THEN
    RAISE EXCEPTION 'Invalid user or status';
  END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.analysis(title, description, status, alignment_mode, region, show_base100, reference_capture_version)
    VALUES (p_config->>'title', nullif(p_config->>'description', ''), 'draft',
      p_config->>'alignment_mode', nullif(p_config->>'region', ''), (p_config->>'show_base100')::boolean, 1)
    RETURNING id INTO result_id;
  ELSE
    UPDATE public.analysis SET title = p_config->>'title', description = nullif(p_config->>'description', ''),
      alignment_mode = p_config->>'alignment_mode', region = nullif(p_config->>'region', ''),
      show_base100 = (p_config->>'show_base100')::boolean
    WHERE id = p_id AND created_by = auth.uid() AND status = 'draft' RETURNING id INTO result_id;
    IF result_id IS NULL THEN RAISE EXCEPTION 'Draft unavailable'; END IF;
    DELETE FROM public.analysis_indicators WHERE analysis_id = result_id;
    DELETE FROM public.analysis_periods WHERE analysis_id = result_id;
    DELETE FROM public.analysis_source_selections WHERE analysis_id = result_id;
    DELETE FROM public.analysis_macro_events WHERE analysis_id = result_id;
  END IF;

  INSERT INTO public.analysis_indicators(analysis_id, indicator_id, sort_order)
    SELECT result_id, item->>'indicator_id', (item->>'sort_order')::integer
    FROM jsonb_array_elements(p_config->'indicators') item;
  INSERT INTO public.analysis_periods(id, analysis_id, name, start_date, end_date, color, sort_order)
    SELECT (item->>'id')::uuid, result_id, item->>'name', (item->>'start_date')::date,
      (item->>'end_date')::date, item->>'color', (item->>'sort_order')::integer
    FROM jsonb_array_elements(p_config->'periods') item;
  INSERT INTO public.analysis_source_selections(analysis_id, indicator_id, date, post_id)
    SELECT result_id, item->>'indicator_id', (item->>'date')::date, (item->>'post_id')::uuid
    FROM jsonb_array_elements(p_config->'selections') item;
  INSERT INTO public.analysis_macro_events(analysis_id, macro_event_id, marker_mode, marker_color)
    SELECT result_id, (item->>'macro_event_id')::uuid, item->>'marker_mode', item->>'marker_color'
    FROM jsonb_array_elements(p_config->'events') item;

  IF desired_status <> 'draft' THEN
    UPDATE public.analysis SET status = desired_status WHERE id = result_id AND created_by = auth.uid();
  END IF;
  RETURN result_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_analysis_version(p_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE new_id uuid;
BEGIN
  INSERT INTO public.analysis (title, description, alignment_mode, region, show_base100, status, created_by, previous_version_id, reference_capture_version)
  SELECT title, description, alignment_mode, region, show_base100, 'draft', created_by, id, reference_capture_version
  FROM public.analysis WHERE id = p_id AND created_by = auth.uid() AND status IN ('public', 'hidden')
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
