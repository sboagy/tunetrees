-- ============================================================================
-- Sync Outbox Triggers for TuneTrees
-- ============================================================================
--
-- NOTE: This file is for DOCUMENTATION/REFERENCE only!
-- The actual triggers are installed dynamically by:
--   src/lib/db/install-triggers.ts
-- Any changes should be made there, not here.
--
-- These triggers automatically populate the sync_outbox table whenever
-- data changes occur on syncable tables. The sync worker then processes
-- this outbox to push changes to Supabase.
--
-- Design decisions:
-- 1. ID generation: lower(hex(randomblob(16))) - random hex ID
-- 2. Composite keys: JSON string format (e.g., '{"user_id":"x","tune_id":"y"}')
-- 3. Timestamp: ISO 8601 format using strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
-- 4. All tables get triggers (including reference data like genre, tune_type)
-- 5. AUTO-MODIFIED triggers: For tables with last_modified_at (supportsIncremental),
--    an additional AFTER UPDATE trigger auto-updates this column when it wasn't
--    explicitly set. This ensures sync propagation works even when code forgets
--    to set last_modified_at. The trigger pattern is:
--
--    CREATE TRIGGER trg_<table>_auto_modified
--    AFTER UPDATE ON <table>
--    FOR EACH ROW
--    WHEN NEW.last_modified_at = OLD.last_modified_at
--      OR NEW.last_modified_at IS NULL
--    BEGIN
--      UPDATE <table>
--      SET last_modified_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
--      WHERE <pk_column> = NEW.<pk_column>;
--    END;
--
-- Generated from: shared/table-meta.ts SYNCABLE_TABLES
-- Installed dynamically by: src/lib/db/install-triggers.ts
-- ============================================================================
-- ============================================================================
-- DROP EXISTING TRIGGERS (if reinstalling)
-- ============================================================================
-- daily_practice_queue
DROP TRIGGER IF EXISTS trg_daily_practice_queue_insert;

DROP TRIGGER IF EXISTS trg_daily_practice_queue_update;

DROP TRIGGER IF EXISTS trg_daily_practice_queue_delete;

DROP TRIGGER IF EXISTS trg_daily_practice_queue_auto_modified;

-- genre
DROP TRIGGER IF EXISTS trg_genre_insert;

DROP TRIGGER IF EXISTS trg_genre_update;

DROP TRIGGER IF EXISTS trg_genre_delete;

-- genre_tune_type (composite PK)
DROP TRIGGER IF EXISTS trg_genre_tune_type_insert;

DROP TRIGGER IF EXISTS trg_genre_tune_type_update;

DROP TRIGGER IF EXISTS trg_genre_tune_type_delete;

-- note
DROP TRIGGER IF EXISTS trg_note_insert;

DROP TRIGGER IF EXISTS trg_note_update;

DROP TRIGGER IF EXISTS trg_note_delete;

-- playlist
DROP TRIGGER IF EXISTS trg_playlist_insert;

DROP TRIGGER IF EXISTS trg_playlist_update;

DROP TRIGGER IF EXISTS trg_playlist_delete;

-- playlist_tune (composite PK)
DROP TRIGGER IF EXISTS trg_playlist_tune_insert;

DROP TRIGGER IF EXISTS trg_playlist_tune_update;

DROP TRIGGER IF EXISTS trg_playlist_tune_delete;

-- practice_record
DROP TRIGGER IF EXISTS trg_practice_record_insert;

DROP TRIGGER IF EXISTS trg_practice_record_update;

DROP TRIGGER IF EXISTS trg_practice_record_delete;

-- prefs_scheduling_options
DROP TRIGGER IF EXISTS trg_prefs_scheduling_options_insert;

DROP TRIGGER IF EXISTS trg_prefs_scheduling_options_update;

DROP TRIGGER IF EXISTS trg_prefs_scheduling_options_delete;

-- prefs_spaced_repetition (composite PK)
DROP TRIGGER IF EXISTS trg_prefs_spaced_repetition_insert;

DROP TRIGGER IF EXISTS trg_prefs_spaced_repetition_update;

DROP TRIGGER IF EXISTS trg_prefs_spaced_repetition_delete;

-- reference
DROP TRIGGER IF EXISTS trg_reference_insert;

