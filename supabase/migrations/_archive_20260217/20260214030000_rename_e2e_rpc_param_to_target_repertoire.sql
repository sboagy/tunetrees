BEGIN;

-- Align E2E RPC parameter naming with repertoire terminology.
-- Function names and argument types remain unchanged for compatibility.

DROP FUNCTION IF EXISTS public.e2e_clear_practice_record(uuid);

CREATE FUNCTION public.e2e_clear_practice_record(target_repertoire uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM public.repertoire r
		WHERE r.repertoire_id = target_repertoire
			AND r.user_ref = auth.uid()
	) THEN
		RAISE EXCEPTION 'not authorized to clear practice_record for this repertoire';
	END IF;

	PERFORM set_config('app.allow_practice_record_delete', 'on', true);

	DELETE FROM public.practice_record pr
	WHERE pr.repertoire_ref = target_repertoire;
END;
$$;

REVOKE ALL ON FUNCTION public.e2e_clear_practice_record(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.e2e_clear_practice_record(uuid) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.e2e_delete_practice_record_by_tunes(uuid, uuid[]);

CREATE FUNCTION public.e2e_delete_practice_record_by_tunes(
	target_repertoire uuid,
	tune_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM public.repertoire r
		WHERE r.repertoire_id = target_repertoire
			AND r.user_ref = auth.uid()
	) THEN
		RAISE EXCEPTION 'Not authorized to clear practice_record for this repertoire';
	END IF;

	PERFORM set_config('app.allow_practice_record_delete', 'on', true);

	DELETE FROM public.practice_record pr
	WHERE pr.repertoire_ref = target_repertoire
		AND pr.tune_ref = ANY (tune_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.e2e_delete_practice_record_by_tunes(uuid, uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.e2e_delete_practice_record_by_tunes(uuid, uuid[]) TO anon;
GRANT EXECUTE ON FUNCTION public.e2e_delete_practice_record_by_tunes(uuid, uuid[]) TO authenticated;

COMMIT;