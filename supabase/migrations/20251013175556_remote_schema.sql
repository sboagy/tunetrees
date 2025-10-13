


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


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";





SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."daily_practice_queue" (
    "id" integer NOT NULL,
    "user_ref" integer NOT NULL,
    "playlist_ref" integer NOT NULL,
    "mode" "text",
    "queue_date" timestamp without time zone,
    "window_start_utc" timestamp without time zone NOT NULL,
    "window_end_utc" timestamp without time zone NOT NULL,
    "tune_ref" integer NOT NULL,
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


CREATE SEQUENCE IF NOT EXISTS "public"."daily_practice_queue_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."daily_practice_queue_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."daily_practice_queue_id_seq" OWNED BY "public"."daily_practice_queue"."id";



CREATE TABLE IF NOT EXISTS "public"."genre" (
    "id" "text" NOT NULL,
    "name" "text",
    "region" "text",
    "description" "text"
);


ALTER TABLE "public"."genre" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."genre_tune_type" (
    "genre_id" "text" NOT NULL,
    "tune_type_id" "text" NOT NULL
);


ALTER TABLE "public"."genre_tune_type" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."instrument" (
    "id" integer NOT NULL,
    "private_to_user" integer,
    "instrument" "text",
    "description" "text",
    "genre_default" "text",
    "deleted" boolean DEFAULT false NOT NULL,
    "sync_version" integer DEFAULT 1 NOT NULL,
    "last_modified_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "device_id" "text"
);


ALTER TABLE "public"."instrument" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."instrument_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."instrument_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."instrument_id_seq" OWNED BY "public"."instrument"."id";



CREATE TABLE IF NOT EXISTS "public"."note" (
    "id" integer NOT NULL,
    "user_ref" integer,
    "tune_ref" integer NOT NULL,
    "playlist_ref" integer,
    "created_date" timestamp without time zone,
    "note_text" "text",
    "public" boolean DEFAULT false NOT NULL,
    "favorite" boolean,
    "deleted" boolean DEFAULT false NOT NULL,
    "sync_version" integer DEFAULT 1 NOT NULL,
    "last_modified_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "device_id" "text",
    CONSTRAINT "chk_favorite_bool" CHECK (("favorite" = ANY (ARRAY[true, false]))),
    CONSTRAINT "chk_public_bool" CHECK (("public" = ANY (ARRAY[true, false])))
);


ALTER TABLE "public"."note" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."note_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."note_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."note_id_seq" OWNED BY "public"."note"."id";



CREATE TABLE IF NOT EXISTS "public"."playlist" (
    "playlist_id" integer NOT NULL,
    "user_ref" integer NOT NULL,
    "instrument_ref" integer,
    "sr_alg_type" "text",
    "deleted" boolean DEFAULT false NOT NULL,
    "sync_version" integer DEFAULT 1 NOT NULL,
    "last_modified_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "device_id" "text",
    "name" "text",
    "genre_default" "text"
);


ALTER TABLE "public"."playlist" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."playlist_playlist_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."playlist_playlist_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."playlist_playlist_id_seq" OWNED BY "public"."playlist"."playlist_id";



CREATE TABLE IF NOT EXISTS "public"."playlist_tune" (
    "playlist_ref" integer NOT NULL,
    "tune_ref" integer NOT NULL,
    "current" timestamp without time zone,
    "learned" timestamp without time zone,
    "scheduled" timestamp without time zone,
    "goal" "text" DEFAULT 'recall'::"text",
    "deleted" boolean DEFAULT false NOT NULL,
    "sync_version" integer DEFAULT 1 NOT NULL,
    "last_modified_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "device_id" "text"
);


ALTER TABLE "public"."playlist_tune" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."practice_record" (
    "id" integer NOT NULL,
    "playlist_ref" integer NOT NULL,
    "tune_ref" integer NOT NULL,
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


CREATE TABLE IF NOT EXISTS "public"."reference" (
    "id" integer NOT NULL,
    "url" "text" NOT NULL,
    "ref_type" "text",
    "tune_ref" integer NOT NULL,
    "user_ref" integer,
    "comment" "text",
    "title" "text",
    "public" boolean,
    "favorite" boolean,
    "deleted" boolean DEFAULT false NOT NULL,
    "sync_version" integer DEFAULT 1 NOT NULL,
    "last_modified_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "device_id" "text",
    CONSTRAINT "check_favorite" CHECK (("favorite" = ANY (ARRAY[true, false]))),
    CONSTRAINT "check_public" CHECK (("public" = ANY (ARRAY[true, false]))),
    CONSTRAINT "check_ref_type" CHECK (("ref_type" = ANY (ARRAY['website'::"text", 'audio'::"text", 'video'::"text"])))
);


ALTER TABLE "public"."reference" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tag" (
    "tag_id" integer NOT NULL,
    "user_ref" integer NOT NULL,
    "tune_ref" integer NOT NULL,
    "tag_text" "text" NOT NULL,
    "sync_version" integer DEFAULT 1 NOT NULL,
    "last_modified_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "device_id" "text"
);


ALTER TABLE "public"."tag" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tune" (
    "id" integer NOT NULL,
    "title" "text",
    "type" "text",
    "structure" "text",
    "mode" "text",
    "incipit" "text",
    "genre" "text",
    "private_for" integer,
    "deleted" boolean DEFAULT false NOT NULL,
    "sync_version" integer DEFAULT 1 NOT NULL,
    "last_modified_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "device_id" "text"
);


ALTER TABLE "public"."tune" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tune_override" (
    "id" integer NOT NULL,
    "tune_ref" integer NOT NULL,
    "user_ref" integer NOT NULL,
    "title" "text",
    "type" "text",
    "structure" "text",
    "genre" "text",
    "mode" "text",
    "incipit" "text",
    "deleted" boolean DEFAULT false NOT NULL,
    "sync_version" integer DEFAULT 1 NOT NULL,
    "last_modified_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "device_id" "text"
);


