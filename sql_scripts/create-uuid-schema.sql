-- Create UUID-based schema for TuneTrees
-- This script creates all tables with UUID primary keys
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Genre table
CREATE TABLE
    IF NOT EXISTS genre (
        id text PRIMARY KEY,
        name text,
        region text,
        description text
    );

-- Tune Type table
CREATE TABLE
    IF NOT EXISTS tune_type (
        id text PRIMARY KEY,
        name text,
        rhythm text,
        description text
    );

-- Genre-Tune Type junction
CREATE TABLE
    IF NOT EXISTS genre_tune_type (
        genre_id text NOT NULL REFERENCES genre (id),
        tune_type_id text NOT NULL REFERENCES tune_type (id),
        PRIMARY KEY (genre_id, tune_type_id)
    );

-- User Profile
CREATE TABLE
    IF NOT EXISTS user_profile (
        id uuid PRIMARY KEY,
        name text,
        email text,
        sr_alg_type text,
        phone text,
        phone_verified timestamp,
        acceptable_delinquency_window integer DEFAULT 21,
        avatar_url text,
        deleted boolean NOT NULL DEFAULT false,
        sync_version integer NOT NULL DEFAULT 1,
        last_modified_at timestamp NOT NULL DEFAULT now (),
        device_id text
    );

-- Tune
CREATE TABLE
    IF NOT EXISTS tune (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
        id_foreign integer,
        primary_origin text DEFAULT 'irishtune.info',
        title text,
        type text,
        structure text,
        mode text,
        incipit text,
        genre text REFERENCES genre (id),
        private_for uuid REFERENCES user_profile (id),
        deleted boolean NOT NULL DEFAULT false,
        sync_version integer NOT NULL DEFAULT 1,
        last_modified_at timestamp NOT NULL DEFAULT now (),
        device_id text
    );

-- Tune Override
CREATE TABLE
    IF NOT EXISTS tune_override (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
        tune_ref uuid NOT NULL REFERENCES tune (id),
        user_ref uuid NOT NULL REFERENCES user_profile (id),
        title text,
        type text,
        structure text,
        genre text REFERENCES genre (id),
        mode text,
        incipit text,
        deleted boolean NOT NULL DEFAULT false,
        sync_version integer NOT NULL DEFAULT 1,
        last_modified_at timestamp NOT NULL DEFAULT now (),
        device_id text
    );

-- Instrument
CREATE TABLE
    IF NOT EXISTS instrument (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
        private_to_user uuid REFERENCES user_profile (id),
        instrument text,
        description text,
        genre_default text,
        deleted boolean NOT NULL DEFAULT false,
        sync_version integer NOT NULL DEFAULT 1,
        last_modified_at timestamp NOT NULL DEFAULT now (),
        device_id text,
        UNIQUE (private_to_user, instrument)
    );

CREATE INDEX IF NOT EXISTS idx_instrument_instrument ON instrument (instrument);

CREATE INDEX IF NOT EXISTS idx_instrument_private_to_user ON instrument (private_to_user);

-- Playlist
CREATE TABLE
    IF NOT EXISTS playlist (
        playlist_id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
        user_ref uuid NOT NULL REFERENCES user_profile (id),
        name text,
        instrument_ref uuid,
        genre_default text REFERENCES genre (id),
        sr_alg_type text,
        deleted boolean NOT NULL DEFAULT false,
        sync_version integer NOT NULL DEFAULT 1,
        last_modified_at timestamp NOT NULL DEFAULT now (),
        device_id text,
        UNIQUE (user_ref, instrument_ref)
    );

-- Playlist Tune
CREATE TABLE
    IF NOT EXISTS playlist_tune (
        playlist_ref uuid NOT NULL REFERENCES playlist (playlist_id),
        tune_ref uuid NOT NULL REFERENCES tune (id),
        current timestamp,
        learned timestamp,
        scheduled timestamp,
        goal text DEFAULT 'recall',
        deleted boolean NOT NULL DEFAULT false,
        sync_version integer NOT NULL DEFAULT 1,
        last_modified_at timestamp NOT NULL DEFAULT now (),
        device_id text,
        PRIMARY KEY (playlist_ref, tune_ref)
    );

