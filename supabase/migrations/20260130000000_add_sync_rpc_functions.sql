-- RPC functions for genre-filtered sync
-- These functions are used by the worker to efficiently sync notes and references
-- based on user's selected genres, with pagination support

-- RPC for syncing note table with genre filtering via tune JOIN
-- Returns notes associated with tunes in selected genres OR user's private tunes OR tunes in user's playlist
-- Supports incremental sync via p_after_timestamp parameter
CREATE OR REPLACE FUNCTION sync_get_user_notes(
  p_user_id UUID,
  p_genre_ids TEXT[],
  p_after_timestamp TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 1000,
  p_offset INTEGER DEFAULT 0
)
RETURNS SETOF note
LANGUAGE sql
STABLE
AS $$
  SELECT n.*
  FROM note n
  JOIN tune t ON n.tune_ref = t.id
  WHERE (
    -- Tunes in selected genres (public) OR user's private tunes
    -- Note: p_genre_ids is the effective genre filter calculated by client
    -- (includes user_genre_selection + playlist genres + playlist_tune genres)
    (t.genre = ANY(p_genre_ids) AND t.private_for IS NULL)
    OR t.private_for = p_user_id
  )
  AND (
    -- Notes visible to user (public or user's own)
    n.user_ref IS NULL OR n.user_ref = p_user_id
  )
  AND (
    -- Incremental sync: only rows updated after timestamp (if provided)
    p_after_timestamp IS NULL OR n.last_modified_at > p_after_timestamp
  )
  AND t.deleted = FALSE
  ORDER BY n.last_modified_at ASC, n.id ASC
  LIMIT p_limit
  OFFSET p_offset;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION sync_get_user_notes TO authenticated;

-- RPC for syncing reference table with genre filtering via tune JOIN
-- Returns references associated with tunes in selected genres OR user's private tunes OR tunes in user's playlist
-- Supports incremental sync via p_after_timestamp parameter
CREATE OR REPLACE FUNCTION sync_get_user_references(
  p_user_id UUID,
  p_genre_ids TEXT[],
  p_after_timestamp TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 1000,
  p_offset INTEGER DEFAULT 0
)
RETURNS SETOF reference
LANGUAGE sql
STABLE
AS $$
  SELECT r.*
  FROM reference r
  JOIN tune t ON r.tune_ref = t.id
  WHERE (
    -- Tunes in selected genres (public) OR user's private tunes
    -- Note: p_genre_ids is the effective genre filter calculated by client
    -- (includes user_genre_selection + playlist genres + playlist_tune genres)
    (t.genre = ANY(p_genre_ids) AND t.private_for IS NULL)
    OR t.private_for = p_user_id
  )
  AND (
    -- References visible to user (public or user's own)
    r.user_ref IS NULL OR r.user_ref = p_user_id
  )
  AND (
    -- Incremental sync: only rows updated after timestamp (if provided)
    p_after_timestamp IS NULL OR r.last_modified_at > p_after_timestamp
  )
  AND t.deleted = FALSE
  ORDER BY r.last_modified_at ASC, r.id ASC
  LIMIT p_limit
  OFFSET p_offset;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION sync_get_user_references TO authenticated;