ALTER TABLE "public"."tune_override" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."practice_list_joined" AS
 SELECT "tune"."id",
    COALESCE("tune_override"."title", "tune"."title") AS "title",
    COALESCE("tune_override"."type", "tune"."type") AS "type",
    COALESCE("tune_override"."structure", "tune"."structure") AS "structure",
    COALESCE("tune_override"."mode", "tune"."mode") AS "mode",
    COALESCE("tune_override"."incipit", "tune"."incipit") AS "incipit",
    COALESCE("tune_override"."genre", "tune"."genre") AS "genre",
    "tune"."deleted",
    "tune"."private_for",
    "playlist_tune"."learned",
    "playlist_tune"."goal",
    "playlist_tune"."scheduled",
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
          WHERE (("tag_1"."tune_ref" = "tune"."id") AND ("tag_1"."user_ref" = "playlist"."user_ref"))) AS "tags",
    "playlist_tune"."playlist_ref",
    "playlist"."user_ref",
    "playlist_tune"."deleted" AS "playlist_deleted",
    ( SELECT "string_agg"("note"."note_text", ' '::"text") AS "string_agg"
           FROM "public"."note"
          WHERE (("note"."tune_ref" = "tune"."id") AND ("note"."user_ref" = "playlist"."user_ref"))) AS "notes",
    ( SELECT "ref"."url"
           FROM "public"."reference" "ref"
          WHERE (("ref"."tune_ref" = "tune"."id") AND ("ref"."user_ref" = "playlist"."user_ref") AND ("ref"."favorite" = true))
         LIMIT 1) AS "favorite_url",
        CASE
            WHEN ("tune_override"."user_ref" = "playlist"."user_ref") THEN 1
            ELSE 0
        END AS "has_override"
   FROM ((((("public"."tune"
     LEFT JOIN "public"."playlist_tune" ON (("playlist_tune"."tune_ref" = "tune"."id")))
     LEFT JOIN "public"."playlist" ON (("playlist"."playlist_id" = "playlist_tune"."playlist_ref")))
     LEFT JOIN "public"."tune_override" ON (("tune_override"."tune_ref" = "tune"."id")))
     LEFT JOIN ( SELECT DISTINCT ON ("pr"."tune_ref", "pr"."playlist_ref") "pr"."id",
            "pr"."playlist_ref",
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
          ORDER BY "pr"."tune_ref", "pr"."playlist_ref", "pr"."id" DESC) "practice_record" ON ((("practice_record"."tune_ref" = "tune"."id") AND ("practice_record"."playlist_ref" = "playlist_tune"."playlist_ref"))))
     LEFT JOIN "public"."tag" ON (("tag"."tune_ref" = COALESCE("tune_override"."id", "tune"."id"))))
  WHERE (("tune_override"."user_ref" IS NULL) OR ("tune_override"."user_ref" = "playlist"."user_ref"));


ALTER VIEW "public"."practice_list_joined" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."table_transient_data" (
    "user_id" integer NOT NULL,
    "tune_id" integer NOT NULL,
    "playlist_id" integer NOT NULL,
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


CREATE OR REPLACE VIEW "public"."practice_list_staged" AS
 SELECT "tune"."id",
    COALESCE("tune_override"."title", "tune"."title") AS "title",
    COALESCE("tune_override"."type", "tune"."type") AS "type",
    COALESCE("tune_override"."structure", "tune"."structure") AS "structure",
    COALESCE("tune_override"."mode", "tune"."mode") AS "mode",
    COALESCE("tune_override"."incipit", "tune"."incipit") AS "incipit",
    COALESCE("tune_override"."genre", "tune"."genre") AS "genre",
    "tune"."private_for",
    "tune"."deleted",
    "playlist_tune"."learned",
    COALESCE("td"."goal", COALESCE("pr"."goal", 'recall'::"text")) AS "goal",
    "playlist_tune"."scheduled",
    "playlist"."user_ref",
    "playlist"."playlist_id",
    "instrument"."instrument",
    "playlist_tune"."deleted" AS "playlist_deleted",
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
          WHERE (("tag_1"."tune_ref" = "tune"."id") AND ("tag_1"."user_ref" = "playlist"."user_ref"))) AS "tags",
    "td"."purpose",
    "td"."note_private",
    "td"."note_public",
    "td"."recall_eval",
    ( SELECT "string_agg"("note"."note_text", ' '::"text") AS "string_agg"
           FROM "public"."note"
          WHERE (("note"."tune_ref" = "tune"."id") AND ("note"."user_ref" = "playlist"."user_ref"))) AS "notes",
    ( SELECT "ref"."url"
           FROM "public"."reference" "ref"
          WHERE (("ref"."tune_ref" = "tune"."id") AND ("ref"."user_ref" = "playlist"."user_ref") AND ("ref"."favorite" = true))
         LIMIT 1) AS "favorite_url",
        CASE
            WHEN ("tune_override"."user_ref" = "playlist"."user_ref") THEN 1
            ELSE 0
        END AS "has_override",
        CASE
            WHEN (("td"."practiced" IS NOT NULL) OR ("td"."quality" IS NOT NULL) OR ("td"."easiness" IS NOT NULL) OR ("td"."difficulty" IS NOT NULL) OR ("td"."interval" IS NOT NULL) OR ("td"."step" IS NOT NULL) OR ("td"."repetitions" IS NOT NULL) OR ("td"."due" IS NOT NULL) OR ("td"."backup_practiced" IS NOT NULL) OR ("td"."goal" IS NOT NULL) OR ("td"."technique" IS NOT NULL) OR ("td"."stability" IS NOT NULL)) THEN 1
            ELSE 0
        END AS "has_staged"
   FROM ((((((("public"."tune"
     LEFT JOIN "public"."playlist_tune" ON (("playlist_tune"."tune_ref" = "tune"."id")))
     LEFT JOIN "public"."playlist" ON (("playlist"."playlist_id" = "playlist_tune"."playlist_ref")))
     LEFT JOIN "public"."tune_override" ON (("tune_override"."tune_ref" = "tune"."id")))
     LEFT JOIN "public"."instrument" ON (("instrument"."id" = "playlist"."instrument_ref")))
     LEFT JOIN ( SELECT DISTINCT ON ("pr_1"."tune_ref", "pr_1"."playlist_ref") "pr_1"."id",
            "pr_1"."playlist_ref",
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
          ORDER BY "pr_1"."tune_ref", "pr_1"."playlist_ref", "pr_1"."id" DESC) "pr" ON ((("pr"."tune_ref" = "tune"."id") AND ("pr"."playlist_ref" = "playlist_tune"."playlist_ref"))))
     LEFT JOIN "public"."tag" ON (("tag"."tune_ref" = "tune"."id")))
     LEFT JOIN "public"."table_transient_data" "td" ON ((("td"."tune_id" = "tune"."id") AND ("td"."playlist_id" = "playlist_tune"."playlist_ref"))))
  WHERE (("tune_override"."user_ref" IS NULL) OR ("tune_override"."user_ref" = "playlist"."user_ref"));


