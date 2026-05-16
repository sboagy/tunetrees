CREATE OR REPLACE FUNCTION public.touch_last_modified_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.last_modified_at = now();
    RETURN NEW;
END;
$$;

ALTER TABLE public.genre
    ADD COLUMN IF NOT EXISTS last_modified_at timestamp without time zone DEFAULT now() NOT NULL;

ALTER TABLE public.genre_tune_type
    ADD COLUMN IF NOT EXISTS last_modified_at timestamp without time zone DEFAULT now() NOT NULL;

ALTER TABLE public.tune_type
    ADD COLUMN IF NOT EXISTS last_modified_at timestamp without time zone DEFAULT now() NOT NULL;

ALTER TABLE public.rhythm_patterns
    ADD COLUMN IF NOT EXISTS last_modified_at timestamp without time zone DEFAULT now() NOT NULL;

CREATE INDEX IF NOT EXISTS idx_genre_last_modified_at
    ON public.genre USING btree (last_modified_at);

CREATE INDEX IF NOT EXISTS idx_genre_tune_type_last_modified_at
    ON public.genre_tune_type USING btree (last_modified_at);

CREATE INDEX IF NOT EXISTS idx_tune_type_last_modified_at
    ON public.tune_type USING btree (last_modified_at);

CREATE INDEX IF NOT EXISTS idx_rhythm_patterns_last_modified_at
    ON public.rhythm_patterns USING btree (last_modified_at);

DROP TRIGGER IF EXISTS trg_genre_touch_last_modified_at ON public.genre;
CREATE TRIGGER trg_genre_touch_last_modified_at
    BEFORE UPDATE ON public.genre
    FOR EACH ROW
    EXECUTE FUNCTION public.touch_last_modified_at();

DROP TRIGGER IF EXISTS trg_genre_tune_type_touch_last_modified_at ON public.genre_tune_type;
CREATE TRIGGER trg_genre_tune_type_touch_last_modified_at
    BEFORE UPDATE ON public.genre_tune_type
    FOR EACH ROW
    EXECUTE FUNCTION public.touch_last_modified_at();

DROP TRIGGER IF EXISTS trg_tune_type_touch_last_modified_at ON public.tune_type;
CREATE TRIGGER trg_tune_type_touch_last_modified_at
    BEFORE UPDATE ON public.tune_type
    FOR EACH ROW
    EXECUTE FUNCTION public.touch_last_modified_at();

DROP TRIGGER IF EXISTS trg_rhythm_patterns_touch_last_modified_at ON public.rhythm_patterns;
CREATE TRIGGER trg_rhythm_patterns_touch_last_modified_at
    BEFORE UPDATE ON public.rhythm_patterns
    FOR EACH ROW
    EXECUTE FUNCTION public.touch_last_modified_at();

CREATE OR REPLACE TRIGGER trg_event_sync
    AFTER INSERT OR DELETE OR UPDATE ON public.event
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_change_log_update();

CREATE OR REPLACE TRIGGER trg_goal_sync
    AFTER INSERT OR DELETE OR UPDATE ON public.goal
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_change_log_update();

CREATE OR REPLACE TRIGGER trg_group_member_sync
    AFTER INSERT OR DELETE OR UPDATE ON public.group_member
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_change_log_update();

CREATE OR REPLACE TRIGGER trg_media_asset_sync
    AFTER INSERT OR DELETE OR UPDATE ON public.media_asset
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_change_log_update();

CREATE OR REPLACE TRIGGER trg_plugin_sync
    AFTER INSERT OR DELETE OR UPDATE ON public.plugin
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_change_log_update();

CREATE OR REPLACE TRIGGER trg_rhythm_patterns_sync
    AFTER INSERT OR DELETE OR UPDATE ON public.rhythm_patterns
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_change_log_update();

CREATE OR REPLACE TRIGGER trg_setlist_sync
    AFTER INSERT OR DELETE OR UPDATE ON public.setlist
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_change_log_update();

CREATE OR REPLACE TRIGGER trg_setlist_item_sync
    AFTER INSERT OR DELETE OR UPDATE ON public.setlist_item
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_change_log_update();

CREATE OR REPLACE TRIGGER trg_tune_set_sync
    AFTER INSERT OR DELETE OR UPDATE ON public.tune_set
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_change_log_update();

CREATE OR REPLACE TRIGGER trg_tune_set_item_sync
    AFTER INSERT OR DELETE OR UPDATE ON public.tune_set_item
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_change_log_update();

CREATE OR REPLACE TRIGGER trg_user_genre_selection_sync
    AFTER INSERT OR DELETE OR UPDATE ON public.user_genre_selection
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_change_log_update();

CREATE OR REPLACE TRIGGER trg_user_group_sync
    AFTER INSERT OR DELETE OR UPDATE ON public.user_group
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_change_log_update();