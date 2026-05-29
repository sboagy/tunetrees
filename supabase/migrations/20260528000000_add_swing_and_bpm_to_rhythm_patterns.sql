BEGIN;

-- ============================================================================
-- Migration: Add swing, swing_desc, and bpm_override to rhythm_patterns
-- Issue: #639 - Swing control UI
-- ============================================================================

ALTER TABLE public.rhythm_patterns
  ADD COLUMN swing_percentage REAL NOT NULL DEFAULT 0,
  ADD COLUMN swing_desc TEXT,
  ADD COLUMN bpm_override INTEGER;

COMMENT ON COLUMN public.rhythm_patterns.swing_percentage IS 'Swing amount as a fraction (0.0–1.0). Applied as a delay multiplier during playback. Hornpipe defaults to 0.33, jig to ~0.167, others to 0.';
COMMENT ON COLUMN public.rhythm_patterns.swing_desc IS 'Future use: describes which beats get swung for this pattern (e.g., "off-beat 8ths", "middle triplet").';
COMMENT ON COLUMN public.rhythm_patterns.bpm_override IS 'Per-pattern BPM override. When set, supersedes genre_tune_type.default_bpm. Null means use the default.';

COMMIT;
