-- Analysis authors can create events without a privileged application role.
ALTER POLICY macro_event_insert ON public.macro_events
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND status = 'valid');
