-- Existing votes are preserved; browser clients may only append their own votes.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.serie_validations FROM anon;
REVOKE UPDATE, DELETE, TRUNCATE ON public.serie_validations FROM authenticated;
DROP POLICY serie_validations_update ON public.serie_validations;
DROP POLICY serie_validations_insert ON public.serie_validations;
CREATE POLICY serie_validations_insert ON public.serie_validations FOR INSERT TO authenticated
  WITH CHECK (validated_by = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.serie_posts p WHERE p.id = post_id AND p.submitted_by <> (SELECT auth.uid())
  ));

-- These policies cannot grant direct writes, which were revoked in the status migration.
DROP POLICY "Only editors can status" ON public.serie_posts;
DROP POLICY "Only owner can update when draft" ON public.serie_posts;
CREATE OR REPLACE FUNCTION public.serie_posts_enforce_update_rules()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.indicator_id IS DISTINCT FROM OLD.indicator_id OR NEW.data_source IS DISTINCT FROM OLD.data_source
    OR NEW.frequency IS DISTINCT FROM OLD.frequency OR NEW.notes IS DISTINCT FROM OLD.notes
    OR NEW.submitted_by IS DISTINCT FROM OLD.submitted_by OR NEW.url IS DISTINCT FROM OLD.url
    OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Series content is immutable';
  END IF;
  RETURN NEW;
END;
$$;
