-- #426, expand phase: old goal payloads and preference tables remain valid.
-- No preference/history backfill here: old clients still edit those sources.
BEGIN;

CREATE FUNCTION public.goal_json_object_valid(payload text, byte_limit integer)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE STRICT
SET search_path = '' AS $$
BEGIN
  IF octet_length(payload) > byte_limit THEN RETURN false; END IF;
  RETURN jsonb_typeof(payload::jsonb) = 'object';
EXCEPTION WHEN invalid_text_representation OR untranslatable_character THEN
  RETURN false;
END;
$$;

ALTER TABLE public.goal
  ADD COLUMN display_name text,
  ADD COLUMN description text,
  ADD COLUMN default_config text,
  ADD CONSTRAINT goal_default_config_json CHECK (
    default_config IS NULL OR public.goal_json_object_valid(default_config, 65536)
  );

CREATE TABLE public.goal_user_settings (
  user_id uuid NOT NULL REFERENCES public.user_profile(id) ON DELETE CASCADE,
  goal_id uuid NOT NULL REFERENCES public.goal(id),
  overrides text NOT NULL DEFAULT '{}',
  deleted boolean NOT NULL DEFAULT false,
  sync_version integer NOT NULL DEFAULT 1,
  last_modified_at timestamp without time zone NOT NULL DEFAULT now(),
  device_id text,
  PRIMARY KEY (user_id, goal_id),
  CONSTRAINT goal_user_settings_overrides_json CHECK (
    public.goal_json_object_valid(overrides, 65536)
  )
);
CREATE INDEX idx_goal_user_settings_goal ON public.goal_user_settings(goal_id);
COMMENT ON TABLE public.goal_user_settings IS
  'Per-user goal overrides; shared across repertoires. Soft-delete restores defaults.';
COMMENT ON COLUMN public.goal.default_config IS
  'Versioned JSON TEXT scheduling definition. NULL supports legacy goal writes.';
COMMENT ON COLUMN public.goal_user_settings.overrides IS
  'JSON TEXT partial definition; daily fields merge, scheduler/evaluations replace whole sections.';

-- RLS covers direct API calls. The trigger also covers privileged Worker SQL.
ALTER TABLE public.goal_user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_user_settings FORCE ROW LEVEL SECURITY;
CREATE POLICY goal_settings_select ON public.goal_user_settings FOR SELECT
  TO authenticated USING (user_id = auth.uid());
CREATE POLICY goal_settings_insert ON public.goal_user_settings FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.goal g WHERE g.id = goal_id
      AND (g.private_for IS NULL OR g.private_for = auth.uid())
  ));
CREATE POLICY goal_settings_update ON public.goal_user_settings FOR UPDATE
  TO authenticated USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.goal g WHERE g.id = goal_id
      AND (g.private_for IS NULL OR g.private_for = auth.uid())
  ));
GRANT SELECT, INSERT, UPDATE ON public.goal_user_settings TO authenticated, service_role;

CREATE FUNCTION public.guard_goal_settings() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE constraint_violation CONSTANT text := '23514';
BEGIN
  IF TG_OP = 'UPDATE' AND
    (NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.goal_id IS DISTINCT FROM OLD.goal_id)
  THEN RAISE EXCEPTION 'Goal settings identity is immutable' USING ERRCODE = constraint_violation;
  END IF;
  -- Include deleted goals: their settings/tombstones must remain syncable.
  -- Do not lock here: SELECT FOR KEY SHARE also applies goal UPDATE RLS,
  -- which excludes shared goals. The FK and immutable owner protect the reference.
  PERFORM 1 FROM public.goal g WHERE g.id = NEW.goal_id
    AND (g.private_for IS NULL OR g.private_for = NEW.user_id);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Goal is not available to settings owner' USING ERRCODE = constraint_violation;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_goal_settings BEFORE INSERT OR UPDATE ON public.goal_user_settings
  FOR EACH ROW EXECUTE FUNCTION public.guard_goal_settings();
CREATE TRIGGER trg_goal_user_settings_sync AFTER INSERT OR UPDATE OR DELETE
  ON public.goal_user_settings FOR EACH ROW EXECUTE FUNCTION public.sync_change_log_update();

CREATE FUNCTION public.guard_goal_ownership() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  existing_owner uuid;
  constraint_violation CONSTANT text := '23514';
BEGIN
  IF TG_OP = 'UPDATE' AND
    (NEW.id IS DISTINCT FROM OLD.id OR NEW.private_for IS DISTINCT FROM OLD.private_for)
  THEN RAISE EXCEPTION 'Goal identity and owner are immutable' USING ERRCODE = constraint_violation;
  END IF;
  IF TG_OP = 'INSERT' THEN
    -- Check BEFORE upsert conflict resolution, including when UPDATE omits owner.
    SELECT private_for INTO existing_owner FROM public.goal WHERE id = NEW.id FOR UPDATE;
    IF FOUND AND existing_owner IS DISTINCT FROM NEW.private_for THEN
      RAISE EXCEPTION 'Cannot take ownership of an existing goal' USING ERRCODE = constraint_violation;
    END IF;
  END IF;
  IF NEW.private_for IS NULL AND NOT (
    current_user = 'postgres' AND
    COALESCE(current_setting('tunetrees.goal_seed_write', true), '') = 'on'
  ) THEN
    RAISE EXCEPTION 'Shared goals may only be written by seed migrations' USING ERRCODE = constraint_violation;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_goal_ownership BEFORE INSERT OR UPDATE ON public.goal
  FOR EACH ROW EXECUTE FUNCTION public.guard_goal_ownership();

COMMIT;
