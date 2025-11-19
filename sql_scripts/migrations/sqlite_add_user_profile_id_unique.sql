-- Migration: Add unique index on user_profile.id
-- Date: 2025-01-16
-- Description: 
--   SQLite schema fix to make user_profile.id unique so it can be used 
--   as FK target (matching Postgres schema). All user FK references now
--   point to user_profile.id (internal UUID) instead of supabase_user_id.
-- Add unique index on id column
CREATE UNIQUE INDEX IF NOT EXISTS user_profile_id_unique ON user_profile (id);