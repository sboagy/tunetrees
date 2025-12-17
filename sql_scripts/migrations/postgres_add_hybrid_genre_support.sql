-- Migration: Add Hybrid Genre Support (Trad/Pop/Classical)
-- Date: 2025-12-16
-- Issue: #246
--
-- This migration adds support for different music genres:
-- 1. composer (text) - For Classical/Choral ("The Creator")
-- 2. artist (text) - For Pop/Rock/Jazz ("The Performer")
-- 3. id_foreign type change (int4 → text) - For Spotify/YouTube IDs
-- 4. release_year (int4) - For decade-based filtering

-- PART 1: Add new columns to tune table
ALTER TABLE public.tune 
  ADD COLUMN IF NOT EXISTS composer text NULL,
  ADD COLUMN IF NOT EXISTS artist text NULL,
  ADD COLUMN IF NOT EXISTS release_year int4 NULL;

-- PART 2: Ensure id_foreign is text (convert in-place when needed)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tune'
      AND column_name = 'id_foreign'
  ) THEN
    IF (
      SELECT data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'tune'
        AND column_name = 'id_foreign'
    ) <> 'text' THEN
      EXECUTE 'ALTER TABLE public.tune ALTER COLUMN id_foreign TYPE text USING id_foreign::text';
    END IF;
  ELSE
    EXECUTE 'ALTER TABLE public.tune ADD COLUMN id_foreign text NULL';
  END IF;
END $$;

-- PART 3: Add same columns to tune_override table
ALTER TABLE public.tune_override 
  ADD COLUMN IF NOT EXISTS composer text NULL,
  ADD COLUMN IF NOT EXISTS artist text NULL,
  ADD COLUMN IF NOT EXISTS release_year int4 NULL;

-- Ensure tune_override.id_foreign is text (convert in-place when needed)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tune_override'
      AND column_name = 'id_foreign'
  ) THEN
    IF (
      SELECT data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'tune_override'
        AND column_name = 'id_foreign'
    ) <> 'text' THEN
      EXECUTE 'ALTER TABLE public.tune_override ALTER COLUMN id_foreign TYPE text USING id_foreign::text';
    END IF;
  ELSE
    EXECUTE 'ALTER TABLE public.tune_override ADD COLUMN id_foreign text NULL';
  END IF;
END $$;

-- PART 4: Update practice_list_joined view
-- (This view is recreated by view_practice_list_staged.sql)
-- We'll add a comment here as a reminder to update that file separately

-- PART 5: Update practice_list_staged view  
-- (This view is recreated by view_practice_list_staged.sql)
-- We'll add a comment here as a reminder to update that file separately

-- Verification queries (uncomment to run):
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'tune' AND column_name IN ('composer', 'artist', 'release_year', 'id_foreign');
-- 
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'tune_override' AND column_name IN ('composer', 'artist', 'release_year', 'id_foreign');
