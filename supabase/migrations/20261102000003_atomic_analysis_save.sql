-- Save the root and all configuration in one transaction, then publish if requested.
CREATE FUNCTION public.save_analysis(p_id uuid, p_config jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE result_id uuid; desired_status text := p_config->>'status';
BEGIN
  IF auth.uid() IS NULL OR desired_status IS NULL OR desired_status NOT IN ('draft', 'public', 'hidden') THEN
    RAISE EXCEPTION 'Invalid user or status';
  END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.analysis(title, description, status, alignment_mode, region, show_base100)
    VALUES (p_config->>'title', nullif(p_config->>'description', ''), 'draft',
      p_config->>'alignment_mode', nullif(p_config->>'region', ''), (p_config->>'show_base100')::boolean)
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
REVOKE ALL ON FUNCTION public.save_analysis(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_analysis(uuid,jsonb) TO authenticated;
