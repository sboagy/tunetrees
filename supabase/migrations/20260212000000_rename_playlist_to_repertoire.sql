-- Migration: Rename playlist to repertoire throughout database
-- Date: 2026-02-12
-- Description: Comprehensive rename of all playlist-related tables, columns, constraints, 
--              indexes, and policies to use "repertoire" terminology instead

-- Step 1: Rename the main tables
ALTER TABLE IF EXISTS public.playlist RENAME TO repertoire;
ALTER TABLE IF EXISTS public.playlist_tune RENAME TO repertoire_tune;

-- Step 2: Rename primary key column in repertoire table
ALTER TABLE public.repertoire RENAME COLUMN playlist_id TO repertoire_id;

-- Step 3: Rename foreign key columns in repertoire_tune table
ALTER TABLE public.repertoire_tune RENAME COLUMN playlist_ref TO repertoire_ref;

-- Step 4: Rename foreign key columns in other tables that reference playlist
ALTER TABLE public.tab_group_main_state RENAME COLUMN playlist_id TO repertoire_id;
ALTER TABLE public.practice_record RENAME COLUMN playlist_ref TO repertoire_ref;
ALTER TABLE public.daily_practice_queue RENAME COLUMN playlist_ref TO repertoire_ref;
ALTER TABLE public.note RENAME COLUMN playlist_ref TO repertoire_ref;
ALTER TABLE public.table_state RENAME COLUMN playlist_id TO repertoire_id;

-- Step 5: Rename constraints (foreign keys)
-- tab_group_main_state
ALTER TABLE public.tab_group_main_state 
  DROP CONSTRAINT IF EXISTS tab_group_main_state_playlist_fk;
ALTER TABLE public.tab_group_main_state 
  ADD CONSTRAINT tab_group_main_state_repertoire_fk 
  FOREIGN KEY (repertoire_id) REFERENCES public.repertoire(repertoire_id);

-- practice_record
ALTER TABLE public.practice_record 
  DROP CONSTRAINT IF EXISTS practice_record_playlist_ref_playlist_playlist_id_fk;
ALTER TABLE public.practice_record 
  ADD CONSTRAINT practice_record_repertoire_ref_repertoire_repertoire_id_fk 
  FOREIGN KEY (repertoire_ref) REFERENCES public.repertoire(repertoire_id);

-- daily_practice_queue
ALTER TABLE public.daily_practice_queue 
  DROP CONSTRAINT IF EXISTS daily_practice_queue_playlist_fk;
ALTER TABLE public.daily_practice_queue 
  ADD CONSTRAINT daily_practice_queue_repertoire_fk 
  FOREIGN KEY (repertoire_ref) REFERENCES public.repertoire(repertoire_id);

-- note
ALTER TABLE public.note 
  DROP CONSTRAINT IF EXISTS note_playlist_ref_playlist_playlist_id_fk;
ALTER TABLE public.note 
  ADD CONSTRAINT note_repertoire_ref_repertoire_repertoire_id_fk 
  FOREIGN KEY (repertoire_ref) REFERENCES public.repertoire(repertoire_id);

-- repertoire_tune
ALTER TABLE public.repertoire_tune 
  DROP CONSTRAINT IF EXISTS playlist_tune_playlist_ref_playlist_playlist_id_fk;
ALTER TABLE public.repertoire_tune 
  ADD CONSTRAINT repertoire_tune_repertoire_ref_repertoire_repertoire_id_fk 
  FOREIGN KEY (repertoire_ref) REFERENCES public.repertoire(repertoire_id);

-- table_state
ALTER TABLE public.table_state 
  DROP CONSTRAINT IF EXISTS table_state_playlist_id_playlist_playlist_id_fk;
ALTER TABLE public.table_state 
  ADD CONSTRAINT table_state_repertoire_id_repertoire_repertoire_id_fk 
  FOREIGN KEY (repertoire_id) REFERENCES public.repertoire(repertoire_id);

-- Step 6: Rename unique constraints
ALTER TABLE public.repertoire 
  DROP CONSTRAINT IF EXISTS playlist_user_ref_instrument_ref_unique;
ALTER TABLE public.repertoire 
  ADD CONSTRAINT repertoire_user_ref_instrument_ref_unique 
  UNIQUE (user_ref, instrument_ref);

ALTER TABLE public.practice_record 
  DROP CONSTRAINT IF EXISTS practice_record_tune_ref_playlist_ref_practiced_unique;
ALTER TABLE public.practice_record 
  ADD CONSTRAINT practice_record_tune_ref_repertoire_ref_practiced_unique 
  UNIQUE (tune_ref, repertoire_ref, practiced);

ALTER TABLE public.daily_practice_queue 
  DROP CONSTRAINT IF EXISTS daily_practice_queue_user_ref_playlist_ref_window_start_utc_tun;
ALTER TABLE public.daily_practice_queue 
  ADD CONSTRAINT daily_practice_queue_user_ref_repertoire_ref_window_start_utc_tun 
  UNIQUE (user_ref, repertoire_ref, window_start_utc, tune_ref);

-- Step 7: Rename primary key constraint in repertoire_tune
-- Note: When table is renamed, PostgreSQL automatically renames constraints
-- The constraint playlist_tune_pkey becomes repertoire_tune_pkey
-- We just need to handle the case where it might still have the old column names referenced
-- Since we already renamed the columns, the constraint already references the new column names
-- No action needed here - the constraint was automatically updated

-- Step 8: Rename indexes
-- practice_record indexes
DROP INDEX IF EXISTS public.idx_practice_record_tune_playlist_practiced;
CREATE INDEX idx_practice_record_tune_repertoire_practiced 
  ON public.practice_record USING btree (tune_ref, repertoire_ref, practiced);

