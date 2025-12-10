-- Migration: Add auto_schedule_new column to prefs_scheduling_options
-- Date: 2025-12-09
-- Description: 
--   Adds boolean field (stored as integer 0/1 in SQLite) to control whether
--   never-practiced tunes are automatically included in Q3 bucket of daily
--   practice queue generation.
--
--   Default: 1 (true) - automatically schedule new tunes
--   Test override: window.__TUNETREES_TEST_AUTO_SCHEDULE_NEW__
--
-- Related: 
--   - practice-queue.ts (Q3 bucket conditional logic)
--   - user-settings.tsx (checkbox UI)
-- Add auto_schedule_new column with default value 1 (true)
ALTER TABLE prefs_scheduling_options
ADD COLUMN auto_schedule_new INTEGER NOT NULL DEFAULT 1;