DROP TRIGGER IF EXISTS trg_reference_update;

DROP TRIGGER IF EXISTS trg_reference_delete;

-- repertoire
DROP TRIGGER IF EXISTS trg_repertoire_insert;

DROP TRIGGER IF EXISTS trg_repertoire_update;

DROP TRIGGER IF EXISTS trg_repertoire_delete;

-- tab_group_main_state
DROP TRIGGER IF EXISTS trg_tab_group_main_state_insert;

DROP TRIGGER IF EXISTS trg_tab_group_main_state_update;

DROP TRIGGER IF EXISTS trg_tab_group_main_state_delete;

-- table_state (composite PK)
DROP TRIGGER IF EXISTS trg_table_state_insert;

DROP TRIGGER IF EXISTS trg_table_state_update;

DROP TRIGGER IF EXISTS trg_table_state_delete;

-- table_transient_data (composite PK)
DROP TRIGGER IF EXISTS trg_table_transient_data_insert;

DROP TRIGGER IF EXISTS trg_table_transient_data_update;

DROP TRIGGER IF EXISTS trg_table_transient_data_delete;

-- tag
DROP TRIGGER IF EXISTS trg_tag_insert;

DROP TRIGGER IF EXISTS trg_tag_update;

DROP TRIGGER IF EXISTS trg_tag_delete;

-- tune
DROP TRIGGER IF EXISTS trg_tune_insert;

DROP TRIGGER IF EXISTS trg_tune_update;

DROP TRIGGER IF EXISTS trg_tune_delete;

-- tune_type
DROP TRIGGER IF EXISTS trg_tune_type_insert;

DROP TRIGGER IF EXISTS trg_tune_type_update;

DROP TRIGGER IF EXISTS trg_tune_type_delete;

-- user_annotation
DROP TRIGGER IF EXISTS trg_user_annotation_insert;

DROP TRIGGER IF EXISTS trg_user_annotation_update;

DROP TRIGGER IF EXISTS trg_user_annotation_delete;

-- user_profile
DROP TRIGGER IF EXISTS trg_user_profile_insert;

DROP TRIGGER IF EXISTS trg_user_profile_update;

DROP TRIGGER IF EXISTS trg_user_profile_delete;

-- ============================================================================
-- CREATE SYNC_OUTBOX TABLE (if not exists)
-- ============================================================================
CREATE TABLE
    IF NOT EXISTS sync_outbox (
        id TEXT PRIMARY KEY NOT NULL,
        table_name TEXT NOT NULL,
        row_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        changed_at TEXT NOT NULL,
        synced_at TEXT,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT
    );

CREATE INDEX IF NOT EXISTS idx_outbox_status_changed ON sync_outbox (status, changed_at);

CREATE INDEX IF NOT EXISTS idx_outbox_table_row ON sync_outbox (table_name, row_id);

-- ============================================================================
-- TRIGGERS: daily_practice_queue (single PK: id)
-- ============================================================================
CREATE TRIGGER trg_daily_practice_queue_insert AFTER INSERT ON daily_practice_queue BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'daily_practice_queue',
        NEW.id,
        'INSERT',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

CREATE TRIGGER trg_daily_practice_queue_update AFTER
UPDATE ON daily_practice_queue BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'daily_practice_queue',
        NEW.id,
        'UPDATE',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

CREATE TRIGGER trg_daily_practice_queue_delete AFTER DELETE ON daily_practice_queue BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'daily_practice_queue',
        OLD.id,
        'DELETE',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

-- Auto-update last_modified_at when not explicitly set (ensures sync propagation)
CREATE TRIGGER trg_daily_practice_queue_auto_modified AFTER
UPDATE ON daily_practice_queue FOR EACH ROW WHEN NEW.last_modified_at = OLD.last_modified_at
OR NEW.last_modified_at IS NULL BEGIN
UPDATE daily_practice_queue
SET
    last_modified_at = strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE
    id = NEW.id;

END;

-- ============================================================================
-- TRIGGERS: genre (single PK: id)
-- ============================================================================
CREATE TRIGGER trg_genre_insert AFTER INSERT ON genre BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'genre',
        NEW.id,
        'INSERT',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

