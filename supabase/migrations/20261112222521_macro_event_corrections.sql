-- Corrections append events and retain an immutable link to their predecessor.
ALTER TABLE public.macro_events
  ADD COLUMN corrects_event_id uuid,
  ADD CONSTRAINT macro_events_corrects_event_fkey
    FOREIGN KEY (corrects_event_id) REFERENCES public.macro_events(id) ON DELETE RESTRICT,
  ADD CONSTRAINT macro_events_cannot_correct_self CHECK (corrects_event_id <> id);

CREATE INDEX macro_events_corrects_event_idx ON public.macro_events(corrects_event_id);

COMMENT ON COLUMN public.macro_events.corrects_event_id IS
  'Immediate predecessor corrected by this event. NULL for events without recorded correction provenance.';

-- Preserve the existing public read and authenticated insert policies. The
-- predecessor FK also protects originals from deletion while corrections exist.
