-- ============================================================================
-- Supabase Migration: Table-Level Sync Change Log
-- ============================================================================
--
-- SIMPLIFIED DESIGN: One row per table, not per row!
--
-- Design Principles:
-- 1. sync_change_log tracks the LAST CHANGE TIME per TABLE
-- 2. Each client tracks its own lastSyncAt timestamp
-- 3. Client queries: "which tables have changed since my lastSyncAt?"
-- 4. For changed tables, query: SELECT * FROM table WHERE last_modified_at > lastSyncAt
-- 5. No garbage collection needed - table has at most N rows (one per syncable table)
--
-- Schema: (table_name PRIMARY KEY, changed_at) - that's it!
-- ============================================================================

-- ============================================================================
-- DROP OLD TABLE AND RECREATE WITH TABLE-LEVEL TRACKING
-- ============================================================================
DROP TABLE IF EXISTS sync_change_log CASCADE;

CREATE TABLE sync_change_log (
    table_name TEXT PRIMARY KEY,
    changed_at TEXT NOT NULL
);

-- Index for efficient queries by timestamp
CREATE INDEX idx_sync_change_log_changed_at ON sync_change_log(changed_at);

-- ============================================================================
-- HELPER FUNCTION: Generate ISO timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION sync_now_iso() RETURNS TEXT AS $$
BEGIN
    RETURN to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- UNIVERSAL TRIGGER FUNCTION
-- Updates the table's changed_at timestamp (upsert pattern)
-- ============================================================================
CREATE OR REPLACE FUNCTION sync_change_log_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Upsert: insert or update the changed_at for this table
    INSERT INTO sync_change_log (table_name, changed_at)
    VALUES (TG_TABLE_NAME, sync_now_iso())
    ON CONFLICT (table_name) DO UPDATE SET changed_at = EXCLUDED.changed_at;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ATTACH TRIGGERS TO ALL SYNCABLE TABLES
-- ============================================================================

-- daily_practice_queue
DROP TRIGGER IF EXISTS trg_daily_practice_queue_sync ON daily_practice_queue;
CREATE TRIGGER trg_daily_practice_queue_sync
    AFTER INSERT OR UPDATE OR DELETE ON daily_practice_queue
    FOR EACH ROW EXECUTE FUNCTION sync_change_log_update();

-- genre
DROP TRIGGER IF EXISTS trg_genre_sync ON genre;
CREATE TRIGGER trg_genre_sync
    AFTER INSERT OR UPDATE OR DELETE ON genre
    FOR EACH ROW EXECUTE FUNCTION sync_change_log_update();

-- tune_type
DROP TRIGGER IF EXISTS trg_tune_type_sync ON tune_type;
CREATE TRIGGER trg_tune_type_sync
    AFTER INSERT OR UPDATE OR DELETE ON tune_type
    FOR EACH ROW EXECUTE FUNCTION sync_change_log_update();

-- genre_tune_type
DROP TRIGGER IF EXISTS trg_genre_tune_type_sync ON genre_tune_type;
CREATE TRIGGER trg_genre_tune_type_sync
    AFTER INSERT OR UPDATE OR DELETE ON genre_tune_type
    FOR EACH ROW EXECUTE FUNCTION sync_change_log_update();

-- user_profile
DROP TRIGGER IF EXISTS trg_user_profile_sync ON user_profile;
CREATE TRIGGER trg_user_profile_sync
    AFTER INSERT OR UPDATE OR DELETE ON user_profile
    FOR EACH ROW EXECUTE FUNCTION sync_change_log_update();

-- instrument
DROP TRIGGER IF EXISTS trg_instrument_sync ON instrument;
CREATE TRIGGER trg_instrument_sync
    AFTER INSERT OR UPDATE OR DELETE ON instrument
    FOR EACH ROW EXECUTE FUNCTION sync_change_log_update();

-- prefs_scheduling_options
DROP TRIGGER IF EXISTS trg_prefs_scheduling_options_sync ON prefs_scheduling_options;
CREATE TRIGGER trg_prefs_scheduling_options_sync
    AFTER INSERT OR UPDATE OR DELETE ON prefs_scheduling_options
    FOR EACH ROW EXECUTE FUNCTION sync_change_log_update();

-- prefs_spaced_repetition
DROP TRIGGER IF EXISTS trg_prefs_spaced_repetition_sync ON prefs_spaced_repetition;
CREATE TRIGGER trg_prefs_spaced_repetition_sync
    AFTER INSERT OR UPDATE OR DELETE ON prefs_spaced_repetition
    FOR EACH ROW EXECUTE FUNCTION sync_change_log_update();

-- playlist
DROP TRIGGER IF EXISTS trg_playlist_sync ON playlist;
CREATE TRIGGER trg_playlist_sync
    AFTER INSERT OR UPDATE OR DELETE ON playlist
    FOR EACH ROW EXECUTE FUNCTION sync_change_log_update();

