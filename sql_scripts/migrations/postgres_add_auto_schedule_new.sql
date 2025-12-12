-- Migration: Add auto_schedule_new column to prefs_scheduling_options
-- Date: 2025-12-09
-- Description: 
--   Adds boolean field to control whether never-practiced tunes are 
--   automatically included in Q3 bucket of daily practice queue generation.
--
--   Default: true - automatically schedule new tunes
--
-- Related: 
--   - practice-queue.ts (Q3 bucket conditional logic)
--   - user-settings.tsx (checkbox UI)
-- Add auto_schedule_new column with default value true
ALTER TABLE prefs_scheduling_options
ADD COLUMN auto_schedule_new BOOLEAN NOT NULL DEFAULT true;