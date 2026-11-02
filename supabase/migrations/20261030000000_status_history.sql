-- Content is immutable; state changes are recorded through one transactional function.
ALTER TABLE public.macro_events ADD COLUMN status text NOT NULL DEFAULT 'valid'
  CHECK (status IN ('valid', 'invalid'));
ALTER TABLE public.analysis_macro_events DROP CONSTRAINT analysis_macro_events_event_fkey;
ALTER TABLE public.analysis_macro_events ADD CONSTRAINT analysis_macro_events_event_fkey
  FOREIGN KEY (macro_event_id) REFERENCES public.macro_events(id) ON DELETE RESTRICT;

CREATE TABLE public.status_change_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_type text NOT NULL CHECK (record_type IN ('series', 'event')),
  record_id uuid NOT NULL,
  old_status text NOT NULL,
  new_status text NOT NULL,
  reason text,
  changed_by uuid NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX status_change_history_record_idx ON public.status_change_history(record_type, record_id, changed_at DESC);
ALTER TABLE public.status_change_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY status_change_history_read ON public.status_change_history FOR SELECT TO anon, authenticated USING (true);
REVOKE ALL ON public.status_change_history FROM anon, authenticated;
GRANT SELECT ON public.status_change_history TO anon, authenticated;

CREATE FUNCTION public.has_authorized_role(allowed text[]) RETURNS boolean
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM unnest(allowed) AS candidate
    WHERE CASE jsonb_typeof(auth.jwt() -> 'app_metadata' -> 'role')
      WHEN 'array' THEN (auth.jwt() -> 'app_metadata' -> 'role') ? candidate
      WHEN 'string' THEN candidate = ANY (regexp_split_to_array(btrim(auth.jwt() -> 'app_metadata' ->> 'role'), '\s*,\s*'))
      ELSE false END
  );
$$;

-- Browsers cannot update records directly, including through old permissive policies.
REVOKE UPDATE, DELETE, TRUNCATE ON public.serie_posts, public.serie_data, public.macro_events FROM anon, authenticated;
REVOKE INSERT ON public.serie_posts, public.serie_data FROM anon, authenticated;
ALTER TABLE public.macro_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY macro_event_read ON public.macro_events FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY macro_event_insert ON public.macro_events FOR INSERT TO authenticated
  WITH CHECK (public.has_authorized_role(ARRAY['admin', 'editor']) AND status = 'valid');

CREATE FUNCTION public.create_series_with_points(p_indicator_id text, p_source text, p_url text,
  p_frequency text, p_notes text, p_points jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE new_id uuid;
BEGIN
  IF auth.uid() IS NULL OR jsonb_typeof(p_points) <> 'array' OR jsonb_array_length(p_points) = 0 THEN
    RAISE EXCEPTION 'Authentication and observations are required';
  END IF;
  INSERT INTO public.serie_posts(indicator_id, data_source, url, frequency, notes, submitted_by)
  VALUES (p_indicator_id, p_source, nullif(p_url, ''), p_frequency, nullif(p_notes, ''), auth.uid()) RETURNING id INTO new_id;
  INSERT INTO public.serie_data(post_id, date, value)
  SELECT new_id,
    (CASE WHEN point->>'date' ~ '^\d{4}$' THEN (point->>'date') || '-01-01' ELSE point->>'date' END)::date,
    (point->>'value')::numeric FROM jsonb_array_elements(p_points) point;
  RETURN new_id;
END;
$$;

CREATE FUNCTION public.change_record_status(p_type text, p_id uuid, p_status text, p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE previous text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_authorized_role(ARRAY['admin', 'editor']) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_type = 'series' THEN
    SELECT status INTO previous FROM public.serie_posts WHERE id = p_id FOR UPDATE;
    IF previous IS NULL OR p_status NOT IN ('pending', 'approved', 'rejected', 'disabled') THEN RAISE EXCEPTION 'Invalid record or status'; END IF;
    IF previous = 'disabled' AND p_status <> previous THEN RAISE EXCEPTION 'Disabled series cannot be reactivated'; END IF;
  ELSIF p_type = 'event' THEN
    SELECT status INTO previous FROM public.macro_events WHERE id = p_id FOR UPDATE;
    IF previous IS NULL OR p_status NOT IN ('valid', 'invalid') THEN RAISE EXCEPTION 'Invalid record or status'; END IF;
  ELSE RAISE EXCEPTION 'Invalid record type'; END IF;
  IF previous = p_status THEN RETURN; END IF;
  IF (p_status IN ('rejected', 'disabled', 'invalid') OR (p_type = 'series' AND previous = 'approved' AND p_status <> 'approved'))
    AND nullif(btrim(p_reason), '') IS NULL THEN RAISE EXCEPTION 'A reason is required'; END IF;
  IF p_type = 'series' THEN
    UPDATE public.serie_posts SET status = p_status, updated_at = now() WHERE id = p_id;
  ELSE
    UPDATE public.macro_events SET status = p_status WHERE id = p_id;
  END IF;
  INSERT INTO public.status_change_history(record_type, record_id, old_status, new_status, reason, changed_by)
  VALUES (p_type, p_id, previous, p_status, nullif(btrim(p_reason), ''), auth.uid());
END;
$$;

CREATE FUNCTION public.delete_series_or_event(p_type text, p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_authorized_role(ARRAY['admin']) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_type = 'series' THEN DELETE FROM public.serie_posts WHERE id = p_id;
  ELSIF p_type = 'event' THEN DELETE FROM public.macro_events WHERE id = p_id;
  ELSE RAISE EXCEPTION 'Invalid record type'; END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'Record not found'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.create_series_with_points(text,text,text,text,text,jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.change_record_status(text,uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_series_or_event(text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_series_with_points(text,text,text,text,text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.change_record_status(text,uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_series_or_event(text,uuid) TO authenticated;