-- Practice Record
CREATE TABLE
    IF NOT EXISTS practice_record (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
        playlist_ref uuid NOT NULL REFERENCES playlist (playlist_id),
        tune_ref uuid NOT NULL REFERENCES tune (id),
        practiced timestamp,
        quality integer,
        easiness real,
        difficulty real,
        stability real,
        interval integer,
        step integer,
        repetitions integer,
        lapses integer,
        elapsed_days integer,
        state integer,
        due timestamp,
        backup_practiced timestamp,
        goal text DEFAULT 'recall',
        technique text,
        sync_version integer NOT NULL DEFAULT 1,
        last_modified_at timestamp NOT NULL DEFAULT now (),
        device_id text,
        UNIQUE (tune_ref, playlist_ref, practiced)
    );

CREATE INDEX IF NOT EXISTS idx_practice_record_id ON practice_record (id DESC);

CREATE INDEX IF NOT EXISTS idx_practice_record_tune_playlist_practiced ON practice_record (tune_ref, playlist_ref, practiced DESC);

CREATE INDEX IF NOT EXISTS idx_practice_record_practiced ON practice_record (practiced DESC);

-- Daily Practice Queue
CREATE TABLE
    IF NOT EXISTS daily_practice_queue (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
        user_ref uuid NOT NULL,
        playlist_ref uuid NOT NULL,
        mode text,
        queue_date timestamp,
        window_start_utc timestamp NOT NULL,
        window_end_utc timestamp NOT NULL,
        tune_ref uuid NOT NULL,
        bucket integer NOT NULL,
        order_index integer NOT NULL,
        snapshot_coalesced_ts timestamp NOT NULL,
        scheduled_snapshot text,
        latest_due_snapshot text,
        acceptable_delinquency_window_snapshot integer,
        tz_offset_minutes_snapshot integer,
        generated_at timestamp NOT NULL,
        completed_at timestamp,
        exposures_required integer,
        exposures_completed integer DEFAULT 0,
        outcome text,
        active boolean NOT NULL DEFAULT true,
        sync_version integer NOT NULL DEFAULT 1,
        last_modified_at timestamp NOT NULL DEFAULT now (),
        device_id text,
        UNIQUE (
            user_ref,
            playlist_ref,
            window_start_utc,
            tune_ref
        )
    );

CREATE INDEX IF NOT EXISTS idx_queue_user_playlist_window ON daily_practice_queue (user_ref, playlist_ref, window_start_utc);

CREATE INDEX IF NOT EXISTS idx_queue_user_playlist_active ON daily_practice_queue (user_ref, playlist_ref, active);

CREATE INDEX IF NOT EXISTS idx_queue_user_playlist_bucket ON daily_practice_queue (user_ref, playlist_ref, bucket);

CREATE INDEX IF NOT EXISTS idx_queue_generated_at ON daily_practice_queue (generated_at);

-- Note
CREATE TABLE
    IF NOT EXISTS note (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
        user_ref uuid REFERENCES user_profile (id),
        tune_ref uuid NOT NULL REFERENCES tune (id),
        playlist_ref uuid REFERENCES playlist (playlist_id),
        created_date timestamp,
        note_text text,
        public boolean NOT NULL DEFAULT false,
        favorite boolean,
        deleted boolean NOT NULL DEFAULT false,
        sync_version integer NOT NULL DEFAULT 1,
        last_modified_at timestamp NOT NULL DEFAULT now (),
        device_id text,
        CONSTRAINT chk_public_bool CHECK (public IN (true, false)),
        CONSTRAINT chk_favorite_bool CHECK (
            favorite IN (true, false)
            OR favorite IS NULL
        )
    );

CREATE INDEX IF NOT EXISTS idx_note_tune_playlist ON note (tune_ref, playlist_ref);

CREATE INDEX IF NOT EXISTS idx_note_tune_playlist_user_public ON note (tune_ref, playlist_ref, user_ref, public);

CREATE INDEX IF NOT EXISTS idx_note_tune_user ON note (tune_ref, user_ref);

