-- Migration: Create media_asset table for uploaded audio reference metadata
-- Issues #536 and #538
--
-- Uploaded audio continues to use the existing `reference` table with
-- ref_type = 'audio'. This table stores the worker-backed R2 metadata and the
-- persisted waveform/loop regions for the linked reference.

CREATE TABLE IF NOT EXISTS "public"."media_asset" (
    "id"                "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reference_ref"     "uuid" NOT NULL REFERENCES "public"."reference"("id") ON DELETE CASCADE,
    "user_ref"          "uuid" NOT NULL REFERENCES "public"."user_profile"("id") ON DELETE CASCADE,
    "storage_path"      "text" NOT NULL,
    "original_filename" "text" NOT NULL,
    "content_type"      "text" NOT NULL,
    "file_size_bytes"   integer NOT NULL,
    "duration_seconds"  double precision,
    "regions_json"      "text",
    "deleted"           boolean DEFAULT false NOT NULL,
    "sync_version"      integer DEFAULT 1 NOT NULL,
    "last_modified_at"  timestamp without time zone DEFAULT "now"() NOT NULL,
    "device_id"         "text",
    CONSTRAINT "media_asset_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "media_asset_reference_ref_key" UNIQUE ("reference_ref"),
    CONSTRAINT "media_asset_storage_path_key" UNIQUE ("storage_path"),
    CONSTRAINT "media_asset_file_size_bytes_nonnegative" CHECK (("file_size_bytes" >= 0))
);

ALTER TABLE ONLY "public"."media_asset" FORCE ROW LEVEL SECURITY;
ALTER TABLE "public"."media_asset" OWNER TO "postgres";

COMMENT ON TABLE "public"."media_asset" IS 'Worker-backed metadata for uploaded media linked to tune references.';
COMMENT ON COLUMN "public"."media_asset"."reference_ref" IS 'Reference row that owns this uploaded media asset.';
COMMENT ON COLUMN "public"."media_asset"."user_ref" IS 'Owner user_profile.id for auth scoping and sync.';
COMMENT ON COLUMN "public"."media_asset"."storage_path" IS 'Private R2 object key under the user namespace.';
COMMENT ON COLUMN "public"."media_asset"."original_filename" IS 'Original client-side filename captured at upload time.';
COMMENT ON COLUMN "public"."media_asset"."content_type" IS 'Uploaded media MIME type.';
COMMENT ON COLUMN "public"."media_asset"."file_size_bytes" IS 'Uploaded media size in bytes.';
COMMENT ON COLUMN "public"."media_asset"."duration_seconds" IS 'Decoded audio duration in seconds.';
COMMENT ON COLUMN "public"."media_asset"."regions_json" IS 'JSON-encoded WaveSurfer regions/markers for looping and annotations.';
COMMENT ON COLUMN "public"."media_asset"."deleted" IS 'Soft-delete flag for the media asset.';
COMMENT ON COLUMN "public"."media_asset"."sync_version" IS 'Sync version for conflict resolution.';
COMMENT ON COLUMN "public"."media_asset"."last_modified_at" IS 'Timestamp of last modification.';
COMMENT ON COLUMN "public"."media_asset"."device_id" IS 'Device that last modified this record.';

CREATE INDEX "idx_media_asset_user_ref" ON "public"."media_asset" USING "btree" ("user_ref");

ALTER TABLE "public"."media_asset" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own media assets"
  ON "public"."media_asset"
  FOR SELECT
  USING ("user_ref" = "auth"."uid"());

CREATE POLICY "Users can insert own media assets"
  ON "public"."media_asset"
  FOR INSERT
  WITH CHECK ("user_ref" = "auth"."uid"());

CREATE POLICY "Users can update own media assets"
  ON "public"."media_asset"
  FOR UPDATE
  USING ("user_ref" = "auth"."uid"())
  WITH CHECK ("user_ref" = "auth"."uid"());

CREATE POLICY "Users can delete own media assets"
  ON "public"."media_asset"
  FOR DELETE
  USING ("user_ref" = "auth"."uid"());

GRANT ALL ON TABLE "public"."media_asset" TO "anon";
GRANT ALL ON TABLE "public"."media_asset" TO "authenticated";
GRANT ALL ON TABLE "public"."media_asset" TO "service_role";

CREATE OR REPLACE FUNCTION "public"."sync_get_user_media_assets"(
  "p_user_id" "uuid",
  "p_genre_ids" "text"[],
  "p_after_timestamp" timestamp with time zone DEFAULT NULL::timestamp with time zone,
  "p_limit" integer DEFAULT 1000,
  "p_offset" integer DEFAULT 0
) RETURNS SETOF "public"."media_asset"
    LANGUAGE "sql" STABLE
    AS $$
  SELECT m.*
  FROM media_asset m
  JOIN reference r ON m.reference_ref = r.id
  JOIN tune t ON r.tune_ref = t.id
  WHERE (
    (t.genre = ANY(p_genre_ids) AND t.private_for IS NULL)
    OR t.private_for = p_user_id
  )
  AND m.user_ref = p_user_id
  AND r.user_ref = p_user_id
  AND m.deleted = FALSE
  AND r.deleted = FALSE
  AND (
    p_after_timestamp IS NULL OR m.last_modified_at > p_after_timestamp
  )
  AND t.deleted = FALSE
  ORDER BY m.last_modified_at ASC, m.id ASC
  LIMIT p_limit
  OFFSET p_offset;
$$;

ALTER FUNCTION "public"."sync_get_user_media_assets"(
  "p_user_id" "uuid",
  "p_genre_ids" "text"[],
  "p_after_timestamp" timestamp with time zone,
  "p_limit" integer,
  "p_offset" integer
) OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."sync_get_user_media_assets"(
  "p_user_id" "uuid",
  "p_genre_ids" "text"[],
  "p_after_timestamp" timestamp with time zone,
  "p_limit" integer,
  "p_offset" integer
) TO "anon";
GRANT ALL ON FUNCTION "public"."sync_get_user_media_assets"(
  "p_user_id" "uuid",
  "p_genre_ids" "text"[],
  "p_after_timestamp" timestamp with time zone,
  "p_limit" integer,
  "p_offset" integer
) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_get_user_media_assets"(
  "p_user_id" "uuid",
  "p_genre_ids" "text"[],
  "p_after_timestamp" timestamp with time zone,
  "p_limit" integer,
  "p_offset" integer
) TO "service_role";