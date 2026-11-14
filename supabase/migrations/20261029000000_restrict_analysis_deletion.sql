-- Roles are assigned by trusted backend processes, never by browser clients.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.user_roles FROM anon, authenticated;
REVOKE TRUNCATE ON public.analysis FROM anon, authenticated;

-- The role table uses user_id; keep the existing metadata synchronization valid.
CREATE OR REPLACE FUNCTION public.handle_update_user_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE auth.users
    SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) - 'role'
    WHERE id = OLD.user_id;
    RETURN OLD;
  END IF;

  UPDATE auth.users
  SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', NEW.role)
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_user_role_change ON public.user_roles;
CREATE TRIGGER on_user_role_change
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.handle_update_user_role();

ALTER TABLE public.analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "analysis_read" ON public.analysis
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "analysis_insert_owner" ON public.analysis
  FOR INSERT TO authenticated WITH CHECK (created_by = (SELECT auth.uid()));

CREATE POLICY "analysis_update_owner_or_admin" ON public.analysis
  FOR UPDATE TO authenticated
  USING (created_by = (SELECT auth.uid()) OR 'admin' = ANY (
    regexp_split_to_array(btrim(coalesce((SELECT auth.jwt()) -> 'app_metadata' ->> 'role', '')), '\s*,\s*')
  ))
  WITH CHECK (created_by = (SELECT auth.uid()) OR 'admin' = ANY (
    regexp_split_to_array(btrim(coalesce((SELECT auth.jwt()) -> 'app_metadata' ->> 'role', '')), '\s*,\s*')
  ));

CREATE POLICY "analysis_delete_draft_owner_or_admin" ON public.analysis
  FOR DELETE TO authenticated
  USING (status = 'draft' AND (created_by = (SELECT auth.uid()) OR 'admin' = ANY (
    regexp_split_to_array(btrim(coalesce((SELECT auth.jwt()) -> 'app_metadata' ->> 'role', '')), '\s*,\s*')
  )));
