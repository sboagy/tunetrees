-- Migration: Eliminate internal user_profile.id in favor of Supabase Auth ID
--
-- This migration consolidates user identity to use only Supabase Auth UUIDs,
-- removing the internal user_profile.id and updating all foreign keys.
--
-- NOTE: Both user_profile.id and supabase_user_id have always been UUID columns.
-- FK columns (user_ref, user_id, etc.) are already UUIDs pointing to user_profile.id.
-- This migration simply rewires FKs to point to supabase_user_id instead.
--
-- Affected tables (13 total):
--   1. tab_group_main_state.user_id
--   2. tag.user_ref
--   3. tune.private_for
--   4. tune_override.user_ref
--   5. instrument.private_to_user
--   6. daily_practice_queue.user_ref
--   7. note.user_ref
--   8. playlist.user_ref
--   9. prefs_scheduling_options.user_id
--  10. reference.user_ref
--  11. table_state.user_id
--  12. prefs_spaced_repetition.user_id
--  13. table_transient_data.user_id
--
-- Strategy: Drop FK constraints, recreate pointing to supabase_user_id, drop id column
-- All operations in a single transaction for atomicity

BEGIN;

-- ============================================================================
-- STEP 1: Drop foreign key constraints pointing to user_profile.id
-- ============================================================================

ALTER TABLE tab_group_main_state DROP CONSTRAINT IF EXISTS tab_group_main_state_user_id_fkey;
ALTER TABLE tag DROP CONSTRAINT IF EXISTS tag_user_ref_fkey;
ALTER TABLE tune DROP CONSTRAINT IF EXISTS tune_private_for_fkey;
ALTER TABLE tune_override DROP CONSTRAINT IF EXISTS tune_override_user_ref_fkey;
ALTER TABLE instrument DROP CONSTRAINT IF EXISTS instrument_private_to_user_fkey;
ALTER TABLE daily_practice_queue DROP CONSTRAINT IF EXISTS daily_practice_queue_user_ref_fkey;
ALTER TABLE note DROP CONSTRAINT IF EXISTS note_user_ref_fkey;
ALTER TABLE playlist DROP CONSTRAINT IF EXISTS playlist_user_ref_fkey;
ALTER TABLE prefs_scheduling_options DROP CONSTRAINT IF EXISTS prefs_scheduling_options_user_id_fkey;
ALTER TABLE reference DROP CONSTRAINT IF EXISTS reference_user_ref_fkey;
ALTER TABLE table_state DROP CONSTRAINT IF EXISTS table_state_user_id_fkey;
ALTER TABLE prefs_spaced_repetition DROP CONSTRAINT IF EXISTS prefs_spaced_repetition_user_id_fkey;
ALTER TABLE table_transient_data DROP CONSTRAINT IF EXISTS table_transient_data_user_id_fkey;
ALTER TABLE user_genre_selection DROP CONSTRAINT IF EXISTS user_genre_selection_user_id_fkey;
ALTER TABLE plugin DROP CONSTRAINT IF EXISTS plugin_user_ref_fkey;

-- ============================================================================
-- STEP 2: Shift PRIMARY KEY from id to supabase_user_id
-- ============================================================================
-- CRITICAL: Must do this BEFORE creating new FK constraints
-- FK constraints require target column to be PRIMARY KEY or UNIQUE

-- Drop the old primary key constraint
ALTER TABLE user_profile DROP CONSTRAINT user_profile_pkey;

-- Make supabase_user_id the new primary key
ALTER TABLE user_profile ADD PRIMARY KEY (supabase_user_id);

-- Drop the id column (no longer needed) - CASCADE drops dependent policies/views
ALTER TABLE user_profile DROP COLUMN id CASCADE;

-- ============================================================================
-- STEP 3: Add new foreign key constraints to user_profile.supabase_user_id
-- ============================================================================

ALTER TABLE tab_group_main_state
  ADD CONSTRAINT tab_group_main_state_user_id_user_profile_fkey
  FOREIGN KEY (user_id) REFERENCES user_profile(supabase_user_id);

ALTER TABLE tag
  ADD CONSTRAINT tag_user_ref_user_profile_fkey
  FOREIGN KEY (user_ref) REFERENCES user_profile(supabase_user_id);

