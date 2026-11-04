CREATE OR REPLACE FUNCTION public.change_record_status(p_type text, p_id uuid, p_status text, p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  previous text;
  is_admin boolean := public.has_authorized_role(ARRAY['admin']);
  reason text := nullif(regexp_replace(p_reason, '^[[:space:]]+|[[:space:]]+$', '', 'g'), '');
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_authorized_role(ARRAY['admin', 'editor']) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_type = 'series' THEN
    SELECT status INTO previous FROM public.serie_posts WHERE id = p_id FOR UPDATE;
    IF previous IS NULL OR p_status IS NULL OR p_status NOT IN ('pending', 'approved', 'rejected', 'disabled') THEN
      RAISE EXCEPTION 'Invalid record or status';
    END IF;
    IF previous = 'disabled' AND p_status <> previous AND NOT is_admin THEN
      RAISE EXCEPTION 'Disabled series cannot be reactivated by an editor';
    END IF;
  ELSIF p_type = 'event' THEN
    SELECT status INTO previous FROM public.macro_events WHERE id = p_id FOR UPDATE;
    IF previous IS NULL OR p_status IS NULL OR p_status NOT IN ('valid', 'invalid') THEN
      RAISE EXCEPTION 'Invalid record or status';
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid record type';
  END IF;
  IF previous = p_status THEN RETURN; END IF;
  IF (is_admin OR p_status IN ('rejected', 'disabled', 'invalid') OR
      (p_type = 'series' AND previous = 'approved' AND p_status <> 'approved')) AND reason IS NULL THEN
    RAISE EXCEPTION 'A reason is required';
  END IF;
  IF p_type = 'series' THEN
    UPDATE public.serie_posts SET status = p_status, updated_at = now() WHERE id = p_id;
  ELSE
    UPDATE public.macro_events SET status = p_status WHERE id = p_id;
  END IF;
  INSERT INTO public.status_change_history(record_type, record_id, old_status, new_status, reason, changed_by)
  VALUES (p_type, p_id, previous, p_status, reason, auth.uid());
END;
$$;