ALTER VIEW "public"."practice_list_staged" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."practice_record_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."practice_record_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."practice_record_id_seq" OWNED BY "public"."practice_record"."id";



CREATE TABLE IF NOT EXISTS "public"."prefs_scheduling_options" (
    "user_id" integer NOT NULL,
    "acceptable_delinquency_window" integer DEFAULT 21 NOT NULL,
    "min_reviews_per_day" integer,
    "max_reviews_per_day" integer,
    "days_per_week" integer,
    "weekly_rules" "text",
    "exceptions" "text",
    "sync_version" integer DEFAULT 1 NOT NULL,
    "last_modified_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "device_id" "text"
);


ALTER TABLE "public"."prefs_scheduling_options" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."prefs_spaced_repetition" (
    "user_id" integer NOT NULL,
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


CREATE SEQUENCE IF NOT EXISTS "public"."reference_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."reference_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."reference_id_seq" OWNED BY "public"."reference"."id";



CREATE TABLE IF NOT EXISTS "public"."tab_group_main_state" (
    "id" integer NOT NULL,
    "user_id" integer NOT NULL,
    "which_tab" "text" DEFAULT 'practice'::"text",
    "playlist_id" integer,
    "tab_spec" "text",
    "practice_show_submitted" integer DEFAULT 0,
    "practice_mode_flashcard" integer DEFAULT 0,
    "sync_version" integer DEFAULT 1 NOT NULL,
    "last_modified_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "device_id" "text",
    CONSTRAINT "check_name" CHECK (("which_tab" = ANY (ARRAY['scheduled'::"text", 'repertoire'::"text", 'catalog'::"text", 'analysis'::"text"])))
);


ALTER TABLE "public"."tab_group_main_state" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."tab_group_main_state_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."tab_group_main_state_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."tab_group_main_state_id_seq" OWNED BY "public"."tab_group_main_state"."id";



CREATE TABLE IF NOT EXISTS "public"."table_state" (
    "user_id" integer NOT NULL,
    "screen_size" "text" NOT NULL,
    "purpose" "text" NOT NULL,
    "playlist_id" integer NOT NULL,
    "settings" "text",
    "current_tune" integer,
    "sync_version" integer DEFAULT 1 NOT NULL,
    "last_modified_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "device_id" "text",
    CONSTRAINT "purpose_check" CHECK (("purpose" = ANY (ARRAY['practice'::"text", 'repertoire'::"text", 'catalog'::"text", 'analysis'::"text"]))),
    CONSTRAINT "screen_size_check" CHECK (("screen_size" = ANY (ARRAY['small'::"text", 'full'::"text"])))
);


ALTER TABLE "public"."table_state" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."tag_tag_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."tag_tag_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."tag_tag_id_seq" OWNED BY "public"."tag"."tag_id";



CREATE SEQUENCE IF NOT EXISTS "public"."tune_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."tune_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."tune_id_seq" OWNED BY "public"."tune"."id";



CREATE SEQUENCE IF NOT EXISTS "public"."tune_override_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."tune_override_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."tune_override_id_seq" OWNED BY "public"."tune_override"."id";



CREATE TABLE IF NOT EXISTS "public"."tune_type" (
    "id" "text" NOT NULL,
    "name" "text",
    "rhythm" "text",
    "description" "text"
);


ALTER TABLE "public"."tune_type" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profile" (
    "id" integer NOT NULL,
    "supabase_user_id" "uuid" NOT NULL,
    "name" "text",
    "email" "text",
    "sr_alg_type" "text",
    "phone" "text",
    "phone_verified" timestamp without time zone,
    "acceptable_delinquency_window" integer DEFAULT 21,
    "deleted" boolean DEFAULT false NOT NULL,
    "sync_version" integer DEFAULT 1 NOT NULL,
    "last_modified_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "device_id" "text"
);


ALTER TABLE "public"."user_profile" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."user_profile_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."user_profile_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."user_profile_id_seq" OWNED BY "public"."user_profile"."id";



CREATE OR REPLACE VIEW "public"."view_playlist_joined" AS
 SELECT "p"."playlist_id",
    "p"."user_ref",
    "p"."deleted" AS "playlist_deleted",
    "p"."instrument_ref",
    "i"."private_to_user",
    "i"."instrument",
    "i"."description",
    "i"."genre_default",
    "i"."deleted" AS "instrument_deleted"
   FROM ("public"."playlist" "p"
     JOIN "public"."instrument" "i" ON (("p"."instrument_ref" = "i"."id")));


ALTER VIEW "public"."view_playlist_joined" OWNER TO "postgres";


ALTER TABLE ONLY "public"."daily_practice_queue" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."daily_practice_queue_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."instrument" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."instrument_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."note" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."note_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."playlist" ALTER COLUMN "playlist_id" SET DEFAULT "nextval"('"public"."playlist_playlist_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."practice_record" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."practice_record_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."reference" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."reference_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."tab_group_main_state" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."tab_group_main_state_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."tag" ALTER COLUMN "tag_id" SET DEFAULT "nextval"('"public"."tag_tag_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."tune" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."tune_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."tune_override" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."tune_override_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."user_profile" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."user_profile_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."daily_practice_queue"
    ADD CONSTRAINT "daily_practice_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_practice_queue"
    ADD CONSTRAINT "daily_practice_queue_user_ref_playlist_ref_window_start_utc_tun" UNIQUE ("user_ref", "playlist_ref", "window_start_utc", "tune_ref");