CREATE TRIGGER trg_genre_update AFTER
UPDATE ON genre BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'genre',
        NEW.id,
        'UPDATE',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

CREATE TRIGGER trg_genre_delete AFTER DELETE ON genre BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'genre',
        OLD.id,
        'DELETE',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

-- ============================================================================
-- TRIGGERS: genre_tune_type (composite PK: genre_id, tune_type_id)
-- ============================================================================
CREATE TRIGGER trg_genre_tune_type_insert AFTER INSERT ON genre_tune_type BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'genre_tune_type',
        json_object (
            'genre_id',
            NEW.genre_id,
            'tune_type_id',
            NEW.tune_type_id
        ),
        'INSERT',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

CREATE TRIGGER trg_genre_tune_type_update AFTER
UPDATE ON genre_tune_type BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'genre_tune_type',
        json_object (
            'genre_id',
            NEW.genre_id,
            'tune_type_id',
            NEW.tune_type_id
        ),
        'UPDATE',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

CREATE TRIGGER trg_genre_tune_type_delete AFTER DELETE ON genre_tune_type BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'genre_tune_type',
        json_object (
            'genre_id',
            OLD.genre_id,
            'tune_type_id',
            OLD.tune_type_id
        ),
        'DELETE',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

-- ============================================================================
-- TRIGGERS: note (single PK: id)
-- ============================================================================
CREATE TRIGGER trg_note_insert AFTER INSERT ON note BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'note',
        NEW.id,
        'INSERT',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

CREATE TRIGGER trg_note_update AFTER
UPDATE ON note BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'note',
        NEW.id,
        'UPDATE',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

CREATE TRIGGER trg_note_delete AFTER DELETE ON note BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'note',
        OLD.id,
        'DELETE',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

-- ============================================================================
-- TRIGGERS: playlist (single PK: playlist_id)
-- ============================================================================
CREATE TRIGGER trg_playlist_insert AFTER INSERT ON playlist BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'playlist',
        NEW.playlist_id,
        'INSERT',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

CREATE TRIGGER trg_playlist_update AFTER
UPDATE ON playlist BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'playlist',
        NEW.playlist_id,
        'UPDATE',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

CREATE TRIGGER trg_playlist_delete AFTER DELETE ON playlist BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'playlist',
        OLD.playlist_id,
        'DELETE',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

-- ============================================================================
-- TRIGGERS: playlist_tune (composite PK: playlist_ref, tune_ref)
-- ============================================================================
CREATE TRIGGER trg_playlist_tune_insert AFTER INSERT ON playlist_tune BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'playlist_tune',
        json_object (
            'playlist_ref',
            NEW.playlist_ref,
            'tune_ref',
            NEW.tune_ref
        ),
        'INSERT',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

CREATE TRIGGER trg_playlist_tune_update AFTER
UPDATE ON playlist_tune BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'playlist_tune',
        json_object (
            'playlist_ref',
            NEW.playlist_ref,
            'tune_ref',
            NEW.tune_ref
        ),
        'UPDATE',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

CREATE TRIGGER trg_playlist_tune_delete AFTER DELETE ON playlist_tune BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'playlist_tune',
        json_object (
            'playlist_ref',
            OLD.playlist_ref,
            'tune_ref',
            OLD.tune_ref
        ),
        'DELETE',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

-- ============================================================================
-- TRIGGERS: practice_record (single PK: id)
-- ============================================================================
CREATE TRIGGER trg_practice_record_insert AFTER INSERT ON practice_record BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'practice_record',
        NEW.id,
        'INSERT',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

CREATE TRIGGER trg_practice_record_update AFTER
UPDATE ON practice_record BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'practice_record',
        NEW.id,
        'UPDATE',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

CREATE TRIGGER trg_practice_record_delete AFTER DELETE ON practice_record BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'practice_record',
        OLD.id,
        'DELETE',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

-- ============================================================================
-- TRIGGERS: prefs_scheduling_options (single PK: user_id)
-- ============================================================================
CREATE TRIGGER trg_prefs_scheduling_options_insert AFTER INSERT ON prefs_scheduling_options BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'prefs_scheduling_options',
        NEW.user_id,
        'INSERT',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

