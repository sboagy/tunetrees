BEGIN;

DROP POLICY IF EXISTS "Users can view own notes" ON public.note;
CREATE POLICY "Users can view own or public notes" ON public.note
  FOR SELECT
  USING (
    user_ref IS NULL
    OR user_ref = auth.uid()
    OR COALESCE(public, false)
  );

DROP POLICY IF EXISTS "Users can view own references" ON public.reference;
CREATE POLICY "Users can view own or public references" ON public.reference
  FOR SELECT
  USING (
    user_ref IS NULL
    OR user_ref = auth.uid()
    OR COALESCE(public, false)
  );

CREATE OR REPLACE FUNCTION public.sync_get_user_notes(
  p_user_id uuid,
  p_genre_ids text[],
  p_after_timestamp timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_limit integer DEFAULT 1000,
  p_offset integer DEFAULT 0
) RETURNS SETOF public.note
    LANGUAGE sql STABLE
    AS $$
  SELECT n.*
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
  ORDER BY n.last_modified_at ASC, n.id ASC
  LIMIT p_limit
  OFFSET p_offset;
$$;

CREATE OR REPLACE FUNCTION public.sync_get_user_references(
  p_user_id uuid,
  p_genre_ids text[],
  p_after_timestamp timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_limit integer DEFAULT 1000,
  p_offset integer DEFAULT 0
) RETURNS SETOF public.reference
    LANGUAGE sql STABLE
    AS $$
  SELECT r.*
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
  ORDER BY r.last_modified_at ASC, r.id ASC
  LIMIT p_limit
  OFFSET p_offset;
$$;

COMMIT;