-- Reference
CREATE TABLE
    IF NOT EXISTS reference (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
        url text NOT NULL,
        ref_type text,
        tune_ref uuid NOT NULL REFERENCES tune (id),
        user_ref uuid REFERENCES user_profile (id),
        comment text,
        title text,
        public boolean,
        favorite boolean,
        deleted boolean NOT NULL DEFAULT false,
        sync_version integer NOT NULL DEFAULT 1,
        last_modified_at timestamp NOT NULL DEFAULT now (),
        device_id text,
        CONSTRAINT check_ref_type CHECK (
            ref_type IN ('website', 'audio', 'video', 'sheet-music', 'article', 'social', 'lesson', 'other')
            OR ref_type IS NULL
        ),
        CONSTRAINT check_public CHECK (
            public IN (true, false)
            OR public IS NULL
        ),
        CONSTRAINT check_favorite CHECK (
            favorite IN (true, false)
            OR favorite IS NULL
        )
    );

CREATE INDEX IF NOT EXISTS idx_reference_tune_public ON reference (tune_ref, public);

CREATE INDEX IF NOT EXISTS idx_reference_tune_user_ref ON reference (tune_ref, user_ref);

CREATE INDEX IF NOT EXISTS idx_reference_user_tune_public ON reference (user_ref, tune_ref, public);

-- Tag
CREATE TABLE
    IF NOT EXISTS tag (
        tag_id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
        user_ref uuid NOT NULL REFERENCES user_profile (id),
        tune_ref uuid NOT NULL REFERENCES tune (id),
        tag_text text NOT NULL,
        sync_version integer NOT NULL DEFAULT 1,
        last_modified_at timestamp NOT NULL DEFAULT now (),
        device_id text,
        UNIQUE (user_ref, tune_ref, tag_text)
    );

CREATE INDEX IF NOT EXISTS idx_tag_user_ref_tag_text ON tag (user_ref, tag_text);

CREATE INDEX IF NOT EXISTS idx_tag_user_ref_tune_ref ON tag (user_ref, tune_ref);

-- Prefs Spaced Repetition
CREATE TABLE
    IF NOT EXISTS prefs_spaced_repetition (
        user_id uuid NOT NULL REFERENCES user_profile (id),
        alg_type text NOT NULL,
        fsrs_weights text,
        request_retention real,
        maximum_interval integer,
        learning_steps text,
        relearning_steps text,
        enable_fuzzing boolean,
        sync_version integer NOT NULL DEFAULT 1,
        last_modified_at timestamp NOT NULL DEFAULT now (),
        device_id text,
        PRIMARY KEY (user_id, alg_type),
        CONSTRAINT check_name CHECK (alg_type IN ('SM2', 'FSRS'))
    );

-- Prefs Scheduling Options
CREATE TABLE
    IF NOT EXISTS prefs_scheduling_options (
        user_id uuid PRIMARY KEY REFERENCES user_profile (id),
        acceptable_delinquency_window integer NOT NULL DEFAULT 21,
        min_reviews_per_day integer,
        max_reviews_per_day integer,
        days_per_week integer,
        weekly_rules text,
        exceptions text,
        auto_schedule_new boolean NOT NULL DEFAULT true,
        sync_version integer NOT NULL DEFAULT 1,
        last_modified_at timestamp NOT NULL DEFAULT now (),
        device_id text
    );

-- Tab Group Main State
CREATE TABLE
    IF NOT EXISTS tab_group_main_state (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
        user_id uuid NOT NULL REFERENCES user_profile (id),
        which_tab text DEFAULT 'practice',
        playlist_id uuid,
        tab_spec text,
        practice_show_submitted integer DEFAULT 0,
        practice_mode_flashcard integer DEFAULT 0,
        sidebar_dock_position text DEFAULT 'left',
        sync_version integer NOT NULL DEFAULT 1,
        last_modified_at timestamp NOT NULL DEFAULT now (),
        device_id text,
        CONSTRAINT check_name CHECK (
            which_tab IN ('scheduled', 'repertoire', 'catalog', 'analysis')
            OR which_tab IS NULL
        )
    );

-- Table State
CREATE TABLE
    IF NOT EXISTS table_state (
        user_id uuid NOT NULL REFERENCES user_profile (id),
        screen_size text NOT NULL,
        purpose text NOT NULL,
        playlist_id uuid NOT NULL REFERENCES playlist (playlist_id),
        settings text,
        current_tune uuid,
        sync_version integer NOT NULL DEFAULT 1,
        last_modified_at timestamp NOT NULL DEFAULT now (),
        device_id text,
        PRIMARY KEY (user_id, screen_size, purpose, playlist_id),
        CONSTRAINT purpose_check CHECK (
            purpose IN ('practice', 'repertoire', 'catalog', 'analysis')
        ),
        CONSTRAINT screen_size_check CHECK (screen_size IN ('small', 'full'))
    );

