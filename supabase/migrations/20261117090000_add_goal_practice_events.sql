-- #426 expansion: all new fields are nullable; legacy writes and views remain valid.

BEGIN;

ALTER TABLE public.practice_record
  ADD COLUMN goal_id uuid REFERENCES public.goal(id),
  ADD COLUMN evaluation_id text,
  ADD COLUMN evaluation_snapshot text,
  ADD COLUMN scheduler_id text,
  ADD COLUMN scheduler_version integer,
  ADD COLUMN scheduler_state text,
  ADD COLUMN interval_days double precision;

CREATE INDEX idx_practice_record_goal_id ON public.practice_record(goal_id);

ALTER TABLE public.table_transient_data
  ADD COLUMN goal_id uuid REFERENCES public.goal(id),
  ADD COLUMN evaluation_id text,
  ADD COLUMN evaluation_snapshot text,
  ADD COLUMN scheduler_id text,
  ADD COLUMN scheduler_version integer,
  ADD COLUMN scheduler_state text,
  ADD COLUMN interval_days double precision,
  ADD COLUMN predecessor_record_id uuid,
  ADD COLUMN predecessor_fingerprint text,
  ADD COLUMN calculation_config_hash text,
  ADD COLUMN practice_record_id uuid;

CREATE INDEX idx_table_transient_data_goal_id ON public.table_transient_data(goal_id);

ALTER TABLE public.repertoire_tune
  ADD COLUMN goal_id uuid REFERENCES public.goal(id);

CREATE INDEX idx_repertoire_tune_goal_id ON public.repertoire_tune(goal_id);

ALTER TABLE public.daily_practice_queue
  ADD COLUMN allocation_goal_id uuid REFERENCES public.goal(id),
  ADD COLUMN selection_reason text,
  ADD COLUMN displayed_practice_record_id uuid;

CREATE INDEX idx_daily_practice_queue_allocation_goal_id ON public.daily_practice_queue(allocation_goal_id);

ALTER TABLE public.practice_record
  ADD CONSTRAINT practice_record_evaluation_snapshot_json CHECK (
    evaluation_snapshot IS NULL OR public.goal_json_object_valid(evaluation_snapshot, 16384)),
  ADD CONSTRAINT practice_record_scheduler_state_json CHECK (
    scheduler_state IS NULL OR public.goal_json_object_valid(scheduler_state, 16384)),
  ADD CONSTRAINT practice_record_scheduler_version_positive CHECK (scheduler_version > 0),
  ADD CONSTRAINT practice_record_interval_days_finite CHECK (
    interval_days >= 0 AND interval_days < 'Infinity'::double precision);
COMMENT ON COLUMN public.practice_record.interval_days IS
  'Fractional days from persisted practiced to due. Legacy interval remains an integer projection.';

ALTER TABLE public.table_transient_data
  ADD CONSTRAINT table_transient_data_evaluation_snapshot_json CHECK (
    evaluation_snapshot IS NULL OR public.goal_json_object_valid(evaluation_snapshot, 16384)),
  ADD CONSTRAINT table_transient_data_scheduler_state_json CHECK (
    scheduler_state IS NULL OR public.goal_json_object_valid(scheduler_state, 16384)),
  ADD CONSTRAINT table_transient_data_scheduler_version_positive CHECK (scheduler_version > 0),
  ADD CONSTRAINT table_transient_data_interval_days_finite CHECK (
    interval_days >= 0 AND interval_days < 'Infinity'::double precision);
COMMENT ON COLUMN public.table_transient_data.interval_days IS
  'Fractional days from persisted practiced to due. Legacy interval remains an integer projection.';

ALTER TABLE public.practice_record ADD CONSTRAINT practice_record_scheduler_practiced
  CHECK (scheduler_id IS NULL OR practiced IS NOT NULL);
ALTER TABLE public.daily_practice_queue ADD CONSTRAINT daily_practice_queue_selection_reason
  CHECK (selection_reason IN ('due_today', 'recent_overdue', 'old_overdue', 'unscheduled_topup', 'future_topup', 'manual'));
COMMENT ON COLUMN public.table_transient_data.practice_record_id IS
  'Stable event UUID allocated during staging and reused on Submit retries; validated soft reference.';
