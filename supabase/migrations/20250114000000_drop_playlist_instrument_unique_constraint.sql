-- Migration: Drop unique constraint on playlist (user_ref, instrument_ref)
-- Date: 2025-11-14
-- Reason: Users should be able to create multiple playlists for the same instrument
--         (e.g., "Beginner Mandolin", "Advanced Mandolin", "Old-Time Mandolin")
-- Drop the unique constraint
ALTER TABLE "public"."playlist"
DROP CONSTRAINT IF EXISTS "playlist_user_ref_instrument_ref_key";

-- Note: This allows multiple playlists per user per instrument combination
-- Playlists are still uniquely identified by playlist_id (primary key)