-- daily_practice_queue indexes
DROP INDEX IF EXISTS public.idx_queue_user_playlist_active;
CREATE INDEX idx_queue_user_repertoire_active 
  ON public.daily_practice_queue USING btree (user_ref, repertoire_ref, active);

DROP INDEX IF EXISTS public.idx_queue_user_playlist_bucket;
CREATE INDEX idx_queue_user_repertoire_bucket 
  ON public.daily_practice_queue USING btree (user_ref, repertoire_ref, bucket);

DROP INDEX IF EXISTS public.idx_queue_user_playlist_window;
CREATE INDEX idx_queue_user_repertoire_window 
  ON public.daily_practice_queue USING btree (user_ref, repertoire_ref, window_start_utc);

-- note indexes
DROP INDEX IF EXISTS public.idx_note_tune_playlist;
CREATE INDEX idx_note_tune_repertoire 
  ON public.note USING btree (tune_ref, repertoire_ref);

DROP INDEX IF EXISTS public.idx_note_tune_playlist_user_public;
CREATE INDEX idx_note_tune_repertoire_user_public 
  ON public.note USING btree (tune_ref, repertoire_ref, user_ref, public);

-- Step 9: Update RLS policies for repertoire table
DROP POLICY IF EXISTS "Users can view own playlists" ON public.repertoire;
CREATE POLICY "Users can view own repertoires" ON public.repertoire
  AS PERMISSIVE FOR SELECT TO public
  USING (user_ref IN (
    SELECT user_profile.id FROM user_profile 
    WHERE user_profile.supabase_user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can insert own playlists" ON public.repertoire;
CREATE POLICY "Users can insert own repertoires" ON public.repertoire
  AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own playlists" ON public.repertoire;
CREATE POLICY "Users can update own repertoires" ON public.repertoire
  AS PERMISSIVE FOR UPDATE TO public USING (true);

DROP POLICY IF EXISTS "Users can delete own playlists" ON public.repertoire;
CREATE POLICY "Users can delete own repertoires" ON public.repertoire
  AS PERMISSIVE FOR DELETE TO public USING (true);

-- Step 10: Update RLS policies for repertoire_tune table
DROP POLICY IF EXISTS "Users can view own playlist tunes" ON public.repertoire_tune;
CREATE POLICY "Users can view own repertoire tunes" ON public.repertoire_tune
  AS PERMISSIVE FOR SELECT TO public
  USING (repertoire_ref IN (
    SELECT repertoire.repertoire_id FROM repertoire 
    WHERE repertoire.user_ref IN (
      SELECT user_profile.id FROM user_profile 
      WHERE user_profile.supabase_user_id = auth.uid()
    )
  ));

DROP POLICY IF EXISTS "Users can insert own playlist tunes" ON public.repertoire_tune;
CREATE POLICY "Users can insert own repertoire tunes" ON public.repertoire_tune
  AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own playlist tunes" ON public.repertoire_tune;
CREATE POLICY "Users can update own repertoire tunes" ON public.repertoire_tune
  AS PERMISSIVE FOR UPDATE TO public USING (true);

DROP POLICY IF EXISTS "Users can delete own playlist tunes" ON public.repertoire_tune;
CREATE POLICY "Users can delete own repertoire tunes" ON public.repertoire_tune
  AS PERMISSIVE FOR DELETE TO public USING (true);

-- Step 11: Update RLS policies in practice_record table
DROP POLICY IF EXISTS "Users can view own practice records" ON public.practice_record;
CREATE POLICY "Users can view own practice records" ON public.practice_record
  AS PERMISSIVE FOR SELECT TO public
  USING (repertoire_ref IN (
    SELECT repertoire.repertoire_id FROM repertoire 
    WHERE repertoire.user_ref IN (
      SELECT user_profile.id FROM user_profile 
      WHERE user_profile.supabase_user_id = auth.uid()
    )
  ));

-- Step 12: Recreate view_playlist_joined as view_repertoire_joined
DROP VIEW IF EXISTS public.view_playlist_joined;
CREATE VIEW public.view_repertoire_joined AS
SELECT 
  r.repertoire_id,
  r.user_ref,
  r.instrument_ref,
  r.sr_alg_type,
  r.deleted,
  r.sync_version,
  r.last_modified_at,
  r.device_id,
  r.name,
  r.genre_default,
  i.name AS instrument_name
FROM public.repertoire r
LEFT JOIN public.instrument i ON r.instrument_ref = i.id;

-- Step 13: Update RPC function get_playlist_tune_genres_for_user
DROP FUNCTION IF EXISTS public.get_playlist_tune_genres_for_user(text);
CREATE OR REPLACE FUNCTION public.get_repertoire_tune_genres_for_user(
  p_user_id text
) RETURNS text[]
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

REVOKE ALL ON FUNCTION public.get_repertoire_tune_genres_for_user(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_repertoire_tune_genres_for_user(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_repertoire_tune_genres_for_user(text) TO service_role;

-- Step 14: Update sync RPC functions comments (table names changed, no code changes needed)
-- sync_get_user_notes and sync_get_user_references reference tune table only
-- Comments in those functions mention "playlist" but the actual SQL only joins tune table
COMMENT ON FUNCTION public.sync_get_user_notes IS 
  'Returns notes associated with tunes in selected genres OR user''s private tunes OR tunes in user''s repertoire';
COMMENT ON FUNCTION public.sync_get_user_references IS 
  'Returns references associated with tunes in selected genres OR user''s private tunes OR tunes in user''s repertoire';