-- Table Transient Data
CREATE TABLE
    IF NOT EXISTS table_transient_data (
        user_id uuid NOT NULL REFERENCES user_profile (id),
        tune_id uuid NOT NULL REFERENCES tune (id),
        playlist_id uuid NOT NULL REFERENCES playlist (playlist_id),
        purpose text,
        note_private text,
        note_public text,
        recall_eval text,
        practiced timestamp,
        quality integer,
        easiness real,
        difficulty real,
        interval integer,
        step integer,
        repetitions integer,
        due timestamp,
        backup_practiced timestamp,
        goal text,
        technique text,
        stability real,
        state integer DEFAULT 2,
        sync_version integer NOT NULL DEFAULT 1,
        last_modified_at timestamp NOT NULL DEFAULT now (),
        device_id text,
        PRIMARY KEY (tune_id, user_id, playlist_id)
    );

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================
-- Enable RLS on all user-scoped tables
ALTER TABLE user_profile ENABLE ROW LEVEL SECURITY;

ALTER TABLE tune ENABLE ROW LEVEL SECURITY;

ALTER TABLE tune_override ENABLE ROW LEVEL SECURITY;

ALTER TABLE instrument ENABLE ROW LEVEL SECURITY;

ALTER TABLE playlist ENABLE ROW LEVEL SECURITY;

ALTER TABLE playlist_tune ENABLE ROW LEVEL SECURITY;

ALTER TABLE practice_record ENABLE ROW LEVEL SECURITY;

ALTER TABLE daily_practice_queue ENABLE ROW LEVEL SECURITY;

ALTER TABLE note ENABLE ROW LEVEL SECURITY;

ALTER TABLE reference ENABLE ROW LEVEL SECURITY;

ALTER TABLE tag ENABLE ROW LEVEL SECURITY;

ALTER TABLE prefs_spaced_repetition ENABLE ROW LEVEL SECURITY;

ALTER TABLE prefs_scheduling_options ENABLE ROW LEVEL SECURITY;

ALTER TABLE tab_group_main_state ENABLE ROW LEVEL SECURITY;

ALTER TABLE table_state ENABLE ROW LEVEL SECURITY;

ALTER TABLE table_transient_data ENABLE ROW LEVEL SECURITY;

ALTER TABLE genre ENABLE ROW LEVEL SECURITY;

ALTER TABLE tune_type ENABLE ROW LEVEL SECURITY;

ALTER TABLE genre_tune_type ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- User Profile Policies
-- ============================================================================
CREATE POLICY "Users can view own profile" ON user_profile FOR
SELECT
    USING (id = auth.uid ());

CREATE POLICY "Users can insert own profile" ON user_profile FOR INSERT
WITH
    CHECK (id = auth.uid ());

CREATE POLICY "Users can update own profile" ON user_profile FOR
UPDATE USING (id = auth.uid ());

CREATE POLICY "Users can delete own profile" ON user_profile FOR DELETE USING (id = auth.uid ());

-- ============================================================================
-- Tune Policies (catalog + private)
-- ============================================================================
CREATE POLICY "Users can view catalog tunes and own private tunes" ON tune FOR
SELECT
    USING (
        private_for IS NULL
        OR private_for IN (
            SELECT
                id
            FROM
                user_profile
            WHERE
                id = auth.uid ()
        )
    );

CREATE POLICY "Users can insert own private tunes" ON tune FOR INSERT
WITH
    CHECK (
        private_for IN (
            SELECT
                id
            FROM
                user_profile
            WHERE
                id = auth.uid ()
        )
    );

CREATE POLICY "Users can update own private tunes" ON tune FOR
UPDATE USING (
    private_for IN (
        SELECT
            id
        FROM
            user_profile
        WHERE
            id = auth.uid ()
    )
);

CREATE POLICY "Users can delete own private tunes" ON tune FOR DELETE USING (
    private_for IN (
        SELECT
            id
        FROM
            user_profile
        WHERE
            id = auth.uid ()
    )
);