ALTER TABLE tune
  ADD CONSTRAINT tune_private_for_user_profile_fkey
  FOREIGN KEY (private_for) REFERENCES user_profile(supabase_user_id);

ALTER TABLE tune_override
  ADD CONSTRAINT tune_override_user_ref_user_profile_fkey
  FOREIGN KEY (user_ref) REFERENCES user_profile(supabase_user_id);

ALTER TABLE instrument
  ADD CONSTRAINT instrument_private_to_user_user_profile_fkey
  FOREIGN KEY (private_to_user) REFERENCES user_profile(supabase_user_id);

ALTER TABLE daily_practice_queue
  ADD CONSTRAINT daily_practice_queue_user_ref_user_profile_fkey
  FOREIGN KEY (user_ref) REFERENCES user_profile(supabase_user_id);

ALTER TABLE note
  ADD CONSTRAINT note_user_ref_user_profile_fkey
  FOREIGN KEY (user_ref) REFERENCES user_profile(supabase_user_id);

ALTER TABLE playlist
  ADD CONSTRAINT playlist_user_ref_user_profile_fkey
  FOREIGN KEY (user_ref) REFERENCES user_profile(supabase_user_id);

ALTER TABLE prefs_scheduling_options
  ADD CONSTRAINT prefs_scheduling_options_user_id_user_profile_fkey
  FOREIGN KEY (user_id) REFERENCES user_profile(supabase_user_id);

ALTER TABLE reference
  ADD CONSTRAINT reference_user_ref_user_profile_fkey
  FOREIGN KEY (user_ref) REFERENCES user_profile(supabase_user_id);

ALTER TABLE table_state
  ADD CONSTRAINT table_state_user_id_user_profile_fkey
  FOREIGN KEY (user_id) REFERENCES user_profile(supabase_user_id);

ALTER TABLE prefs_spaced_repetition
  ADD CONSTRAINT prefs_spaced_repetition_user_id_user_profile_fkey
  FOREIGN KEY (user_id) REFERENCES user_profile(supabase_user_id);

ALTER TABLE table_transient_data
  ADD CONSTRAINT table_transient_data_user_id_user_profile_fkey
  FOREIGN KEY (user_id) REFERENCES user_profile(supabase_user_id);

ALTER TABLE user_genre_selection
  ADD CONSTRAINT user_genre_selection_user_id_user_profile_fkey
  FOREIGN KEY (user_id) REFERENCES user_profile(supabase_user_id);

ALTER TABLE plugin
  ADD CONSTRAINT plugin_user_ref_user_profile_fkey
  FOREIGN KEY (user_ref) REFERENCES user_profile(supabase_user_id);

-- ============================================================================
-- STEP 4: Update RLS policies to use auth.uid() directly
-- ============================================================================
-- NOTE: Policies updated after FK rewiring is complete
-- Many old policies used subqueries like: SELECT id FROM user_profile WHERE supabase_user_id = auth.uid()
-- These simplify to direct auth.uid() comparisons after FK rewiring

-- Playlist policies
DROP POLICY IF EXISTS "Users can view own playlists" ON playlist;
CREATE POLICY "Users can view own playlists"
  ON playlist FOR SELECT
  TO public
  USING (user_ref = auth.uid());

DROP POLICY IF EXISTS "Users can insert own playlists" ON playlist;
CREATE POLICY "Users can insert own playlists"
  ON playlist FOR INSERT
  TO public
  WITH CHECK (user_ref = auth.uid());

DROP POLICY IF EXISTS "Users can update own playlists" ON playlist;
CREATE POLICY "Users can update own playlists"
  ON playlist FOR UPDATE
  TO public
  USING (user_ref = auth.uid());

DROP POLICY IF EXISTS "Users can delete own playlists" ON playlist;
CREATE POLICY "Users can delete own playlists"
  ON playlist FOR DELETE
  TO public
  USING (user_ref = auth.uid());

