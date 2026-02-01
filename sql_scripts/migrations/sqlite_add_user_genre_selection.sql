-- Migration: Add User Genre Selection - SQLite WASM
-- Date: 2026-01-20
-- Issue: #341
--
-- This migration adds support for user-controlled genre selection.
-- Users can choose which genres to download/sync during onboarding
-- and modify their selection later in settings.

-- Create user_genre_selection table
CREATE TABLE IF NOT EXISTS user_genre_selection (
  user_id TEXT NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
  genre_id TEXT NOT NULL REFERENCES genre(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_modified_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, genre_id)
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_user_genre_selection_user_id
  ON user_genre_selection(user_id);

CREATE INDEX IF NOT EXISTS idx_user_genre_selection_genre_id
  ON user_genre_selection(genre_id);
