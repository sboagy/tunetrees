-- RPC for syncing visible program items. Tune items must resolve to public tunes;
-- tune-set items can reference eligible tune sets that are synced separately.

CREATE OR REPLACE FUNCTION sync_get_program_items(
  p_user_id UUID,
  p_genre_ids TEXT[],
  p_after_timestamp TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 1000,
  p_offset INTEGER DEFAULT 0
)
RETURNS SETOF program_item
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
  SELECT pi.*
  FROM program_item pi
  JOIN program p ON p.id = pi.program_ref
  LEFT JOIN tune t ON t.id = pi.tune_ref
  LEFT JOIN tune_set ts ON ts.id = pi.tune_set_ref
  WHERE p.group_ref IN (SELECT id FROM accessible_group_ids)
    AND (
      (pi.item_kind = 'tune'
        AND t.id IS NOT NULL
        AND t.deleted = FALSE
        AND t.private_for IS NULL
        AND t.genre = ANY(p_genre_ids)
      )
      OR (
        pi.item_kind = 'tune_set'
        AND ts.id IS NOT NULL
        AND ts.deleted = FALSE
      )
    )
    AND (
      p_after_timestamp IS NULL
      OR pi.last_modified_at > p_after_timestamp
      OR p.last_modified_at > p_after_timestamp
      OR p.group_ref IN (SELECT group_ref FROM changed_membership_group_ids)
    )
  ORDER BY pi.last_modified_at ASC, pi.id ASC
  LIMIT p_limit
  OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION sync_get_program_items TO authenticated;