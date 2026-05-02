-- RPC for syncing tune-set items whose parent set is a personal practice_set
-- visible directly or referenced by a visible program.
-- Items for group-owned tune sets (set_kind = 'group_program') are intentionally
-- excluded: after local SQLite migration 0016, those items are migrated into
-- 'program_item' and the parent tune_set no longer exists locally.

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
  ),
  visible_program_tune_set_ids AS (
    SELECT DISTINCT pi.tune_set_ref AS id
    FROM program_item pi
    JOIN program p ON p.id = pi.program_ref
    WHERE pi.item_kind = 'tune_set'
      AND pi.tune_set_ref IS NOT NULL
      AND p.group_ref IN (SELECT id FROM accessible_group_ids)
  )
  SELECT tsi.*
  FROM tune_set_item tsi
  JOIN tune_set ts ON ts.id = tsi.tune_set_ref
  JOIN tune t ON t.id = tsi.tune_ref
  WHERE ts.set_kind = 'practice_set'
    AND (
      ts.owner_user_ref = p_user_id
      OR ts.group_ref IN (SELECT id FROM accessible_group_ids)
      OR ts.id IN (SELECT id FROM visible_program_tune_set_ids)
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