-- ============================================================================
-- Tune Override Policies
-- ============================================================================
CREATE POLICY "Users can view own tune overrides" ON tune_override FOR
SELECT
    USING (
        user_ref IN (
            SELECT
                id
            FROM
                user_profile
            WHERE
                id = auth.uid ()
        )
    );

CREATE POLICY "Users can insert own tune overrides" ON tune_override FOR INSERT
WITH
    CHECK (
        user_ref IN (
            SELECT
                id
            FROM
                user_profile
            WHERE
                id = auth.uid ()
        )
    );

CREATE POLICY "Users can update own tune overrides" ON tune_override FOR
UPDATE USING (
    user_ref IN (
        SELECT
            id
        FROM
            user_profile
        WHERE
            id = auth.uid ()
    )
);

CREATE POLICY "Users can delete own tune overrides" ON tune_override FOR DELETE USING (
    user_ref IN (
        SELECT
            id
        FROM
            user_profile
        WHERE
            id = auth.uid ()
    )
);

-- ============================================================================
-- Instrument Policies (catalog + private)
-- ============================================================================
CREATE POLICY "Users can view catalog instruments and own private instruments" ON instrument FOR
SELECT
    USING (
        private_to_user IS NULL
        OR private_to_user IN (
            SELECT
                id
            FROM
                user_profile
            WHERE
                id = auth.uid ()
        )
    );

CREATE POLICY "Users can insert own private instruments" ON instrument FOR INSERT
WITH
    CHECK (
        private_to_user IN (
            SELECT
                id
            FROM
                user_profile
            WHERE
                id = auth.uid ()
        )
    );

CREATE POLICY "Users can update own private instruments" ON instrument FOR
UPDATE USING (
    private_to_user IN (
        SELECT
            id
        FROM
            user_profile
        WHERE
            id = auth.uid ()
    )
);

CREATE POLICY "Users can delete own private instruments" ON instrument FOR DELETE USING (
    private_to_user IN (
        SELECT
            id
        FROM
            user_profile
        WHERE
            id = auth.uid ()
    )
);

-- ============================================================================
-- Playlist Policies
-- ============================================================================
CREATE POLICY "Users can view own playlists" ON playlist FOR
SELECT
    USING (
        user_ref IN (
            SELECT
                id
            FROM
                user_profile
            WHERE
                id = auth.uid ()
        )
    );

CREATE POLICY "Users can insert own playlists" ON playlist FOR INSERT
WITH
    CHECK (
        user_ref IN (
            SELECT
                id
            FROM
                user_profile
            WHERE
                id = auth.uid ()
        )
    );

CREATE POLICY "Users can update own playlists" ON playlist FOR
UPDATE USING (
    user_ref IN (
        SELECT
            id
        FROM
            user_profile
        WHERE
            id = auth.uid ()
    )
);

CREATE POLICY "Users can delete own playlists" ON playlist FOR DELETE USING (
    user_ref IN (
        SELECT
            id
        FROM
            user_profile
        WHERE
            id = auth.uid ()
    )
);

-- ============================================================================
-- Playlist Tune Policies
-- ============================================================================
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
                        id = auth.uid ()
                )
        )
    );

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
                        id = auth.uid ()
                )
        )
    );

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
                    id = auth.uid ()
            )
    )
);

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
                    id = auth.uid ()
            )
    )
);

-- ============================================================================
-- Practice Record Policies
-- ============================================================================
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
                        id = auth.uid ()
                )
        )
    );

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
                        id = auth.uid ()
                )
        )
    );

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
                    id = auth.uid ()
            )
    )
);

CREATE POLICY "Users can delete own practice records" ON practice_record FOR DELETE USING (
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
                    id = auth.uid ()
            )
    )
);

-- ============================================================================
-- Daily Practice Queue Policies
-- ============================================================================
CREATE POLICY "Users can view own practice queue" ON daily_practice_queue FOR
SELECT
    USING (
        user_ref IN (
            SELECT
                id
            FROM
                user_profile
            WHERE
                id = auth.uid ()
        )
    );

CREATE POLICY "Users can insert own practice queue" ON daily_practice_queue FOR INSERT
WITH
    CHECK (
        user_ref IN (
            SELECT
                id
            FROM
                user_profile
            WHERE
                id = auth.uid ()
        )
    );