ALTER TABLE ONLY "public"."genre"
    ADD CONSTRAINT "genre_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."genre_tune_type"
    ADD CONSTRAINT "genre_tune_type_genre_id_tune_type_id_pk" PRIMARY KEY ("genre_id", "tune_type_id");



ALTER TABLE ONLY "public"."instrument"
    ADD CONSTRAINT "instrument_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."instrument"
    ADD CONSTRAINT "instrument_private_to_user_instrument_unique" UNIQUE ("private_to_user", "instrument");



ALTER TABLE ONLY "public"."note"
    ADD CONSTRAINT "note_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."playlist"
    ADD CONSTRAINT "playlist_pkey" PRIMARY KEY ("playlist_id");



ALTER TABLE ONLY "public"."playlist_tune"
    ADD CONSTRAINT "playlist_tune_playlist_ref_tune_ref_pk" PRIMARY KEY ("playlist_ref", "tune_ref");



ALTER TABLE ONLY "public"."playlist"
    ADD CONSTRAINT "playlist_user_ref_instrument_ref_unique" UNIQUE ("user_ref", "instrument_ref");



ALTER TABLE ONLY "public"."practice_record"
    ADD CONSTRAINT "practice_record_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."practice_record"
    ADD CONSTRAINT "practice_record_tune_ref_playlist_ref_practiced_unique" UNIQUE ("tune_ref", "playlist_ref", "practiced");



ALTER TABLE ONLY "public"."prefs_scheduling_options"
    ADD CONSTRAINT "prefs_scheduling_options_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."prefs_spaced_repetition"
    ADD CONSTRAINT "prefs_spaced_repetition_user_id_alg_type_pk" PRIMARY KEY ("user_id", "alg_type");



ALTER TABLE ONLY "public"."reference"
    ADD CONSTRAINT "reference_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tab_group_main_state"
    ADD CONSTRAINT "tab_group_main_state_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."table_state"
    ADD CONSTRAINT "table_state_user_id_screen_size_purpose_playlist_id_pk" PRIMARY KEY ("user_id", "screen_size", "purpose", "playlist_id");



ALTER TABLE ONLY "public"."table_transient_data"
    ADD CONSTRAINT "table_transient_data_tune_id_user_id_playlist_id_pk" PRIMARY KEY ("tune_id", "user_id", "playlist_id");



ALTER TABLE ONLY "public"."tag"
    ADD CONSTRAINT "tag_pkey" PRIMARY KEY ("tag_id");



ALTER TABLE ONLY "public"."tag"
    ADD CONSTRAINT "tag_user_ref_tune_ref_tag_text_unique" UNIQUE ("user_ref", "tune_ref", "tag_text");



ALTER TABLE ONLY "public"."tune_override"
    ADD CONSTRAINT "tune_override_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tune"
    ADD CONSTRAINT "tune_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tune_type"
    ADD CONSTRAINT "tune_type_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profile"
    ADD CONSTRAINT "user_profile_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profile"
    ADD CONSTRAINT "user_profile_supabase_user_id_unique" UNIQUE ("supabase_user_id");



CREATE INDEX "idx_instrument_instrument" ON "public"."instrument" USING "btree" ("instrument");



CREATE INDEX "idx_instrument_private_to_user" ON "public"."instrument" USING "btree" ("private_to_user");



CREATE INDEX "idx_note_tune_playlist" ON "public"."note" USING "btree" ("tune_ref", "playlist_ref");



CREATE INDEX "idx_note_tune_playlist_user_public" ON "public"."note" USING "btree" ("tune_ref", "playlist_ref", "user_ref", "public");



CREATE INDEX "idx_note_tune_user" ON "public"."note" USING "btree" ("tune_ref", "user_ref");



CREATE INDEX "idx_practice_record_id" ON "public"."practice_record" USING "btree" ("id" DESC NULLS LAST);



CREATE INDEX "idx_practice_record_practiced" ON "public"."practice_record" USING "btree" ("practiced" DESC NULLS LAST);



CREATE INDEX "idx_practice_record_tune_playlist_practiced" ON "public"."practice_record" USING "btree" ("tune_ref", "playlist_ref", "practiced" DESC NULLS LAST);



CREATE INDEX "idx_queue_generated_at" ON "public"."daily_practice_queue" USING "btree" ("generated_at");



CREATE INDEX "idx_queue_user_playlist_active" ON "public"."daily_practice_queue" USING "btree" ("user_ref", "playlist_ref", "active");



CREATE INDEX "idx_queue_user_playlist_bucket" ON "public"."daily_practice_queue" USING "btree" ("user_ref", "playlist_ref", "bucket");



CREATE INDEX "idx_queue_user_playlist_window" ON "public"."daily_practice_queue" USING "btree" ("user_ref", "playlist_ref", "window_start_utc");



CREATE INDEX "idx_reference_tune_public" ON "public"."reference" USING "btree" ("tune_ref", "public");



CREATE INDEX "idx_reference_tune_user_ref" ON "public"."reference" USING "btree" ("tune_ref", "user_ref");



CREATE INDEX "idx_reference_user_tune_public" ON "public"."reference" USING "btree" ("user_ref", "tune_ref", "public");



CREATE INDEX "idx_tag_user_ref_tag_text" ON "public"."tag" USING "btree" ("user_ref", "tag_text");



CREATE INDEX "idx_tag_user_ref_tune_ref" ON "public"."tag" USING "btree" ("user_ref", "tune_ref");



ALTER TABLE ONLY "public"."daily_practice_queue"
    ADD CONSTRAINT "daily_practice_queue_playlist_fk" FOREIGN KEY ("playlist_ref") REFERENCES "public"."playlist"("playlist_id");



