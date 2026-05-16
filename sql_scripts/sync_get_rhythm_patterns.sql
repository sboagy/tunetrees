-- RPC for syncing rhythm_patterns with genre scoping for public rows.
-- Returns public patterns only for the user's effective genres, plus any
-- private patterns owned by the current user.

CREATE OR REPLACE FUNCTION sync_get_rhythm_patterns(
  p_user_id UUID,
  p_genre_ids TEXT[],
  p_after_timestamp TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 1000,
  p_offset INTEGER DEFAULT 0
)
RETURNS SETOF rhythm_patterns
LANGUAGE sql
STABLE
AS $$
  SELECT rp.*
  FROM rhythm_patterns rp
  WHERE (
    (
      rp.user_id IS NULL
      AND rp.genre_id = ANY(COALESCE(p_genre_ids, ARRAY[]::TEXT[]))
    )
    OR rp.user_id = p_user_id
  )
  AND (
    p_after_timestamp IS NULL OR rp.last_modified_at > p_after_timestamp
  )
  ORDER BY rp.last_modified_at ASC, rp.id ASC
  LIMIT p_limit
  OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION sync_get_rhythm_patterns TO authenticated;