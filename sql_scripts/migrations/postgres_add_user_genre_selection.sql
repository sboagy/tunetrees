-- Migration: Add User Genre Selection
-- Date: 2026-01-20
-- Issue: #341
--
-- This migration adds support for user-controlled genre selection.
-- Users can choose which genres to download/sync during onboarding
-- and modify their selection later in settings.

-- Create user_genre_selection table
CREATE TABLE IF NOT EXISTS public.user_genre_selection (
  user_id uuid NOT NULL REFERENCES public.user_profile(id) ON DELETE CASCADE,
  genre_id text NOT NULL REFERENCES public.genre(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  last_modified_at timestamp with time zone DEFAULT now() NOT NULL,
  sync_version integer NOT NULL DEFAULT 1,
  device_id text,
  PRIMARY KEY (user_id, genre_id)
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_user_genre_selection_user_id
  ON public.user_genre_selection(user_id);

CREATE INDEX IF NOT EXISTS idx_user_genre_selection_genre_id
  ON public.user_genre_selection(genre_id);
