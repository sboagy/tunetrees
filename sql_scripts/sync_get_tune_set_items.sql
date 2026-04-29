-- RPC for syncing tune-set items whose parent set is visible and whose tunes are
-- already visible under the existing tune sync rules.

CREATE OR REPLACE FUNCTION sync_get_tune_set_items(
  p_user_id UUID,
  p_genre_ids TEXT[],
  p_after_timestamp TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 1000,
  p_offset INTEGER DEFAULT 0
)
RETURNS SETOF tune_set_item
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
  SELECT tsi.*
  FROM tune_set_item tsi
  JOIN tune_set ts ON ts.id = tsi.tune_set_ref
  JOIN tune t ON t.id = tsi.tune_ref
  WHERE (
      ts.owner_user_ref = p_user_id
      OR ts.group_ref IN (SELECT id FROM accessible_group_ids)
    )
    AND (
      (t.genre = ANY(p_genre_ids) AND t.private_for IS NULL)
      OR t.private_for = p_user_id
    )
    AND (
      p_after_timestamp IS NULL
      OR tsi.last_modified_at > p_after_timestamp
      OR ts.group_ref IN (SELECT group_ref FROM changed_membership_group_ids)
    )
    AND t.deleted = FALSE
  ORDER BY tsi.last_modified_at ASC, tsi.id ASC
  LIMIT p_limit
  OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION sync_get_tune_set_items TO authenticated;