ALTER TABLE ONLY "public"."daily_practice_queue"
    ADD CONSTRAINT "daily_practice_queue_tune_fk" FOREIGN KEY ("tune_ref") REFERENCES "public"."tune"("id");



ALTER TABLE ONLY "public"."daily_practice_queue"
    ADD CONSTRAINT "daily_practice_queue_user_profile_fk" FOREIGN KEY ("user_ref") REFERENCES "public"."user_profile"("id");



ALTER TABLE ONLY "public"."genre_tune_type"
    ADD CONSTRAINT "genre_tune_type_genre_id_genre_id_fk" FOREIGN KEY ("genre_id") REFERENCES "public"."genre"("id");



ALTER TABLE ONLY "public"."genre_tune_type"
    ADD CONSTRAINT "genre_tune_type_tune_type_id_tune_type_id_fk" FOREIGN KEY ("tune_type_id") REFERENCES "public"."tune_type"("id");



ALTER TABLE ONLY "public"."instrument"
    ADD CONSTRAINT "instrument_genre_fk" FOREIGN KEY ("genre_default") REFERENCES "public"."genre"("id");



ALTER TABLE ONLY "public"."instrument"
    ADD CONSTRAINT "instrument_private_to_user_user_profile_id_fk" FOREIGN KEY ("private_to_user") REFERENCES "public"."user_profile"("id");



ALTER TABLE ONLY "public"."note"
    ADD CONSTRAINT "note_playlist_ref_playlist_playlist_id_fk" FOREIGN KEY ("playlist_ref") REFERENCES "public"."playlist"("playlist_id");



ALTER TABLE ONLY "public"."note"
    ADD CONSTRAINT "note_tune_ref_tune_id_fk" FOREIGN KEY ("tune_ref") REFERENCES "public"."tune"("id");



ALTER TABLE ONLY "public"."note"
    ADD CONSTRAINT "note_user_ref_user_profile_id_fk" FOREIGN KEY ("user_ref") REFERENCES "public"."user_profile"("id");



ALTER TABLE ONLY "public"."playlist"
    ADD CONSTRAINT "playlist_instrument_fk" FOREIGN KEY ("instrument_ref") REFERENCES "public"."instrument"("id");



ALTER TABLE ONLY "public"."playlist_tune"
    ADD CONSTRAINT "playlist_tune_playlist_ref_playlist_playlist_id_fk" FOREIGN KEY ("playlist_ref") REFERENCES "public"."playlist"("playlist_id");



ALTER TABLE ONLY "public"."playlist_tune"
    ADD CONSTRAINT "playlist_tune_tune_ref_tune_id_fk" FOREIGN KEY ("tune_ref") REFERENCES "public"."tune"("id");



ALTER TABLE ONLY "public"."playlist"
    ADD CONSTRAINT "playlist_user_ref_user_profile_id_fk" FOREIGN KEY ("user_ref") REFERENCES "public"."user_profile"("id");



ALTER TABLE ONLY "public"."practice_record"
    ADD CONSTRAINT "practice_record_playlist_ref_playlist_playlist_id_fk" FOREIGN KEY ("playlist_ref") REFERENCES "public"."playlist"("playlist_id");



ALTER TABLE ONLY "public"."practice_record"
    ADD CONSTRAINT "practice_record_tune_ref_tune_id_fk" FOREIGN KEY ("tune_ref") REFERENCES "public"."tune"("id");



ALTER TABLE ONLY "public"."prefs_scheduling_options"
    ADD CONSTRAINT "prefs_scheduling_options_user_id_user_profile_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profile"("id");



ALTER TABLE ONLY "public"."prefs_spaced_repetition"
    ADD CONSTRAINT "prefs_spaced_repetition_user_id_user_profile_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profile"("id");



ALTER TABLE ONLY "public"."reference"
    ADD CONSTRAINT "reference_tune_ref_tune_id_fk" FOREIGN KEY ("tune_ref") REFERENCES "public"."tune"("id");



ALTER TABLE ONLY "public"."reference"
    ADD CONSTRAINT "reference_user_ref_user_profile_id_fk" FOREIGN KEY ("user_ref") REFERENCES "public"."user_profile"("id");



ALTER TABLE ONLY "public"."tab_group_main_state"
    ADD CONSTRAINT "tab_group_main_state_playlist_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlist"("playlist_id");



ALTER TABLE ONLY "public"."tab_group_main_state"
    ADD CONSTRAINT "tab_group_main_state_user_id_user_profile_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profile"("id");



ALTER TABLE ONLY "public"."table_state"
    ADD CONSTRAINT "table_state_playlist_id_playlist_playlist_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlist"("playlist_id");



ALTER TABLE ONLY "public"."table_state"
    ADD CONSTRAINT "table_state_user_id_user_profile_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profile"("id");



ALTER TABLE ONLY "public"."table_transient_data"
    ADD CONSTRAINT "table_transient_data_playlist_id_playlist_playlist_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlist"("playlist_id");



ALTER TABLE ONLY "public"."table_transient_data"
    ADD CONSTRAINT "table_transient_data_tune_id_tune_id_fk" FOREIGN KEY ("tune_id") REFERENCES "public"."tune"("id");



ALTER TABLE ONLY "public"."table_transient_data"
    ADD CONSTRAINT "table_transient_data_user_id_user_profile_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profile"("id");



ALTER TABLE ONLY "public"."tag"
    ADD CONSTRAINT "tag_tune_ref_tune_id_fk" FOREIGN KEY ("tune_ref") REFERENCES "public"."tune"("id");



ALTER TABLE ONLY "public"."tag"
    ADD CONSTRAINT "tag_user_ref_user_profile_id_fk" FOREIGN KEY ("user_ref") REFERENCES "public"."user_profile"("id");



ALTER TABLE ONLY "public"."tune"
    ADD CONSTRAINT "tune_genre_genre_id_fk" FOREIGN KEY ("genre") REFERENCES "public"."genre"("id");



ALTER TABLE ONLY "public"."tune_override"
    ADD CONSTRAINT "tune_override_genre_genre_id_fk" FOREIGN KEY ("genre") REFERENCES "public"."genre"("id");



