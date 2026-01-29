-- Migration: Add genre filter indexes
-- Date: 2026-01-26
-- Issue: #404

-- Index for filtering tunes by genre
CREATE INDEX IF NOT EXISTS idx_tune_genre
  ON public.tune(genre)
  WHERE genre IS NOT NULL;

-- Index for filtering notes by last_modified_at
CREATE INDEX IF NOT EXISTS idx_note_last_modified_at
  ON public.note(last_modified_at);