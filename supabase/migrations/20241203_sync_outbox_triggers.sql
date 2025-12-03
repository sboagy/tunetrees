-- ============================================================================
-- Supabase Migration: Sync Outbox Triggers for PostgreSQL
-- ============================================================================
--
-- This migration creates triggers that populate the sync_outbox table whenever
-- data changes occur on syncable tables. The Cloudflare Worker queries this
-- outbox for efficient incremental sync (PULL).
--
-- Design:
-- 1. ID generation: gen_random_uuid()
-- 2. Composite keys: JSON string format (e.g., '{"user_id":"x","tune_id":"y"}')
-- 3. Timestamp: ISO 8601 format using to_char(..., 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
-- 4. All syncable tables get triggers
--
-- Generated from: shared/table-meta.ts TABLE_REGISTRY
-- ============================================================================

-- ============================================================================
-- CREATE SYNC_OUTBOX TABLE (if not exists)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sync_outbox (
    id TEXT PRIMARY KEY NOT NULL DEFAULT gen_random_uuid()::text,
    table_name TEXT NOT NULL,
    row_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    changed_at TEXT NOT NULL,
    synced_at TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_outbox_status_changed ON sync_outbox(status, changed_at);
CREATE INDEX IF NOT EXISTS idx_outbox_table_row ON sync_outbox(table_name, row_id);

-- ============================================================================
-- HELPER FUNCTION: Generate ISO timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION sync_now_iso() RETURNS TEXT AS $$
BEGIN
    RETURN to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- GENERIC TRIGGER FUNCTION
-- We use dynamic SQL to handle different tables and PK structures
-- ============================================================================

-- Single PK trigger function
CREATE OR REPLACE FUNCTION sync_outbox_single_pk()
RETURNS TRIGGER AS $$
DECLARE
    pk_col TEXT;
    row_id_val TEXT;
    op TEXT;
BEGIN
    pk_col := TG_ARGV[0];
    
    IF TG_OP = 'DELETE' THEN
        EXECUTE format('SELECT ($1).%I::text', pk_col) INTO row_id_val USING OLD;
        op := 'DELETE';
    ELSE
        EXECUTE format('SELECT ($1).%I::text', pk_col) INTO row_id_val USING NEW;
        op := TG_OP;
    END IF;
    
    INSERT INTO sync_outbox (id, table_name, row_id, operation, changed_at)
    VALUES (gen_random_uuid()::text, TG_TABLE_NAME, row_id_val, op, sync_now_iso());
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TABLE-SPECIFIC TRIGGERS
-- ============================================================================

-- daily_practice_queue (single PK: id)
DROP TRIGGER IF EXISTS trg_daily_practice_queue_sync ON daily_practice_queue;
CREATE TRIGGER trg_daily_practice_queue_sync
    AFTER INSERT OR UPDATE OR DELETE ON daily_practice_queue
    FOR EACH ROW EXECUTE FUNCTION sync_outbox_single_pk('id');

-- genre (single PK: id)
DROP TRIGGER IF EXISTS trg_genre_sync ON genre;
CREATE TRIGGER trg_genre_sync
    AFTER INSERT OR UPDATE OR DELETE ON genre
    FOR EACH ROW EXECUTE FUNCTION sync_outbox_single_pk('id');

-- tune_type (single PK: id)
DROP TRIGGER IF EXISTS trg_tune_type_sync ON tune_type;
CREATE TRIGGER trg_tune_type_sync
    AFTER INSERT OR UPDATE OR DELETE ON tune_type
    FOR EACH ROW EXECUTE FUNCTION sync_outbox_single_pk('id');

-- genre_tune_type (composite PK: genre_id, tune_type_id)
CREATE OR REPLACE FUNCTION sync_outbox_genre_tune_type()
RETURNS TRIGGER AS $$
DECLARE
    row_id_val TEXT;
BEGIN
    IF TG_OP = 'DELETE' THEN
        row_id_val := json_build_object('genre_id', OLD.genre_id, 'tune_type_id', OLD.tune_type_id)::text;
    ELSE
        row_id_val := json_build_object('genre_id', NEW.genre_id, 'tune_type_id', NEW.tune_type_id)::text;
    END IF;
    
    INSERT INTO sync_outbox (id, table_name, row_id, operation, changed_at)
    VALUES (gen_random_uuid()::text, 'genre_tune_type', row_id_val, TG_OP, sync_now_iso());
    
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_genre_tune_type_sync ON genre_tune_type;
CREATE TRIGGER trg_genre_tune_type_sync
    AFTER INSERT OR UPDATE OR DELETE ON genre_tune_type
    FOR EACH ROW EXECUTE FUNCTION sync_outbox_genre_tune_type();

-- user_profile (single PK: supabase_user_id)
DROP TRIGGER IF EXISTS trg_user_profile_sync ON user_profile;
CREATE TRIGGER trg_user_profile_sync
    AFTER INSERT OR UPDATE OR DELETE ON user_profile
    FOR EACH ROW EXECUTE FUNCTION sync_outbox_single_pk('supabase_user_id');

-- instrument (single PK: id)
DROP TRIGGER IF EXISTS trg_instrument_sync ON instrument;
CREATE TRIGGER trg_instrument_sync
    AFTER INSERT OR UPDATE OR DELETE ON instrument
    FOR EACH ROW EXECUTE FUNCTION sync_outbox_single_pk('id');

-- prefs_scheduling_options (single PK: user_id)
DROP TRIGGER IF EXISTS trg_prefs_scheduling_options_sync ON prefs_scheduling_options;
CREATE TRIGGER trg_prefs_scheduling_options_sync
    AFTER INSERT OR UPDATE OR DELETE ON prefs_scheduling_options
    FOR EACH ROW EXECUTE FUNCTION sync_outbox_single_pk('user_id');

-- prefs_spaced_repetition (composite PK: user_id, alg_type)
CREATE OR REPLACE FUNCTION sync_outbox_prefs_spaced_repetition()
RETURNS TRIGGER AS $$
DECLARE
    row_id_val TEXT;
BEGIN
    IF TG_OP = 'DELETE' THEN
        row_id_val := json_build_object('user_id', OLD.user_id, 'alg_type', OLD.alg_type)::text;
    ELSE
        row_id_val := json_build_object('user_id', NEW.user_id, 'alg_type', NEW.alg_type)::text;
    END IF;
    
    INSERT INTO sync_outbox (id, table_name, row_id, operation, changed_at)
    VALUES (gen_random_uuid()::text, 'prefs_spaced_repetition', row_id_val, TG_OP, sync_now_iso());
    
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prefs_spaced_repetition_sync ON prefs_spaced_repetition;
CREATE TRIGGER trg_prefs_spaced_repetition_sync
    AFTER INSERT OR UPDATE OR DELETE ON prefs_spaced_repetition
    FOR EACH ROW EXECUTE FUNCTION sync_outbox_prefs_spaced_repetition();

-- playlist (single PK: playlist_id)
DROP TRIGGER IF EXISTS trg_playlist_sync ON playlist;
CREATE TRIGGER trg_playlist_sync
    AFTER INSERT OR UPDATE OR DELETE ON playlist
    FOR EACH ROW EXECUTE FUNCTION sync_outbox_single_pk('playlist_id');

-- table_state (composite PK: user_id, screen_size, purpose, playlist_id)
CREATE OR REPLACE FUNCTION sync_outbox_table_state()
RETURNS TRIGGER AS $$
DECLARE
    row_id_val TEXT;
BEGIN
    IF TG_OP = 'DELETE' THEN
        row_id_val := json_build_object(
            'user_id', OLD.user_id,
            'screen_size', OLD.screen_size,
            'purpose', OLD.purpose,
            'playlist_id', OLD.playlist_id
        )::text;
    ELSE
        row_id_val := json_build_object(
            'user_id', NEW.user_id,
            'screen_size', NEW.screen_size,
            'purpose', NEW.purpose,
            'playlist_id', NEW.playlist_id
        )::text;
    END IF;
    
    INSERT INTO sync_outbox (id, table_name, row_id, operation, changed_at)
    VALUES (gen_random_uuid()::text, 'table_state', row_id_val, TG_OP, sync_now_iso());
    
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_table_state_sync ON table_state;
CREATE TRIGGER trg_table_state_sync
    AFTER INSERT OR UPDATE OR DELETE ON table_state
    FOR EACH ROW EXECUTE FUNCTION sync_outbox_table_state();

-- tab_group_main_state (single PK: id)
DROP TRIGGER IF EXISTS trg_tab_group_main_state_sync ON tab_group_main_state;
CREATE TRIGGER trg_tab_group_main_state_sync
    AFTER INSERT OR UPDATE OR DELETE ON tab_group_main_state
    FOR EACH ROW EXECUTE FUNCTION sync_outbox_single_pk('id');

-- tune (single PK: id)
DROP TRIGGER IF EXISTS trg_tune_sync ON tune;
CREATE TRIGGER trg_tune_sync
    AFTER INSERT OR UPDATE OR DELETE ON tune
    FOR EACH ROW EXECUTE FUNCTION sync_outbox_single_pk('id');

-- playlist_tune (composite PK: playlist_ref, tune_ref)
CREATE OR REPLACE FUNCTION sync_outbox_playlist_tune()
RETURNS TRIGGER AS $$
DECLARE
    row_id_val TEXT;
BEGIN
    IF TG_OP = 'DELETE' THEN
        row_id_val := json_build_object('playlist_ref', OLD.playlist_ref, 'tune_ref', OLD.tune_ref)::text;
    ELSE
        row_id_val := json_build_object('playlist_ref', NEW.playlist_ref, 'tune_ref', NEW.tune_ref)::text;
    END IF;
    
    INSERT INTO sync_outbox (id, table_name, row_id, operation, changed_at)
    VALUES (gen_random_uuid()::text, 'playlist_tune', row_id_val, TG_OP, sync_now_iso());
    
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_playlist_tune_sync ON playlist_tune;
CREATE TRIGGER trg_playlist_tune_sync
    AFTER INSERT OR UPDATE OR DELETE ON playlist_tune
    FOR EACH ROW EXECUTE FUNCTION sync_outbox_playlist_tune();

-- practice_record (single PK: id)
DROP TRIGGER IF EXISTS trg_practice_record_sync ON practice_record;
CREATE TRIGGER trg_practice_record_sync
    AFTER INSERT OR UPDATE OR DELETE ON practice_record
    FOR EACH ROW EXECUTE FUNCTION sync_outbox_single_pk('id');

-- table_transient_data (composite PK: user_id, tune_id, playlist_id)
CREATE OR REPLACE FUNCTION sync_outbox_table_transient_data()
RETURNS TRIGGER AS $$
DECLARE
    row_id_val TEXT;
BEGIN
    IF TG_OP = 'DELETE' THEN
        row_id_val := json_build_object(
            'user_id', OLD.user_id,
            'tune_id', OLD.tune_id,
            'playlist_id', OLD.playlist_id
        )::text;
    ELSE
        row_id_val := json_build_object(
            'user_id', NEW.user_id,
            'tune_id', NEW.tune_id,
            'playlist_id', NEW.playlist_id
        )::text;
    END IF;
    
    INSERT INTO sync_outbox (id, table_name, row_id, operation, changed_at)
    VALUES (gen_random_uuid()::text, 'table_transient_data', row_id_val, TG_OP, sync_now_iso());
    
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_table_transient_data_sync ON table_transient_data;
CREATE TRIGGER trg_table_transient_data_sync
    AFTER INSERT OR UPDATE OR DELETE ON table_transient_data
    FOR EACH ROW EXECUTE FUNCTION sync_outbox_table_transient_data();

-- note (single PK: id)
DROP TRIGGER IF EXISTS trg_note_sync ON note;
CREATE TRIGGER trg_note_sync
    AFTER INSERT OR UPDATE OR DELETE ON note
    FOR EACH ROW EXECUTE FUNCTION sync_outbox_single_pk('id');

-- reference (single PK: id)
DROP TRIGGER IF EXISTS trg_reference_sync ON reference;
CREATE TRIGGER trg_reference_sync
    AFTER INSERT OR UPDATE OR DELETE ON reference
    FOR EACH ROW EXECUTE FUNCTION sync_outbox_single_pk('id');

-- tag (single PK: id)
DROP TRIGGER IF EXISTS trg_tag_sync ON tag;
CREATE TRIGGER trg_tag_sync
    AFTER INSERT OR UPDATE OR DELETE ON tag
    FOR EACH ROW EXECUTE FUNCTION sync_outbox_single_pk('id');

-- tune_override (single PK: id)
DROP TRIGGER IF EXISTS trg_tune_override_sync ON tune_override;
CREATE TRIGGER trg_tune_override_sync
    AFTER INSERT OR UPDATE OR DELETE ON tune_override
    FOR EACH ROW EXECUTE FUNCTION sync_outbox_single_pk('id');

-- ============================================================================
-- CLEANUP: Periodic job to prune old synced outbox entries
-- Run this via pg_cron or a scheduled Supabase Edge Function
-- ============================================================================
-- DELETE FROM sync_outbox 
-- WHERE status = 'synced' 
--   AND synced_at < (now() - interval '7 days')::text;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