-- Playlist_tune policies (join through playlist)
DROP POLICY IF EXISTS "Users can view playlist_tune in own playlists" ON playlist_tune;
CREATE POLICY "Users can view playlist_tune in own playlists"
  ON playlist_tune FOR SELECT
  TO public
  USING (playlist_ref IN (
    SELECT playlist_id FROM playlist WHERE user_ref = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can insert playlist_tune in own playlists" ON playlist_tune;
CREATE POLICY "Users can insert playlist_tune in own playlists"
  ON playlist_tune FOR INSERT
  TO public
  WITH CHECK (playlist_ref IN (
    SELECT playlist_id FROM playlist WHERE user_ref = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can update playlist_tune in own playlists" ON playlist_tune;
CREATE POLICY "Users can update playlist_tune in own playlists"
  ON playlist_tune FOR UPDATE
  TO public
  USING (playlist_ref IN (
    SELECT playlist_id FROM playlist WHERE user_ref = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can delete playlist_tune in own playlists" ON playlist_tune;
CREATE POLICY "Users can delete playlist_tune in own playlists"
  ON playlist_tune FOR DELETE
  TO public
  USING (playlist_ref IN (
    SELECT playlist_id FROM playlist WHERE user_ref = auth.uid()
  ));

-- Practice_record policies (join through playlist)
DROP POLICY IF EXISTS "Users can view practice_record in own playlists" ON practice_record;
CREATE POLICY "Users can view practice_record in own playlists"
  ON practice_record FOR SELECT
  TO public
  USING (playlist_ref IN (
    SELECT playlist_id FROM playlist WHERE user_ref = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can insert practice_record in own playlists" ON practice_record;
CREATE POLICY "Users can insert practice_record in own playlists"
  ON practice_record FOR INSERT
  TO public
  WITH CHECK (playlist_ref IN (
    SELECT playlist_id FROM playlist WHERE user_ref = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can update practice_record in own playlists" ON practice_record;
CREATE POLICY "Users can update practice_record in own playlists"
  ON practice_record FOR UPDATE
  TO public
  USING (playlist_ref IN (
    SELECT playlist_id FROM playlist WHERE user_ref = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can delete practice_record in own playlists" ON practice_record;
CREATE POLICY "Users can delete practice_record in own playlists"
  ON practice_record FOR DELETE
  TO public
  USING (playlist_ref IN (
    SELECT playlist_id FROM playlist WHERE user_ref = auth.uid()
  ));

-- Tune policies (private_for column)
DROP POLICY IF EXISTS "Users can view catalog tunes and own private tunes" ON tune;
CREATE POLICY "Users can view catalog tunes and own private tunes"
  ON tune FOR SELECT
  TO public
  USING (private_for IS NULL OR private_for = auth.uid());

DROP POLICY IF EXISTS "Users can insert own private tunes" ON tune;
CREATE POLICY "Users can insert own private tunes"
  ON tune FOR INSERT
  TO public
  WITH CHECK (private_for IS NULL OR private_for = auth.uid());

DROP POLICY IF EXISTS "Users can update own private tunes" ON tune;
CREATE POLICY "Users can update own private tunes"
  ON tune FOR UPDATE
  TO public
  USING (private_for IS NULL OR private_for = auth.uid());

DROP POLICY IF EXISTS "Users can delete own private tunes" ON tune;
CREATE POLICY "Users can delete own private tunes"
  ON tune FOR DELETE
  TO public
  USING (private_for IS NULL OR private_for = auth.uid());

-- Tune duplicate policy names (drop old named variants)
DROP POLICY IF EXISTS "Select public or owned tunes" ON tune;
DROP POLICY IF EXISTS "Insert user private tunes" ON tune;
DROP POLICY IF EXISTS "Update owned private tunes" ON tune;
DROP POLICY IF EXISTS "Delete owned private tunes" ON tune;

-- Tune_override policies  
DROP POLICY IF EXISTS "Users can view own tune overrides" ON tune_override;
CREATE POLICY "Users can view own tune overrides"
  ON tune_override FOR SELECT
  TO public
  USING (user_ref = auth.uid());

DROP POLICY IF EXISTS "Users can insert own tune overrides" ON tune_override;
CREATE POLICY "Users can insert own tune overrides"
  ON tune_override FOR INSERT
  TO public
  WITH CHECK (user_ref = auth.uid());

DROP POLICY IF EXISTS "Users can update own tune overrides" ON tune_override;
CREATE POLICY "Users can update own tune overrides"
  ON tune_override FOR UPDATE
  TO public
  USING (user_ref = auth.uid());

DROP POLICY IF EXISTS "Users can delete own tune overrides" ON tune_override;
CREATE POLICY "Users can delete own tune overrides"
  ON tune_override FOR DELETE
  TO public
  USING (user_ref = auth.uid());

-- Tune_override duplicate policy names (drop old named variants)
DROP POLICY IF EXISTS "Select own tune overrides" ON tune_override;
DROP POLICY IF EXISTS "Insert own tune overrides" ON tune_override;
DROP POLICY IF EXISTS "Update own tune overrides" ON tune_override;
DROP POLICY IF EXISTS "Delete own tune overrides" ON tune_override;

-- ============================================================================
-- STEP 4: Drop ALL old policies that reference user_profile.id
-- ============================================================================
-- These were created in initial schema with subquery pattern:
-- user_ref IN (SELECT id FROM user_profile WHERE supabase_user_id = auth.uid())
-- Must drop before DROP COLUMN can succeed

-- daily_practice_queue
DROP POLICY IF EXISTS "Users can view own daily_practice_queue" ON daily_practice_queue;
DROP POLICY IF EXISTS "Users can insert own daily_practice_queue" ON daily_practice_queue;
DROP POLICY IF EXISTS "Users can update own daily_practice_queue" ON daily_practice_queue;
DROP POLICY IF EXISTS "Users can delete own daily_practice_queue" ON daily_practice_queue;
DROP POLICY IF EXISTS "check_user_ref_daily_practice_queue" ON daily_practice_queue;

-- note
DROP POLICY IF EXISTS "Users can view own notes" ON note;
DROP POLICY IF EXISTS "Users can insert own notes" ON note;
DROP POLICY IF EXISTS "Users can update own notes" ON note;
DROP POLICY IF EXISTS "Users can delete own notes" ON note;

-- reference
DROP POLICY IF EXISTS "Users can view own references" ON reference;
DROP POLICY IF EXISTS "Users can insert own references" ON reference;
DROP POLICY IF EXISTS "Users can update own references" ON reference;
DROP POLICY IF EXISTS "Users can delete own references" ON reference;

-- tag
DROP POLICY IF EXISTS "Users can view own tags" ON tag;
DROP POLICY IF EXISTS "Users can insert own tags" ON tag;
DROP POLICY IF EXISTS "Users can update own tags" ON tag;
DROP POLICY IF EXISTS "Users can delete own tags" ON tag;
DROP POLICY IF EXISTS "check_user_ref_tag" ON tag;

-- tab_group_main_state
DROP POLICY IF EXISTS "Users can view own tab_group_main_state" ON tab_group_main_state;
DROP POLICY IF EXISTS "Users can insert own tab_group_main_state" ON tab_group_main_state;
DROP POLICY IF EXISTS "Users can update own tab_group_main_state" ON tab_group_main_state;
DROP POLICY IF EXISTS "Users can delete own tab_group_main_state" ON tab_group_main_state;
DROP POLICY IF EXISTS "Users can view own tab group state" ON tab_group_main_state;

-- table_state
DROP POLICY IF EXISTS "Users can view own table_state" ON table_state;
DROP POLICY IF EXISTS "Users can insert own table_state" ON table_state;
DROP POLICY IF EXISTS "Users can update own table_state" ON table_state;
DROP POLICY IF EXISTS "Users can delete own table_state" ON table_state;
DROP POLICY IF EXISTS "Users can view own table state" ON table_state;

-- table_transient_data
DROP POLICY IF EXISTS "Users can view own table_transient_data" ON table_transient_data;
DROP POLICY IF EXISTS "Users can insert own table_transient_data" ON table_transient_data;
DROP POLICY IF EXISTS "Users can update own table_transient_data" ON table_transient_data;
DROP POLICY IF EXISTS "Users can delete own table_transient_data" ON table_transient_data;
DROP POLICY IF EXISTS "Users can view own transient data" ON table_transient_data;
DROP POLICY IF EXISTS "Users can insert own transient data" ON table_transient_data;
DROP POLICY IF EXISTS "Users can update own transient data" ON table_transient_data;
DROP POLICY IF EXISTS "Users can delete own transient data" ON table_transient_data;

-- instrument
DROP POLICY IF EXISTS "Users can view catalog and own instruments" ON instrument;
DROP POLICY IF EXISTS "Users can insert own private instruments" ON instrument;
DROP POLICY IF EXISTS "Users can update own private instruments" ON instrument;
DROP POLICY IF EXISTS "Users can delete own private instruments" ON instrument;

-- prefs_spaced_repetition
DROP POLICY IF EXISTS "Users can view own spaced_repetition prefs" ON prefs_spaced_repetition;
DROP POLICY IF EXISTS "Users can insert own spaced_repetition prefs" ON prefs_spaced_repetition;
DROP POLICY IF EXISTS "Users can update own spaced_repetition prefs" ON prefs_spaced_repetition;
DROP POLICY IF EXISTS "Users can delete own spaced_repetition prefs" ON prefs_spaced_repetition;
DROP POLICY IF EXISTS "Users can view own SR prefs" ON prefs_spaced_repetition;
DROP POLICY IF EXISTS "Users can insert own SR prefs" ON prefs_spaced_repetition;
DROP POLICY IF EXISTS "Users can update own SR prefs" ON prefs_spaced_repetition;
DROP POLICY IF EXISTS "Users can delete own SR prefs" ON prefs_spaced_repetition;

-- prefs_scheduling_options
DROP POLICY IF EXISTS "Users can view own scheduling_options prefs" ON prefs_scheduling_options;
DROP POLICY IF EXISTS "Users can insert own scheduling_options prefs" ON prefs_scheduling_options;
DROP POLICY IF EXISTS "Users can update own scheduling_options prefs" ON prefs_scheduling_options;
DROP POLICY IF EXISTS "Users can delete own scheduling_options prefs" ON prefs_scheduling_options;
DROP POLICY IF EXISTS "Users can view own scheduling prefs" ON prefs_scheduling_options;
DROP POLICY IF EXISTS "Users can insert own scheduling prefs" ON prefs_scheduling_options;
DROP POLICY IF EXISTS "Users can update own scheduling prefs" ON prefs_scheduling_options;
DROP POLICY IF EXISTS "Users can delete own scheduling prefs" ON prefs_scheduling_options;

-- plugin
DROP POLICY IF EXISTS "Users can view own or public plugins" ON plugin;
DROP POLICY IF EXISTS "Users can insert own plugins" ON plugin;
DROP POLICY IF EXISTS "Users can update own plugins" ON plugin;
DROP POLICY IF EXISTS "Users can delete own plugins" ON plugin;

-- user_genre_selection
DROP POLICY IF EXISTS "user_genre_selection_select_own" ON user_genre_selection;
DROP POLICY IF EXISTS "user_genre_selection_insert_own" ON user_genre_selection;
DROP POLICY IF EXISTS "user_genre_selection_update_own" ON user_genre_selection;
DROP POLICY IF EXISTS "user_genre_selection_delete_own" ON user_genre_selection;

-- ============================================================================
-- STEP 5: Recreate all policies with auth.uid() directly
-- ============================================================================

-- daily_practice_queue policies
DROP POLICY IF EXISTS "Users can view own daily_practice_queue" ON daily_practice_queue;
CREATE POLICY "Users can view own daily_practice_queue"
  ON daily_practice_queue FOR SELECT
  TO public
  USING (user_ref = auth.uid());

DROP POLICY IF EXISTS "Users can insert own daily_practice_queue" ON daily_practice_queue;
CREATE POLICY "Users can insert own daily_practice_queue"
  ON daily_practice_queue FOR INSERT
  TO public
  WITH CHECK (user_ref = auth.uid());

DROP POLICY IF EXISTS "Users can update own daily_practice_queue" ON daily_practice_queue;
CREATE POLICY "Users can update own daily_practice_queue"
  ON daily_practice_queue FOR UPDATE
  TO public
  USING (user_ref = auth.uid());

DROP POLICY IF EXISTS "Users can delete own daily_practice_queue" ON daily_practice_queue;
CREATE POLICY "Users can delete own daily_practice_queue"
  ON daily_practice_queue FOR DELETE
  TO public
  USING (user_ref = auth.uid());

-- note policies
CREATE POLICY "Users can view own notes"
  ON note FOR SELECT
  TO public
  USING (user_ref = auth.uid());

CREATE POLICY "Users can insert own notes"
  ON note FOR INSERT
  TO public
  WITH CHECK (user_ref = auth.uid());

CREATE POLICY "Users can update own notes"
  ON note FOR UPDATE
  TO public
  USING (user_ref = auth.uid());

CREATE POLICY "Users can delete own notes"
  ON note FOR DELETE
  TO public
  USING (user_ref = auth.uid());

-- reference policies
CREATE POLICY "Users can view own references"
  ON reference FOR SELECT
  TO public
  USING (user_ref = auth.uid());

CREATE POLICY "Users can insert own references"
  ON reference FOR INSERT
  TO public
  WITH CHECK (user_ref = auth.uid());

CREATE POLICY "Users can update own references"
  ON reference FOR UPDATE
  TO public
  USING (user_ref = auth.uid());

CREATE POLICY "Users can delete own references"
  ON reference FOR DELETE
  TO public
  USING (user_ref = auth.uid());

-- tag policies
CREATE POLICY "Users can view own tags"
  ON tag FOR SELECT
  TO public
  USING (user_ref = auth.uid());

CREATE POLICY "Users can insert own tags"
  ON tag FOR INSERT
  TO public
  WITH CHECK (user_ref = auth.uid());

CREATE POLICY "Users can update own tags"
  ON tag FOR UPDATE
  TO public
  USING (user_ref = auth.uid());

CREATE POLICY "Users can delete own tags"
  ON tag FOR DELETE
  TO public
  USING (user_ref = auth.uid());

-- tab_group_main_state policies
CREATE POLICY "Users can view own tab_group_main_state"
  ON tab_group_main_state FOR SELECT
  TO public
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own tab_group_main_state"
  ON tab_group_main_state FOR INSERT
  TO public
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own tab_group_main_state"
  ON tab_group_main_state FOR UPDATE
  TO public
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own tab_group_main_state"
  ON tab_group_main_state FOR DELETE
  TO public
  USING (user_id = auth.uid());

-- table_state policies
CREATE POLICY "Users can view own table_state"
  ON table_state FOR SELECT
  TO public
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own table_state"
  ON table_state FOR INSERT
  TO public
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own table_state"
  ON table_state FOR UPDATE
  TO public
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own table_state"
  ON table_state FOR DELETE
  TO public
  USING (user_id = auth.uid());

-- table_transient_data policies
CREATE POLICY "Users can view own table_transient_data"
  ON table_transient_data FOR SELECT
  TO public
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own table_transient_data"
  ON table_transient_data FOR INSERT
  TO public
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own table_transient_data"
  ON table_transient_data FOR UPDATE
  TO public
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own table_transient_data"
  ON table_transient_data FOR DELETE
  TO public
  USING (user_id = auth.uid());

-- prefs_spaced_repetition policies
CREATE POLICY "Users can view own spaced_repetition prefs"
  ON prefs_spaced_repetition FOR SELECT
  TO public
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own spaced_repetition prefs"
  ON prefs_spaced_repetition FOR INSERT
  TO public
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own spaced_repetition prefs"
  ON prefs_spaced_repetition FOR UPDATE
  TO public
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own spaced_repetition prefs"
  ON prefs_spaced_repetition FOR DELETE
  TO public
  USING (user_id = auth.uid());

-- prefs_scheduling_options policies
CREATE POLICY "Users can view own scheduling_options prefs"
  ON prefs_scheduling_options FOR SELECT
  TO public
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own scheduling_options prefs"
  ON prefs_scheduling_options FOR INSERT
  TO public
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own scheduling_options prefs"
  ON prefs_scheduling_options FOR UPDATE
  TO public
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own scheduling_options prefs"
  ON prefs_scheduling_options FOR DELETE
  TO public
  USING (user_id = auth.uid());

-- instrument policies
CREATE POLICY "Users can view catalog and own instruments"
  ON instrument FOR SELECT
  TO public
  USING (private_to_user IS NULL OR private_to_user = auth.uid());

CREATE POLICY "Users can insert own private instruments"
  ON instrument FOR INSERT
  TO public
  WITH CHECK (private_to_user IS NULL OR private_to_user = auth.uid());

CREATE POLICY "Users can update own private instruments"
  ON instrument FOR UPDATE
  TO public
  USING (private_to_user IS NULL OR private_to_user = auth.uid());

CREATE POLICY "Users can delete own private instruments"
  ON instrument FOR DELETE
  TO public
  USING (private_to_user IS NULL OR private_to_user = auth.uid());

-- plugin policies
CREATE POLICY "Users can view own or public plugins"
  ON plugin FOR SELECT
  TO public
  USING (user_ref = auth.uid() OR is_public = true);

CREATE POLICY "Users can insert own plugins"
  ON plugin FOR INSERT
  TO public
  WITH CHECK (user_ref = auth.uid());

CREATE POLICY "Users can update own plugins"
  ON plugin FOR UPDATE
  TO public
  USING (user_ref = auth.uid());

CREATE POLICY "Users can delete own plugins"
  ON plugin FOR DELETE
  TO public
  USING (user_ref = auth.uid());

-- user_genre_selection policies
CREATE POLICY "user_genre_selection_select_own"
  ON user_genre_selection FOR SELECT
  TO public
  USING (user_id = auth.uid());

CREATE POLICY "user_genre_selection_insert_own"
  ON user_genre_selection FOR INSERT
  TO public
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_genre_selection_update_own"
  ON user_genre_selection FOR UPDATE
  TO public
  USING (user_id = auth.uid());

CREATE POLICY "user_genre_selection_delete_own"
  ON user_genre_selection FOR DELETE
  TO public
  USING (user_id = auth.uid());

-- ============================================================================
-- STEP 6: Update views that JOIN on user_profile.id
-- ============================================================================

-- view_daily_practice_queue_readable
DROP VIEW IF EXISTS "public"."view_daily_practice_queue_readable";
CREATE VIEW "public"."view_daily_practice_queue_readable"
WITH (security_invoker = true)
AS
SELECT
  dpq.id AS queue_id,
  COALESCE(up.name, up.email) AS user_name,
  i.instrument AS playlist_instrument,
  COALESCE(tune_override.title, tune.title) AS tune_title,
  dpq.queue_date,
  dpq.window_start_utc,
  dpq.window_end_utc,
  dpq.bucket,
  dpq.order_index,
  dpq.completed_at,
  dpq.active,
  dpq.mode,
  dpq.snapshot_coalesced_ts,
  dpq.scheduled_snapshot,
  dpq.generated_at,
  dpq.user_ref,
  dpq.playlist_ref,
  dpq.tune_ref
FROM
  daily_practice_queue dpq
  LEFT JOIN user_profile up ON up.supabase_user_id = dpq.user_ref
  LEFT JOIN playlist p ON p.playlist_id = dpq.playlist_ref
  LEFT JOIN instrument i ON i.id = p.instrument_ref
  LEFT JOIN tune ON tune.id = dpq.tune_ref
  LEFT JOIN tune_override ON tune_override.tune_ref = tune.id
    AND tune_override.user_ref = dpq.user_ref
ORDER BY
  dpq.queue_date DESC,
  dpq.bucket ASC,
  dpq.order_index ASC;

ALTER VIEW "public"."view_daily_practice_queue_readable" OWNER TO "postgres";
COMMENT ON VIEW "public"."view_daily_practice_queue_readable" IS 'Human-readable view of daily practice queue with resolved user names, instrument names, and tune titles. Uses security_invoker to respect RLS.';

-- view_transient_data_readable
DROP VIEW IF EXISTS "public"."view_transient_data_readable";
CREATE VIEW "public"."view_transient_data_readable"
WITH (security_invoker = true)
AS
SELECT
  COALESCE(up.name, up.email) AS user_name,
  ttd.user_id,
  COALESCE(tune_override.title, tune.title) AS tune_title,
  ttd.tune_id,
  i.instrument AS playlist_instrument,
  ttd.playlist_id,
  ttd.purpose,
  ttd.note_private,
  ttd.note_public,
  ttd.recall_eval,
  ttd.practiced,
  ttd.quality,
  ttd.easiness,
  ttd.difficulty,
  ttd.interval,
  ttd.step,
  ttd.repetitions,
  ttd.due,
  ttd.backup_practiced,
  ttd.goal,
  ttd.technique,
  ttd.stability,
  ttd.state,
  ttd.sync_version,
  ttd.last_modified_at,
  ttd.device_id
FROM
  table_transient_data ttd
  LEFT JOIN user_profile up ON up.supabase_user_id = ttd.user_id
  LEFT JOIN tune ON tune.id = ttd.tune_id
  LEFT JOIN tune_override ON tune_override.tune_ref = tune.id
    AND tune_override.user_ref = ttd.user_id
  LEFT JOIN playlist p ON p.playlist_id = ttd.playlist_id
  LEFT JOIN instrument i ON i.id = p.instrument_ref
ORDER BY
  ttd.last_modified_at DESC;

ALTER VIEW "public"."view_transient_data_readable" OWNER TO "postgres";
COMMENT ON VIEW "public"."view_transient_data_readable" IS 'Human-readable view of transient/staged practice data with resolved user names, instrument names, and tune titles. Uses security_invoker to respect RLS.';

-- view_practice_record_readable
DROP VIEW IF EXISTS "public"."view_practice_record_readable";
CREATE VIEW "public"."view_practice_record_readable"
WITH (security_invoker = true)
AS
SELECT
  COALESCE(up.name, up.email) AS user_name,
  COALESCE(tune_override.title, tune.title) AS tune_title,
  pr.tune_ref,
  i.instrument AS playlist_instrument,
  pr.playlist_ref,
  pr.practiced,
  pr.quality,
  CASE pr.quality
    WHEN 1 THEN 'Again'
    WHEN 2 THEN 'Hard'
    WHEN 3 THEN 'Good'
    WHEN 4 THEN 'Easy'
    ELSE 'Unknown'
  END AS quality_label,
  pr.easiness,
  pr.difficulty,
  pr.stability,
  pr.interval,
  pr.step,
  pr.repetitions,
  pr.lapses,
  pr.elapsed_days,
  pr.state,
  CASE pr.state
    WHEN 0 THEN 'New'
    WHEN 1 THEN 'Learning'
    WHEN 2 THEN 'Review'
    WHEN 3 THEN 'Relearning'
    ELSE 'Unknown'
  END AS state_label,
  pr.due,
  pr.backup_practiced,
  pr.goal,
  pr.technique,
  pr.sync_version,
  pr.last_modified_at,
  pr.device_id,
  pr.id
FROM
  practice_record pr
  LEFT JOIN playlist p ON p.playlist_id = pr.playlist_ref
  LEFT JOIN user_profile up ON up.supabase_user_id = p.user_ref
  LEFT JOIN tune ON tune.id = pr.tune_ref
  LEFT JOIN tune_override ON tune_override.tune_ref = tune.id
    AND tune_override.user_ref = p.user_ref
  LEFT JOIN instrument i ON i.id = p.instrument_ref
ORDER BY
  pr.practiced DESC;

ALTER VIEW "public"."view_practice_record_readable" OWNER TO "postgres";
COMMENT ON VIEW "public"."view_practice_record_readable" IS 'Human-readable view of practice records with resolved user names, instrument names, tune titles, and decoded quality/state labels. Uses security_invoker to respect RLS.';


COMMIT;

-- ============================================================================
-- Post-migration verification queries (run separately after migration)
-- ============================================================================
-- 
-- Verify user_profile structure:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'user_profile'
-- ORDER BY ordinal_position;
--
-- Verify foreign keys point to supabase_user_id:
-- SELECT
--   tc.table_name,
--   kcu.column_name,
--   ccu.table_name AS foreign_table_name,
--   ccu.column_name AS foreign_column_name
-- FROM information_schema.table_constraints AS tc
-- JOIN information_schema.key_column_usage AS kcu
--   ON tc.constraint_name = kcu.constraint_name
-- JOIN information_schema.constraint_column_usage AS ccu
--   ON ccu.constraint_name = tc.constraint_name
-- WHERE tc.constraint_type = 'FOREIGN KEY'
--   AND ccu.table_name = 'user_profile';
