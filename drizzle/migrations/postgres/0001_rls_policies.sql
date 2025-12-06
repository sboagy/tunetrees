-- Enable Row Level Security (RLS) policies for TuneTrees
-- This migration adds security policies to ensure users can only access their own data
-- ============================================================================
-- USER PROFILE
-- ============================================================================
ALTER TABLE user_profile ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON user_profile FOR
SELECT
    USING (auth.uid () = supabase_user_id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON user_profile FOR
UPDATE USING (auth.uid () = supabase_user_id);

-- Users can insert their own profile (during sign-up)
CREATE POLICY "Users can insert own profile" ON user_profile FOR INSERT
WITH
    CHECK (auth.uid () = supabase_user_id);

-- ============================================================================
-- PLAYLIST
-- ============================================================================
ALTER TABLE playlist ENABLE ROW LEVEL SECURITY;

-- Users can view own playlists
CREATE POLICY "Users can view own playlists" ON playlist FOR
SELECT
    USING (
        user_ref IN (
            SELECT
                id
            FROM
                user_profile
            WHERE
                supabase_user_id = auth.uid ()
        )
    );

-- Users can insert own playlists
CREATE POLICY "Users can insert own playlists" ON playlist FOR INSERT
WITH
    CHECK (
        user_ref IN (
            SELECT
                id
            FROM
                user_profile
            WHERE
                supabase_user_id = auth.uid ()
        )
    );

-- Users can update own playlists
CREATE POLICY "Users can update own playlists" ON playlist FOR
UPDATE USING (
    user_ref IN (
        SELECT
            id
        FROM
            user_profile
        WHERE
            supabase_user_id = auth.uid ()
    )
);

-- Users can delete own playlists
CREATE POLICY "Users can delete own playlists" ON playlist FOR DELETE USING (
    user_ref IN (
        SELECT
            id
        FROM
            user_profile
        WHERE
            supabase_user_id = auth.uid ()
    )
);

-- ============================================================================
-- PLAYLIST_TUNE
-- ============================================================================
ALTER TABLE playlist_tune ENABLE ROW LEVEL SECURITY;

-- Users can view own playlist tunes
CREATE POLICY "Users can view own playlist tunes" ON playlist_tune FOR
SELECT
    USING (
        playlist_ref IN (
            SELECT
                playlist_id
            FROM
                playlist
            WHERE
                user_ref IN (
                    SELECT
                        id
                    FROM
                        user_profile
                    WHERE
                        supabase_user_id = auth.uid ()
                )
        )
    );

-- Users can insert own playlist tunes
CREATE POLICY "Users can insert own playlist tunes" ON playlist_tune FOR INSERT
WITH
    CHECK (
        playlist_ref IN (
            SELECT
                playlist_id
            FROM
                playlist
            WHERE
                user_ref IN (
                    SELECT
                        id
                    FROM
                        user_profile
                    WHERE
                        supabase_user_id = auth.uid ()
                )
        )
    );

-- Users can update own playlist tunes
CREATE POLICY "Users can update own playlist tunes" ON playlist_tune FOR
UPDATE USING (
    playlist_ref IN (
        SELECT
            playlist_id
        FROM
            playlist
        WHERE
            user_ref IN (
                SELECT
                    id
                FROM
                    user_profile
                WHERE
                    supabase_user_id = auth.uid ()
            )
    )
);

-- Users can delete own playlist tunes
CREATE POLICY "Users can delete own playlist tunes" ON playlist_tune FOR DELETE USING (
    playlist_ref IN (
        SELECT
            playlist_id
        FROM
            playlist
        WHERE
            user_ref IN (
                SELECT
                    id
                FROM
                    user_profile
                WHERE
                    supabase_user_id = auth.uid ()
            )
    )
);

-- ============================================================================
-- PRACTICE_RECORD
-- ============================================================================
ALTER TABLE practice_record ENABLE ROW LEVEL SECURITY;

-- Users can view own practice records
CREATE POLICY "Users can view own practice records" ON practice_record FOR
SELECT
    USING (
        playlist_ref IN (
            SELECT
                playlist_id
            FROM
                playlist
            WHERE
                user_ref IN (
                    SELECT
                        id
                    FROM
                        user_profile
                    WHERE
                        supabase_user_id = auth.uid ()
                )
        )
    );

-- Users can insert own practice records
CREATE POLICY "Users can insert own practice records" ON practice_record FOR INSERT
WITH
    CHECK (
        playlist_ref IN (
            SELECT
                playlist_id
            FROM
                playlist
            WHERE
                user_ref IN (
                    SELECT
                        id
                    FROM
                        user_profile
                    WHERE
                        supabase_user_id = auth.uid ()
                )
        )
    );

-- Users can update own practice records
CREATE POLICY "Users can update own practice records" ON practice_record FOR
UPDATE USING (
    playlist_ref IN (
        SELECT
            playlist_id
        FROM
            playlist
        WHERE
            user_ref IN (
                SELECT
                    id
                FROM
                    user_profile
                WHERE
                    supabase_user_id = auth.uid ()
            )
    )
);

-- ============================================================================
-- DAILY_PRACTICE_QUEUE
-- ============================================================================
ALTER TABLE daily_practice_queue ENABLE ROW LEVEL SECURITY;

-- Users can view own practice queue
CREATE POLICY "Users can view own practice queue" ON daily_practice_queue FOR
SELECT
    USING (
        user_ref IN (
            SELECT
                id
            FROM
                user_profile
            WHERE
                supabase_user_id = auth.uid ()
        )
    );

-- Users can insert own practice queue items
CREATE POLICY "Users can insert own practice queue items" ON daily_practice_queue FOR INSERT
WITH
    CHECK (
        user_ref IN (
            SELECT
                id
            FROM
                user_profile
            WHERE
                supabase_user_id = auth.uid ()
        )
    );

-- Users can update own practice queue items
CREATE POLICY "Users can update own practice queue items" ON daily_practice_queue FOR
UPDATE USING (
    user_ref IN (
        SELECT
            id
        FROM
            user_profile
        WHERE
            supabase_user_id = auth.uid ()
    )
);

-- Users can delete own practice queue items
CREATE POLICY "Users can delete own practice queue items" ON daily_practice_queue FOR DELETE USING (
    user_ref IN (
        SELECT
            id
        FROM
            user_profile
        WHERE
            supabase_user_id = auth.uid ()
    )
);

-- ============================================================================
-- NOTE
-- ============================================================================
ALTER TABLE note ENABLE ROW LEVEL SECURITY;

-- Users can view own notes OR public notes
CREATE POLICY "Users can view own or public notes" ON note FOR
SELECT
    USING (
        user_ref IN (
            SELECT
                id
            FROM
                user_profile
            WHERE
                supabase_user_id = auth.uid ()
        )
        OR public = true
    );

-- Users can insert own notes
CREATE POLICY "Users can insert own notes" ON note FOR INSERT
WITH
    CHECK (
        user_ref IN (
            SELECT
                id
            FROM
                user_profile
            WHERE
                supabase_user_id = auth.uid ()
        )
    );

-- Users can update own notes
CREATE POLICY "Users can update own notes" ON note FOR
UPDATE USING (
    user_ref IN (
        SELECT
            id
        FROM
            user_profile
        WHERE
            supabase_user_id = auth.uid ()
    )
);

-- Users can delete own notes
CREATE POLICY "Users can delete own notes" ON note FOR DELETE USING (
    user_ref IN (
        SELECT
            id
        FROM
            user_profile
        WHERE
            supabase_user_id = auth.uid ()
    )
);

-- ============================================================================
-- REFERENCE
-- ============================================================================
ALTER TABLE reference ENABLE ROW LEVEL SECURITY;

-- Users can view own references OR public references
CREATE POLICY "Users can view own or public references" ON reference FOR
SELECT
    USING (
        user_ref IN (
            SELECT
                id
            FROM
                user_profile
            WHERE
                supabase_user_id = auth.uid ()
        )
        OR public = true
    );

-- Users can insert own references
CREATE POLICY "Users can insert own references" ON reference FOR INSERT
WITH
    CHECK (
        user_ref IN (
            SELECT
                id
            FROM
                user_profile
            WHERE
                supabase_user_id = auth.uid ()
        )
    );

-- Users can update own references
CREATE POLICY "Users can update own references" ON reference FOR
UPDATE USING (
    user_ref IN (
        SELECT
            id
        FROM
            user_profile
        WHERE
            supabase_user_id = auth.uid ()
    )
);

-- Users can delete own references
CREATE POLICY "Users can delete own references" ON reference FOR DELETE USING (
    user_ref IN (
        SELECT
            id
        FROM
            user_profile
        WHERE
            supabase_user_id = auth.uid ()
    )
);

-- ============================================================================
-- TAG
-- ============================================================================
ALTER TABLE tag ENABLE ROW LEVEL SECURITY;

-- Users can view own tags
CREATE POLICY "Users can view own tags" ON tag FOR
SELECT
    USING (
        user_ref IN (
            SELECT
                id
            FROM
                user_profile
            WHERE
                supabase_user_id = auth.uid ()
        )
    );

-- Users can insert own tags
CREATE POLICY "Users can insert own tags" ON tag FOR INSERT
WITH
    CHECK (
        user_ref IN (
            SELECT
                id
            FROM
                user_profile
            WHERE
                supabase_user_id = auth.uid ()
        )
    );

-- Users can update own tags
CREATE POLICY "Users can update own tags" ON tag FOR
UPDATE USING (
    user_ref IN (
        SELECT
            id
        FROM
            user_profile
        WHERE
            supabase_user_id = auth.uid ()
    )
);

-- Users can delete own tags
CREATE POLICY "Users can delete own tags" ON tag FOR DELETE USING (
    user_ref IN (
        SELECT
            id
        FROM
            user_profile
        WHERE
            supabase_user_id = auth.uid ()
    )
);

-- ============================================================================
-- TUNE
-- ============================================================================
ALTER TABLE tune ENABLE ROW LEVEL SECURITY;

-- Everyone can view public tunes (private_for IS NULL) OR own private tunes
CREATE POLICY "Users can view public or own private tunes" ON tune FOR
SELECT
    USING (
        private_for IS NULL
        OR private_for IN (
            SELECT
                id
            FROM
                user_profile
            WHERE
                supabase_user_id = auth.uid ()
        )
    );

-- Users can insert own private tunes
CREATE POLICY "Users can insert own private tunes" ON tune FOR INSERT
WITH
    CHECK (
        private_for IN (
            SELECT
                id
            FROM
                user_profile
            WHERE
                supabase_user_id = auth.uid ()
        )
    );

-- Users can update own private tunes
CREATE POLICY "Users can update own private tunes" ON tune FOR
UPDATE USING (
    private_for IN (
        SELECT
            id
        FROM
            user_profile
        WHERE
            supabase_user_id = auth.uid ()
    )
);

-- Users can delete own private tunes
CREATE POLICY "Users can delete own private tunes" ON tune FOR DELETE USING (
    private_for IN (
        SELECT
            id
        FROM
            user_profile
        WHERE
            supabase_user_id = auth.uid ()
    )
);

-- ============================================================================
-- TUNE_OVERRIDE
-- ============================================================================
ALTER TABLE tune_override ENABLE ROW LEVEL SECURITY;

-- Users can view own tune overrides
CREATE POLICY "Users can view own tune overrides" ON tune_override FOR
SELECT
    USING (
        user_ref IN (
            SELECT
                id
            FROM
                user_profile
            WHERE
                supabase_user_id = auth.uid ()
        )
    );

-- Users can insert own tune overrides
CREATE POLICY "Users can insert own tune overrides" ON tune_override FOR INSERT
WITH
    CHECK (
        user_ref IN (
            SELECT
                id
            FROM
                user_profile
            WHERE
                supabase_user_id = auth.uid ()
        )
    );

-- Users can update own tune overrides
CREATE POLICY "Users can update own tune overrides" ON tune_override FOR
UPDATE USING (
    user_ref IN (
        SELECT
            id
        FROM
            user_profile
        WHERE
            supabase_user_id = auth.uid ()
    )
);

-- Users can delete own tune overrides
CREATE POLICY "Users can delete own tune overrides" ON tune_override FOR DELETE USING (
    user_ref IN (
        SELECT
            id
        FROM
            user_profile
        WHERE
            supabase_user_id = auth.uid ()
    )
);

-- ============================================================================
-- INSTRUMENT
-- ============================================================================
ALTER TABLE instrument ENABLE ROW LEVEL SECURITY;

-- Everyone can view public instruments (private_to_user IS NULL) OR own private instruments
CREATE POLICY "Users can view public or own private instruments" ON instrument FOR
SELECT
    USING (
        private_to_user IS NULL
        OR private_to_user IN (
            SELECT
                id
            FROM
                user_profile
            WHERE
                supabase_user_id = auth.uid ()
        )
    );

-- Users can insert own private instruments
CREATE POLICY "Users can insert own private instruments" ON instrument FOR INSERT
WITH
    CHECK (
        private_to_user IN (
            SELECT
                id
            FROM
                user_profile
            WHERE
                supabase_user_id = auth.uid ()
        )
    );

-- Users can update own private instruments
CREATE POLICY "Users can update own private instruments" ON instrument FOR
UPDATE USING (
    private_to_user IN (
        SELECT
            id
        FROM
            user_profile
        WHERE
            supabase_user_id = auth.uid ()
    )
);

-- Users can delete own private instruments
CREATE POLICY "Users can delete own private instruments" ON instrument FOR DELETE USING (
    private_to_user IN (
        SELECT
            id
        FROM
            user_profile
        WHERE
            supabase_user_id = auth.uid ()
    )
);

-- ============================================================================
-- PREFERENCES - SPACED REPETITION
-- ============================================================================
ALTER TABLE prefs_spaced_repetition ENABLE ROW LEVEL SECURITY;

-- Users can view own preferences
CREATE POLICY "Users can view own SR preferences" ON prefs_spaced_repetition FOR
SELECT
    USING (
        user_id IN (
            SELECT
                id
            FROM
                user_profile
            WHERE
                supabase_user_id = auth.uid ()
        )
    );

-- Users can insert own preferences
CREATE POLICY "Users can insert own SR preferences" ON prefs_spaced_repetition FOR INSERT
WITH
    CHECK (
        user_id IN (
            SELECT
                id
            FROM
                user_profile
            WHERE
                supabase_user_id = auth.uid ()
        )
    );

-- Users can update own preferences
CREATE POLICY "Users can update own SR preferences" ON prefs_spaced_repetition FOR
UPDATE USING (
    user_id IN (
        SELECT
            id
        FROM
            user_profile
        WHERE
            supabase_user_id = auth.uid ()
    )
);

-- Users can delete own preferences
CREATE POLICY "Users can delete own SR preferences" ON prefs_spaced_repetition FOR DELETE USING (
    user_id IN (
        SELECT
            id
        FROM
            user_profile
        WHERE
            supabase_user_id = auth.uid ()
    )
);

-- ============================================================================
-- PREFERENCES - SCHEDULING OPTIONS
-- ============================================================================
ALTER TABLE prefs_scheduling_options ENABLE ROW LEVEL SECURITY;

-- Users can view own preferences
CREATE POLICY "Users can view own scheduling preferences" ON prefs_scheduling_options FOR
SELECT
    USING (
        user_id IN (
            SELECT
                id
            FROM
                user_profile
            WHERE
                supabase_user_id = auth.uid ()
        )
    );

-- Users can insert own preferences
CREATE POLICY "Users can insert own scheduling preferences" ON prefs_scheduling_options FOR INSERT
WITH
    CHECK (
        user_id IN (
            SELECT
                id
            FROM
                user_profile
            WHERE
                supabase_user_id = auth.uid ()
        )
    );

-- Users can update own preferences
CREATE POLICY "Users can update own scheduling preferences" ON prefs_scheduling_options FOR
UPDATE USING (
    user_id IN (
        SELECT
            id
        FROM
            user_profile
        WHERE
            supabase_user_id = auth.uid ()
    )
);

-- Users can delete own scheduling preferences
CREATE POLICY "Users can delete own scheduling preferences" ON prefs_scheduling_options FOR DELETE USING (
    user_id IN (
        SELECT
            id
        FROM
            user_profile
        WHERE
            supabase_user_id = auth.uid ()
    )
);

-- ============================================================================
-- TABLE STATE
-- ============================================================================
ALTER TABLE table_state ENABLE ROW LEVEL SECURITY;

-- Users can view own table state
CREATE POLICY "Users can view own table state" ON table_state FOR
SELECT
    USING (
        user_id IN (
            SELECT
                id
            FROM
                user_profile
            WHERE
                supabase_user_id = auth.uid ()
        )
    );

-- Users can insert own table state
CREATE POLICY "Users can insert own table state" ON table_state FOR INSERT
WITH
    CHECK (
        user_id IN (
            SELECT
                id
            FROM
                user_profile
            WHERE
                supabase_user_id = auth.uid ()
        )
    );

-- Users can update own table state
CREATE POLICY "Users can update own table state" ON table_state FOR
UPDATE USING (
    user_id IN (
        SELECT
            id
        FROM
            user_profile
        WHERE
            supabase_user_id = auth.uid ()
    )
);

-- Users can delete own table state
CREATE POLICY "Users can delete own table state" ON table_state FOR DELETE USING (
    user_id IN (
        SELECT
            id
        FROM
            user_profile
        WHERE
            supabase_user_id = auth.uid ()
    )
);

-- ============================================================================
-- TAB GROUP MAIN STATE
-- ============================================================================
ALTER TABLE tab_group_main_state ENABLE ROW LEVEL SECURITY;

-- Users can view own tab group state
CREATE POLICY "Users can view own tab group state" ON tab_group_main_state FOR
SELECT
    USING (
        user_id IN (
            SELECT
                id
            FROM
                user_profile
            WHERE
                supabase_user_id = auth.uid ()
        )
    );

-- Users can insert own tab group state
CREATE POLICY "Users can insert own tab group state" ON tab_group_main_state FOR INSERT
WITH
    CHECK (
        user_id IN (
            SELECT
                id
            FROM
                user_profile
            WHERE
                supabase_user_id = auth.uid ()
        )
    );

-- Users can update own tab group state
CREATE POLICY "Users can update own tab group state" ON tab_group_main_state FOR
UPDATE USING (
    user_id IN (
        SELECT
            id
        FROM
            user_profile
        WHERE
            supabase_user_id = auth.uid ()
    )
);

-- Users can delete own tab group state
CREATE POLICY "Users can delete own tab group state" ON tab_group_main_state FOR DELETE USING (
    user_id IN (
        SELECT
            id
        FROM
            user_profile
        WHERE
            supabase_user_id = auth.uid ()
    )
);

-- ============================================================================
-- TABLE TRANSIENT DATA
-- ============================================================================
ALTER TABLE table_transient_data ENABLE ROW LEVEL SECURITY;

-- Users can view own transient data
CREATE POLICY "Users can view own transient data" ON table_transient_data FOR
SELECT
    USING (
        user_id IN (
            SELECT
                id
            FROM
                user_profile
            WHERE
                supabase_user_id = auth.uid ()
        )
    );

-- Users can insert own transient data
CREATE POLICY "Users can insert own transient data" ON table_transient_data FOR INSERT
WITH
    CHECK (
        user_id IN (
            SELECT
                id
            FROM
                user_profile
            WHERE
                supabase_user_id = auth.uid ()
        )
    );

-- Users can update own transient data
CREATE POLICY "Users can update own transient data" ON table_transient_data FOR
UPDATE USING (
    user_id IN (
        SELECT
            id
        FROM
            user_profile
        WHERE
            supabase_user_id = auth.uid ()
    )
);

-- Users can delete own transient data
CREATE POLICY "Users can delete own transient data" ON table_transient_data FOR DELETE USING (
    user_id IN (
        SELECT
            id
        FROM
            user_profile
        WHERE
            supabase_user_id = auth.uid ()
    )
);

-- ============================================================================
-- REFERENCE DATA TABLES (READ-ONLY FOR ALL AUTHENTICATED USERS)
-- ============================================================================
-- GENRE: Everyone can read genres (system reference data)
ALTER TABLE genre ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view genres" ON genre FOR
SELECT
    TO authenticated USING (true);

-- TUNE_TYPE: Everyone can read tune types (system reference data)
ALTER TABLE tune_type ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view tune types" ON tune_type FOR
SELECT
    TO authenticated USING (true);

-- GENRE_TUNE_TYPE: Everyone can read genre-tune type relationships
ALTER TABLE genre_tune_type ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view genre-tune type relationships" ON genre_tune_type FOR
SELECT
    TO authenticated USING (true);

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- RLS policies created for 19 tables:
-- ✅ user_profile - Users can only see/modify their own profile
-- ✅ playlist - Users can only see/modify their own playlists
-- ✅ playlist_tune - Users can only see/modify tunes in their playlists
-- ✅ practice_record - Users can only see/modify their own practice records
-- ✅ daily_practice_queue - Users can only see/modify their own queue
-- ✅ note - Users can see their own notes OR public notes
-- ✅ reference - Users can see their own references OR public references
-- ✅ tag - Users can only see/modify their own tags
-- ✅ tune - Users can see public tunes OR their own private tunes
-- ✅ tune_override - Users can only see/modify their own overrides
-- ✅ instrument - Users can see public instruments OR their own private instruments
-- ✅ prefs_spaced_repetition - Users can only see/modify their own preferences
-- ✅ prefs_scheduling_options - Users can only see/modify their own preferences
-- ✅ table_state - Users can only see/modify their own table state
-- ✅ tab_group_main_state - Users can only see/modify their own tab state
-- ✅ table_transient_data - Users can only see/modify their own transient data
-- ✅ genre - All authenticated users can read (reference data)
-- ✅ tune_type - All authenticated users can read (reference data)
-- ✅ genre_tune_type - All authenticated users can read (reference data)