CREATE POLICY "Users can update own practice queue" ON daily_practice_queue FOR
UPDATE USING (
    user_ref IN (
        SELECT
            id
        FROM
            user_profile
        WHERE
            id = auth.uid ()
    )
);

CREATE POLICY "Users can delete own practice queue" ON daily_practice_queue FOR DELETE USING (
    user_ref IN (
        SELECT
            id
        FROM
            user_profile
        WHERE
            id = auth.uid ()
    )
);

-- ============================================================================
-- Note Policies
-- ============================================================================
CREATE POLICY "Users can view own notes and public notes" ON note FOR
SELECT
    USING (
        user_ref IN (
            SELECT
                id
            FROM
                user_profile
            WHERE
                id = auth.uid ()
        )
        OR public = true
    );

CREATE POLICY "Users can insert own notes" ON note FOR INSERT
WITH
    CHECK (
        user_ref IN (
            SELECT
                id
            FROM
                user_profile
            WHERE
                id = auth.uid ()
        )
    );

CREATE POLICY "Users can update own notes" ON note FOR
UPDATE USING (
    user_ref IN (
        SELECT
            id
        FROM
            user_profile
        WHERE
            id = auth.uid ()
    )
);

CREATE POLICY "Users can delete own notes" ON note FOR DELETE USING (
    user_ref IN (
        SELECT
            id
        FROM
            user_profile
        WHERE
            id = auth.uid ()
    )
);

-- ============================================================================
-- Reference Policies
-- ============================================================================
CREATE POLICY "Users can view own references and public references" ON reference FOR
SELECT
    USING (
        user_ref IN (
            SELECT
                id
            FROM
                user_profile
            WHERE
                id = auth.uid ()
        )
        OR public = true
    );

CREATE POLICY "Users can insert own references" ON reference FOR INSERT
WITH
    CHECK (
        user_ref IN (
            SELECT
                id
            FROM
                user_profile
            WHERE
                id = auth.uid ()
        )
    );

CREATE POLICY "Users can update own references" ON reference FOR
UPDATE USING (
    user_ref IN (
        SELECT
            id
        FROM
            user_profile
        WHERE
            id = auth.uid ()
    )
);

CREATE POLICY "Users can delete own references" ON reference FOR DELETE USING (
    user_ref IN (
        SELECT
            id
        FROM
            user_profile
        WHERE
            id = auth.uid ()
    )
);

-- ============================================================================
-- Tag Policies
-- ============================================================================
CREATE POLICY "Users can view own tags" ON tag FOR
SELECT
    USING (
        user_ref IN (
            SELECT
                id
            FROM
                user_profile
            WHERE
                id = auth.uid ()
        )
    );

CREATE POLICY "Users can insert own tags" ON tag FOR INSERT
WITH
    CHECK (
        user_ref IN (
            SELECT
                id
            FROM
                user_profile
            WHERE
                id = auth.uid ()
        )
    );

CREATE POLICY "Users can update own tags" ON tag FOR
UPDATE USING (
    user_ref IN (
        SELECT
            id
        FROM
            user_profile
        WHERE
            id = auth.uid ()
    )
);

CREATE POLICY "Users can delete own tags" ON tag FOR DELETE USING (
    user_ref IN (
        SELECT
            id
        FROM
            user_profile
        WHERE
            id = auth.uid ()
    )
);

-- ============================================================================
-- Preferences Policies
-- ============================================================================
CREATE POLICY "Users can view own spaced repetition prefs" ON prefs_spaced_repetition FOR
SELECT
    USING (
        user_id IN (
            SELECT
                id
            FROM
                user_profile
            WHERE
                id = auth.uid ()
        )
    );

CREATE POLICY "Users can insert own spaced repetition prefs" ON prefs_spaced_repetition FOR INSERT
WITH
    CHECK (
        user_id IN (
            SELECT
                id
            FROM
                user_profile
            WHERE
                id = auth.uid ()
        )
    );

CREATE POLICY "Users can update own spaced repetition prefs" ON prefs_spaced_repetition FOR
UPDATE USING (
    user_id IN (
        SELECT
            id
        FROM
            user_profile
        WHERE
            id = auth.uid ()
    )
);

CREATE POLICY "Users can delete own spaced repetition prefs" ON prefs_spaced_repetition FOR DELETE USING (
    user_id IN (
        SELECT
            id
        FROM
            user_profile
        WHERE
            id = auth.uid ()
    )
);

