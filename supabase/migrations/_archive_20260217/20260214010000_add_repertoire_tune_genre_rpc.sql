-- Canonicalize repertoire genre RPC naming after playlist -> repertoire rename.
--
-- Why:
-- - App code should call get_repertoire_tune_genres_for_user.
-- - This migration defines the canonical repertoire RPC only.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_repertoire_tune_genres_for_user(
	p_user_id text
)
RETURNS text[]
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
	SELECT COALESCE(array_agg(DISTINCT t.genre), '{}')
	FROM public.repertoire_tune rt
	JOIN public.repertoire r
		ON r.repertoire_id = rt.repertoire_ref
		AND r.deleted = false
	JOIN public.tune t
		ON t.id = rt.tune_ref
		AND t.deleted = false
	WHERE rt.deleted = false
		AND t.genre IS NOT NULL
		AND r.user_ref::text = p_user_id;
$$;

REVOKE ALL ON FUNCTION public.get_repertoire_tune_genres_for_user(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_repertoire_tune_genres_for_user(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_repertoire_tune_genres_for_user(text) TO service_role;

COMMIT;