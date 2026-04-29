-- RPC for syncing groups visible to the current user.
-- Includes owned groups and groups where the user has an active membership.

CREATE OR REPLACE FUNCTION sync_get_user_groups(
  p_user_id UUID,
  p_after_timestamp TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 1000,
  p_offset INTEGER DEFAULT 0
)
RETURNS SETOF user_group
LANGUAGE sql
STABLE
AS $$
  WITH changed_membership_group_ids AS (
    SELECT DISTINCT gm.group_ref
    FROM group_member gm
    WHERE gm.user_ref = p_user_id
      AND p_after_timestamp IS NOT NULL
      AND gm.last_modified_at > p_after_timestamp
  ),
  accessible_group_ids AS (
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
  SELECT ug.*
  FROM user_group ug
  WHERE ug.id IN (SELECT id FROM accessible_group_ids)
    AND (
      p_after_timestamp IS NULL
      OR ug.last_modified_at > p_after_timestamp
      OR ug.id IN (SELECT group_ref FROM changed_membership_group_ids)
    )
  ORDER BY ug.last_modified_at ASC, ug.id ASC
  LIMIT p_limit
  OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION sync_get_user_groups TO authenticated;