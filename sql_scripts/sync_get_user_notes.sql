-- RPC for syncing note table with genre filtering via tune JOIN
-- Returns notes associated with tunes in selected genres OR user's private tunes
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
    -- Tunes in selected genres (public or user's private)
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
