-- A private lookup avoids recursively evaluating the validations SELECT policy.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE FUNCTION private.has_reviewed_series(p_post_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.serie_validations
    WHERE post_id = p_post_id AND validated_by = (SELECT auth.uid())
  );
$$;
REVOKE ALL ON FUNCTION private.has_reviewed_series(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_reviewed_series(uuid) TO authenticated;

DROP POLICY serie_validations_allow_read ON public.serie_validations;
CREATE POLICY serie_validations_allow_read ON public.serie_validations
FOR SELECT TO authenticated USING (
  validated_by = (SELECT auth.uid())
  OR (SELECT public.has_authorized_role(ARRAY['admin', 'editor']))
  OR EXISTS (
    SELECT 1 FROM public.serie_posts p
    WHERE p.id = post_id AND p.status <> 'pending'
  )
  OR private.has_reviewed_series(post_id)
);

-- Aggregates must not disclose pending peer decisions through an owner-run view.
ALTER VIEW public.validation_summary SET (security_invoker = true);
