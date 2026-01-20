SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;

CREATE TABLE IF NOT EXISTS "public"."plugin" (
  "id" "uuid" DEFAULT gen_random_uuid() NOT NULL,
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
  "last_modified_at" timestamp without time zone DEFAULT now() NOT NULL,
  "device_id" "text"
);

ALTER TABLE "public"."plugin" OWNER TO "postgres";

ALTER TABLE "public"."plugin" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own or public plugins"
  ON "public"."plugin" FOR SELECT
  USING (
    "is_public" = true
    OR "user_ref" IN (
      SELECT "id" FROM "public"."user_profile" WHERE "supabase_user_id" = auth.uid()
    )
  );

CREATE POLICY "Users can insert own plugins"
  ON "public"."plugin" FOR INSERT
  WITH CHECK (
    "user_ref" IN (
      SELECT "id" FROM "public"."user_profile" WHERE "supabase_user_id" = auth.uid()
    )
  );

CREATE POLICY "Users can update own plugins"
  ON "public"."plugin" FOR UPDATE
  USING (
    "user_ref" IN (
      SELECT "id" FROM "public"."user_profile" WHERE "supabase_user_id" = auth.uid()
    )
  );

CREATE POLICY "Users can delete own plugins"
  ON "public"."plugin" FOR DELETE
  USING (
    "user_ref" IN (
      SELECT "id" FROM "public"."user_profile" WHERE "supabase_user_id" = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS "idx_plugin_user_ref" ON "public"."plugin" USING "btree" ("user_ref");
CREATE INDEX IF NOT EXISTS "idx_plugin_public" ON "public"."plugin" USING "btree" ("is_public");
