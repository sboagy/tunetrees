-- RPC for syncing membership rows for groups visible to the current user.

CREATE OR REPLACE FUNCTION sync_get_group_members(
  p_user_id UUID,
  p_after_timestamp TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 1000,
  p_offset INTEGER DEFAULT 0
)
RETURNS SETOF group_member
LANGUAGE sql
STABLE
AS $$
  WITH accessible_group_ids AS (
    SELECT ug.id
    FROM user_group ug
    WHERE ug.owner_user_ref = p_user_id

    UNION

    SELECT gm.group_ref
    FROM group_member gm
    WHERE gm.user_ref = p_user_id
      AND (
        gm.deleted = FALSE
        OR (p_after_timestamp IS NOT NULL AND gm.last_modified_at > p_after_timestamp)
      )
  )
  SELECT gm.*
  FROM group_member gm
  WHERE gm.group_ref IN (SELECT id FROM accessible_group_ids)
    AND (
      p_after_timestamp IS NULL
      OR gm.last_modified_at > p_after_timestamp
    )
  ORDER BY gm.last_modified_at ASC, gm.id ASC
  LIMIT p_limit
  OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION sync_get_group_members TO authenticated;