-- Add missing columns to playlist table in Supabase (PostgreSQL)
-- Run this in Supabase SQL Editor
-- 1. Add 'name' column
ALTER TABLE playlist
ADD COLUMN IF NOT EXISTS name TEXT;

-- 2. Add 'genre_default' column with foreign key to genre
ALTER TABLE playlist
ADD COLUMN IF NOT EXISTS genre_default TEXT REFERENCES genre (id);

-- 3. Update existing records with default names (optional)
-- UPDATE playlist 
--   SET name = 'Playlist ' || playlist_id 
--   WHERE name IS NULL;
-- Verify changes
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM
    information_schema.columns
WHERE
    table_name = 'playlist'
ORDER BY
    ordinal_position;