-- table_state
DROP TRIGGER IF EXISTS trg_table_state_sync ON table_state;
CREATE TRIGGER trg_table_state_sync
    AFTER INSERT OR UPDATE OR DELETE ON table_state
    FOR EACH ROW EXECUTE FUNCTION sync_change_log_update();

-- tab_group_main_state
DROP TRIGGER IF EXISTS trg_tab_group_main_state_sync ON tab_group_main_state;
CREATE TRIGGER trg_tab_group_main_state_sync
    AFTER INSERT OR UPDATE OR DELETE ON tab_group_main_state
    FOR EACH ROW EXECUTE FUNCTION sync_change_log_update();

-- tune
DROP TRIGGER IF EXISTS trg_tune_sync ON tune;
CREATE TRIGGER trg_tune_sync
    AFTER INSERT OR UPDATE OR DELETE ON tune
    FOR EACH ROW EXECUTE FUNCTION sync_change_log_update();

-- playlist_tune
DROP TRIGGER IF EXISTS trg_playlist_tune_sync ON playlist_tune;
CREATE TRIGGER trg_playlist_tune_sync
    AFTER INSERT OR UPDATE OR DELETE ON playlist_tune
    FOR EACH ROW EXECUTE FUNCTION sync_change_log_update();

-- practice_record
DROP TRIGGER IF EXISTS trg_practice_record_sync ON practice_record;
CREATE TRIGGER trg_practice_record_sync
    AFTER INSERT OR UPDATE OR DELETE ON practice_record
    FOR EACH ROW EXECUTE FUNCTION sync_change_log_update();

-- table_transient_data
DROP TRIGGER IF EXISTS trg_table_transient_data_sync ON table_transient_data;
CREATE TRIGGER trg_table_transient_data_sync
    AFTER INSERT OR UPDATE OR DELETE ON table_transient_data
    FOR EACH ROW EXECUTE FUNCTION sync_change_log_update();

-- note
DROP TRIGGER IF EXISTS trg_note_sync ON note;
CREATE TRIGGER trg_note_sync
    AFTER INSERT OR UPDATE OR DELETE ON note
    FOR EACH ROW EXECUTE FUNCTION sync_change_log_update();

-- reference
DROP TRIGGER IF EXISTS trg_reference_sync ON reference;
CREATE TRIGGER trg_reference_sync
    AFTER INSERT OR UPDATE OR DELETE ON reference
    FOR EACH ROW EXECUTE FUNCTION sync_change_log_update();

-- tag
DROP TRIGGER IF EXISTS trg_tag_sync ON tag;
CREATE TRIGGER trg_tag_sync
    AFTER INSERT OR UPDATE OR DELETE ON tag
    FOR EACH ROW EXECUTE FUNCTION sync_change_log_update();

-- tune_override
DROP TRIGGER IF EXISTS trg_tune_override_sync ON tune_override;
CREATE TRIGGER trg_tune_override_sync
    AFTER INSERT OR UPDATE OR DELETE ON tune_override
    FOR EACH ROW EXECUTE FUNCTION sync_change_log_update();

-- ============================================================================
-- ROW LEVEL SECURITY FOR sync_change_log
-- ============================================================================
-- Enable RLS on the table
ALTER TABLE sync_change_log ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read and write (triggers fire in their context)
-- This is a meta-table tracking table-level changes, not user data
CREATE POLICY "Allow authenticated users full access to sync_change_log"
    ON sync_change_log
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Allow service_role full access (for worker operations)
CREATE POLICY "Allow service_role full access to sync_change_log"
    ON sync_change_log
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Grant permissions (triggers need INSERT/UPDATE)
GRANT ALL ON sync_change_log TO authenticated;
GRANT ALL ON sync_change_log TO service_role;

-- ============================================================================
-- SECURITY INVOKER FOR VIEWS (Postgres 15+)
-- This ensures views respect RLS policies on underlying tables
-- ============================================================================
-- Note: These ALTER VIEW commands require Postgres 15+
-- If running on older Postgres, these will fail gracefully

DO $$
BEGIN
    -- practice_list_joined
    BEGIN
        ALTER VIEW practice_list_joined SET (security_invoker = on);
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not set security_invoker on practice_list_joined: %', SQLERRM;
    END;
    
    -- practice_list_staged
    BEGIN
        ALTER VIEW practice_list_staged SET (security_invoker = on);
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not set security_invoker on practice_list_staged: %', SQLERRM;
    END;
    
    -- view_playlist_joined
    BEGIN
        ALTER VIEW view_playlist_joined SET (security_invoker = on);
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not set security_invoker on view_playlist_joined: %', SQLERRM;
    END;
END $$;

-- ============================================================================
-- NO GARBAGE COLLECTION NEEDED!
-- The table will have at most ~20 rows (one per syncable table)
-- ============================================================================

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
