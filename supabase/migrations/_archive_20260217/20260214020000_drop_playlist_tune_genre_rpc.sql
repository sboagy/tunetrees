-- Strict purge of legacy playlist-named genre RPC.

BEGIN;

DROP FUNCTION IF EXISTS public.get_playlist_tune_genres_for_user(text);

COMMIT;