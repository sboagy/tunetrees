


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."auth_internal_user_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT id FROM public.user_profile WHERE supabase_user_id = auth.uid();
$$;


ALTER FUNCTION "public"."auth_internal_user_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."e2e_clear_practice_record"("target_repertoire" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
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


ALTER FUNCTION "public"."e2e_clear_practice_record"("target_repertoire" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."e2e_delete_practice_record_by_tunes"("target_repertoire" "uuid", "tune_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
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


ALTER FUNCTION "public"."e2e_delete_practice_record_by_tunes"("target_repertoire" "uuid", "tune_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_repertoire_tune_genres_for_user"("p_user_id" "text") RETURNS "text"[]
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
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


ALTER FUNCTION "public"."get_repertoire_tune_genres_for_user"("p_user_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_practice_record_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  -- Break-glass bypass (per-session / per-transaction).
  -- Example:
  --   begin;
  --   set local app.allow_practice_record_delete = 'on';
  --   delete from public.practice_record where id = 123;
  --   commit;
  if current_setting('app.allow_practice_record_delete', true) = 'on' then
    return old;
  end if;

  raise exception 'Deleting from practice_record is not allowed';
end;
$$;


ALTER FUNCTION "public"."prevent_practice_record_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_change_log_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
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
$$;


ALTER FUNCTION "public"."sync_change_log_update"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."note" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_ref" "uuid",
    "tune_ref" "uuid" NOT NULL,
    "repertoire_ref" "uuid",
    "created_date" timestamp without time zone,
    "note_text" "text",
    "public" boolean DEFAULT false NOT NULL,
    "favorite" boolean,
    "deleted" boolean DEFAULT false NOT NULL,
    "sync_version" integer DEFAULT 1 NOT NULL,
    "last_modified_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "device_id" "text",
    "display_order" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "chk_favorite_bool" CHECK ((("favorite" = ANY (ARRAY[true, false])) OR ("favorite" IS NULL))),
    CONSTRAINT "chk_public_bool" CHECK (("public" = ANY (ARRAY[true, false])))
);


ALTER TABLE "public"."note" OWNER TO "postgres";


COMMENT ON TABLE "public"."note" IS 'User notes attached to tunes.';



COMMENT ON COLUMN "public"."note"."id" IS 'Primary key for the note.';



COMMENT ON COLUMN "public"."note"."user_ref" IS 'User ID who created this note.';



COMMENT ON COLUMN "public"."note"."tune_ref" IS 'Reference to the tune.';



COMMENT ON COLUMN "public"."note"."repertoire_ref" IS 'Reference to the playlist (optional).';



COMMENT ON COLUMN "public"."note"."created_date" IS 'Timestamp when the note was created.';



COMMENT ON COLUMN "public"."note"."note_text" IS 'Text content of the note.';



COMMENT ON COLUMN "public"."note"."public" IS 'Whether the note is public (true) or private (false).';



COMMENT ON COLUMN "public"."note"."favorite" IS 'Whether this is marked as a favorite note.';



COMMENT ON COLUMN "public"."note"."deleted" IS 'Soft-delete flag for the note.';



COMMENT ON COLUMN "public"."note"."sync_version" IS 'Sync version for conflict resolution.';



COMMENT ON COLUMN "public"."note"."last_modified_at" IS 'Timestamp of last modification.';



COMMENT ON COLUMN "public"."note"."device_id" IS 'Device that last modified this record.';



COMMENT ON COLUMN "public"."note"."display_order" IS 'User-defined display order for drag-and-drop reordering in the UI';



CREATE OR REPLACE FUNCTION "public"."sync_get_user_notes"("p_user_id" "uuid", "p_genre_ids" "text"[], "p_after_timestamp" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_limit" integer DEFAULT 1000, "p_offset" integer DEFAULT 0) RETURNS SETOF "public"."note"
    LANGUAGE "sql" STABLE
    AS $$
  SELECT n.*
  FROM note n
  JOIN tune t ON n.tune_ref = t.id
  WHERE (
    -- Tunes in selected genres (public) OR user's private tunes
    -- Note: p_genre_ids is the effective genre filter calculated by client
    -- (includes user_genre_selection + playlist genres + playlist_tune genres)
    (t.genre = ANY(p_genre_ids) AND t.private_for IS NULL)
    OR t.private_for = p_user_id
  )
  AND (
    -- Notes visible to user (public or user's own)
    n.user_ref IS NULL OR n.user_ref = p_user_id
  )
  AND (
    -- Incremental sync: only rows updated after timestamp (if provided)
    p_after_timestamp IS NULL OR n.last_modified_at > p_after_timestamp
  )
  AND t.deleted = FALSE
  ORDER BY n.last_modified_at ASC, n.id ASC
  LIMIT p_limit
  OFFSET p_offset;
$$;


ALTER FUNCTION "public"."sync_get_user_notes"("p_user_id" "uuid", "p_genre_ids" "text"[], "p_after_timestamp" timestamp with time zone, "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reference" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "url" "text" NOT NULL,
    "ref_type" "text",
    "tune_ref" "uuid" NOT NULL,
    "user_ref" "uuid",
    "comment" "text",
    "title" "text",
    "public" boolean,
    "favorite" boolean,
    "deleted" boolean DEFAULT false NOT NULL,
    "sync_version" integer DEFAULT 1 NOT NULL,
    "last_modified_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "device_id" "text",
    "display_order" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "check_favorite" CHECK ((("favorite" = ANY (ARRAY[true, false])) OR ("favorite" IS NULL))),
    CONSTRAINT "check_public" CHECK ((("public" = ANY (ARRAY[true, false])) OR ("public" IS NULL))),
    CONSTRAINT "check_ref_type" CHECK ((("ref_type" = ANY (ARRAY['website'::"text", 'audio'::"text", 'video'::"text", 'sheet-music'::"text", 'article'::"text", 'social'::"text", 'lesson'::"text", 'other'::"text"])) OR ("ref_type" IS NULL)))
);


ALTER TABLE "public"."reference" OWNER TO "postgres";


COMMENT ON TABLE "public"."reference" IS 'User references (links) attached to tunes.';



COMMENT ON COLUMN "public"."reference"."id" IS 'Primary key for the reference.';



COMMENT ON COLUMN "public"."reference"."url" IS 'URL of the reference.';



COMMENT ON COLUMN "public"."reference"."ref_type" IS 'Type of reference (website/audio/video).';



COMMENT ON COLUMN "public"."reference"."tune_ref" IS 'Reference to the tune.';



COMMENT ON COLUMN "public"."reference"."user_ref" IS 'User ID who created this reference.';



COMMENT ON COLUMN "public"."reference"."comment" IS 'Optional comment about the reference.';



COMMENT ON COLUMN "public"."reference"."title" IS 'Title/label for the reference.';



COMMENT ON COLUMN "public"."reference"."public" IS 'Whether the reference is public.';



COMMENT ON COLUMN "public"."reference"."favorite" IS 'Whether this is marked as a favorite reference.';



COMMENT ON COLUMN "public"."reference"."deleted" IS 'Soft-delete flag for the reference.';



COMMENT ON COLUMN "public"."reference"."sync_version" IS 'Sync version for conflict resolution.';



COMMENT ON COLUMN "public"."reference"."last_modified_at" IS 'Timestamp of last modification.';



COMMENT ON COLUMN "public"."reference"."device_id" IS 'Device that last modified this record.';



COMMENT ON COLUMN "public"."reference"."display_order" IS 'User-defined display order for drag-and-drop reordering in the UI';



CREATE OR REPLACE FUNCTION "public"."sync_get_user_references"("p_user_id" "uuid", "p_genre_ids" "text"[], "p_after_timestamp" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_limit" integer DEFAULT 1000, "p_offset" integer DEFAULT 0) RETURNS SETOF "public"."reference"
    LANGUAGE "sql" STABLE
    AS $$
  SELECT r.*
  FROM reference r
  JOIN tune t ON r.tune_ref = t.id
  WHERE (
    -- Tunes in selected genres (public) OR user's private tunes
    -- Note: p_genre_ids is the effective genre filter calculated by client
    -- (includes user_genre_selection + playlist genres + playlist_tune genres)
    (t.genre = ANY(p_genre_ids) AND t.private_for IS NULL)
    OR t.private_for = p_user_id
  )
  AND (
    -- References visible to user (public or user's own)
    r.user_ref IS NULL OR r.user_ref = p_user_id
  )
  AND (
    -- Incremental sync: only rows updated after timestamp (if provided)
    p_after_timestamp IS NULL OR r.last_modified_at > p_after_timestamp
  )
  AND t.deleted = FALSE
  ORDER BY r.last_modified_at ASC, r.id ASC
  LIMIT p_limit
  OFFSET p_offset;
$$;


ALTER FUNCTION "public"."sync_get_user_references"("p_user_id" "uuid", "p_genre_ids" "text"[], "p_after_timestamp" timestamp with time zone, "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_now_iso"() RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
BEGIN
    RETURN to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
END;
$$;


ALTER FUNCTION "public"."sync_now_iso"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_practice_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_ref" "uuid" NOT NULL,
    "repertoire_ref" "uuid" NOT NULL,
    "mode" "text",
    "queue_date" timestamp without time zone,
    "window_start_utc" timestamp without time zone NOT NULL,
    "window_end_utc" timestamp without time zone NOT NULL,
    "tune_ref" "uuid" NOT NULL,
    "bucket" integer NOT NULL,
    "order_index" integer NOT NULL,
    "snapshot_coalesced_ts" timestamp without time zone NOT NULL,
    "scheduled_snapshot" "text",
    "latest_due_snapshot" "text",
    "acceptable_delinquency_window_snapshot" integer,
    "tz_offset_minutes_snapshot" integer,
    "generated_at" timestamp without time zone NOT NULL,
    "completed_at" timestamp without time zone,
    "exposures_required" integer,
    "exposures_completed" integer DEFAULT 0,
    "outcome" "text",
    "active" boolean DEFAULT true NOT NULL,
    "sync_version" integer DEFAULT 1 NOT NULL,
    "last_modified_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "device_id" "text"
);


ALTER TABLE "public"."daily_practice_queue" OWNER TO "postgres";


COMMENT ON TABLE "public"."daily_practice_queue" IS 'Generated practice queue snapshot for a user and playlist.';



COMMENT ON COLUMN "public"."daily_practice_queue"."id" IS 'Primary key for the queue entry.';



COMMENT ON COLUMN "public"."daily_practice_queue"."user_ref" IS 'User ID who owns this queue entry.';



COMMENT ON COLUMN "public"."daily_practice_queue"."repertoire_ref" IS 'Reference to the playlist.';



COMMENT ON COLUMN "public"."daily_practice_queue"."mode" IS 'Practice mode (e.g., flashcard, listening).';



COMMENT ON COLUMN "public"."daily_practice_queue"."queue_date" IS 'Date this queue was generated for.';



COMMENT ON COLUMN "public"."daily_practice_queue"."window_start_utc" IS 'Start of practice window (UTC).';



COMMENT ON COLUMN "public"."daily_practice_queue"."window_end_utc" IS 'End of practice window (UTC).';



COMMENT ON COLUMN "public"."daily_practice_queue"."tune_ref" IS 'Reference to the tune in queue.';



COMMENT ON COLUMN "public"."daily_practice_queue"."bucket" IS 'Priority bucket (lower = higher priority).';



COMMENT ON COLUMN "public"."daily_practice_queue"."order_index" IS 'Order within the bucket.';



COMMENT ON COLUMN "public"."daily_practice_queue"."snapshot_coalesced_ts" IS 'Timestamp when queue was coalesced.';



COMMENT ON COLUMN "public"."daily_practice_queue"."scheduled_snapshot" IS 'Snapshot of scheduled time.';



COMMENT ON COLUMN "public"."daily_practice_queue"."latest_due_snapshot" IS 'Snapshot of latest due date.';



COMMENT ON COLUMN "public"."daily_practice_queue"."acceptable_delinquency_window_snapshot" IS 'Snapshot of delinquency window.';



COMMENT ON COLUMN "public"."daily_practice_queue"."tz_offset_minutes_snapshot" IS 'Snapshot of user timezone offset.';



COMMENT ON COLUMN "public"."daily_practice_queue"."generated_at" IS 'Timestamp when queue entry was generated.';



COMMENT ON COLUMN "public"."daily_practice_queue"."completed_at" IS 'Timestamp when queue entry was completed.';



COMMENT ON COLUMN "public"."daily_practice_queue"."exposures_required" IS 'Number of exposures required for this queue item.';



COMMENT ON COLUMN "public"."daily_practice_queue"."exposures_completed" IS 'Number of exposures completed so far.';



COMMENT ON COLUMN "public"."daily_practice_queue"."outcome" IS 'Outcome of the queue entry (pass/fail/skip).';



COMMENT ON COLUMN "public"."daily_practice_queue"."active" IS 'Whether this queue entry is still active.';



COMMENT ON COLUMN "public"."daily_practice_queue"."sync_version" IS 'Sync version for conflict resolution.';



COMMENT ON COLUMN "public"."daily_practice_queue"."last_modified_at" IS 'Timestamp of last modification.';



COMMENT ON COLUMN "public"."daily_practice_queue"."device_id" IS 'Device that last modified this record.';



CREATE TABLE IF NOT EXISTS "public"."genre" (
    "id" "text" NOT NULL,
    "name" "text",
    "region" "text",
    "description" "text"
);


ALTER TABLE "public"."genre" OWNER TO "postgres";


COMMENT ON TABLE "public"."genre" IS 'Reference list of tune genres.';



COMMENT ON COLUMN "public"."genre"."id" IS 'Primary key (genre identifier).';



COMMENT ON COLUMN "public"."genre"."name" IS 'Genre name.';



COMMENT ON COLUMN "public"."genre"."region" IS 'Geographic region associated with the genre.';



COMMENT ON COLUMN "public"."genre"."description" IS 'Description of the genre.';



CREATE TABLE IF NOT EXISTS "public"."genre_tune_type" (
    "genre_id" "text" NOT NULL,
    "tune_type_id" "text" NOT NULL
);


ALTER TABLE "public"."genre_tune_type" OWNER TO "postgres";


COMMENT ON TABLE "public"."genre_tune_type" IS 'Many-to-many association between tune genres and tune types.';



COMMENT ON COLUMN "public"."genre_tune_type"."genre_id" IS 'Reference to the genre.';



COMMENT ON COLUMN "public"."genre_tune_type"."tune_type_id" IS 'Reference to the tune type.';



CREATE TABLE IF NOT EXISTS "public"."instrument" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "private_to_user" "uuid",
    "instrument" "text",
    "description" "text",
    "genre_default" "text",
    "deleted" boolean DEFAULT false NOT NULL,
    "sync_version" integer DEFAULT 1 NOT NULL,
    "last_modified_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "device_id" "text"
);


ALTER TABLE "public"."instrument" OWNER TO "postgres";


COMMENT ON TABLE "public"."instrument" IS 'Instrument catalog for playlists, including per-user private instruments.';



COMMENT ON COLUMN "public"."instrument"."id" IS 'Primary key for the instrument.';



COMMENT ON COLUMN "public"."instrument"."private_to_user" IS 'User ID if this is a private instrument (null = public).';



COMMENT ON COLUMN "public"."instrument"."instrument" IS 'Instrument name.';



COMMENT ON COLUMN "public"."instrument"."description" IS 'Description of the instrument.';



COMMENT ON COLUMN "public"."instrument"."genre_default" IS 'Default genre associated with this instrument.';



COMMENT ON COLUMN "public"."instrument"."deleted" IS 'Soft-delete flag for the instrument.';



COMMENT ON COLUMN "public"."instrument"."sync_version" IS 'Sync version for conflict resolution.';



COMMENT ON COLUMN "public"."instrument"."last_modified_at" IS 'Timestamp of last modification.';



COMMENT ON COLUMN "public"."instrument"."device_id" IS 'Device that last modified this record.';



CREATE TABLE IF NOT EXISTS "public"."plugin" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_ref" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "script" "text" NOT NULL,
    "capabilities" "text" NOT NULL,
    "is_public" boolean DEFAULT false NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "deleted" boolean DEFAULT false NOT NULL,
    "sync_version" integer DEFAULT 1 NOT NULL,
    "last_modified_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "device_id" "text",
    "goals" "text" DEFAULT '[]'::"text" NOT NULL
);


ALTER TABLE "public"."plugin" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."practice_record" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "repertoire_ref" "uuid" NOT NULL,
    "tune_ref" "uuid" NOT NULL,
    "practiced" timestamp without time zone,
    "quality" integer,
    "easiness" real,
    "difficulty" real,
    "stability" real,
    "interval" integer,
    "step" integer,
    "repetitions" integer,
    "lapses" integer,
    "elapsed_days" integer,
    "state" integer,
    "due" timestamp without time zone,
    "backup_practiced" timestamp without time zone,
    "goal" "text" DEFAULT 'recall'::"text",
    "technique" "text",
    "sync_version" integer DEFAULT 1 NOT NULL,
    "last_modified_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "device_id" "text"
);


ALTER TABLE "public"."practice_record" OWNER TO "postgres";


COMMENT ON TABLE "public"."practice_record" IS 'Historical practice records for tunes, used for scheduling.';



COMMENT ON COLUMN "public"."practice_record"."id" IS 'Primary key for the practice record.';



COMMENT ON COLUMN "public"."practice_record"."repertoire_ref" IS 'Reference to the playlist.';



COMMENT ON COLUMN "public"."practice_record"."tune_ref" IS 'Reference to the tune practiced.';



COMMENT ON COLUMN "public"."practice_record"."practiced" IS 'Timestamp when the tune was practiced.';



COMMENT ON COLUMN "public"."practice_record"."quality" IS 'Quality rating (0-5) for this practice session.';



COMMENT ON COLUMN "public"."practice_record"."easiness" IS 'Easiness factor (SM2) or retention value (FSRS).';



COMMENT ON COLUMN "public"."practice_record"."difficulty" IS 'Difficulty rating for FSRS scheduling.';



COMMENT ON COLUMN "public"."practice_record"."stability" IS 'Memory stability value from spaced repetition algorithm.';



COMMENT ON COLUMN "public"."practice_record"."interval" IS 'Days until next review (interval).';



COMMENT ON COLUMN "public"."practice_record"."step" IS 'Current learning step.';



COMMENT ON COLUMN "public"."practice_record"."repetitions" IS 'Total number of repetitions completed.';



COMMENT ON COLUMN "public"."practice_record"."lapses" IS 'Number of times forgotten (lapses).';



COMMENT ON COLUMN "public"."practice_record"."elapsed_days" IS 'Days since previous review.';



COMMENT ON COLUMN "public"."practice_record"."state" IS 'Scheduler state (0=new, 1=learning, 2=review, 3=relearning).';



COMMENT ON COLUMN "public"."practice_record"."due" IS 'Due date for next review.';



COMMENT ON COLUMN "public"."practice_record"."backup_practiced" IS 'Backup timestamp (pre-update stored value).';



COMMENT ON COLUMN "public"."practice_record"."goal" IS 'Practice goal for this record.';



COMMENT ON COLUMN "public"."practice_record"."technique" IS 'Technique note for this practice session.';



COMMENT ON COLUMN "public"."practice_record"."sync_version" IS 'Sync version for conflict resolution.';



COMMENT ON COLUMN "public"."practice_record"."last_modified_at" IS 'Timestamp of last modification.';



COMMENT ON COLUMN "public"."practice_record"."device_id" IS 'Device that last modified this record.';



CREATE TABLE IF NOT EXISTS "public"."repertoire" (
    "repertoire_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_ref" "uuid" NOT NULL,
    "name" "text",
    "instrument_ref" "uuid",
    "genre_default" "text",
    "sr_alg_type" "text",
    "deleted" boolean DEFAULT false NOT NULL,
    "sync_version" integer DEFAULT 1 NOT NULL,
    "last_modified_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "device_id" "text"
);


ALTER TABLE "public"."repertoire" OWNER TO "postgres";


COMMENT ON TABLE "public"."repertoire" IS 'User playlists (repertoires) for organizing tunes.';



COMMENT ON COLUMN "public"."repertoire"."repertoire_id" IS 'Primary key for the playlist.';



COMMENT ON COLUMN "public"."repertoire"."user_ref" IS 'User ID who owns this playlist.';



COMMENT ON COLUMN "public"."repertoire"."name" IS 'Name of the playlist (repertoire).';



COMMENT ON COLUMN "public"."repertoire"."instrument_ref" IS 'Reference to the instrument for this playlist.';



COMMENT ON COLUMN "public"."repertoire"."genre_default" IS 'Default genre filter for this playlist.';



COMMENT ON COLUMN "public"."repertoire"."sr_alg_type" IS 'Spaced repetition algorithm type (SM2/FSRS).';



COMMENT ON COLUMN "public"."repertoire"."deleted" IS 'Soft-delete flag for the playlist.';



COMMENT ON COLUMN "public"."repertoire"."sync_version" IS 'Sync version for conflict resolution.';



COMMENT ON COLUMN "public"."repertoire"."last_modified_at" IS 'Timestamp of last modification.';



COMMENT ON COLUMN "public"."repertoire"."device_id" IS 'Device that last modified this record.';



CREATE TABLE IF NOT EXISTS "public"."repertoire_tune" (
    "repertoire_ref" "uuid" NOT NULL,
    "tune_ref" "uuid" NOT NULL,
    "current" timestamp without time zone,
    "learned" timestamp without time zone,
    "scheduled" timestamp without time zone,
    "goal" "text" DEFAULT 'recall'::"text",
    "deleted" boolean DEFAULT false NOT NULL,
    "sync_version" integer DEFAULT 1 NOT NULL,
    "last_modified_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "device_id" "text"
);


ALTER TABLE "public"."repertoire_tune" OWNER TO "postgres";


COMMENT ON TABLE "public"."repertoire_tune" IS 'Join table linking tunes to playlists with per-playlist status and goals.';



COMMENT ON COLUMN "public"."repertoire_tune"."repertoire_ref" IS 'Reference to the playlist.';



COMMENT ON COLUMN "public"."repertoire_tune"."tune_ref" IS 'Reference to the tune.';



COMMENT ON COLUMN "public"."repertoire_tune"."current" IS 'Timestamp when added to current learnings.';



COMMENT ON COLUMN "public"."repertoire_tune"."learned" IS 'Timestamp when marked as fully learned.';



COMMENT ON COLUMN "public"."repertoire_tune"."scheduled" IS 'Manual schedule override for next review.';



COMMENT ON COLUMN "public"."repertoire_tune"."goal" IS 'Practice goal (recall/sight_read/technique).';



COMMENT ON COLUMN "public"."repertoire_tune"."deleted" IS 'Soft-delete flag for this playlist entry.';



COMMENT ON COLUMN "public"."repertoire_tune"."sync_version" IS 'Sync version for conflict resolution.';



COMMENT ON COLUMN "public"."repertoire_tune"."last_modified_at" IS 'Timestamp of last modification.';



COMMENT ON COLUMN "public"."repertoire_tune"."device_id" IS 'Device that last modified this record.';



CREATE TABLE IF NOT EXISTS "public"."tag" (
    "tag_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_ref" "uuid" NOT NULL,
    "tune_ref" "uuid" NOT NULL,
    "tag_text" "text" NOT NULL,
    "sync_version" integer DEFAULT 1 NOT NULL,
    "last_modified_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "device_id" "text"
);


ALTER TABLE "public"."tag" OWNER TO "postgres";


COMMENT ON TABLE "public"."tag" IS 'User tags attached to tunes.';



COMMENT ON COLUMN "public"."tag"."tag_id" IS 'Primary key for the tag.';



COMMENT ON COLUMN "public"."tag"."user_ref" IS 'User ID who owns this tag.';



COMMENT ON COLUMN "public"."tag"."tune_ref" IS 'Reference to the tune.';



COMMENT ON COLUMN "public"."tag"."tag_text" IS 'Text content of the tag.';



COMMENT ON COLUMN "public"."tag"."sync_version" IS 'Sync version for conflict resolution.';



COMMENT ON COLUMN "public"."tag"."last_modified_at" IS 'Timestamp of last modification.';



COMMENT ON COLUMN "public"."tag"."device_id" IS 'Device that last modified this record.';



CREATE TABLE IF NOT EXISTS "public"."tune" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "id_foreign" "text",
    "primary_origin" "text" DEFAULT 'irishtune.info'::"text",
    "title" "text",
    "type" "text",
    "structure" "text",
    "mode" "text",
    "incipit" "text",
    "genre" "text",
    "private_for" "uuid",
    "deleted" boolean DEFAULT false NOT NULL,
    "sync_version" integer DEFAULT 1 NOT NULL,
    "last_modified_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "device_id" "text",
    "composer" "text",
    "artist" "text",
    "release_year" integer
);

ALTER TABLE ONLY "public"."tune" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."tune" OWNER TO "postgres";


COMMENT ON TABLE "public"."tune" IS 'Master catalog of tunes, including metadata like type, mode, and genre.';



COMMENT ON COLUMN "public"."tune"."id" IS 'Primary key for the tune.';



COMMENT ON COLUMN "public"."tune"."id_foreign" IS 'External tune identifier (e.g. irishtune.info, Spotify).';



COMMENT ON COLUMN "public"."tune"."title" IS 'Tune title as displayed in the UI.';



COMMENT ON COLUMN "public"."tune"."type" IS 'Tune type classification (reel, jig, etc.) used in filtering.';



COMMENT ON COLUMN "public"."tune"."structure" IS 'Tune structure shorthand (e.g. AABB).';



COMMENT ON COLUMN "public"."tune"."mode" IS 'Musical mode of the tune.';



COMMENT ON COLUMN "public"."tune"."incipit" IS 'Opening notes or incipit text.';



COMMENT ON COLUMN "public"."tune"."genre" IS 'Genre identifier assigned to the tune.';



COMMENT ON COLUMN "public"."tune"."private_for" IS 'User profile ID if the tune is private.';



COMMENT ON COLUMN "public"."tune"."deleted" IS 'Soft-delete flag for the tune.';



COMMENT ON COLUMN "public"."tune"."composer" IS 'Composer name for classical/choral tunes.';



COMMENT ON COLUMN "public"."tune"."artist" IS 'Artist name for pop/rock/jazz tunes.';



COMMENT ON COLUMN "public"."tune"."release_year" IS 'Release year for the recording or tune.';



CREATE TABLE IF NOT EXISTS "public"."tune_override" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tune_ref" "uuid" NOT NULL,
    "user_ref" "uuid" NOT NULL,
    "title" "text",
    "type" "text",
    "structure" "text",
    "genre" "text",
    "mode" "text",
    "incipit" "text",
    "deleted" boolean DEFAULT false NOT NULL,
    "sync_version" integer DEFAULT 1 NOT NULL,
    "last_modified_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "device_id" "text",
    "composer" "text",
    "artist" "text",
    "release_year" integer,
    "id_foreign" "text"
);

ALTER TABLE ONLY "public"."tune_override" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."tune_override" OWNER TO "postgres";


COMMENT ON TABLE "public"."tune_override" IS 'User-specific overrides for tune metadata in the repertoire.';



COMMENT ON COLUMN "public"."tune_override"."id" IS 'Primary key for the override record.';



COMMENT ON COLUMN "public"."tune_override"."tune_ref" IS 'Reference to the tune being overridden.';



COMMENT ON COLUMN "public"."tune_override"."user_ref" IS 'User ID who owns this override.';



COMMENT ON COLUMN "public"."tune_override"."title" IS 'User-specific tune title override.';



COMMENT ON COLUMN "public"."tune_override"."type" IS 'User-specific tune type override.';



COMMENT ON COLUMN "public"."tune_override"."structure" IS 'User-specific tune structure override.';



COMMENT ON COLUMN "public"."tune_override"."genre" IS 'User-specific genre override.';



COMMENT ON COLUMN "public"."tune_override"."mode" IS 'User-specific mode override.';



COMMENT ON COLUMN "public"."tune_override"."incipit" IS 'User-specific incipit override.';



COMMENT ON COLUMN "public"."tune_override"."deleted" IS 'Soft-delete flag for the override.';



COMMENT ON COLUMN "public"."tune_override"."sync_version" IS 'Sync version for conflict resolution.';



COMMENT ON COLUMN "public"."tune_override"."last_modified_at" IS 'Timestamp of last modification.';



COMMENT ON COLUMN "public"."tune_override"."device_id" IS 'Device that last modified this record.';



CREATE OR REPLACE VIEW "public"."practice_list_joined" WITH ("security_invoker"='on') AS
 SELECT "tune"."id",
    COALESCE("tune_override"."title", "tune"."title") AS "title",
    COALESCE("tune_override"."type", "tune"."type") AS "type",
    COALESCE("tune_override"."structure", "tune"."structure") AS "structure",
    COALESCE("tune_override"."mode", "tune"."mode") AS "mode",
    COALESCE("tune_override"."incipit", "tune"."incipit") AS "incipit",
    COALESCE("tune_override"."genre", "tune"."genre") AS "genre",
    "tune"."deleted",
    "tune"."private_for",
    "repertoire_tune"."learned",
    "repertoire_tune"."goal",
    "repertoire_tune"."scheduled",
    "practice_record"."state" AS "latest_state",
    "practice_record"."practiced" AS "latest_practiced",
    "practice_record"."quality" AS "latest_quality",
    "practice_record"."easiness" AS "latest_easiness",
    "practice_record"."difficulty" AS "latest_difficulty",
    "practice_record"."interval" AS "latest_interval",
    "practice_record"."stability" AS "latest_stability",
    "practice_record"."step" AS "latest_step",
    "practice_record"."repetitions" AS "latest_repetitions",
    "practice_record"."due" AS "latest_due",
    "practice_record"."goal" AS "latest_goal",
    "practice_record"."technique" AS "latest_technique",
    ( SELECT "string_agg"("tag_1"."tag_text", ' '::"text") AS "string_agg"
           FROM "public"."tag" "tag_1"
          WHERE (("tag_1"."tune_ref" = "tune"."id") AND ("tag_1"."user_ref" = "repertoire"."user_ref"))) AS "tags",
    "repertoire_tune"."repertoire_ref" AS "playlist_ref",
    "repertoire"."user_ref",
    "repertoire_tune"."deleted" AS "playlist_deleted",
    ( SELECT "string_agg"("note"."note_text", ' '::"text") AS "string_agg"
           FROM "public"."note"
          WHERE (("note"."tune_ref" = "tune"."id") AND ("note"."user_ref" = "repertoire"."user_ref"))) AS "notes",
    ( SELECT "ref"."url"
           FROM "public"."reference" "ref"
          WHERE (("ref"."tune_ref" = "tune"."id") AND ("ref"."user_ref" = "repertoire"."user_ref") AND ("ref"."favorite" = true))
         LIMIT 1) AS "favorite_url",
        CASE
            WHEN ("tune_override"."user_ref" = "repertoire"."user_ref") THEN 1
            ELSE 0
        END AS "has_override"
   FROM ((((("public"."tune"
     LEFT JOIN "public"."repertoire_tune" ON (("repertoire_tune"."tune_ref" = "tune"."id")))
     LEFT JOIN "public"."repertoire" ON (("repertoire"."repertoire_id" = "repertoire_tune"."repertoire_ref")))
     LEFT JOIN "public"."tune_override" ON (("tune_override"."tune_ref" = "tune"."id")))
     LEFT JOIN ( SELECT DISTINCT ON ("pr"."tune_ref", "pr"."repertoire_ref") "pr"."id",
            "pr"."repertoire_ref" AS "playlist_ref",
            "pr"."tune_ref",
            "pr"."practiced",
            "pr"."quality",
            "pr"."easiness",
            "pr"."difficulty",
            "pr"."stability",
            "pr"."interval",
            "pr"."step",
            "pr"."repetitions",
            "pr"."lapses",
            "pr"."elapsed_days",
            "pr"."state",
            "pr"."due",
            "pr"."backup_practiced",
            "pr"."goal",
            "pr"."technique",
            "pr"."sync_version",
            "pr"."last_modified_at",
            "pr"."device_id"
           FROM "public"."practice_record" "pr"
          ORDER BY "pr"."tune_ref", "pr"."repertoire_ref", "pr"."id" DESC) "practice_record" ON ((("practice_record"."tune_ref" = "tune"."id") AND ("practice_record"."playlist_ref" = "repertoire_tune"."repertoire_ref"))))
     LEFT JOIN "public"."tag" ON (("tag"."tune_ref" = COALESCE("tune_override"."id", "tune"."id"))))
  WHERE (("tune_override"."user_ref" IS NULL) OR ("tune_override"."user_ref" = "repertoire"."user_ref"));


ALTER VIEW "public"."practice_list_joined" OWNER TO "postgres";


COMMENT ON VIEW "public"."practice_list_joined" IS 'Denormalized view joining tunes with overrides, playlists, and latest practice records for UI grids.';



COMMENT ON COLUMN "public"."practice_list_joined"."id" IS 'Unique tune ID for this row.';



COMMENT ON COLUMN "public"."practice_list_joined"."title" IS 'Tune title (uses any user override).';



COMMENT ON COLUMN "public"."practice_list_joined"."type" IS 'Tune type classification (reel, jig, hornpipe, etc.).';



COMMENT ON COLUMN "public"."practice_list_joined"."structure" IS 'Tune structure shorthand (e.g. AABB).';



COMMENT ON COLUMN "public"."practice_list_joined"."mode" IS 'Musical mode of the tune.';



COMMENT ON COLUMN "public"."practice_list_joined"."incipit" IS 'Opening notes or incipit text for the tune.';



COMMENT ON COLUMN "public"."practice_list_joined"."genre" IS 'Genre classification for the tune.';



COMMENT ON COLUMN "public"."practice_list_joined"."deleted" IS 'Soft-delete flag for the tune.';



COMMENT ON COLUMN "public"."practice_list_joined"."private_for" IS 'User profile ID if the tune is private.';



COMMENT ON COLUMN "public"."practice_list_joined"."learned" IS 'Timestamp when the tune was marked learned in the playlist.';



COMMENT ON COLUMN "public"."practice_list_joined"."goal" IS 'Practice goal for this tune in the playlist.';



COMMENT ON COLUMN "public"."practice_list_joined"."scheduled" IS 'Manual schedule override for the next review.';



COMMENT ON COLUMN "public"."practice_list_joined"."latest_state" IS 'Latest scheduler state (new/learning/review/relearning).';



COMMENT ON COLUMN "public"."practice_list_joined"."latest_practiced" IS 'Most recent practice timestamp.';



COMMENT ON COLUMN "public"."practice_list_joined"."latest_quality" IS 'Most recent quality rating.';



COMMENT ON COLUMN "public"."practice_list_joined"."latest_easiness" IS 'Most recent easiness value.';



COMMENT ON COLUMN "public"."practice_list_joined"."latest_difficulty" IS 'Most recent difficulty value.';



COMMENT ON COLUMN "public"."practice_list_joined"."latest_interval" IS 'Most recent interval (days).';



COMMENT ON COLUMN "public"."practice_list_joined"."latest_stability" IS 'Most recent stability value.';



COMMENT ON COLUMN "public"."practice_list_joined"."latest_step" IS 'Most recent learning step.';



COMMENT ON COLUMN "public"."practice_list_joined"."latest_repetitions" IS 'Most recent repetitions count.';



COMMENT ON COLUMN "public"."practice_list_joined"."latest_due" IS 'Next due date after latest review.';



COMMENT ON COLUMN "public"."practice_list_joined"."latest_goal" IS 'Latest goal value from practice record.';



COMMENT ON COLUMN "public"."practice_list_joined"."latest_technique" IS 'Latest technique note from practice record.';



COMMENT ON COLUMN "public"."practice_list_joined"."tags" IS 'Tags applied to the tune (aggregated).';



COMMENT ON COLUMN "public"."practice_list_joined"."playlist_ref" IS 'Reference to the playlist (repertoire).';



COMMENT ON COLUMN "public"."practice_list_joined"."user_ref" IS 'User ID who owns the playlist.';



COMMENT ON COLUMN "public"."practice_list_joined"."playlist_deleted" IS 'Soft-delete flag for the playlist entry.';



COMMENT ON COLUMN "public"."practice_list_joined"."notes" IS 'User notes for the tune (aggregated).';



COMMENT ON COLUMN "public"."practice_list_joined"."favorite_url" IS 'Favorite reference URL for the tune.';



COMMENT ON COLUMN "public"."practice_list_joined"."has_override" IS 'Whether the tune has user-specific overrides.';



CREATE TABLE IF NOT EXISTS "public"."table_transient_data" (
    "user_id" "uuid" NOT NULL,
    "tune_id" "uuid" NOT NULL,
    "repertoire_id" "uuid" NOT NULL,
    "purpose" "text",
    "note_private" "text",
    "note_public" "text",
    "recall_eval" "text",
    "practiced" timestamp without time zone,
    "quality" integer,
    "easiness" real,
    "difficulty" real,
    "interval" integer,
    "step" integer,
    "repetitions" integer,
    "due" timestamp without time zone,
    "backup_practiced" timestamp without time zone,
    "goal" "text",
    "technique" "text",
    "stability" real,
    "state" integer DEFAULT 2,
    "sync_version" integer DEFAULT 1 NOT NULL,
    "last_modified_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "device_id" "text"
);


ALTER TABLE "public"."table_transient_data" OWNER TO "postgres";


COMMENT ON TABLE "public"."table_transient_data" IS 'Staged practice data awaiting submission to practice_record.';



COMMENT ON COLUMN "public"."table_transient_data"."user_id" IS 'User ID who owns this transient data.';



COMMENT ON COLUMN "public"."table_transient_data"."tune_id" IS 'Reference to the tune.';



COMMENT ON COLUMN "public"."table_transient_data"."repertoire_id" IS 'Reference to the playlist.';



COMMENT ON COLUMN "public"."table_transient_data"."purpose" IS 'Purpose/context of this staged data.';



COMMENT ON COLUMN "public"."table_transient_data"."note_private" IS 'Private practice note (not synced to others).';



COMMENT ON COLUMN "public"."table_transient_data"."note_public" IS 'Public practice note (shared).';



COMMENT ON COLUMN "public"."table_transient_data"."recall_eval" IS 'Recall evaluation selection.';



COMMENT ON COLUMN "public"."table_transient_data"."practiced" IS 'Timestamp when practiced (staged).';



COMMENT ON COLUMN "public"."table_transient_data"."quality" IS 'Quality rating (staged).';



COMMENT ON COLUMN "public"."table_transient_data"."easiness" IS 'Easiness factor (staged).';



COMMENT ON COLUMN "public"."table_transient_data"."difficulty" IS 'Difficulty rating (staged).';



COMMENT ON COLUMN "public"."table_transient_data"."interval" IS 'Interval (staged).';



COMMENT ON COLUMN "public"."table_transient_data"."step" IS 'Learning step (staged).';



COMMENT ON COLUMN "public"."table_transient_data"."repetitions" IS 'Repetitions count (staged).';



COMMENT ON COLUMN "public"."table_transient_data"."due" IS 'Next due date (staged).';



COMMENT ON COLUMN "public"."table_transient_data"."backup_practiced" IS 'Backup practiced timestamp.';



COMMENT ON COLUMN "public"."table_transient_data"."goal" IS 'Practice goal (staged).';



COMMENT ON COLUMN "public"."table_transient_data"."technique" IS 'Technique note (staged).';



COMMENT ON COLUMN "public"."table_transient_data"."stability" IS 'Memory stability (staged).';



COMMENT ON COLUMN "public"."table_transient_data"."state" IS 'Scheduler state (staged).';



COMMENT ON COLUMN "public"."table_transient_data"."sync_version" IS 'Sync version for conflict resolution.';



COMMENT ON COLUMN "public"."table_transient_data"."last_modified_at" IS 'Timestamp of last modification.';



COMMENT ON COLUMN "public"."table_transient_data"."device_id" IS 'Device that last modified this record.';



CREATE OR REPLACE VIEW "public"."practice_list_staged" WITH ("security_invoker"='on') AS
 SELECT "tune"."id",
    COALESCE("tune_override"."title", "tune"."title") AS "title",
    COALESCE("tune_override"."type", "tune"."type") AS "type",
    COALESCE("tune_override"."structure", "tune"."structure") AS "structure",
    COALESCE("tune_override"."mode", "tune"."mode") AS "mode",
    COALESCE("tune_override"."incipit", "tune"."incipit") AS "incipit",
    COALESCE("tune_override"."genre", "tune"."genre") AS "genre",
    "tune"."private_for",
    "tune"."deleted",
    "repertoire_tune"."learned",
    COALESCE("td"."goal", COALESCE("pr"."goal", 'recall'::"text")) AS "goal",
    "repertoire_tune"."scheduled",
    "repertoire"."user_ref",
    "repertoire"."repertoire_id" AS "playlist_id",
    "instrument"."instrument",
    "repertoire_tune"."deleted" AS "playlist_deleted",
    COALESCE("td"."state", "pr"."state") AS "latest_state",
    COALESCE("td"."practiced", "pr"."practiced") AS "latest_practiced",
    COALESCE("td"."quality", "pr"."quality") AS "latest_quality",
    COALESCE("td"."easiness", "pr"."easiness") AS "latest_easiness",
    COALESCE("td"."difficulty", "pr"."difficulty") AS "latest_difficulty",
    COALESCE("td"."stability", "pr"."stability") AS "latest_stability",
    COALESCE("td"."interval", "pr"."interval") AS "latest_interval",
    COALESCE("td"."step", "pr"."step") AS "latest_step",
    COALESCE("td"."repetitions", "pr"."repetitions") AS "latest_repetitions",
    COALESCE("td"."due", "pr"."due") AS "latest_due",
    COALESCE("td"."backup_practiced", "pr"."backup_practiced") AS "latest_backup_practiced",
    COALESCE("td"."goal", "pr"."goal") AS "latest_goal",
    COALESCE("td"."technique", "pr"."technique") AS "latest_technique",
    ( SELECT "string_agg"("tag_1"."tag_text", ' '::"text") AS "string_agg"
           FROM "public"."tag" "tag_1"
          WHERE (("tag_1"."tune_ref" = "tune"."id") AND ("tag_1"."user_ref" = "repertoire"."user_ref"))) AS "tags",
    "td"."purpose",
    "td"."note_private",
    "td"."note_public",
    "td"."recall_eval",
    ( SELECT "string_agg"("note"."note_text", ' '::"text") AS "string_agg"
           FROM "public"."note"
          WHERE (("note"."tune_ref" = "tune"."id") AND ("note"."user_ref" = "repertoire"."user_ref"))) AS "notes",
    ( SELECT "ref"."url"
           FROM "public"."reference" "ref"
          WHERE (("ref"."tune_ref" = "tune"."id") AND ("ref"."user_ref" = "repertoire"."user_ref") AND ("ref"."favorite" = true))
         LIMIT 1) AS "favorite_url",
        CASE
            WHEN ("tune_override"."user_ref" = "repertoire"."user_ref") THEN 1
            ELSE 0
        END AS "has_override",
        CASE
            WHEN (("td"."practiced" IS NOT NULL) OR ("td"."quality" IS NOT NULL) OR ("td"."easiness" IS NOT NULL) OR ("td"."difficulty" IS NOT NULL) OR ("td"."interval" IS NOT NULL) OR ("td"."step" IS NOT NULL) OR ("td"."repetitions" IS NOT NULL) OR ("td"."due" IS NOT NULL) OR ("td"."backup_practiced" IS NOT NULL) OR ("td"."goal" IS NOT NULL) OR ("td"."technique" IS NOT NULL) OR ("td"."stability" IS NOT NULL)) THEN 1
            ELSE 0
        END AS "has_staged",
    COALESCE("tune_override"."composer", "tune"."composer") AS "composer",
    COALESCE("tune_override"."artist", "tune"."artist") AS "artist",
    COALESCE("tune_override"."id_foreign", "tune"."id_foreign") AS "id_foreign",
    COALESCE("tune_override"."release_year", "tune"."release_year") AS "release_year"
   FROM ((((((("public"."tune"
     LEFT JOIN "public"."repertoire_tune" ON (("repertoire_tune"."tune_ref" = "tune"."id")))
     LEFT JOIN "public"."repertoire" ON (("repertoire"."repertoire_id" = "repertoire_tune"."repertoire_ref")))
     LEFT JOIN "public"."tune_override" ON (("tune_override"."tune_ref" = "tune"."id")))
     LEFT JOIN "public"."instrument" ON (("instrument"."id" = "repertoire"."instrument_ref")))
     LEFT JOIN ( SELECT DISTINCT ON ("pr_1"."tune_ref", "pr_1"."repertoire_ref") "pr_1"."id",
            "pr_1"."repertoire_ref" AS "playlist_ref",
            "pr_1"."tune_ref",
            "pr_1"."practiced",
            "pr_1"."quality",
            "pr_1"."easiness",
            "pr_1"."difficulty",
            "pr_1"."stability",
            "pr_1"."interval",
            "pr_1"."step",
            "pr_1"."repetitions",
            "pr_1"."lapses",
            "pr_1"."elapsed_days",
            "pr_1"."state",
            "pr_1"."due",
            "pr_1"."backup_practiced",
            "pr_1"."goal",
            "pr_1"."technique",
            "pr_1"."sync_version",
            "pr_1"."last_modified_at",
            "pr_1"."device_id"
           FROM "public"."practice_record" "pr_1"
          ORDER BY "pr_1"."tune_ref", "pr_1"."repertoire_ref", "pr_1"."id" DESC) "pr" ON ((("pr"."tune_ref" = "tune"."id") AND ("pr"."playlist_ref" = "repertoire_tune"."repertoire_ref"))))
     LEFT JOIN "public"."tag" ON (("tag"."tune_ref" = "tune"."id")))
     LEFT JOIN "public"."table_transient_data" "td" ON ((("td"."tune_id" = "tune"."id") AND ("td"."repertoire_id" = "repertoire_tune"."repertoire_ref"))))
  WHERE (("tune_override"."user_ref" IS NULL) OR ("tune_override"."user_ref" = "repertoire"."user_ref"));


ALTER VIEW "public"."practice_list_staged" OWNER TO "postgres";


COMMENT ON VIEW "public"."practice_list_staged" IS 'View of playlist tunes enriched with overrides, practice history, and staged data for UI grids.';



COMMENT ON COLUMN "public"."practice_list_staged"."id" IS 'Unique tune ID for this row.';



COMMENT ON COLUMN "public"."practice_list_staged"."title" IS 'Tune title (uses any user override).';



COMMENT ON COLUMN "public"."practice_list_staged"."type" IS 'Tune type classification (reel, jig, hornpipe, etc.).';



COMMENT ON COLUMN "public"."practice_list_staged"."structure" IS 'Tune structure shorthand (e.g. AABB).';



COMMENT ON COLUMN "public"."practice_list_staged"."mode" IS 'Musical mode of the tune.';



COMMENT ON COLUMN "public"."practice_list_staged"."incipit" IS 'Opening notes or incipit text for the tune.';



COMMENT ON COLUMN "public"."practice_list_staged"."genre" IS 'Genre classification for the tune.';



COMMENT ON COLUMN "public"."practice_list_staged"."learned" IS 'Timestamp when the tune was marked learned.';



COMMENT ON COLUMN "public"."practice_list_staged"."goal" IS 'Practice goal for this tune in the playlist.';



COMMENT ON COLUMN "public"."practice_list_staged"."scheduled" IS 'Manual schedule override for the next review.';



COMMENT ON COLUMN "public"."practice_list_staged"."instrument" IS 'Instrument name for the playlist.';



COMMENT ON COLUMN "public"."practice_list_staged"."latest_state" IS 'Latest scheduler state (new/learning/review/relearning).';



COMMENT ON COLUMN "public"."practice_list_staged"."latest_practiced" IS 'Most recent practice timestamp.';



COMMENT ON COLUMN "public"."practice_list_staged"."latest_quality" IS 'Most recent quality rating.';



COMMENT ON COLUMN "public"."practice_list_staged"."latest_easiness" IS 'Most recent easiness value.';



COMMENT ON COLUMN "public"."practice_list_staged"."latest_difficulty" IS 'Most recent difficulty value.';



COMMENT ON COLUMN "public"."practice_list_staged"."latest_stability" IS 'Most recent stability value.';



COMMENT ON COLUMN "public"."practice_list_staged"."latest_interval" IS 'Most recent interval (days).';



COMMENT ON COLUMN "public"."practice_list_staged"."latest_step" IS 'Most recent learning step.';



COMMENT ON COLUMN "public"."practice_list_staged"."latest_repetitions" IS 'Most recent repetitions count.';



COMMENT ON COLUMN "public"."practice_list_staged"."latest_due" IS 'Next due date after latest review.';



COMMENT ON COLUMN "public"."practice_list_staged"."tags" IS 'Tags applied to the tune.';



COMMENT ON COLUMN "public"."practice_list_staged"."note_private" IS 'Private practice note for this tune.';



COMMENT ON COLUMN "public"."practice_list_staged"."note_public" IS 'Public practice note for this tune.';



COMMENT ON COLUMN "public"."practice_list_staged"."recall_eval" IS 'Latest recall evaluation selection.';



COMMENT ON COLUMN "public"."practice_list_staged"."favorite_url" IS 'Favorite reference URL for the tune.';



COMMENT ON COLUMN "public"."practice_list_staged"."has_override" IS 'Whether the tune has user-specific overrides.';



COMMENT ON COLUMN "public"."practice_list_staged"."has_staged" IS 'Whether staged changes are present for this tune.';



COMMENT ON COLUMN "public"."practice_list_staged"."composer" IS 'Composer name (classical/choral).';



COMMENT ON COLUMN "public"."practice_list_staged"."artist" IS 'Artist name (pop/rock/jazz).';



COMMENT ON COLUMN "public"."practice_list_staged"."id_foreign" IS 'External tune identifier (e.g. irishtune.info, Spotify).';



COMMENT ON COLUMN "public"."practice_list_staged"."release_year" IS 'Release year for the recording or tune.';



CREATE TABLE IF NOT EXISTS "public"."prefs_scheduling_options" (
    "user_id" "uuid" NOT NULL,
    "acceptable_delinquency_window" integer DEFAULT 21 NOT NULL,
    "min_reviews_per_day" integer,
    "max_reviews_per_day" integer,
    "days_per_week" integer,
    "weekly_rules" "text",
    "exceptions" "text",
    "sync_version" integer DEFAULT 1 NOT NULL,
    "last_modified_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "device_id" "text",
    "auto_schedule_new" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."prefs_scheduling_options" OWNER TO "postgres";


COMMENT ON TABLE "public"."prefs_scheduling_options" IS 'User scheduling preferences for practice queue generation.';



COMMENT ON COLUMN "public"."prefs_scheduling_options"."user_id" IS 'User ID who owns these preferences.';



COMMENT ON COLUMN "public"."prefs_scheduling_options"."acceptable_delinquency_window" IS 'Days allowed before tune is considered delinquent.';



COMMENT ON COLUMN "public"."prefs_scheduling_options"."min_reviews_per_day" IS 'Minimum reviews per day target.';



COMMENT ON COLUMN "public"."prefs_scheduling_options"."max_reviews_per_day" IS 'Maximum reviews per day cap.';



COMMENT ON COLUMN "public"."prefs_scheduling_options"."days_per_week" IS 'Number of days per week to practice.';



COMMENT ON COLUMN "public"."prefs_scheduling_options"."weekly_rules" IS 'Weekly scheduling rules (JSON format).';



COMMENT ON COLUMN "public"."prefs_scheduling_options"."exceptions" IS 'Schedule exceptions/off-days (JSON format).';



COMMENT ON COLUMN "public"."prefs_scheduling_options"."sync_version" IS 'Sync version for conflict resolution.';



COMMENT ON COLUMN "public"."prefs_scheduling_options"."last_modified_at" IS 'Timestamp of last modification.';



COMMENT ON COLUMN "public"."prefs_scheduling_options"."device_id" IS 'Device that last modified this record.';



COMMENT ON COLUMN "public"."prefs_scheduling_options"."auto_schedule_new" IS 'Include never-practiced tunes in daily practice queue (Q3 bucket). Default: true';



CREATE TABLE IF NOT EXISTS "public"."prefs_spaced_repetition" (
    "user_id" "uuid" NOT NULL,
    "alg_type" "text" NOT NULL,
    "fsrs_weights" "text",
    "request_retention" real,
    "maximum_interval" integer,
    "learning_steps" "text",
    "relearning_steps" "text",
    "enable_fuzzing" boolean,
    "sync_version" integer DEFAULT 1 NOT NULL,
    "last_modified_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "device_id" "text",
    CONSTRAINT "check_name" CHECK (("alg_type" = ANY (ARRAY['SM2'::"text", 'FSRS'::"text"])))
);


ALTER TABLE "public"."prefs_spaced_repetition" OWNER TO "postgres";


COMMENT ON TABLE "public"."prefs_spaced_repetition" IS 'User spaced repetition configuration (FSRS/SM-2).';



COMMENT ON COLUMN "public"."prefs_spaced_repetition"."user_id" IS 'User ID who owns these preferences.';



COMMENT ON COLUMN "public"."prefs_spaced_repetition"."alg_type" IS 'Algorithm type (SM2 or FSRS).';



COMMENT ON COLUMN "public"."prefs_spaced_repetition"."fsrs_weights" IS 'FSRS algorithm weights (JSON format).';



COMMENT ON COLUMN "public"."prefs_spaced_repetition"."request_retention" IS 'Target retention rate (FSRS).';



COMMENT ON COLUMN "public"."prefs_spaced_repetition"."maximum_interval" IS 'Maximum interval in days.';



COMMENT ON COLUMN "public"."prefs_spaced_repetition"."learning_steps" IS 'Learning steps configuration (JSON format).';



COMMENT ON COLUMN "public"."prefs_spaced_repetition"."relearning_steps" IS 'Relearning steps configuration (JSON format).';



COMMENT ON COLUMN "public"."prefs_spaced_repetition"."enable_fuzzing" IS 'Whether to enable interval fuzzing.';



COMMENT ON COLUMN "public"."prefs_spaced_repetition"."sync_version" IS 'Sync version for conflict resolution.';



COMMENT ON COLUMN "public"."prefs_spaced_repetition"."last_modified_at" IS 'Timestamp of last modification.';



COMMENT ON COLUMN "public"."prefs_spaced_repetition"."device_id" IS 'Device that last modified this record.';



CREATE TABLE IF NOT EXISTS "public"."sync_change_log" (
    "table_name" "text" NOT NULL,
    "changed_at" "text" NOT NULL
);


ALTER TABLE "public"."sync_change_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tab_group_main_state" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "which_tab" "text" DEFAULT 'practice'::"text",
    "repertoire_id" "uuid",
    "tab_spec" "text",
    "practice_show_submitted" integer DEFAULT 0,
    "practice_mode_flashcard" integer DEFAULT 0,
    "sidebar_dock_position" "text" DEFAULT 'left'::"text",
    "sync_version" integer DEFAULT 1 NOT NULL,
    "last_modified_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "device_id" "text",
    CONSTRAINT "check_name" CHECK ((("which_tab" = ANY (ARRAY['scheduled'::"text", 'repertoire'::"text", 'catalog'::"text", 'analysis'::"text"])) OR ("which_tab" IS NULL)))
);


ALTER TABLE "public"."tab_group_main_state" OWNER TO "postgres";


COMMENT ON TABLE "public"."tab_group_main_state" IS 'Persisted UI state for main tab selections.';



COMMENT ON COLUMN "public"."tab_group_main_state"."id" IS 'Primary key for this state record.';



COMMENT ON COLUMN "public"."tab_group_main_state"."user_id" IS 'User ID who owns this state.';



COMMENT ON COLUMN "public"."tab_group_main_state"."which_tab" IS 'Currently selected main tab (practice/repertoire/catalog/analysis).';



COMMENT ON COLUMN "public"."tab_group_main_state"."repertoire_id" IS 'Currently selected playlist.';



COMMENT ON COLUMN "public"."tab_group_main_state"."tab_spec" IS 'Additional tab specification.';



COMMENT ON COLUMN "public"."tab_group_main_state"."practice_show_submitted" IS 'Whether to show submitted items in practice view.';



COMMENT ON COLUMN "public"."tab_group_main_state"."practice_mode_flashcard" IS 'Whether practice mode is flashcard (1) or list (0).';



COMMENT ON COLUMN "public"."tab_group_main_state"."sidebar_dock_position" IS 'Sidebar position (left/right/hidden).';



COMMENT ON COLUMN "public"."tab_group_main_state"."sync_version" IS 'Sync version for conflict resolution.';



COMMENT ON COLUMN "public"."tab_group_main_state"."last_modified_at" IS 'Timestamp of last modification.';



COMMENT ON COLUMN "public"."tab_group_main_state"."device_id" IS 'Device that last modified this record.';



CREATE TABLE IF NOT EXISTS "public"."table_state" (
    "user_id" "uuid" NOT NULL,
    "screen_size" "text" NOT NULL,
    "purpose" "text" NOT NULL,
    "repertoire_id" "uuid" NOT NULL,
    "settings" "text",
    "current_tune" "uuid",
    "sync_version" integer DEFAULT 1 NOT NULL,
    "last_modified_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "device_id" "text",
    CONSTRAINT "purpose_check" CHECK (("purpose" = ANY (ARRAY['practice'::"text", 'repertoire'::"text", 'catalog'::"text", 'analysis'::"text"]))),
    CONSTRAINT "screen_size_check" CHECK (("screen_size" = ANY (ARRAY['small'::"text", 'full'::"text"])))
);


ALTER TABLE "public"."table_state" OWNER TO "postgres";


COMMENT ON TABLE "public"."table_state" IS 'Persisted UI table state (columns, sorting, selection).';



COMMENT ON COLUMN "public"."table_state"."user_id" IS 'User ID who owns this table state.';



COMMENT ON COLUMN "public"."table_state"."screen_size" IS 'Screen size category (small/full).';



COMMENT ON COLUMN "public"."table_state"."purpose" IS 'Purpose/view this state applies to (practice/repertoire/catalog/analysis).';



COMMENT ON COLUMN "public"."table_state"."repertoire_id" IS 'Reference to the playlist.';



COMMENT ON COLUMN "public"."table_state"."settings" IS 'Table settings (column order, sorting, filters) in JSON format.';



COMMENT ON COLUMN "public"."table_state"."current_tune" IS 'Currently selected tune ID.';



COMMENT ON COLUMN "public"."table_state"."sync_version" IS 'Sync version for conflict resolution.';



COMMENT ON COLUMN "public"."table_state"."last_modified_at" IS 'Timestamp of last modification.';



COMMENT ON COLUMN "public"."table_state"."device_id" IS 'Device that last modified this record.';



CREATE TABLE IF NOT EXISTS "public"."tune_type" (
    "id" "text" NOT NULL,
    "name" "text",
    "rhythm" "text",
    "description" "text"
);


ALTER TABLE "public"."tune_type" OWNER TO "postgres";


COMMENT ON TABLE "public"."tune_type" IS 'Reference list of tune types (reel, jig, etc.).';



COMMENT ON COLUMN "public"."tune_type"."id" IS 'Primary key (tune type identifier).';



COMMENT ON COLUMN "public"."tune_type"."name" IS 'Tune type name (reel, jig, hornpipe, etc.).';



COMMENT ON COLUMN "public"."tune_type"."rhythm" IS 'Rhythmic pattern of the tune type.';



COMMENT ON COLUMN "public"."tune_type"."description" IS 'Description of the tune type.';



CREATE TABLE IF NOT EXISTS "public"."user_genre_selection" (
    "user_id" "uuid" NOT NULL,
    "genre_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_modified_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sync_version" integer DEFAULT 1 NOT NULL,
    "device_id" "text"
);

ALTER TABLE ONLY "public"."user_genre_selection" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_genre_selection" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profile" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text",
    "email" "text",
    "sr_alg_type" "text",
    "phone" "text",
    "phone_verified" timestamp without time zone,
    "acceptable_delinquency_window" integer DEFAULT 21,
    "avatar_url" "text",
    "deleted" boolean DEFAULT false NOT NULL,
    "sync_version" integer DEFAULT 1 NOT NULL,
    "last_modified_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "device_id" "text"
);

ALTER TABLE ONLY "public"."user_profile" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profile" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_profile" IS 'User profile data synced from Supabase auth.';



COMMENT ON COLUMN "public"."user_profile"."id" IS 'Primary key for the user profile.';



COMMENT ON COLUMN "public"."user_profile"."name" IS 'User display name.';



COMMENT ON COLUMN "public"."user_profile"."email" IS 'User email address.';



COMMENT ON COLUMN "public"."user_profile"."sr_alg_type" IS 'Preferred spaced repetition algorithm (SM2/FSRS).';



COMMENT ON COLUMN "public"."user_profile"."phone" IS 'User phone number.';



COMMENT ON COLUMN "public"."user_profile"."phone_verified" IS 'Timestamp when phone was verified.';



COMMENT ON COLUMN "public"."user_profile"."acceptable_delinquency_window" IS 'User default delinquency window in days.';



COMMENT ON COLUMN "public"."user_profile"."avatar_url" IS 'URL to user avatar/profile picture.';



COMMENT ON COLUMN "public"."user_profile"."deleted" IS 'Soft-delete flag for the user profile.';



COMMENT ON COLUMN "public"."user_profile"."sync_version" IS 'Sync version for conflict resolution.';



COMMENT ON COLUMN "public"."user_profile"."last_modified_at" IS 'Timestamp of last modification.';



COMMENT ON COLUMN "public"."user_profile"."device_id" IS 'Device that last modified this record.';



CREATE OR REPLACE VIEW "public"."view_daily_practice_queue_readable" WITH ("security_invoker"='true') AS
 SELECT "dpq"."id" AS "queue_id",
    COALESCE("up"."name", "up"."email") AS "user_name",
    "i"."instrument" AS "playlist_instrument",
    COALESCE("tune_override"."title", "tune"."title") AS "tune_title",
    "dpq"."queue_date",
    "dpq"."window_start_utc",
    "dpq"."window_end_utc",
    "dpq"."bucket",
    "dpq"."order_index",
    "dpq"."completed_at",
    "dpq"."active",
    "dpq"."mode",
    "dpq"."snapshot_coalesced_ts",
    "dpq"."scheduled_snapshot",
    "dpq"."generated_at",
    "dpq"."user_ref",
    "dpq"."repertoire_ref",
    "dpq"."tune_ref"
   FROM ((((("public"."daily_practice_queue" "dpq"
     LEFT JOIN "public"."user_profile" "up" ON (("up"."id" = "dpq"."user_ref")))
     LEFT JOIN "public"."repertoire" "r" ON (("r"."repertoire_id" = "dpq"."repertoire_ref")))
     LEFT JOIN "public"."instrument" "i" ON (("i"."id" = "r"."instrument_ref")))
     LEFT JOIN "public"."tune" ON (("tune"."id" = "dpq"."tune_ref")))
     LEFT JOIN "public"."tune_override" ON ((("tune_override"."tune_ref" = "tune"."id") AND ("tune_override"."user_ref" = "dpq"."user_ref"))))
  ORDER BY "dpq"."queue_date" DESC, "dpq"."bucket", "dpq"."order_index";


ALTER VIEW "public"."view_daily_practice_queue_readable" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_playlist_joined" WITH ("security_invoker"='on') AS
 SELECT "p"."repertoire_id" AS "playlist_id",
    "p"."user_ref",
    "p"."deleted" AS "playlist_deleted",
    "p"."instrument_ref",
    "i"."private_to_user",
    "i"."instrument",
    "i"."description",
    "i"."genre_default",
    "i"."deleted" AS "instrument_deleted"
   FROM ("public"."repertoire" "p"
     JOIN "public"."instrument" "i" ON (("p"."instrument_ref" = "i"."id")));


ALTER VIEW "public"."view_playlist_joined" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_practice_record_readable" WITH ("security_invoker"='true') AS
 SELECT COALESCE("up"."name", "up"."email") AS "user_name",
    COALESCE("tune_override"."title", "tune"."title") AS "tune_title",
    "pr"."tune_ref",
    "i"."instrument" AS "playlist_instrument",
    "pr"."repertoire_ref",
    "pr"."practiced",
    "pr"."quality",
        CASE "pr"."quality"
            WHEN 1 THEN 'Again'::"text"
            WHEN 2 THEN 'Hard'::"text"
            WHEN 3 THEN 'Good'::"text"
            WHEN 4 THEN 'Easy'::"text"
            ELSE 'Unknown'::"text"
        END AS "quality_label",
    "pr"."easiness",
    "pr"."difficulty",
    "pr"."stability",
    "pr"."interval",
    "pr"."step",
    "pr"."repetitions",
    "pr"."lapses",
    "pr"."elapsed_days",
    "pr"."state",
        CASE "pr"."state"
            WHEN 0 THEN 'New'::"text"
            WHEN 1 THEN 'Learning'::"text"
            WHEN 2 THEN 'Review'::"text"
            WHEN 3 THEN 'Relearning'::"text"
            ELSE 'Unknown'::"text"
        END AS "state_label",
    "pr"."due",
    "pr"."backup_practiced",
    "pr"."goal",
    "pr"."technique",
    "pr"."sync_version",
    "pr"."last_modified_at",
    "pr"."device_id",
    "pr"."id"
   FROM ((((("public"."practice_record" "pr"
     LEFT JOIN "public"."repertoire" "r" ON (("r"."repertoire_id" = "pr"."repertoire_ref")))
     LEFT JOIN "public"."user_profile" "up" ON (("up"."id" = "r"."user_ref")))
     LEFT JOIN "public"."tune" ON (("tune"."id" = "pr"."tune_ref")))
     LEFT JOIN "public"."tune_override" ON ((("tune_override"."tune_ref" = "tune"."id") AND ("tune_override"."user_ref" = "r"."user_ref"))))
     LEFT JOIN "public"."instrument" "i" ON (("i"."id" = "r"."instrument_ref")))
  ORDER BY "pr"."practiced" DESC;


ALTER VIEW "public"."view_practice_record_readable" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_transient_data_readable" WITH ("security_invoker"='true') AS
 SELECT COALESCE("up"."name", "up"."email") AS "user_name",
    "ttd"."user_id",
    COALESCE("tune_override"."title", "tune"."title") AS "tune_title",
    "ttd"."tune_id",
    "i"."instrument" AS "playlist_instrument",
    "ttd"."repertoire_id",
    "ttd"."purpose",
    "ttd"."note_private",
    "ttd"."note_public",
    "ttd"."recall_eval",
    "ttd"."practiced",
    "ttd"."quality",
    "ttd"."easiness",
    "ttd"."difficulty",
    "ttd"."interval",
    "ttd"."step",
    "ttd"."repetitions",
    "ttd"."due",
    "ttd"."backup_practiced",
    "ttd"."goal",
    "ttd"."technique",
    "ttd"."stability",
    "ttd"."state",
    "ttd"."sync_version",
    "ttd"."last_modified_at",
    "ttd"."device_id"
   FROM ((((("public"."table_transient_data" "ttd"
     LEFT JOIN "public"."user_profile" "up" ON (("up"."id" = "ttd"."user_id")))
     LEFT JOIN "public"."tune" ON (("tune"."id" = "ttd"."tune_id")))
     LEFT JOIN "public"."tune_override" ON ((("tune_override"."tune_ref" = "tune"."id") AND ("tune_override"."user_ref" = "ttd"."user_id"))))
     LEFT JOIN "public"."repertoire" "r" ON (("r"."repertoire_id" = "ttd"."repertoire_id")))
     LEFT JOIN "public"."instrument" "i" ON (("i"."id" = "r"."instrument_ref")))
  ORDER BY "ttd"."last_modified_at" DESC;


ALTER VIEW "public"."view_transient_data_readable" OWNER TO "postgres";


ALTER TABLE ONLY "public"."daily_practice_queue"
    ADD CONSTRAINT "daily_practice_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_practice_queue"
    ADD CONSTRAINT "daily_practice_queue_user_ref_playlist_ref_window_start_utc_key" UNIQUE ("user_ref", "repertoire_ref", "window_start_utc", "tune_ref");



ALTER TABLE ONLY "public"."genre"
    ADD CONSTRAINT "genre_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."genre_tune_type"
    ADD CONSTRAINT "genre_tune_type_pkey" PRIMARY KEY ("genre_id", "tune_type_id");



ALTER TABLE ONLY "public"."instrument"
    ADD CONSTRAINT "instrument_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."instrument"
    ADD CONSTRAINT "instrument_private_to_user_instrument_key" UNIQUE ("private_to_user", "instrument");



ALTER TABLE ONLY "public"."note"
    ADD CONSTRAINT "note_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."repertoire"
    ADD CONSTRAINT "playlist_pkey" PRIMARY KEY ("repertoire_id");



ALTER TABLE ONLY "public"."repertoire_tune"
    ADD CONSTRAINT "playlist_tune_pkey" PRIMARY KEY ("repertoire_ref", "tune_ref");



ALTER TABLE ONLY "public"."plugin"
    ADD CONSTRAINT "plugin_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."practice_record"
    ADD CONSTRAINT "practice_record_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."practice_record"
    ADD CONSTRAINT "practice_record_tune_ref_playlist_ref_practiced_key" UNIQUE ("tune_ref", "repertoire_ref", "practiced");



ALTER TABLE ONLY "public"."prefs_scheduling_options"
    ADD CONSTRAINT "prefs_scheduling_options_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."prefs_spaced_repetition"
    ADD CONSTRAINT "prefs_spaced_repetition_pkey" PRIMARY KEY ("user_id", "alg_type");



ALTER TABLE ONLY "public"."reference"
    ADD CONSTRAINT "reference_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sync_change_log"
    ADD CONSTRAINT "sync_change_log_pkey" PRIMARY KEY ("table_name");



ALTER TABLE ONLY "public"."tab_group_main_state"
    ADD CONSTRAINT "tab_group_main_state_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."table_state"
    ADD CONSTRAINT "table_state_pkey" PRIMARY KEY ("user_id", "screen_size", "purpose", "repertoire_id");



ALTER TABLE ONLY "public"."table_transient_data"
    ADD CONSTRAINT "table_transient_data_pkey" PRIMARY KEY ("tune_id", "user_id", "repertoire_id");



ALTER TABLE ONLY "public"."tag"
    ADD CONSTRAINT "tag_pkey" PRIMARY KEY ("tag_id");



ALTER TABLE ONLY "public"."tag"
    ADD CONSTRAINT "tag_user_ref_tune_ref_tag_text_key" UNIQUE ("user_ref", "tune_ref", "tag_text");



ALTER TABLE ONLY "public"."tune_override"
    ADD CONSTRAINT "tune_override_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tune"
    ADD CONSTRAINT "tune_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tune_type"
    ADD CONSTRAINT "tune_type_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_genre_selection"
    ADD CONSTRAINT "user_genre_selection_pkey" PRIMARY KEY ("user_id", "genre_id");



ALTER TABLE ONLY "public"."user_profile"
    ADD CONSTRAINT "user_profile_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_instrument_instrument" ON "public"."instrument" USING "btree" ("instrument");



CREATE INDEX "idx_instrument_private_to_user" ON "public"."instrument" USING "btree" ("private_to_user");



CREATE INDEX "idx_note_last_modified_at" ON "public"."note" USING "btree" ("last_modified_at");



CREATE INDEX "idx_note_tune_playlist" ON "public"."note" USING "btree" ("tune_ref", "repertoire_ref");



CREATE INDEX "idx_note_tune_playlist_user_public" ON "public"."note" USING "btree" ("tune_ref", "repertoire_ref", "user_ref", "public");



CREATE INDEX "idx_note_tune_user" ON "public"."note" USING "btree" ("tune_ref", "user_ref");



CREATE INDEX "idx_plugin_public" ON "public"."plugin" USING "btree" ("is_public");



CREATE INDEX "idx_plugin_user_ref" ON "public"."plugin" USING "btree" ("user_ref");



CREATE INDEX "idx_practice_record_id" ON "public"."practice_record" USING "btree" ("id" DESC);



CREATE INDEX "idx_practice_record_practiced" ON "public"."practice_record" USING "btree" ("practiced" DESC);



CREATE INDEX "idx_practice_record_tune_playlist_practiced" ON "public"."practice_record" USING "btree" ("tune_ref", "repertoire_ref", "practiced" DESC);



CREATE INDEX "idx_queue_generated_at" ON "public"."daily_practice_queue" USING "btree" ("generated_at");



CREATE INDEX "idx_queue_user_playlist_active" ON "public"."daily_practice_queue" USING "btree" ("user_ref", "repertoire_ref", "active");



CREATE INDEX "idx_queue_user_playlist_bucket" ON "public"."daily_practice_queue" USING "btree" ("user_ref", "repertoire_ref", "bucket");



CREATE INDEX "idx_queue_user_playlist_window" ON "public"."daily_practice_queue" USING "btree" ("user_ref", "repertoire_ref", "window_start_utc");



CREATE INDEX "idx_reference_tune_public" ON "public"."reference" USING "btree" ("tune_ref", "public");



CREATE INDEX "idx_reference_tune_user_ref" ON "public"."reference" USING "btree" ("tune_ref", "user_ref");



CREATE INDEX "idx_reference_user_tune_public" ON "public"."reference" USING "btree" ("user_ref", "tune_ref", "public");



CREATE INDEX "idx_sync_change_log_changed_at" ON "public"."sync_change_log" USING "btree" ("changed_at");



CREATE INDEX "idx_tag_user_ref_tag_text" ON "public"."tag" USING "btree" ("user_ref", "tag_text");



CREATE INDEX "idx_tag_user_ref_tune_ref" ON "public"."tag" USING "btree" ("user_ref", "tune_ref");



CREATE INDEX "idx_tune_genre" ON "public"."tune" USING "btree" ("genre") WHERE ("genre" IS NOT NULL);



CREATE INDEX "idx_user_genre_selection_genre_id" ON "public"."user_genre_selection" USING "btree" ("genre_id");



CREATE INDEX "idx_user_genre_selection_user_id" ON "public"."user_genre_selection" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "trg_daily_practice_queue_sync" AFTER INSERT OR DELETE OR UPDATE ON "public"."daily_practice_queue" FOR EACH ROW EXECUTE FUNCTION "public"."sync_change_log_update"();



CREATE OR REPLACE TRIGGER "trg_genre_sync" AFTER INSERT OR DELETE OR UPDATE ON "public"."genre" FOR EACH ROW EXECUTE FUNCTION "public"."sync_change_log_update"();



CREATE OR REPLACE TRIGGER "trg_genre_tune_type_sync" AFTER INSERT OR DELETE OR UPDATE ON "public"."genre_tune_type" FOR EACH ROW EXECUTE FUNCTION "public"."sync_change_log_update"();



CREATE OR REPLACE TRIGGER "trg_instrument_sync" AFTER INSERT OR DELETE OR UPDATE ON "public"."instrument" FOR EACH ROW EXECUTE FUNCTION "public"."sync_change_log_update"();



CREATE OR REPLACE TRIGGER "trg_note_sync" AFTER INSERT OR DELETE OR UPDATE ON "public"."note" FOR EACH ROW EXECUTE FUNCTION "public"."sync_change_log_update"();



CREATE OR REPLACE TRIGGER "trg_playlist_sync" AFTER INSERT OR DELETE OR UPDATE ON "public"."repertoire" FOR EACH ROW EXECUTE FUNCTION "public"."sync_change_log_update"();



CREATE OR REPLACE TRIGGER "trg_playlist_tune_sync" AFTER INSERT OR DELETE OR UPDATE ON "public"."repertoire_tune" FOR EACH ROW EXECUTE FUNCTION "public"."sync_change_log_update"();



CREATE OR REPLACE TRIGGER "trg_practice_record_sync" AFTER INSERT OR DELETE OR UPDATE ON "public"."practice_record" FOR EACH ROW EXECUTE FUNCTION "public"."sync_change_log_update"();



CREATE OR REPLACE TRIGGER "trg_prefs_scheduling_options_sync" AFTER INSERT OR DELETE OR UPDATE ON "public"."prefs_scheduling_options" FOR EACH ROW EXECUTE FUNCTION "public"."sync_change_log_update"();



CREATE OR REPLACE TRIGGER "trg_prefs_spaced_repetition_sync" AFTER INSERT OR DELETE OR UPDATE ON "public"."prefs_spaced_repetition" FOR EACH ROW EXECUTE FUNCTION "public"."sync_change_log_update"();



CREATE OR REPLACE TRIGGER "trg_prevent_practice_record_delete" BEFORE DELETE ON "public"."practice_record" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_practice_record_delete"();



CREATE OR REPLACE TRIGGER "trg_reference_sync" AFTER INSERT OR DELETE OR UPDATE ON "public"."reference" FOR EACH ROW EXECUTE FUNCTION "public"."sync_change_log_update"();



CREATE OR REPLACE TRIGGER "trg_tab_group_main_state_sync" AFTER INSERT OR DELETE OR UPDATE ON "public"."tab_group_main_state" FOR EACH ROW EXECUTE FUNCTION "public"."sync_change_log_update"();



CREATE OR REPLACE TRIGGER "trg_table_state_sync" AFTER INSERT OR DELETE OR UPDATE ON "public"."table_state" FOR EACH ROW EXECUTE FUNCTION "public"."sync_change_log_update"();



CREATE OR REPLACE TRIGGER "trg_table_transient_data_sync" AFTER INSERT OR DELETE OR UPDATE ON "public"."table_transient_data" FOR EACH ROW EXECUTE FUNCTION "public"."sync_change_log_update"();



CREATE OR REPLACE TRIGGER "trg_tag_sync" AFTER INSERT OR DELETE OR UPDATE ON "public"."tag" FOR EACH ROW EXECUTE FUNCTION "public"."sync_change_log_update"();



CREATE OR REPLACE TRIGGER "trg_tune_override_sync" AFTER INSERT OR DELETE OR UPDATE ON "public"."tune_override" FOR EACH ROW EXECUTE FUNCTION "public"."sync_change_log_update"();



CREATE OR REPLACE TRIGGER "trg_tune_sync" AFTER INSERT OR DELETE OR UPDATE ON "public"."tune" FOR EACH ROW EXECUTE FUNCTION "public"."sync_change_log_update"();



CREATE OR REPLACE TRIGGER "trg_tune_type_sync" AFTER INSERT OR DELETE OR UPDATE ON "public"."tune_type" FOR EACH ROW EXECUTE FUNCTION "public"."sync_change_log_update"();



CREATE OR REPLACE TRIGGER "trg_user_profile_sync" AFTER INSERT OR DELETE OR UPDATE ON "public"."user_profile" FOR EACH ROW EXECUTE FUNCTION "public"."sync_change_log_update"();



ALTER TABLE ONLY "public"."daily_practice_queue"
    ADD CONSTRAINT "daily_practice_queue_user_ref_user_profile_fkey" FOREIGN KEY ("user_ref") REFERENCES "public"."user_profile"("id");



ALTER TABLE ONLY "public"."genre_tune_type"
    ADD CONSTRAINT "genre_tune_type_genre_id_fkey" FOREIGN KEY ("genre_id") REFERENCES "public"."genre"("id");



ALTER TABLE ONLY "public"."genre_tune_type"
    ADD CONSTRAINT "genre_tune_type_tune_type_id_fkey" FOREIGN KEY ("tune_type_id") REFERENCES "public"."tune_type"("id");



ALTER TABLE ONLY "public"."instrument"
    ADD CONSTRAINT "instrument_private_to_user_user_profile_fkey" FOREIGN KEY ("private_to_user") REFERENCES "public"."user_profile"("id");



ALTER TABLE ONLY "public"."note"
    ADD CONSTRAINT "note_playlist_ref_fkey" FOREIGN KEY ("repertoire_ref") REFERENCES "public"."repertoire"("repertoire_id");



ALTER TABLE ONLY "public"."note"
    ADD CONSTRAINT "note_tune_ref_fkey" FOREIGN KEY ("tune_ref") REFERENCES "public"."tune"("id");



ALTER TABLE ONLY "public"."note"
    ADD CONSTRAINT "note_user_ref_user_profile_fkey" FOREIGN KEY ("user_ref") REFERENCES "public"."user_profile"("id");



ALTER TABLE ONLY "public"."repertoire"
    ADD CONSTRAINT "playlist_genre_default_fkey" FOREIGN KEY ("genre_default") REFERENCES "public"."genre"("id");



ALTER TABLE ONLY "public"."repertoire_tune"
    ADD CONSTRAINT "playlist_tune_playlist_ref_fkey" FOREIGN KEY ("repertoire_ref") REFERENCES "public"."repertoire"("repertoire_id");



ALTER TABLE ONLY "public"."repertoire_tune"
    ADD CONSTRAINT "playlist_tune_tune_ref_fkey" FOREIGN KEY ("tune_ref") REFERENCES "public"."tune"("id");



ALTER TABLE ONLY "public"."repertoire"
    ADD CONSTRAINT "playlist_user_ref_user_profile_fkey" FOREIGN KEY ("user_ref") REFERENCES "public"."user_profile"("id");



ALTER TABLE ONLY "public"."plugin"
    ADD CONSTRAINT "plugin_user_ref_user_profile_fkey" FOREIGN KEY ("user_ref") REFERENCES "public"."user_profile"("id");



ALTER TABLE ONLY "public"."practice_record"
    ADD CONSTRAINT "practice_record_playlist_ref_fkey" FOREIGN KEY ("repertoire_ref") REFERENCES "public"."repertoire"("repertoire_id");



ALTER TABLE ONLY "public"."practice_record"
    ADD CONSTRAINT "practice_record_tune_ref_fkey" FOREIGN KEY ("tune_ref") REFERENCES "public"."tune"("id");



ALTER TABLE ONLY "public"."prefs_scheduling_options"
    ADD CONSTRAINT "prefs_scheduling_options_user_id_user_profile_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profile"("id");



ALTER TABLE ONLY "public"."prefs_spaced_repetition"
    ADD CONSTRAINT "prefs_spaced_repetition_user_id_user_profile_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profile"("id");



ALTER TABLE ONLY "public"."reference"
    ADD CONSTRAINT "reference_tune_ref_fkey" FOREIGN KEY ("tune_ref") REFERENCES "public"."tune"("id");



ALTER TABLE ONLY "public"."reference"
    ADD CONSTRAINT "reference_user_ref_user_profile_fkey" FOREIGN KEY ("user_ref") REFERENCES "public"."user_profile"("id");



ALTER TABLE ONLY "public"."tab_group_main_state"
    ADD CONSTRAINT "tab_group_main_state_user_id_user_profile_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profile"("id");



ALTER TABLE ONLY "public"."table_state"
    ADD CONSTRAINT "table_state_playlist_id_fkey" FOREIGN KEY ("repertoire_id") REFERENCES "public"."repertoire"("repertoire_id");



ALTER TABLE ONLY "public"."table_state"
    ADD CONSTRAINT "table_state_user_id_user_profile_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profile"("id");



ALTER TABLE ONLY "public"."table_transient_data"
    ADD CONSTRAINT "table_transient_data_playlist_id_fkey" FOREIGN KEY ("repertoire_id") REFERENCES "public"."repertoire"("repertoire_id");



ALTER TABLE ONLY "public"."table_transient_data"
    ADD CONSTRAINT "table_transient_data_tune_id_fkey" FOREIGN KEY ("tune_id") REFERENCES "public"."tune"("id");



ALTER TABLE ONLY "public"."table_transient_data"
    ADD CONSTRAINT "table_transient_data_user_id_user_profile_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profile"("id");



ALTER TABLE ONLY "public"."tag"
    ADD CONSTRAINT "tag_tune_ref_fkey" FOREIGN KEY ("tune_ref") REFERENCES "public"."tune"("id");



ALTER TABLE ONLY "public"."tag"
    ADD CONSTRAINT "tag_user_ref_user_profile_fkey" FOREIGN KEY ("user_ref") REFERENCES "public"."user_profile"("id");



ALTER TABLE ONLY "public"."tune"
    ADD CONSTRAINT "tune_genre_fkey" FOREIGN KEY ("genre") REFERENCES "public"."genre"("id");



ALTER TABLE ONLY "public"."tune_override"
    ADD CONSTRAINT "tune_override_genre_fkey" FOREIGN KEY ("genre") REFERENCES "public"."genre"("id");



ALTER TABLE ONLY "public"."tune_override"
    ADD CONSTRAINT "tune_override_tune_ref_fkey" FOREIGN KEY ("tune_ref") REFERENCES "public"."tune"("id");



ALTER TABLE ONLY "public"."tune_override"
    ADD CONSTRAINT "tune_override_user_ref_user_profile_fkey" FOREIGN KEY ("user_ref") REFERENCES "public"."user_profile"("id");



ALTER TABLE ONLY "public"."tune"
    ADD CONSTRAINT "tune_private_for_user_profile_fkey" FOREIGN KEY ("private_for") REFERENCES "public"."user_profile"("id");



ALTER TABLE ONLY "public"."user_genre_selection"
    ADD CONSTRAINT "user_genre_selection_genre_id_fkey" FOREIGN KEY ("genre_id") REFERENCES "public"."genre"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_genre_selection"
    ADD CONSTRAINT "user_genre_selection_user_id_user_profile_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profile"("id");



CREATE POLICY "Allow authenticated users full access to sync_change_log" ON "public"."sync_change_log" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow service_role full access to sync_change_log" ON "public"."sync_change_log" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Anyone can view genre_tune_type" ON "public"."genre_tune_type" FOR SELECT USING (true);



CREATE POLICY "Anyone can view genres" ON "public"."genre" FOR SELECT USING (true);



CREATE POLICY "Anyone can view tune_types" ON "public"."tune_type" FOR SELECT USING (true);



CREATE POLICY "Users can delete own daily_practice_queue" ON "public"."daily_practice_queue" FOR DELETE USING (("user_ref" = "auth"."uid"()));



CREATE POLICY "Users can delete own notes" ON "public"."note" FOR DELETE USING (("user_ref" = "auth"."uid"()));



CREATE POLICY "Users can delete own playlists" ON "public"."repertoire" FOR DELETE USING (("user_ref" = "auth"."uid"()));



CREATE POLICY "Users can delete own plugins" ON "public"."plugin" FOR DELETE USING (("user_ref" = "auth"."uid"()));



CREATE POLICY "Users can delete own private instruments" ON "public"."instrument" FOR DELETE USING ((("private_to_user" IS NULL) OR ("private_to_user" = "auth"."uid"())));



CREATE POLICY "Users can delete own private tunes" ON "public"."tune" FOR DELETE USING ((("private_for" IS NULL) OR ("private_for" = "auth"."uid"())));



CREATE POLICY "Users can delete own references" ON "public"."reference" FOR DELETE USING (("user_ref" = "auth"."uid"()));



CREATE POLICY "Users can delete own scheduling_options prefs" ON "public"."prefs_scheduling_options" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete own spaced_repetition prefs" ON "public"."prefs_spaced_repetition" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete own tab_group_main_state" ON "public"."tab_group_main_state" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete own table_state" ON "public"."table_state" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete own table_transient_data" ON "public"."table_transient_data" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete own tags" ON "public"."tag" FOR DELETE USING (("user_ref" = "auth"."uid"()));



CREATE POLICY "Users can delete own tune overrides" ON "public"."tune_override" FOR DELETE USING (("user_ref" = "auth"."uid"()));



CREATE POLICY "Users can delete playlist_tune in own playlists" ON "public"."repertoire_tune" FOR DELETE USING (("repertoire_ref" IN ( SELECT "repertoire"."repertoire_id" AS "playlist_id"
   FROM "public"."repertoire"
  WHERE ("repertoire"."user_ref" = "auth"."uid"()))));



CREATE POLICY "Users can delete practice_record in own playlists" ON "public"."practice_record" FOR DELETE USING (("repertoire_ref" IN ( SELECT "repertoire"."repertoire_id" AS "playlist_id"
   FROM "public"."repertoire"
  WHERE ("repertoire"."user_ref" = "auth"."uid"()))));



CREATE POLICY "Users can insert own daily_practice_queue" ON "public"."daily_practice_queue" FOR INSERT WITH CHECK (("user_ref" = "auth"."uid"()));



CREATE POLICY "Users can insert own notes" ON "public"."note" FOR INSERT WITH CHECK (("user_ref" = "auth"."uid"()));



CREATE POLICY "Users can insert own playlists" ON "public"."repertoire" FOR INSERT WITH CHECK (("user_ref" = "auth"."uid"()));



CREATE POLICY "Users can insert own plugins" ON "public"."plugin" FOR INSERT WITH CHECK (("user_ref" = "auth"."uid"()));



CREATE POLICY "Users can insert own private instruments" ON "public"."instrument" FOR INSERT WITH CHECK ((("private_to_user" IS NULL) OR ("private_to_user" = "auth"."uid"())));



CREATE POLICY "Users can insert own private tunes" ON "public"."tune" FOR INSERT WITH CHECK ((("private_for" IS NULL) OR ("private_for" = "auth"."uid"())));



CREATE POLICY "Users can insert own references" ON "public"."reference" FOR INSERT WITH CHECK (("user_ref" = "auth"."uid"()));



CREATE POLICY "Users can insert own scheduling_options prefs" ON "public"."prefs_scheduling_options" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert own spaced_repetition prefs" ON "public"."prefs_spaced_repetition" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert own tab_group_main_state" ON "public"."tab_group_main_state" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert own table_state" ON "public"."table_state" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert own table_transient_data" ON "public"."table_transient_data" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert own tags" ON "public"."tag" FOR INSERT WITH CHECK (("user_ref" = "auth"."uid"()));



CREATE POLICY "Users can insert own tune overrides" ON "public"."tune_override" FOR INSERT WITH CHECK (("user_ref" = "auth"."uid"()));



CREATE POLICY "Users can insert playlist_tune in own playlists" ON "public"."repertoire_tune" FOR INSERT WITH CHECK (("repertoire_ref" IN ( SELECT "repertoire"."repertoire_id" AS "playlist_id"
   FROM "public"."repertoire"
  WHERE ("repertoire"."user_ref" = "auth"."uid"()))));



CREATE POLICY "Users can insert practice_record in own playlists" ON "public"."practice_record" FOR INSERT WITH CHECK (("repertoire_ref" IN ( SELECT "repertoire"."repertoire_id" AS "playlist_id"
   FROM "public"."repertoire"
  WHERE ("repertoire"."user_ref" = "auth"."uid"()))));



CREATE POLICY "Users can update own daily_practice_queue" ON "public"."daily_practice_queue" FOR UPDATE USING (("user_ref" = "auth"."uid"()));



CREATE POLICY "Users can update own notes" ON "public"."note" FOR UPDATE USING (("user_ref" = "auth"."uid"()));



CREATE POLICY "Users can update own playlists" ON "public"."repertoire" FOR UPDATE USING (("user_ref" = "auth"."uid"()));



CREATE POLICY "Users can update own plugins" ON "public"."plugin" FOR UPDATE USING (("user_ref" = "auth"."uid"()));



CREATE POLICY "Users can update own private instruments" ON "public"."instrument" FOR UPDATE USING ((("private_to_user" IS NULL) OR ("private_to_user" = "auth"."uid"())));



CREATE POLICY "Users can update own private tunes" ON "public"."tune" FOR UPDATE USING ((("private_for" IS NULL) OR ("private_for" = "auth"."uid"())));



CREATE POLICY "Users can update own references" ON "public"."reference" FOR UPDATE USING (("user_ref" = "auth"."uid"()));



CREATE POLICY "Users can update own scheduling_options prefs" ON "public"."prefs_scheduling_options" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update own spaced_repetition prefs" ON "public"."prefs_spaced_repetition" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update own tab_group_main_state" ON "public"."tab_group_main_state" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update own table_state" ON "public"."table_state" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update own table_transient_data" ON "public"."table_transient_data" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update own tags" ON "public"."tag" FOR UPDATE USING (("user_ref" = "auth"."uid"()));



CREATE POLICY "Users can update own tune overrides" ON "public"."tune_override" FOR UPDATE USING (("user_ref" = "auth"."uid"()));



CREATE POLICY "Users can update playlist_tune in own playlists" ON "public"."repertoire_tune" FOR UPDATE USING (("repertoire_ref" IN ( SELECT "repertoire"."repertoire_id" AS "playlist_id"
   FROM "public"."repertoire"
  WHERE ("repertoire"."user_ref" = "auth"."uid"()))));



CREATE POLICY "Users can update practice_record in own playlists" ON "public"."practice_record" FOR UPDATE USING (("repertoire_ref" IN ( SELECT "repertoire"."repertoire_id" AS "playlist_id"
   FROM "public"."repertoire"
  WHERE ("repertoire"."user_ref" = "auth"."uid"()))));



CREATE POLICY "Users can view catalog and own instruments" ON "public"."instrument" FOR SELECT USING ((("private_to_user" IS NULL) OR ("private_to_user" = "auth"."uid"())));



CREATE POLICY "Users can view catalog tunes and own private tunes" ON "public"."tune" FOR SELECT USING ((("private_for" IS NULL) OR ("private_for" = "auth"."uid"())));



CREATE POLICY "Users can view own daily_practice_queue" ON "public"."daily_practice_queue" FOR SELECT USING (("user_ref" = "auth"."uid"()));



CREATE POLICY "Users can view own notes" ON "public"."note" FOR SELECT USING (("user_ref" = "auth"."uid"()));



CREATE POLICY "Users can view own or public plugins" ON "public"."plugin" FOR SELECT USING ((("user_ref" = "auth"."uid"()) OR ("is_public" = true)));



CREATE POLICY "Users can view own playlists" ON "public"."repertoire" FOR SELECT USING (("user_ref" = "auth"."uid"()));



CREATE POLICY "Users can view own references" ON "public"."reference" FOR SELECT USING (("user_ref" = "auth"."uid"()));



CREATE POLICY "Users can view own scheduling_options prefs" ON "public"."prefs_scheduling_options" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own spaced_repetition prefs" ON "public"."prefs_spaced_repetition" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own tab_group_main_state" ON "public"."tab_group_main_state" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own table_state" ON "public"."table_state" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own table_transient_data" ON "public"."table_transient_data" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own tags" ON "public"."tag" FOR SELECT USING (("user_ref" = "auth"."uid"()));



CREATE POLICY "Users can view own tune overrides" ON "public"."tune_override" FOR SELECT USING (("user_ref" = "auth"."uid"()));



CREATE POLICY "Users can view playlist_tune in own playlists" ON "public"."repertoire_tune" FOR SELECT USING (("repertoire_ref" IN ( SELECT "repertoire"."repertoire_id" AS "playlist_id"
   FROM "public"."repertoire"
  WHERE ("repertoire"."user_ref" = "auth"."uid"()))));



CREATE POLICY "Users can view practice_record in own playlists" ON "public"."practice_record" FOR SELECT USING (("repertoire_ref" IN ( SELECT "repertoire"."repertoire_id" AS "playlist_id"
   FROM "public"."repertoire"
  WHERE ("repertoire"."user_ref" = "auth"."uid"()))));



ALTER TABLE "public"."daily_practice_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."genre" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."genre_tune_type" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."instrument" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."note" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."plugin" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."practice_record" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."prefs_scheduling_options" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."prefs_spaced_repetition" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reference" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."repertoire" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."repertoire_tune" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sync_change_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tab_group_main_state" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."table_state" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."table_transient_data" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tag" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tune" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tune_override" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tune_type" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_genre_selection" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_genre_selection_delete_own" ON "public"."user_genre_selection" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "user_genre_selection_insert_own" ON "public"."user_genre_selection" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "user_genre_selection_select_own" ON "public"."user_genre_selection" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "user_genre_selection_update_own" ON "public"."user_genre_selection" FOR UPDATE USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."user_profile" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."auth_internal_user_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."auth_internal_user_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auth_internal_user_id"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."e2e_clear_practice_record"("target_repertoire" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."e2e_clear_practice_record"("target_repertoire" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."e2e_clear_practice_record"("target_repertoire" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."e2e_clear_practice_record"("target_repertoire" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."e2e_delete_practice_record_by_tunes"("target_repertoire" "uuid", "tune_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."e2e_delete_practice_record_by_tunes"("target_repertoire" "uuid", "tune_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."e2e_delete_practice_record_by_tunes"("target_repertoire" "uuid", "tune_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."e2e_delete_practice_record_by_tunes"("target_repertoire" "uuid", "tune_ids" "uuid"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_repertoire_tune_genres_for_user"("p_user_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_repertoire_tune_genres_for_user"("p_user_id" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_repertoire_tune_genres_for_user"("p_user_id" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."prevent_practice_record_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_practice_record_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_practice_record_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_change_log_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_change_log_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_change_log_update"() TO "service_role";



GRANT ALL ON TABLE "public"."note" TO "anon";
GRANT ALL ON TABLE "public"."note" TO "authenticated";
GRANT ALL ON TABLE "public"."note" TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_get_user_notes"("p_user_id" "uuid", "p_genre_ids" "text"[], "p_after_timestamp" timestamp with time zone, "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sync_get_user_notes"("p_user_id" "uuid", "p_genre_ids" "text"[], "p_after_timestamp" timestamp with time zone, "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_get_user_notes"("p_user_id" "uuid", "p_genre_ids" "text"[], "p_after_timestamp" timestamp with time zone, "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON TABLE "public"."reference" TO "anon";
GRANT ALL ON TABLE "public"."reference" TO "authenticated";
GRANT ALL ON TABLE "public"."reference" TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_get_user_references"("p_user_id" "uuid", "p_genre_ids" "text"[], "p_after_timestamp" timestamp with time zone, "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sync_get_user_references"("p_user_id" "uuid", "p_genre_ids" "text"[], "p_after_timestamp" timestamp with time zone, "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_get_user_references"("p_user_id" "uuid", "p_genre_ids" "text"[], "p_after_timestamp" timestamp with time zone, "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_now_iso"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_now_iso"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_now_iso"() TO "service_role";



GRANT ALL ON TABLE "public"."daily_practice_queue" TO "anon";
GRANT ALL ON TABLE "public"."daily_practice_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_practice_queue" TO "service_role";



GRANT ALL ON TABLE "public"."genre" TO "anon";
GRANT ALL ON TABLE "public"."genre" TO "authenticated";
GRANT ALL ON TABLE "public"."genre" TO "service_role";



GRANT ALL ON TABLE "public"."genre_tune_type" TO "anon";
GRANT ALL ON TABLE "public"."genre_tune_type" TO "authenticated";
GRANT ALL ON TABLE "public"."genre_tune_type" TO "service_role";



GRANT ALL ON TABLE "public"."instrument" TO "anon";
GRANT ALL ON TABLE "public"."instrument" TO "authenticated";
GRANT ALL ON TABLE "public"."instrument" TO "service_role";



GRANT ALL ON TABLE "public"."plugin" TO "anon";
GRANT ALL ON TABLE "public"."plugin" TO "authenticated";
GRANT ALL ON TABLE "public"."plugin" TO "service_role";



GRANT ALL ON TABLE "public"."practice_record" TO "anon";
GRANT ALL ON TABLE "public"."practice_record" TO "authenticated";
GRANT ALL ON TABLE "public"."practice_record" TO "service_role";



GRANT ALL ON TABLE "public"."repertoire" TO "anon";
GRANT ALL ON TABLE "public"."repertoire" TO "authenticated";
GRANT ALL ON TABLE "public"."repertoire" TO "service_role";



GRANT ALL ON TABLE "public"."repertoire_tune" TO "anon";
GRANT ALL ON TABLE "public"."repertoire_tune" TO "authenticated";
GRANT ALL ON TABLE "public"."repertoire_tune" TO "service_role";



GRANT ALL ON TABLE "public"."tag" TO "anon";
GRANT ALL ON TABLE "public"."tag" TO "authenticated";
GRANT ALL ON TABLE "public"."tag" TO "service_role";



GRANT ALL ON TABLE "public"."tune" TO "anon";
GRANT ALL ON TABLE "public"."tune" TO "authenticated";
GRANT ALL ON TABLE "public"."tune" TO "service_role";



GRANT ALL ON TABLE "public"."tune_override" TO "anon";
GRANT ALL ON TABLE "public"."tune_override" TO "authenticated";
GRANT ALL ON TABLE "public"."tune_override" TO "service_role";



GRANT ALL ON TABLE "public"."practice_list_joined" TO "anon";
GRANT ALL ON TABLE "public"."practice_list_joined" TO "authenticated";
GRANT ALL ON TABLE "public"."practice_list_joined" TO "service_role";



GRANT ALL ON TABLE "public"."table_transient_data" TO "anon";
GRANT ALL ON TABLE "public"."table_transient_data" TO "authenticated";
GRANT ALL ON TABLE "public"."table_transient_data" TO "service_role";



GRANT ALL ON TABLE "public"."practice_list_staged" TO "service_role";
GRANT SELECT ON TABLE "public"."practice_list_staged" TO "authenticated";



GRANT ALL ON TABLE "public"."prefs_scheduling_options" TO "anon";
GRANT ALL ON TABLE "public"."prefs_scheduling_options" TO "authenticated";
GRANT ALL ON TABLE "public"."prefs_scheduling_options" TO "service_role";



GRANT ALL ON TABLE "public"."prefs_spaced_repetition" TO "anon";
GRANT ALL ON TABLE "public"."prefs_spaced_repetition" TO "authenticated";
GRANT ALL ON TABLE "public"."prefs_spaced_repetition" TO "service_role";



GRANT ALL ON TABLE "public"."sync_change_log" TO "anon";
GRANT ALL ON TABLE "public"."sync_change_log" TO "authenticated";
GRANT ALL ON TABLE "public"."sync_change_log" TO "service_role";



GRANT ALL ON TABLE "public"."tab_group_main_state" TO "anon";
GRANT ALL ON TABLE "public"."tab_group_main_state" TO "authenticated";
GRANT ALL ON TABLE "public"."tab_group_main_state" TO "service_role";



GRANT ALL ON TABLE "public"."table_state" TO "anon";
GRANT ALL ON TABLE "public"."table_state" TO "authenticated";
GRANT ALL ON TABLE "public"."table_state" TO "service_role";



GRANT ALL ON TABLE "public"."tune_type" TO "anon";
GRANT ALL ON TABLE "public"."tune_type" TO "authenticated";
GRANT ALL ON TABLE "public"."tune_type" TO "service_role";



GRANT ALL ON TABLE "public"."user_genre_selection" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."user_genre_selection" TO "authenticated";



GRANT ALL ON TABLE "public"."user_profile" TO "anon";
GRANT ALL ON TABLE "public"."user_profile" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profile" TO "service_role";



GRANT ALL ON TABLE "public"."view_daily_practice_queue_readable" TO "anon";
GRANT ALL ON TABLE "public"."view_daily_practice_queue_readable" TO "authenticated";
GRANT ALL ON TABLE "public"."view_daily_practice_queue_readable" TO "service_role";



GRANT ALL ON TABLE "public"."view_playlist_joined" TO "anon";
GRANT ALL ON TABLE "public"."view_playlist_joined" TO "authenticated";
GRANT ALL ON TABLE "public"."view_playlist_joined" TO "service_role";



GRANT ALL ON TABLE "public"."view_practice_record_readable" TO "anon";
GRANT ALL ON TABLE "public"."view_practice_record_readable" TO "authenticated";
GRANT ALL ON TABLE "public"."view_practice_record_readable" TO "service_role";



GRANT ALL ON TABLE "public"."view_transient_data_readable" TO "anon";
GRANT ALL ON TABLE "public"."view_transient_data_readable" TO "authenticated";
GRANT ALL ON TABLE "public"."view_transient_data_readable" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







