-- Correction provenance cannot be reassigned or made cyclic after creation.
CREATE OR REPLACE FUNCTION public.protect_macro_event_correction_link()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.corrects_event_id IS DISTINCT FROM OLD.corrects_event_id
      OR NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Event identity and correction links are immutable';
    END IF;
  ELSIF NEW.corrects_event_id IS NOT NULL THEN
    -- Require an existing predecessor; the FK handles concurrent deletion.
    -- A read needs no UPDATE privilege, which browser roles do not have.
    PERFORM id FROM public.macro_events WHERE id = NEW.corrects_event_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The corrected event must already exist' USING ERRCODE = '23503';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER protect_macro_event_correction_link
  BEFORE INSERT OR UPDATE ON public.macro_events
  FOR EACH ROW EXECUTE FUNCTION public.protect_macro_event_correction_link();
