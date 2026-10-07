-- The v2 event store writes type and actor_id. Older databases retain the
-- required event_type and user_id columns from the original events table.
-- Preserve historical values while allowing new v2 events to be inserted.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'event_type'
  ) THEN
    ALTER TABLE public.events ALTER COLUMN event_type DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.events ALTER COLUMN user_id DROP NOT NULL;
  END IF;
END $$;
