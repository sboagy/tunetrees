-- RPC for syncing user_profile rows needed by the current user and by visible
-- public/shared notes and references. This preserves local FK integrity for
-- note.user_ref and reference.user_ref during initial and incremental sync.

CREATE OR REPLACE FUNCTION sync_get_user_profiles(
  p_user_id UUID,
  p_genre_ids TEXT[],
  p_after_timestamp TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 1000,
  p_offset INTEGER DEFAULT 0
)
RETURNS SETOF user_profile
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
  visible_author_ids AS (
    SELECT DISTINCT author_id
    FROM (
      SELECT n.user_ref AS author_id
      FROM note n
      JOIN tune t ON n.tune_ref = t.id
      WHERE (
        (t.genre = ANY(p_genre_ids) AND t.private_for IS NULL)
        OR t.private_for = p_user_id
      )
      AND (
        n.user_ref IS NULL
        OR n.user_ref = p_user_id
        OR COALESCE(n.public, false)
      )
      AND t.deleted = FALSE

      UNION

      SELECT r.user_ref AS author_id
      FROM reference r
      JOIN tune t ON r.tune_ref = t.id
      WHERE (
        (t.genre = ANY(p_genre_ids) AND t.private_for IS NULL)
        OR t.private_for = p_user_id
      )
      AND (
        r.user_ref IS NULL
        OR r.user_ref = p_user_id
        OR COALESCE(r.public, false)
      )
      AND t.deleted = FALSE
    ) visible_authors
    WHERE author_id IS NOT NULL
  ),
  changed_visible_author_ids AS (
    SELECT DISTINCT author_id
    FROM (
      SELECT n.user_ref AS author_id
      FROM note n
      JOIN tune t ON n.tune_ref = t.id
      WHERE (
        (t.genre = ANY(p_genre_ids) AND t.private_for IS NULL)
        OR t.private_for = p_user_id
      )
      AND (
        n.user_ref IS NULL
        OR n.user_ref = p_user_id
        OR COALESCE(n.public, false)
      )
      AND (
        p_after_timestamp IS NULL OR n.last_modified_at > p_after_timestamp
      )
      AND t.deleted = FALSE

      UNION

      SELECT r.user_ref AS author_id
      FROM reference r
      JOIN tune t ON r.tune_ref = t.id
      WHERE (
        (t.genre = ANY(p_genre_ids) AND t.private_for IS NULL)
        OR t.private_for = p_user_id
      )
      AND (
        r.user_ref IS NULL
        OR r.user_ref = p_user_id
        OR COALESCE(r.public, false)
      )
      AND (
        p_after_timestamp IS NULL OR r.last_modified_at > p_after_timestamp
      )
      AND t.deleted = FALSE
    ) changed_visible_authors
    WHERE author_id IS NOT NULL
  ),
  visible_group_profile_ids AS (
    SELECT DISTINCT profile_id
    FROM (
      SELECT ug.owner_user_ref AS profile_id
      FROM user_group ug
      WHERE ug.id IN (SELECT id FROM accessible_group_ids)

      UNION

      SELECT gm.user_ref AS profile_id
      FROM group_member gm
      WHERE gm.group_ref IN (SELECT id FROM accessible_group_ids)
    ) visible_group_profiles
    WHERE profile_id IS NOT NULL
  ),
  changed_visible_group_profile_ids AS (
    SELECT DISTINCT profile_id
    FROM (
      SELECT ug.owner_user_ref AS profile_id
      FROM user_group ug
      WHERE ug.id IN (SELECT id FROM accessible_group_ids)
        AND (
          p_after_timestamp IS NULL OR ug.last_modified_at > p_after_timestamp
        )

      UNION

      SELECT gm.user_ref AS profile_id
      FROM group_member gm
      WHERE gm.group_ref IN (SELECT id FROM accessible_group_ids)
        AND (
          p_after_timestamp IS NULL OR gm.last_modified_at > p_after_timestamp
        )

      UNION

      SELECT ug.owner_user_ref AS profile_id
      FROM user_group ug
      WHERE ug.id IN (SELECT group_ref FROM changed_membership_group_ids)
    ) changed_group_profiles
    WHERE profile_id IS NOT NULL
  ),
  candidate_ids AS (
    SELECT p_user_id AS id
    WHERE p_after_timestamp IS NULL

    UNION

    SELECT author_id AS id
    FROM visible_author_ids
    WHERE p_after_timestamp IS NULL

    UNION

    SELECT profile_id AS id
    FROM visible_group_profile_ids
    WHERE p_after_timestamp IS NULL

    UNION

    SELECT p_user_id AS id
    WHERE p_after_timestamp IS NOT NULL

    UNION

    SELECT author_id AS id
    FROM visible_author_ids
    WHERE p_after_timestamp IS NOT NULL

    UNION

    SELECT profile_id AS id
    FROM visible_group_profile_ids
    WHERE p_after_timestamp IS NOT NULL
  )
  SELECT up.*
  FROM user_profile up
  WHERE up.id IN (SELECT id FROM candidate_ids)
  AND (
    p_after_timestamp IS NULL
    OR up.last_modified_at > p_after_timestamp
    OR up.id IN (SELECT author_id FROM changed_visible_author_ids)
    OR up.id IN (SELECT profile_id FROM changed_visible_group_profile_ids)
  )
  ORDER BY up.last_modified_at ASC, up.id ASC
  LIMIT p_limit
  OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION sync_get_user_profiles TO authenticated;