CREATE TRIGGER trg_prefs_scheduling_options_update AFTER
UPDATE ON prefs_scheduling_options BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'prefs_scheduling_options',
        NEW.user_id,
        'UPDATE',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

CREATE TRIGGER trg_prefs_scheduling_options_delete AFTER DELETE ON prefs_scheduling_options BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'prefs_scheduling_options',
        OLD.user_id,
        'DELETE',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

-- ============================================================================
-- TRIGGERS: prefs_spaced_repetition (composite PK: user_id, playlist_id)
-- ============================================================================
CREATE TRIGGER trg_prefs_spaced_repetition_insert AFTER INSERT ON prefs_spaced_repetition BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'prefs_spaced_repetition',
        json_object (
            'user_id',
            NEW.user_id,
            'playlist_id',
            NEW.playlist_id
        ),
        'INSERT',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

CREATE TRIGGER trg_prefs_spaced_repetition_update AFTER
UPDATE ON prefs_spaced_repetition BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'prefs_spaced_repetition',
        json_object (
            'user_id',
            NEW.user_id,
            'playlist_id',
            NEW.playlist_id
        ),
        'UPDATE',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

CREATE TRIGGER trg_prefs_spaced_repetition_delete AFTER DELETE ON prefs_spaced_repetition BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'prefs_spaced_repetition',
        json_object (
            'user_id',
            OLD.user_id,
            'playlist_id',
            OLD.playlist_id
        ),
        'DELETE',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

-- ============================================================================
-- TRIGGERS: reference (single PK: id)
-- ============================================================================
CREATE TRIGGER trg_reference_insert AFTER INSERT ON reference BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'reference',
        NEW.id,
        'INSERT',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

CREATE TRIGGER trg_reference_update AFTER
UPDATE ON reference BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'reference',
        NEW.id,
        'UPDATE',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

CREATE TRIGGER trg_reference_delete AFTER DELETE ON reference BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'reference',
        OLD.id,
        'DELETE',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

-- ============================================================================
-- TRIGGERS: repertoire (single PK: id)
-- ============================================================================
CREATE TRIGGER trg_repertoire_insert AFTER INSERT ON repertoire BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'repertoire',
        NEW.id,
        'INSERT',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

CREATE TRIGGER trg_repertoire_update AFTER
UPDATE ON repertoire BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'repertoire',
        NEW.id,
        'UPDATE',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

CREATE TRIGGER trg_repertoire_delete AFTER DELETE ON repertoire BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'repertoire',
        OLD.id,
        'DELETE',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

-- ============================================================================
-- TRIGGERS: tab_group_main_state (single PK: id)
-- ============================================================================
CREATE TRIGGER trg_tab_group_main_state_insert AFTER INSERT ON tab_group_main_state BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'tab_group_main_state',
        NEW.id,
        'INSERT',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

CREATE TRIGGER trg_tab_group_main_state_update AFTER
UPDATE ON tab_group_main_state BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'tab_group_main_state',
        NEW.id,
        'UPDATE',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

CREATE TRIGGER trg_tab_group_main_state_delete AFTER DELETE ON tab_group_main_state BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'tab_group_main_state',
        OLD.id,
        'DELETE',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

-- ============================================================================
-- TRIGGERS: table_state (composite PK: user_id, screen_size, purpose, playlist_id)
-- ============================================================================
CREATE TRIGGER trg_table_state_insert AFTER INSERT ON table_state BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'table_state',
        json_object (
            'user_id',
            NEW.user_id,
            'screen_size',
            NEW.screen_size,
            'purpose',
            NEW.purpose,
            'playlist_id',
            NEW.playlist_id
        ),
        'INSERT',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

CREATE TRIGGER trg_table_state_update AFTER
UPDATE ON table_state BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'table_state',
        json_object (
            'user_id',
            NEW.user_id,
            'screen_size',
            NEW.screen_size,
            'purpose',
            NEW.purpose,
            'playlist_id',
            NEW.playlist_id
        ),
        'UPDATE',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

CREATE TRIGGER trg_table_state_delete AFTER DELETE ON table_state BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'table_state',
        json_object (
            'user_id',
            OLD.user_id,
            'screen_size',
            OLD.screen_size,
            'purpose',
            OLD.purpose,
            'playlist_id',
            OLD.playlist_id
        ),
        'DELETE',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

