BEGIN;

-- ============================================================================
-- Migration: Add rhythm pattern storage and default BPM metadata
-- Issue: #607 - Rhythm Engine UI & Schema Expansion (Phase 2)
-- ============================================================================

ALTER TABLE public.genre_tune_type
ADD COLUMN default_bpm INTEGER;

COMMENT ON COLUMN public.genre_tune_type.default_bpm IS 'The baseline tempo (Beats/Quarter-notes Per Minute) for this specific genre and tune type combination (e.g., 115 for an ITRAD JigD).';

CREATE TABLE public.rhythm_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  genre_id TEXT NOT NULL,
  tune_type_id TEXT NOT NULL,
  name TEXT NOT NULL,
  part_target TEXT DEFAULT '*',
  abc_string TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  premium_audio_url TEXT,

  CONSTRAINT rhythm_patterns_genre_id_fkey
    FOREIGN KEY (genre_id)
    REFERENCES public.genre (id)
    ON DELETE CASCADE,
  CONSTRAINT rhythm_patterns_tune_type_id_fkey
    FOREIGN KEY (tune_type_id)
    REFERENCES public.tune_type (id)
    ON DELETE CASCADE
) TABLESPACE pg_default;

ALTER TABLE public.rhythm_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view rhythm_patterns"
ON public.rhythm_patterns
FOR SELECT
USING (true);

COMMENT ON TABLE public.rhythm_patterns IS 'Stores the ABC percussion strings and optional premium audio loop URLs for generating rhythm accompaniment, allowing for per-part variations and overrides.';

COMMENT ON COLUMN public.rhythm_patterns.id IS 'Unique identifier for the rhythm pattern variation.';

COMMENT ON COLUMN public.rhythm_patterns.genre_id IS 'Foreign key component referencing the genre (e.g., ITRAD).';

COMMENT ON COLUMN public.rhythm_patterns.tune_type_id IS 'Foreign key component referencing the tune type (e.g., JigD).';

COMMENT ON COLUMN public.rhythm_patterns.name IS 'A human-readable description for the UI dropdown (e.g., "Basic Rolling", "Driving Backbeat").';

COMMENT ON COLUMN public.rhythm_patterns.part_target IS 'Specifies which structural part this pattern targets. "*" or NULL applies to the whole tune, "A" applies only to the A part, "B" to the B part, allowing the groove to change mid-tune.';

COMMENT ON COLUMN public.rhythm_patterns.abc_string IS 'The 2-bar or 4-bar ABC notation string used by the abcjs TimingCallbacks engine to generate the metronome loop (e.g., |: C2 c C c c :|).';

COMMENT ON COLUMN public.rhythm_patterns.is_default IS 'If true, this is the baseline Smart Metronome pattern that loads automatically when the user selects this genre/tune-type combination.';

COMMENT ON COLUMN public.rhythm_patterns.premium_audio_url IS 'Optional URL to a pre-recorded audio loop (e.g., an MP3 hosted on Cloudflare R2). If present, the UI logic should prioritize streaming this file over generating the ABC string.';

COMMIT;