ALTER TABLE ONLY "public"."tune_override"
    ADD CONSTRAINT "tune_override_tune_ref_tune_id_fk" FOREIGN KEY ("tune_ref") REFERENCES "public"."tune"("id");



ALTER TABLE ONLY "public"."tune_override"
    ADD CONSTRAINT "tune_override_user_ref_user_profile_id_fk" FOREIGN KEY ("user_ref") REFERENCES "public"."user_profile"("id");



ALTER TABLE ONLY "public"."tune"
    ADD CONSTRAINT "tune_private_for_user_profile_id_fk" FOREIGN KEY ("private_for") REFERENCES "public"."user_profile"("id");



CREATE POLICY "Authenticated users can view genre-tune type relationships" ON "public"."genre_tune_type" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view genres" ON "public"."genre" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view tune types" ON "public"."tune_type" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can delete own SR preferences" ON "public"."prefs_spaced_repetition" FOR DELETE USING (("user_id" IN ( SELECT "user_profile"."id"
   FROM "public"."user_profile"
  WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete own notes" ON "public"."note" FOR DELETE USING (("user_ref" IN ( SELECT "user_profile"."id"
   FROM "public"."user_profile"
  WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete own playlist tunes" ON "public"."playlist_tune" FOR DELETE USING (("playlist_ref" IN ( SELECT "playlist"."playlist_id"
   FROM "public"."playlist"
  WHERE ("playlist"."user_ref" IN ( SELECT "user_profile"."id"
           FROM "public"."user_profile"
          WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can delete own playlists" ON "public"."playlist" FOR DELETE USING (("user_ref" IN ( SELECT "user_profile"."id"
   FROM "public"."user_profile"
  WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete own practice queue items" ON "public"."daily_practice_queue" FOR DELETE USING (("user_ref" IN ( SELECT "user_profile"."id"
   FROM "public"."user_profile"
  WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete own private instruments" ON "public"."instrument" FOR DELETE USING (("private_to_user" IN ( SELECT "user_profile"."id"
   FROM "public"."user_profile"
  WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete own private tunes" ON "public"."tune" FOR DELETE USING (("private_for" IN ( SELECT "user_profile"."id"
   FROM "public"."user_profile"
  WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete own references" ON "public"."reference" FOR DELETE USING (("user_ref" IN ( SELECT "user_profile"."id"
   FROM "public"."user_profile"
  WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete own scheduling preferences" ON "public"."prefs_scheduling_options" FOR DELETE USING (("user_id" IN ( SELECT "user_profile"."id"
   FROM "public"."user_profile"
  WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete own tab group state" ON "public"."tab_group_main_state" FOR DELETE USING (("user_id" IN ( SELECT "user_profile"."id"
   FROM "public"."user_profile"
  WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete own table state" ON "public"."table_state" FOR DELETE USING (("user_id" IN ( SELECT "user_profile"."id"
   FROM "public"."user_profile"
  WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete own tags" ON "public"."tag" FOR DELETE USING (("user_ref" IN ( SELECT "user_profile"."id"
   FROM "public"."user_profile"
  WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete own transient data" ON "public"."table_transient_data" FOR DELETE USING (("user_id" IN ( SELECT "user_profile"."id"
   FROM "public"."user_profile"
  WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete own tune overrides" ON "public"."tune_override" FOR DELETE USING (("user_ref" IN ( SELECT "user_profile"."id"
   FROM "public"."user_profile"
  WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert own SR preferences" ON "public"."prefs_spaced_repetition" FOR INSERT WITH CHECK (("user_id" IN ( SELECT "user_profile"."id"
   FROM "public"."user_profile"
  WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert own notes" ON "public"."note" FOR INSERT WITH CHECK (("user_ref" IN ( SELECT "user_profile"."id"
   FROM "public"."user_profile"
  WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert own playlist tunes" ON "public"."playlist_tune" FOR INSERT WITH CHECK (("playlist_ref" IN ( SELECT "playlist"."playlist_id"
   FROM "public"."playlist"
  WHERE ("playlist"."user_ref" IN ( SELECT "user_profile"."id"
           FROM "public"."user_profile"
          WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can insert own playlists" ON "public"."playlist" FOR INSERT WITH CHECK (("user_ref" IN ( SELECT "user_profile"."id"
   FROM "public"."user_profile"
  WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert own practice queue items" ON "public"."daily_practice_queue" FOR INSERT WITH CHECK (("user_ref" IN ( SELECT "user_profile"."id"
   FROM "public"."user_profile"
  WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert own practice records" ON "public"."practice_record" FOR INSERT WITH CHECK (("playlist_ref" IN ( SELECT "playlist"."playlist_id"
   FROM "public"."playlist"
  WHERE ("playlist"."user_ref" IN ( SELECT "user_profile"."id"
           FROM "public"."user_profile"
          WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can insert own private instruments" ON "public"."instrument" FOR INSERT WITH CHECK (("private_to_user" IN ( SELECT "user_profile"."id"
   FROM "public"."user_profile"
  WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert own private tunes" ON "public"."tune" FOR INSERT WITH CHECK (("private_for" IN ( SELECT "user_profile"."id"
   FROM "public"."user_profile"
  WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert own profile" ON "public"."user_profile" FOR INSERT WITH CHECK (("auth"."uid"() = "supabase_user_id"));



CREATE POLICY "Users can insert own references" ON "public"."reference" FOR INSERT WITH CHECK (("user_ref" IN ( SELECT "user_profile"."id"
   FROM "public"."user_profile"
  WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert own scheduling preferences" ON "public"."prefs_scheduling_options" FOR INSERT WITH CHECK (("user_id" IN ( SELECT "user_profile"."id"
   FROM "public"."user_profile"
  WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert own tab group state" ON "public"."tab_group_main_state" FOR INSERT WITH CHECK (("user_id" IN ( SELECT "user_profile"."id"
   FROM "public"."user_profile"
  WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert own table state" ON "public"."table_state" FOR INSERT WITH CHECK (("user_id" IN ( SELECT "user_profile"."id"
   FROM "public"."user_profile"
  WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert own tags" ON "public"."tag" FOR INSERT WITH CHECK (("user_ref" IN ( SELECT "user_profile"."id"
   FROM "public"."user_profile"
  WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert own transient data" ON "public"."table_transient_data" FOR INSERT WITH CHECK (("user_id" IN ( SELECT "user_profile"."id"
   FROM "public"."user_profile"
  WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert own tune overrides" ON "public"."tune_override" FOR INSERT WITH CHECK (("user_ref" IN ( SELECT "user_profile"."id"
   FROM "public"."user_profile"
  WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update own SR preferences" ON "public"."prefs_spaced_repetition" FOR UPDATE USING (("user_id" IN ( SELECT "user_profile"."id"
   FROM "public"."user_profile"
  WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update own notes" ON "public"."note" FOR UPDATE USING (("user_ref" IN ( SELECT "user_profile"."id"
   FROM "public"."user_profile"
  WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update own playlist tunes" ON "public"."playlist_tune" FOR UPDATE USING (("playlist_ref" IN ( SELECT "playlist"."playlist_id"
   FROM "public"."playlist"
  WHERE ("playlist"."user_ref" IN ( SELECT "user_profile"."id"
           FROM "public"."user_profile"
          WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can update own playlists" ON "public"."playlist" FOR UPDATE USING (("user_ref" IN ( SELECT "user_profile"."id"
   FROM "public"."user_profile"
  WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update own practice queue items" ON "public"."daily_practice_queue" FOR UPDATE USING (("user_ref" IN ( SELECT "user_profile"."id"
   FROM "public"."user_profile"
  WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update own practice records" ON "public"."practice_record" FOR UPDATE USING (("playlist_ref" IN ( SELECT "playlist"."playlist_id"
   FROM "public"."playlist"
  WHERE ("playlist"."user_ref" IN ( SELECT "user_profile"."id"
           FROM "public"."user_profile"
          WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can update own private instruments" ON "public"."instrument" FOR UPDATE USING (("private_to_user" IN ( SELECT "user_profile"."id"
   FROM "public"."user_profile"
  WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update own private tunes" ON "public"."tune" FOR UPDATE USING (("private_for" IN ( SELECT "user_profile"."id"
   FROM "public"."user_profile"
  WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update own profile" ON "public"."user_profile" FOR UPDATE USING (("auth"."uid"() = "supabase_user_id"));



CREATE POLICY "Users can update own references" ON "public"."reference" FOR UPDATE USING (("user_ref" IN ( SELECT "user_profile"."id"
   FROM "public"."user_profile"
  WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update own scheduling preferences" ON "public"."prefs_scheduling_options" FOR UPDATE USING (("user_id" IN ( SELECT "user_profile"."id"
   FROM "public"."user_profile"
  WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update own tab group state" ON "public"."tab_group_main_state" FOR UPDATE USING (("user_id" IN ( SELECT "user_profile"."id"
   FROM "public"."user_profile"
  WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update own table state" ON "public"."table_state" FOR UPDATE USING (("user_id" IN ( SELECT "user_profile"."id"
   FROM "public"."user_profile"
  WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update own tags" ON "public"."tag" FOR UPDATE USING (("user_ref" IN ( SELECT "user_profile"."id"
   FROM "public"."user_profile"
  WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update own transient data" ON "public"."table_transient_data" FOR UPDATE USING (("user_id" IN ( SELECT "user_profile"."id"
   FROM "public"."user_profile"
  WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update own tune overrides" ON "public"."tune_override" FOR UPDATE USING (("user_ref" IN ( SELECT "user_profile"."id"
   FROM "public"."user_profile"
  WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view own SR preferences" ON "public"."prefs_spaced_repetition" FOR SELECT USING (("user_id" IN ( SELECT "user_profile"."id"
   FROM "public"."user_profile"
  WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view own or public notes" ON "public"."note" FOR SELECT USING ((("user_ref" IN ( SELECT "user_profile"."id"
   FROM "public"."user_profile"
  WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))) OR ("public" = true)));



CREATE POLICY "Users can view own or public references" ON "public"."reference" FOR SELECT USING ((("user_ref" IN ( SELECT "user_profile"."id"
   FROM "public"."user_profile"
  WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))) OR ("public" = true)));



CREATE POLICY "Users can view own playlist tunes" ON "public"."playlist_tune" FOR SELECT USING (("playlist_ref" IN ( SELECT "playlist"."playlist_id"
   FROM "public"."playlist"
  WHERE ("playlist"."user_ref" IN ( SELECT "user_profile"."id"
           FROM "public"."user_profile"
          WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can view own playlists" ON "public"."playlist" FOR SELECT USING (("user_ref" IN ( SELECT "user_profile"."id"
   FROM "public"."user_profile"
  WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view own practice queue" ON "public"."daily_practice_queue" FOR SELECT USING (("user_ref" IN ( SELECT "user_profile"."id"
   FROM "public"."user_profile"
  WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view own practice records" ON "public"."practice_record" FOR SELECT USING (("playlist_ref" IN ( SELECT "playlist"."playlist_id"
   FROM "public"."playlist"
  WHERE ("playlist"."user_ref" IN ( SELECT "user_profile"."id"
           FROM "public"."user_profile"
          WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can view own profile" ON "public"."user_profile" FOR SELECT USING (("auth"."uid"() = "supabase_user_id"));



CREATE POLICY "Users can view own scheduling preferences" ON "public"."prefs_scheduling_options" FOR SELECT USING (("user_id" IN ( SELECT "user_profile"."id"
   FROM "public"."user_profile"
  WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view own tab group state" ON "public"."tab_group_main_state" FOR SELECT USING (("user_id" IN ( SELECT "user_profile"."id"
   FROM "public"."user_profile"
  WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view own table state" ON "public"."table_state" FOR SELECT USING (("user_id" IN ( SELECT "user_profile"."id"
   FROM "public"."user_profile"
  WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view own tags" ON "public"."tag" FOR SELECT USING (("user_ref" IN ( SELECT "user_profile"."id"
   FROM "public"."user_profile"
  WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view own transient data" ON "public"."table_transient_data" FOR SELECT USING (("user_id" IN ( SELECT "user_profile"."id"
   FROM "public"."user_profile"
  WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view own tune overrides" ON "public"."tune_override" FOR SELECT USING (("user_ref" IN ( SELECT "user_profile"."id"
   FROM "public"."user_profile"
  WHERE ("user_profile"."supabase_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view public or own private instruments" ON "public"."instrument" FOR SELECT USING ((("private_to_user" IS NULL) OR ("private_to_user" IN ( SELECT "user_profile"."id"
   FROM "public"."user_profile"
  WHERE ("user_profile"."supabase_user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view public or own private tunes" ON "public"."tune" FOR SELECT USING ((("private_for" IS NULL) OR ("private_for" IN ( SELECT "user_profile"."id"
   FROM "public"."user_profile"
  WHERE ("user_profile"."supabase_user_id" = "auth"."uid"())))));



ALTER TABLE "public"."daily_practice_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."genre" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."genre_tune_type" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."instrument" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."note" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."playlist" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."playlist_tune" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."practice_record" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."prefs_scheduling_options" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."prefs_spaced_repetition" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reference" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tab_group_main_state" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."table_state" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."table_transient_data" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tag" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tune" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tune_override" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tune_type" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profile" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";








































































































































































GRANT ALL ON TABLE "public"."daily_practice_queue" TO "anon";
GRANT ALL ON TABLE "public"."daily_practice_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_practice_queue" TO "service_role";



GRANT ALL ON SEQUENCE "public"."daily_practice_queue_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."daily_practice_queue_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."daily_practice_queue_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."genre" TO "anon";
GRANT ALL ON TABLE "public"."genre" TO "authenticated";
GRANT ALL ON TABLE "public"."genre" TO "service_role";



GRANT ALL ON TABLE "public"."genre_tune_type" TO "anon";
GRANT ALL ON TABLE "public"."genre_tune_type" TO "authenticated";
GRANT ALL ON TABLE "public"."genre_tune_type" TO "service_role";



GRANT ALL ON TABLE "public"."instrument" TO "anon";
GRANT ALL ON TABLE "public"."instrument" TO "authenticated";
GRANT ALL ON TABLE "public"."instrument" TO "service_role";



GRANT ALL ON SEQUENCE "public"."instrument_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."instrument_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."instrument_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."note" TO "anon";
GRANT ALL ON TABLE "public"."note" TO "authenticated";
GRANT ALL ON TABLE "public"."note" TO "service_role";



GRANT ALL ON SEQUENCE "public"."note_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."note_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."note_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."playlist" TO "anon";
GRANT ALL ON TABLE "public"."playlist" TO "authenticated";
GRANT ALL ON TABLE "public"."playlist" TO "service_role";



GRANT ALL ON SEQUENCE "public"."playlist_playlist_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."playlist_playlist_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."playlist_playlist_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."playlist_tune" TO "anon";
GRANT ALL ON TABLE "public"."playlist_tune" TO "authenticated";
GRANT ALL ON TABLE "public"."playlist_tune" TO "service_role";



GRANT ALL ON TABLE "public"."practice_record" TO "anon";
GRANT ALL ON TABLE "public"."practice_record" TO "authenticated";
GRANT ALL ON TABLE "public"."practice_record" TO "service_role";



GRANT ALL ON TABLE "public"."reference" TO "anon";
GRANT ALL ON TABLE "public"."reference" TO "authenticated";
GRANT ALL ON TABLE "public"."reference" TO "service_role";



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



GRANT ALL ON TABLE "public"."practice_list_staged" TO "anon";
GRANT ALL ON TABLE "public"."practice_list_staged" TO "authenticated";
GRANT ALL ON TABLE "public"."practice_list_staged" TO "service_role";



GRANT ALL ON SEQUENCE "public"."practice_record_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."practice_record_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."practice_record_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."prefs_scheduling_options" TO "anon";
GRANT ALL ON TABLE "public"."prefs_scheduling_options" TO "authenticated";
GRANT ALL ON TABLE "public"."prefs_scheduling_options" TO "service_role";



GRANT ALL ON TABLE "public"."prefs_spaced_repetition" TO "anon";
GRANT ALL ON TABLE "public"."prefs_spaced_repetition" TO "authenticated";
GRANT ALL ON TABLE "public"."prefs_spaced_repetition" TO "service_role";



GRANT ALL ON SEQUENCE "public"."reference_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."reference_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."reference_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."tab_group_main_state" TO "anon";
GRANT ALL ON TABLE "public"."tab_group_main_state" TO "authenticated";
GRANT ALL ON TABLE "public"."tab_group_main_state" TO "service_role";



GRANT ALL ON SEQUENCE "public"."tab_group_main_state_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."tab_group_main_state_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tab_group_main_state_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."table_state" TO "anon";
GRANT ALL ON TABLE "public"."table_state" TO "authenticated";
GRANT ALL ON TABLE "public"."table_state" TO "service_role";



GRANT ALL ON SEQUENCE "public"."tag_tag_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."tag_tag_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tag_tag_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."tune_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."tune_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tune_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."tune_override_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."tune_override_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tune_override_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."tune_type" TO "anon";
GRANT ALL ON TABLE "public"."tune_type" TO "authenticated";
GRANT ALL ON TABLE "public"."tune_type" TO "service_role";



GRANT ALL ON TABLE "public"."user_profile" TO "anon";
GRANT ALL ON TABLE "public"."user_profile" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profile" TO "service_role";



GRANT ALL ON SEQUENCE "public"."user_profile_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_profile_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_profile_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."view_playlist_joined" TO "anon";
GRANT ALL ON TABLE "public"."view_playlist_joined" TO "authenticated";
GRANT ALL ON TABLE "public"."view_playlist_joined" TO "service_role";









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































RESET ALL;

