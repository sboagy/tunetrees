-- Migration: Create Human-Readable Views
-- Description: Add debugging views that show human-readable names instead of UUIDs
-- These views are helpful for inspecting data in database browsers and debugging tools.

-- View 1: Daily Practice Queue with Human-Readable Names
-- Shows queue entries with user names, instrument names, and tune titles
CREATE OR REPLACE VIEW "public"."view_daily_practice_queue_readable" AS
SELECT
  dpq.id AS queue_id,
  COALESCE(up.name, up.email) AS user_name,
  i.instrument AS playlist_instrument,
  COALESCE(tune_override.title, tune.title) AS tune_title,
  dpq.queue_date,
  dpq.window_start_utc,
  dpq.window_end_utc,
  dpq.bucket,
  dpq.order_index,
  dpq.completed_at,
  dpq.active,
  dpq.mode,
  dpq.snapshot_coalesced_ts,
  dpq.scheduled_snapshot,
  dpq.generated_at,
  dpq.user_ref,
  dpq.playlist_ref,
  dpq.tune_ref
FROM
  daily_practice_queue dpq
  LEFT JOIN user_profile up ON up.id = dpq.user_ref
  LEFT JOIN playlist p ON p.playlist_id = dpq.playlist_ref
  LEFT JOIN instrument i ON i.id = p.instrument_ref
  LEFT JOIN tune ON tune.id = dpq.tune_ref
  LEFT JOIN tune_override ON tune_override.tune_ref = tune.id
    AND tune_override.user_ref = dpq.user_ref
ORDER BY
  dpq.queue_date DESC,
  dpq.bucket ASC,
  dpq.order_index ASC;

ALTER VIEW "public"."view_daily_practice_queue_readable" OWNER TO "postgres";

COMMENT ON VIEW "public"."view_daily_practice_queue_readable" IS 'Human-readable view of daily practice queue with resolved user names, instrument names, and tune titles';

-- View 2: Transient Data with Human-Readable Names
-- Shows staged/uncommitted practice data with readable identifiers
CREATE OR REPLACE VIEW "public"."view_transient_data_readable" AS
SELECT
  COALESCE(up.name, up.email) AS user_name,
  ttd.user_id,
  COALESCE(tune_override.title, tune.title) AS tune_title,
  ttd.tune_id,
  i.instrument AS playlist_instrument,
  ttd.playlist_id,
  ttd.purpose,
  ttd.note_private,
  ttd.note_public,
  ttd.recall_eval,
  ttd.practiced,
  ttd.quality,
  ttd.easiness,
  ttd.difficulty,
  ttd.interval,
  ttd.step,
  ttd.repetitions,
  ttd.due,
  ttd.backup_practiced,
  ttd.goal,
  ttd.technique,
  ttd.stability,
  ttd.state,
  ttd.sync_version,
  ttd.last_modified_at,
  ttd.device_id
FROM
  table_transient_data ttd
  LEFT JOIN user_profile up ON up.id = ttd.user_id
  LEFT JOIN tune ON tune.id = ttd.tune_id
  LEFT JOIN tune_override ON tune_override.tune_ref = tune.id
    AND tune_override.user_ref = ttd.user_id
  LEFT JOIN playlist p ON p.playlist_id = ttd.playlist_id
  LEFT JOIN instrument i ON i.id = p.instrument_ref
ORDER BY
  ttd.last_modified_at DESC;

ALTER VIEW "public"."view_transient_data_readable" OWNER TO "postgres";

COMMENT ON VIEW "public"."view_transient_data_readable" IS 'Human-readable view of transient/staged practice data with resolved user names, instrument names, and tune titles';

-- View 3: Practice Records with Human-Readable Names
-- Shows practice history with readable names and quality/state labels
CREATE OR REPLACE VIEW "public"."view_practice_record_readable" AS
SELECT
  COALESCE(up.name, up.email) AS user_name,
  COALESCE(tune_override.title, tune.title) AS tune_title,
  pr.tune_ref,
  i.instrument AS playlist_instrument,
  pr.playlist_ref,
  pr.practiced,
  pr.quality,
  CASE pr.quality
    WHEN 1 THEN 'Again'
    WHEN 2 THEN 'Hard'
    WHEN 3 THEN 'Good'
    WHEN 4 THEN 'Easy'
    ELSE 'Unknown'
  END AS quality_label,
  pr.easiness,
  pr.difficulty,
  pr.stability,
  pr.interval,
  pr.step,
  pr.repetitions,
  pr.lapses,
  pr.elapsed_days,
  pr.state,
  CASE pr.state
    WHEN 0 THEN 'New'
    WHEN 1 THEN 'Learning'
    WHEN 2 THEN 'Review'
    WHEN 3 THEN 'Relearning'
    ELSE 'Unknown'
  END AS state_label,
  pr.due,
  pr.backup_practiced,
  pr.goal,
  pr.technique,
  pr.sync_version,
  pr.last_modified_at,
  pr.device_id,
  pr.id
FROM
  practice_record pr
  LEFT JOIN playlist p ON p.playlist_id = pr.playlist_ref
  LEFT JOIN user_profile up ON up.id = p.user_ref
  LEFT JOIN tune ON tune.id = pr.tune_ref
  LEFT JOIN tune_override ON tune_override.tune_ref = tune.id
    AND tune_override.user_ref = p.user_ref
  LEFT JOIN instrument i ON i.id = p.instrument_ref
ORDER BY
  pr.practiced DESC;

ALTER VIEW "public"."view_practice_record_readable" OWNER TO "postgres";

COMMENT ON VIEW "public"."view_practice_record_readable" IS 'Human-readable view of practice records with resolved user names, instrument names, tune titles, and decoded quality/state labels';
