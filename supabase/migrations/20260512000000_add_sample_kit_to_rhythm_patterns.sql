BEGIN;

ALTER TABLE public.rhythm_patterns
ADD COLUMN sample_kit TEXT NOT NULL DEFAULT 'bodhran';

COMMENT ON COLUMN public.rhythm_patterns.sample_kit IS 'The identifier for the audio sample kit used by the frontend registry (e.g., "bodhran", "spoons") to map MIDI pitches to Cloudflare R2 audio URLs.';

COMMIT;