CREATE POLICY "Users can view own scheduling prefs" ON prefs_scheduling_options FOR
SELECT
    USING (
        user_id IN (
            SELECT
                id
            FROM
                user_profile
            WHERE
                id = auth.uid ()
        )
    );

CREATE POLICY "Users can insert own scheduling prefs" ON prefs_scheduling_options FOR INSERT
WITH
    CHECK (
        user_id IN (
            SELECT
                id
            FROM
                user_profile
            WHERE
                id = auth.uid ()
        )
    );

CREATE POLICY "Users can update own scheduling prefs" ON prefs_scheduling_options FOR
UPDATE USING (
    user_id IN (
        SELECT
            id
        FROM
            user_profile
        WHERE
            id = auth.uid ()
    )
);

CREATE POLICY "Users can delete own scheduling prefs" ON prefs_scheduling_options FOR DELETE USING (
    user_id IN (
        SELECT
            id
        FROM
            user_profile
        WHERE
            id = auth.uid ()
    )
);

-- ============================================================================
-- UI State Policies
-- ============================================================================
CREATE POLICY "Users can view own tab group state" ON tab_group_main_state FOR
SELECT
    USING (
        user_id IN (
            SELECT
                id
            FROM
                user_profile
            WHERE
                id = auth.uid ()
        )
    );

CREATE POLICY "Users can insert own tab group state" ON tab_group_main_state FOR INSERT
WITH
    CHECK (
        user_id IN (
            SELECT
                id
            FROM
                user_profile
            WHERE
                id = auth.uid ()
        )
    );

CREATE POLICY "Users can update own tab group state" ON tab_group_main_state FOR
UPDATE USING (
    user_id IN (
        SELECT
            id
        FROM
            user_profile
        WHERE
            id = auth.uid ()
    )
);

CREATE POLICY "Users can delete own tab group state" ON tab_group_main_state FOR DELETE USING (
    user_id IN (
        SELECT
            id
        FROM
            user_profile
        WHERE
            id = auth.uid ()
    )
);

CREATE POLICY "Users can view own table state" ON table_state FOR
SELECT
    USING (
        user_id IN (
            SELECT
                id
            FROM
                user_profile
            WHERE
                id = auth.uid ()
        )
    );

CREATE POLICY "Users can insert own table state" ON table_state FOR INSERT
WITH
    CHECK (
        user_id IN (
            SELECT
                id
            FROM
                user_profile
            WHERE
                id = auth.uid ()
        )
    );

CREATE POLICY "Users can update own table state" ON table_state FOR
UPDATE USING (
    user_id IN (
        SELECT
            id
        FROM
            user_profile
        WHERE
            id = auth.uid ()
    )
);

CREATE POLICY "Users can delete own table state" ON table_state FOR DELETE USING (
    user_id IN (
        SELECT
            id
        FROM
            user_profile
        WHERE
            id = auth.uid ()
    )
);

CREATE POLICY "Users can view own table transient data" ON table_transient_data FOR
SELECT
    USING (
        user_id IN (
            SELECT
                id
            FROM
                user_profile
            WHERE
                id = auth.uid ()
        )
    );

CREATE POLICY "Users can insert own table transient data" ON table_transient_data FOR INSERT
WITH
    CHECK (
        user_id IN (
            SELECT
                id
            FROM
                user_profile
            WHERE
                id = auth.uid ()
        )
    );

CREATE POLICY "Users can update own table transient data" ON table_transient_data FOR
UPDATE USING (
    user_id IN (
        SELECT
            id
        FROM
            user_profile
        WHERE
            id = auth.uid ()
    )
);

CREATE POLICY "Users can delete own table transient data" ON table_transient_data FOR DELETE USING (
    user_id IN (
        SELECT
            id
        FROM
            user_profile
        WHERE
            id = auth.uid ()
    )
);

-- ============================================================================
-- Reference Data Policies (public read-only)
-- ============================================================================
CREATE POLICY "All users can view genres" ON genre FOR
SELECT
    USING (true);

CREATE POLICY "All users can view tune types" ON tune_type FOR
SELECT
    USING (true);

CREATE POLICY "All users can view genre-tune type mappings" ON genre_tune_type FOR
SELECT
    USING (true);