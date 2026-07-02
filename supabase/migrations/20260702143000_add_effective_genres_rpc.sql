-- Add a remote effective-genre resolver for initial sync.
--
-- This lets the app build genre-filtered sync overrides before local metadata
-- has been hydrated, avoiding a separate metadata prefetch sync pass.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_effective_genres_for_user(
  p_user_id text
)
RETURNS text[]
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(array_agg(DISTINCT genre_id ORDER BY genre_id), '{}')
  FROM (
    SELECT ugs.genre_id
    FROM public.user_genre_selection ugs
    WHERE ugs.user_id::text = p_user_id

    UNION

    SELECT COALESCE(r.genre_default, i.genre_default) AS genre_id
    FROM public.repertoire r
    LEFT JOIN public.instrument i
      ON i.id = r.instrument_ref
      AND i.deleted = false
      AND (i.private_to_user IS NULL OR i.private_to_user::text = p_user_id)
    WHERE r.deleted = false
      AND r.user_ref::text = p_user_id
      AND COALESCE(r.genre_default, i.genre_default) IS NOT NULL

    UNION

    SELECT COALESCE(o.genre, t.genre) AS genre_id
    FROM public.repertoire_tune rt
    JOIN public.repertoire r
      ON r.repertoire_id = rt.repertoire_ref
      AND r.deleted = false
      AND r.user_ref::text = p_user_id
    JOIN public.tune t
      ON t.id = rt.tune_ref
      AND t.deleted = false
    LEFT JOIN public.tune_override o
      ON o.tune_ref = t.id
      AND o.user_ref = r.user_ref
      AND o.deleted = false
    WHERE rt.deleted = false
      AND COALESCE(o.genre, t.genre) IS NOT NULL
  ) effective_genres;
$$;

REVOKE ALL ON FUNCTION public.get_effective_genres_for_user(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_effective_genres_for_user(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_effective_genres_for_user(text) TO service_role;

COMMIT;