-- ============================================================================
-- TRIGGERS: table_transient_data (composite PK: user_id, tune_id, playlist_id)
-- ============================================================================
CREATE TRIGGER trg_table_transient_data_insert AFTER INSERT ON table_transient_data BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'table_transient_data',
        json_object (
            'user_id',
            NEW.user_id,
            'tune_id',
            NEW.tune_id,
            'playlist_id',
            NEW.playlist_id
        ),
        'INSERT',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

CREATE TRIGGER trg_table_transient_data_update AFTER
UPDATE ON table_transient_data BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'table_transient_data',
        json_object (
            'user_id',
            NEW.user_id,
            'tune_id',
            NEW.tune_id,
            'playlist_id',
            NEW.playlist_id
        ),
        'UPDATE',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

CREATE TRIGGER trg_table_transient_data_delete AFTER DELETE ON table_transient_data BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'table_transient_data',
        json_object (
            'user_id',
            OLD.user_id,
            'tune_id',
            OLD.tune_id,
            'playlist_id',
            OLD.playlist_id
        ),
        'DELETE',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

-- ============================================================================
-- TRIGGERS: tag (single PK: id)
-- ============================================================================
CREATE TRIGGER trg_tag_insert AFTER INSERT ON tag BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'tag',
        NEW.id,
        'INSERT',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

CREATE TRIGGER trg_tag_update AFTER
UPDATE ON tag BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'tag',
        NEW.id,
        'UPDATE',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

CREATE TRIGGER trg_tag_delete AFTER DELETE ON tag BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'tag',
        OLD.id,
        'DELETE',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

-- ============================================================================
-- TRIGGERS: tune (single PK: id)
-- ============================================================================
CREATE TRIGGER trg_tune_insert AFTER INSERT ON tune BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'tune',
        NEW.id,
        'INSERT',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

CREATE TRIGGER trg_tune_update AFTER
UPDATE ON tune BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'tune',
        NEW.id,
        'UPDATE',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

CREATE TRIGGER trg_tune_delete AFTER DELETE ON tune BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'tune',
        OLD.id,
        'DELETE',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

-- ============================================================================
-- TRIGGERS: tune_type (single PK: id)
-- ============================================================================
CREATE TRIGGER trg_tune_type_insert AFTER INSERT ON tune_type BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'tune_type',
        NEW.id,
        'INSERT',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

CREATE TRIGGER trg_tune_type_update AFTER
UPDATE ON tune_type BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'tune_type',
        NEW.id,
        'UPDATE',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

CREATE TRIGGER trg_tune_type_delete AFTER DELETE ON tune_type BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'tune_type',
        OLD.id,
        'DELETE',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

-- ============================================================================
-- TRIGGERS: user_annotation (single PK: id)
-- ============================================================================
CREATE TRIGGER trg_user_annotation_insert AFTER INSERT ON user_annotation BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'user_annotation',
        NEW.id,
        'INSERT',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

CREATE TRIGGER trg_user_annotation_update AFTER
UPDATE ON user_annotation BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'user_annotation',
        NEW.id,
        'UPDATE',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

CREATE TRIGGER trg_user_annotation_delete AFTER DELETE ON user_annotation BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'user_annotation',
        OLD.id,
        'DELETE',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

-- ============================================================================
-- TRIGGERS: user_profile (single PK: id)
-- ============================================================================
CREATE TRIGGER trg_user_profile_insert AFTER INSERT ON user_profile BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'user_profile',
        NEW.id,
        'INSERT',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

CREATE TRIGGER trg_user_profile_update AFTER
UPDATE ON user_profile BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'user_profile',
        NEW.id,
        'UPDATE',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

CREATE TRIGGER trg_user_profile_delete AFTER DELETE ON user_profile BEGIN
INSERT INTO
    sync_outbox (id, table_name, row_id, operation, changed_at)
VALUES
    (
        lower(hex (randomblob (16))),
        'user_profile',
        OLD.id,
        'DELETE',
        strftime ('%Y-%m-%dT%H:%M:%fZ', 'now')
    );

END;

-- ============================================================================
-- END OF TRIGGERS
-- ============================================================================