-- Migration: Add RPC for playlist_tune genre aggregation
-- Date: 2026-01-27

CREATE OR REPLACE FUNCTION public.get_playlist_tune_genres_for_user(
  p_user_id text
) RETURNS text[]
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(array_agg(DISTINCT t.genre), '{}')
  FROM public.playlist_tune pt
  JOIN public.playlist p
    ON p.playlist_id = pt.playlist_ref
    AND p.deleted = false
  JOIN public.tune t
    ON t.id = pt.tune_ref
    AND t.deleted = false
  WHERE pt.deleted = false
    AND t.genre IS NOT NULL
    AND p.user_ref::text = p_user_id
    AND p_user_id = public.auth_internal_user_id()::text;
$$;

REVOKE ALL ON FUNCTION public.get_playlist_tune_genres_for_user(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_playlist_tune_genres_for_user(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_playlist_tune_genres_for_user(text) TO service_role;
