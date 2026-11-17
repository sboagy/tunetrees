-- #426 documentation-only expansion. No row values, constraints or types change.
-- Old clients keep their existing columns until the coordinated scheduling cutover.
DO $$
DECLARE
  lapses_column CONSTANT text := 'lapses';
  target_table text;
  field record;
BEGIN
  FOREACH target_table IN ARRAY ARRAY['practice_record', 'table_transient_data'] LOOP
    FOR field IN SELECT * FROM (VALUES
      ('stability', 'stability'), ('difficulty', 'difficulty'),
      ('repetitions', 'reps'), (lapses_column, lapses_column),
      ('state', 'status'), ('elapsed_days', 'elapsed UTC days derived from event timestamps')
    ) AS mapping(column_name, state_property)
      -- These two typed historical fields never existed on staging rows.
      WHERE target_table = 'practice_record' OR mapping.column_name NOT IN (lapses_column, 'elapsed_days')
    LOOP
      EXECUTE format('COMMENT ON COLUMN public.%I.%I IS %L', target_table, field.column_name,
        format('Historical FSRS storage; after goal-model cutover, compatibility projection only (%s). New scheduler state is authoritative in scheduler_state; retain old values for legacy decoding.', field.state_property));
    END LOOP;
    FOR field IN SELECT * FROM (VALUES
      ('backup_practiced', 'Historical support field retained unchanged. practiced is the common event time; this is not a complete undo snapshot.'),
      ('scheduler_state', 'Authoritative versioned JSON state for all new scheduler results, including FSRS. Interpret using scheduler_id and scheduler_version; never fall back to typed columns for malformed new state.'),
      ('goal', 'Legacy goal text key. New events use goal_id. Preserve original historical attribution; maintain compatibility keys where required during transition.'),
      ('technique', 'Legacy scheduler identifier. New events use scheduler_id and scheduler_version; any new value here is a compatibility projection.'),
      ('interval', 'Legacy integer duration. New events use fractional interval_days derived from practiced and due. A new value here is a compatibility projection, not a scheduling input.'),
      ('quality', 'Historical FSRS rating or explicit compatibility projection of a new evaluation action. New events use evaluation_id and evaluation_snapshot; do not invent ratings for other schedulers.'),
      ('easiness', 'Historical compatibility field; not authoritative FSRS-6 or general scheduler state.'),
      ('step', 'Historical compatibility field with inconsistent old semantics. Not a ladder index or evidence of recorded FSRS learning progress. New learning progress belongs in scheduler_state.')
    ) AS descriptions(column_name, description) LOOP
      EXECUTE format('COMMENT ON COLUMN public.%I.%I IS %L', target_table, field.column_name, field.description);
    END LOOP;
  END LOOP;
END;
$$;
