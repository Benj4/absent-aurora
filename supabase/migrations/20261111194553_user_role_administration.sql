-- Administrators manage other users' assignments using validated session claims.
-- Current-user authorization must never depend on reading this table.
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.user_roles FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.user_roles TO authenticated;
-- Keep the assignment owner immutable, including during an upsert.
GRANT UPDATE (role) ON public.user_roles TO authenticated;

CREATE POLICY user_roles_admin_read ON public.user_roles
FOR SELECT TO authenticated
USING ((SELECT public.has_authorized_role(ARRAY['admin'])));

CREATE POLICY user_roles_admin_insert ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (
  (SELECT public.has_authorized_role(ARRAY['admin']))
  AND user_id <> (SELECT auth.uid())
);

CREATE POLICY user_roles_admin_update ON public.user_roles
FOR UPDATE TO authenticated
USING (
  (SELECT public.has_authorized_role(ARRAY['admin']))
  AND user_id <> (SELECT auth.uid())
)
WITH CHECK (
  (SELECT public.has_authorized_role(ARRAY['admin']))
  AND user_id <> (SELECT auth.uid())
);

CREATE POLICY user_roles_admin_delete ON public.user_roles
FOR DELETE TO authenticated
USING (
  (SELECT public.has_authorized_role(ARRAY['admin']))
  AND user_id <> (SELECT auth.uid())
);

-- The existing on_user_role_change trigger synchronizes Auth app_metadata.
-- Existing tokens retain their roles until refreshed; backend provisioning
-- remains responsible for assigning the first administrator.
