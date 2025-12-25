-- Migration: Add Hybrid Genre Support (Trad/Pop/Classical) - SQLite WASM
-- Date: 2025-12-16
-- Issue: #246
--
-- This migration adds support for different music genres:
-- 1. composer (text) - For Classical/Choral ("The Creator")
-- 2. artist (text) - For Pop/Rock/Jazz ("The Performer")
-- 3. id_foreign (text) - For Spotify/YouTube IDs
-- 4. release_year (integer) - For decade-based filtering
-- PART 1: Add new columns to tune table
ALTER TABLE tune
ADD COLUMN composer TEXT;

ALTER TABLE tune
ADD COLUMN artist TEXT;

ALTER TABLE tune
ADD COLUMN release_year INTEGER;

-- PART 2: Add same columns to tune_override table
ALTER TABLE tune_override
ADD COLUMN composer TEXT;

ALTER TABLE tune_override
ADD COLUMN artist TEXT;

ALTER TABLE tune_override
ADD COLUMN release_year INTEGER;

-- PART 3: Views will be updated separately
-- (practice_list_joined and practice_list_staged)