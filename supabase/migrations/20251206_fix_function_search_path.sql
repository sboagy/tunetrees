-- ============================================================================
-- Fix security warnings: Set search_path on functions
-- Prevents search_path injection attacks
-- ============================================================================

-- Fix sync_now_iso function
CREATE OR REPLACE FUNCTION public.sync_now_iso() 
RETURNS TEXT AS $$
BEGIN
    RETURN to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
END;
$$ LANGUAGE plpgsql IMMUTABLE
SET search_path = '';

-- Fix sync_change_log_update function
CREATE OR REPLACE FUNCTION public.sync_change_log_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Upsert: insert or update the changed_at for this table
    INSERT INTO public.sync_change_log (table_name, changed_at)
    VALUES (TG_TABLE_NAME, public.sync_now_iso())
    ON CONFLICT (table_name) DO UPDATE SET changed_at = EXCLUDED.changed_at;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql
SET search_path = '';
