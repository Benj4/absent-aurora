-- Read-only catalog APIs run with the caller's grants and RLS policies.
CREATE FUNCTION public.normalize_event_location(value text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE SET search_path = ''
AS $$ SELECT lower(btrim(regexp_replace(value, '[[:space:]]+', ' ', 'g'))) $$;

CREATE INDEX macro_events_catalog_order_idx ON public.macro_events(start_date DESC, id DESC);

CREATE FUNCTION public.search_macro_events(
  p_status text DEFAULT NULL,
  p_topic public.macro_event_topic DEFAULT NULL,
  p_scope text DEFAULT NULL,
  p_region text DEFAULT NULL,
  p_from date DEFAULT NULL,
  p_until date DEFAULT NULL,
  p_cursor_date date DEFAULT NULL,
  p_cursor_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = ''
AS $$
BEGIN
  IF p_from > p_until THEN
    RAISE EXCEPTION 'Invalid date range' USING ERRCODE = '22023';
  END IF;
  IF (p_cursor_date IS NULL) <> (p_cursor_id IS NULL) THEN
    RAISE EXCEPTION 'Incomplete cursor' USING ERRCODE = '22023';
  END IF;
  RETURN (
    WITH candidates AS MATERIALIZED (
      SELECT e.* FROM public.macro_events e
      WHERE (p_status IS NULL OR e.status = p_status)
        AND (p_topic IS NULL OR e.topic = p_topic)
        AND (p_scope IS NULL OR public.normalize_event_location(e.geo_scope) = public.normalize_event_location(p_scope))
        AND (p_region IS NULL OR public.normalize_event_location(e.geo_region) = public.normalize_event_location(p_region))
        AND (p_from IS NULL OR coalesce(e.end_date, e.start_date) >= p_from)
        AND (p_until IS NULL OR e.start_date <= p_until)
        AND (p_cursor_date IS NULL OR (e.start_date, e.id) < (p_cursor_date, p_cursor_id))
      ORDER BY e.start_date DESC, e.id DESC
      LIMIT 21
    ), page AS (
      SELECT * FROM candidates ORDER BY start_date DESC, id DESC LIMIT 20
    )
    SELECT jsonb_build_object(
      'events', coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.start_date DESC, p.id DESC) FROM page p), '[]'::jsonb),
      'has_more', (SELECT count(*) > 20 FROM candidates)
    )
  );
END;
$$;

CREATE FUNCTION public.macro_event_locations()
RETURNS TABLE(field text, value text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT 'scope'::text, public.normalize_event_location(e.geo_scope)
  FROM public.macro_events e WHERE public.normalize_event_location(e.geo_scope) <> ''
  GROUP BY 2
  UNION
  SELECT 'region'::text, public.normalize_event_location(e.geo_region)
  FROM public.macro_events e WHERE public.normalize_event_location(e.geo_region) <> ''
  GROUP BY 2
  ORDER BY 1, 2
$$;

CREATE FUNCTION public.macro_event_context(p_ids uuid[])
RETURNS TABLE(event_id uuid, original_name text, correction_count bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT e.id, original.name,
    (SELECT count(*) FROM public.macro_events correction WHERE correction.corrects_event_id = e.id)
  FROM public.macro_events e
  LEFT JOIN public.macro_events original ON original.id = e.corrects_event_id
  WHERE e.id = ANY(p_ids) AND cardinality(p_ids) <= 20
$$;

REVOKE ALL ON FUNCTION public.normalize_event_location(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_macro_events(text, public.macro_event_topic, text, text, date, date, date, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.macro_event_locations() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.macro_event_context(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.normalize_event_location(text),
  public.search_macro_events(text, public.macro_event_topic, text, text, date, date, date, uuid),
  public.macro_event_locations(), public.macro_event_context(uuid[])
TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.search_macro_events IS 'Inclusive interval overlap, keyset pagination, 20 public event rows and a bounded lookahead.';