COMMENT ON COLUMN public.table_transient_data.predecessor_record_id IS
  'Latest submitted event used for calculation, checked atomically at local Submit; validated soft reference.';
COMMENT ON COLUMN public.daily_practice_queue.displayed_practice_record_id IS
  'Event displayed by this queue row; validated soft reference, not an inferred latest review.';

-- The privileged Worker bypasses RLS. New goal references must still belong to
-- the repertoire owner (or be shared). Owners are immutable on the goal table.
CREATE FUNCTION public.guard_practice_goal_visibility() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  default_goal_column CONSTANT text := 'goal_id';
  default_repertoire_column CONSTANT text := 'repertoire_ref';
  row_data jsonb := to_jsonb(NEW);
  goal_ref uuid := (row_data ->> COALESCE(TG_ARGV[0], default_goal_column))::uuid;
  target_repertoire uuid := (row_data ->> COALESCE(TG_ARGV[1], default_repertoire_column))::uuid;
BEGIN
  IF goal_ref IS NULL THEN RETURN NEW; END IF;
  PERFORM 1 FROM public.goal g JOIN public.repertoire r ON r.repertoire_id = target_repertoire
    WHERE g.id = goal_ref AND (g.private_for IS NULL OR g.private_for = r.user_ref);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Goal is not available to repertoire owner' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
-- Most tables use the default column names; pass only exceptions.
CREATE TRIGGER guard_practice_goal_visibility BEFORE INSERT OR UPDATE ON public.practice_record
  FOR EACH ROW EXECUTE FUNCTION public.guard_practice_goal_visibility();
CREATE TRIGGER guard_staged_goal_visibility BEFORE INSERT OR UPDATE ON public.table_transient_data
  FOR EACH ROW EXECUTE FUNCTION public.guard_practice_goal_visibility('goal_id', 'repertoire_id');
CREATE TRIGGER guard_repertoire_goal_visibility BEFORE INSERT OR UPDATE ON public.repertoire_tune
  FOR EACH ROW EXECUTE FUNCTION public.guard_practice_goal_visibility();
CREATE TRIGGER guard_queue_goal_visibility BEFORE INSERT OR UPDATE ON public.daily_practice_queue
  FOR EACH ROW EXECUTE FUNCTION public.guard_practice_goal_visibility('allocation_goal_id');

CREATE FUNCTION public.guard_practice_event_identity() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE existing_event public.practice_record%ROWTYPE;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.practiced IS NOT NULL THEN
    -- Serialize even legacy inserts: otherwise an old client's concurrent write
    -- could bypass the precheck before the Worker's natural-key upsert.
    -- Epoch text is independent of session DateStyle/timezone formatting.
    PERFORM pg_advisory_xact_lock(hashtextextended(
      NEW.repertoire_ref::text || '/' || NEW.tune_ref::text || '/' ||
      extract(epoch FROM NEW.practiced)::text, 426));
    SELECT * INTO existing_event FROM public.practice_record
      WHERE repertoire_ref = NEW.repertoire_ref AND tune_ref = NEW.tune_ref
        AND practiced = NEW.practiced;
    IF FOUND AND existing_event.id <> NEW.id AND
      (NEW.scheduler_id IS NOT NULL OR existing_event.scheduler_id IS NOT NULL) THEN
      RAISE EXCEPTION 'Practice event timestamp already belongs to a different UUID'
        USING ERRCODE = '23505', CONSTRAINT = 'practice_event_identity_conflict';
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND (OLD.scheduler_id IS NOT NULL OR NEW.scheduler_id IS NOT NULL) AND
    (to_jsonb(NEW) - ARRAY['sync_version', 'last_modified_at', 'device_id']) IS DISTINCT FROM
    (to_jsonb(OLD) - ARRAY['sync_version', 'last_modified_at', 'device_id']) THEN
    RAISE EXCEPTION 'Submitted practice event content is immutable'
      USING ERRCODE = '23514', CONSTRAINT = 'practice_event_content_immutable';
  END IF;
  -- Legacy-only updates retain their existing semantics until coordinated cutover.
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_practice_event_identity BEFORE INSERT OR UPDATE ON public.practice_record
  FOR EACH ROW EXECUTE FUNCTION public.guard_practice_event_identity();
COMMIT;
