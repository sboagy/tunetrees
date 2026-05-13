BEGIN;

ALTER TABLE public.rhythm_patterns
ADD COLUMN tune_id UUID NULL,
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NULL,
ADD COLUMN pattern_type TEXT NOT NULL DEFAULT 'seed' CHECK (pattern_type IN ('seed', 'full_track'));

COMMENT ON COLUMN public.rhythm_patterns.tune_id IS 'If set, this pattern specifically overrides the default for a single tune.';
COMMENT ON COLUMN public.rhythm_patterns.user_id IS 'If set, this pattern is a private override created by a specific user.';
COMMENT ON COLUMN public.rhythm_patterns.pattern_type IS 'Defines how the frontend should render the abc_string. "seed" means tile/repeat it to match the tune length. "full_track" means play it exactly as written without looping.';

COMMIT;