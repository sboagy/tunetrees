BEGIN;

CREATE OR REPLACE FUNCTION public.sync_get_user_profiles(
  p_user_id uuid,
  p_genre_ids text[],
  p_after_timestamp timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_limit integer DEFAULT 1000,
  p_offset integer DEFAULT 0
) RETURNS SETOF public.user_profile
    LANGUAGE sql STABLE
    AS $$
  WITH visible_author_ids AS (
    SELECT DISTINCT author_id
    FROM (
      SELECT n.user_ref AS author_id
      FROM public.note n
      JOIN public.tune t ON n.tune_ref = t.id
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
      FROM public.reference r
      JOIN public.tune t ON r.tune_ref = t.id
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
      FROM public.note n
      JOIN public.tune t ON n.tune_ref = t.id
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
      FROM public.reference r
      JOIN public.tune t ON r.tune_ref = t.id
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
  candidate_ids AS (
    SELECT p_user_id AS id
    WHERE p_after_timestamp IS NULL

    UNION

    SELECT author_id AS id
    FROM visible_author_ids
    WHERE p_after_timestamp IS NULL

    UNION

    SELECT p_user_id AS id
    WHERE p_after_timestamp IS NOT NULL

    UNION

    SELECT author_id AS id
    FROM visible_author_ids
    WHERE p_after_timestamp IS NOT NULL
  )
  SELECT up.*
  FROM public.user_profile up
  WHERE up.id IN (SELECT id FROM candidate_ids)
  AND (
    p_after_timestamp IS NULL
    OR up.last_modified_at > p_after_timestamp
    OR up.id IN (SELECT author_id FROM changed_visible_author_ids)
  )
  ORDER BY up.last_modified_at ASC, up.id ASC
  LIMIT p_limit
  OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION public.sync_get_user_profiles(uuid, text[], timestamp with time zone, integer, integer) TO authenticated;

COMMIT;