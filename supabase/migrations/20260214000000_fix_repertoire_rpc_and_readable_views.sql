-- Post-rename repair: recompile RPCs and readable views against repertoire naming.
--
-- Why:
-- - Table/column renames from playlist* -> repertoire* happened in 20260213000000.
-- - SQL/plpgsql function bodies are stored as source text and can still reference old
--   relation/column names unless explicitly replaced.
-- - This migration keeps existing RPC signatures for compatibility while fixing internals.

BEGIN;

-- ---------------------------------------------------------------------------
-- E2E RPC: clear practice records (keep function name/signature for test callers)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.e2e_clear_practice_record(target_playlist uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM public.repertoire r
		WHERE r.repertoire_id = target_playlist
			AND r.user_ref = auth.uid()
	) THEN
		RAISE EXCEPTION 'not authorized to clear practice_record for this repertoire';
	END IF;

	PERFORM set_config('app.allow_practice_record_delete', 'on', true);

	DELETE FROM public.practice_record pr
	WHERE pr.repertoire_ref = target_playlist;
END;
$$;

REVOKE ALL ON FUNCTION public.e2e_clear_practice_record(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.e2e_clear_practice_record(uuid) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- E2E RPC: delete specific practice records by tune ids
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.e2e_delete_practice_record_by_tunes(
	target_playlist uuid,
	tune_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM public.repertoire r
		WHERE r.repertoire_id = target_playlist
			AND r.user_ref = auth.uid()
	) THEN
		RAISE EXCEPTION 'Not authorized to clear practice_record for this repertoire';
	END IF;

	PERFORM set_config('app.allow_practice_record_delete', 'on', true);

	DELETE FROM public.practice_record pr
	WHERE pr.repertoire_ref = target_playlist
		AND pr.tune_ref = ANY (tune_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.e2e_delete_practice_record_by_tunes(uuid, uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.e2e_delete_practice_record_by_tunes(uuid, uuid[]) TO anon;
GRANT EXECUTE ON FUNCTION public.e2e_delete_practice_record_by_tunes(uuid, uuid[]) TO authenticated;

-- ---------------------------------------------------------------------------
-- Sync RPC: keep existing name for compatibility, but use repertoire* tables.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_playlist_tune_genres_for_user(
	p_user_id text
)
RETURNS text[]
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
	SELECT COALESCE(array_agg(DISTINCT t.genre), '{}')
	FROM public.repertoire_tune rt
	JOIN public.repertoire r
		ON r.repertoire_id = rt.repertoire_ref
		AND r.deleted = false
	JOIN public.tune t
		ON t.id = rt.tune_ref
		AND t.deleted = false
	WHERE rt.deleted = false
		AND t.genre IS NOT NULL
		AND r.user_ref::text = p_user_id;
$$;

REVOKE ALL ON FUNCTION public.get_playlist_tune_genres_for_user(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_playlist_tune_genres_for_user(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_playlist_tune_genres_for_user(text) TO service_role;

-- ---------------------------------------------------------------------------
-- Readable debug views: recreate against repertoire* identifiers.
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.view_daily_practice_queue_readable;
CREATE VIEW public.view_daily_practice_queue_readable
WITH (security_invoker = true)
AS
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
	dpq.repertoire_ref,
	dpq.tune_ref
FROM
	public.daily_practice_queue dpq
	LEFT JOIN public.user_profile up ON up.id = dpq.user_ref
	LEFT JOIN public.repertoire r ON r.repertoire_id = dpq.repertoire_ref
	LEFT JOIN public.instrument i ON i.id = r.instrument_ref
	LEFT JOIN public.tune ON tune.id = dpq.tune_ref
	LEFT JOIN public.tune_override ON tune_override.tune_ref = tune.id
		AND tune_override.user_ref = dpq.user_ref
ORDER BY
	dpq.queue_date DESC,
	dpq.bucket ASC,
	dpq.order_index ASC;

ALTER VIEW public.view_daily_practice_queue_readable OWNER TO postgres;

DROP VIEW IF EXISTS public.view_transient_data_readable;
CREATE VIEW public.view_transient_data_readable
WITH (security_invoker = true)
AS
SELECT
	COALESCE(up.name, up.email) AS user_name,
	ttd.user_id,
	COALESCE(tune_override.title, tune.title) AS tune_title,
	ttd.tune_id,
	i.instrument AS playlist_instrument,
	ttd.repertoire_id,
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
	public.table_transient_data ttd
	LEFT JOIN public.user_profile up ON up.id = ttd.user_id
	LEFT JOIN public.tune ON tune.id = ttd.tune_id
	LEFT JOIN public.tune_override ON tune_override.tune_ref = tune.id
		AND tune_override.user_ref = ttd.user_id
	LEFT JOIN public.repertoire r ON r.repertoire_id = ttd.repertoire_id
	LEFT JOIN public.instrument i ON i.id = r.instrument_ref
ORDER BY
	ttd.last_modified_at DESC;

ALTER VIEW public.view_transient_data_readable OWNER TO postgres;

DROP VIEW IF EXISTS public.view_practice_record_readable;
CREATE VIEW public.view_practice_record_readable
WITH (security_invoker = true)
AS
SELECT
	COALESCE(up.name, up.email) AS user_name,
	COALESCE(tune_override.title, tune.title) AS tune_title,
	pr.tune_ref,
	i.instrument AS playlist_instrument,
	pr.repertoire_ref,
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
	public.practice_record pr
	LEFT JOIN public.repertoire r ON r.repertoire_id = pr.repertoire_ref
	LEFT JOIN public.user_profile up ON up.id = r.user_ref
	LEFT JOIN public.tune ON tune.id = pr.tune_ref
	LEFT JOIN public.tune_override ON tune_override.tune_ref = tune.id
		AND tune_override.user_ref = r.user_ref
	LEFT JOIN public.instrument i ON i.id = r.instrument_ref
ORDER BY
	pr.practiced DESC;

ALTER VIEW public.view_practice_record_readable OWNER TO postgres;

COMMIT;
