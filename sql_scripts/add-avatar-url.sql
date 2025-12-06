-- Migration: Add avatar_url field to user_profile table
-- Date: 2025-11-03
-- Description: Adds avatar_url column to support user avatar selection
-- PostgreSQL (Supabase)
ALTER TABLE user_profile
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

COMMENT ON COLUMN user_profile.avatar_url IS 'User avatar image URL (predefined or custom upload)';