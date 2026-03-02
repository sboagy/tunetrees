-- Migration: Create goal table
-- Issue #426 — User-Defined Goals, Goal Badge UX, and Scheduling Integration
--
-- Adds a first-class `goal` table keyed by (name, private_for).
-- System goals have private_for = NULL and are visible to all users.
-- User-created goals have private_for = user_profile.id and are user-private.
-- Soft-delete via `deleted` boolean; physical rows are kept for sync tombstones.
--
-- RLS mirrors the plugin table pattern:
--   SELECT  → own rows OR system rows (private_for IS NULL)
--   INSERT  → own rows only (private_for = auth.uid())
--   UPDATE  → own rows only
--   DELETE  → own rows only (system goals cannot be deleted via API)

-- ─── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "public"."goal" (
    "id"                "uuid"      DEFAULT "gen_random_uuid"() NOT NULL,
    "name"              "text"      NOT NULL,
    "private_for"       "uuid"      REFERENCES "public"."user_profile"("id") ON DELETE CASCADE,
    "default_technique" "text"      NOT NULL DEFAULT 'fsrs',
    "base_intervals"    "text",
    "deleted"           boolean     DEFAULT false NOT NULL,
    "sync_version"      integer     DEFAULT 1 NOT NULL,
    "last_modified_at"  timestamp without time zone DEFAULT "now"() NOT NULL,
    "device_id"         "text",
    CONSTRAINT "goal_pkey" PRIMARY KEY ("id"),
    -- Treat NULL as equal so (name='recall', private_for=NULL) is unique.
    -- Requires PostgreSQL 15+ (available on all current Supabase projects).
    CONSTRAINT "goal_name_owner_uniq" UNIQUE NULLS NOT DISTINCT ("name", "private_for")
);

ALTER TABLE ONLY "public"."goal" FORCE ROW LEVEL SECURITY;
ALTER TABLE "public"."goal" OWNER TO "postgres";

-- ─── Comments ─────────────────────────────────────────────────────────────────

COMMENT ON TABLE  "public"."goal" IS 'Practice goals with optional per-goal scheduling technique.';
COMMENT ON COLUMN "public"."goal"."private_for"       IS 'Owner user_profile.id; NULL = system goal visible to all users.';
COMMENT ON COLUMN "public"."goal"."default_technique" IS 'One of: fsrs, base_interval, or a plugin id string.';
COMMENT ON COLUMN "public"."goal"."base_intervals"    IS 'JSON array of day-values; used when default_technique = base_interval.';
COMMENT ON COLUMN "public"."goal"."sync_version"      IS 'Sync version for conflict resolution.';
COMMENT ON COLUMN "public"."goal"."last_modified_at"  IS 'Timestamp of last modification.';
COMMENT ON COLUMN "public"."goal"."device_id"         IS 'Device that last modified this record.';

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX "idx_goal_private_for" ON "public"."goal" USING "btree" ("private_for");

-- ─── RLS Policies ─────────────────────────────────────────────────────────────

ALTER TABLE "public"."goal" ENABLE ROW LEVEL SECURITY;

-- SELECT: own goals OR system goals (private_for IS NULL)
CREATE POLICY "Users can view own or system goals"
  ON "public"."goal"
  FOR SELECT
  USING (("private_for" = "auth"."uid"()) OR ("private_for" IS NULL));

-- INSERT: can only insert rows owned by themselves
CREATE POLICY "Users can insert own goals"
  ON "public"."goal"
  FOR INSERT
  WITH CHECK ("private_for" = "auth"."uid"());

-- UPDATE: can only update rows they own
CREATE POLICY "Users can update own goals"
  ON "public"."goal"
  FOR UPDATE
  USING ("private_for" = "auth"."uid"());

-- DELETE: can only delete rows they own (system goals are protected)
CREATE POLICY "Users can delete own goals"
  ON "public"."goal"
  FOR DELETE
  USING ("private_for" = "auth"."uid"());

-- ─── Grants ───────────────────────────────────────────────────────────────────

GRANT ALL ON TABLE "public"."goal" TO "anon";
GRANT ALL ON TABLE "public"."goal" TO "authenticated";
GRANT ALL ON TABLE "public"."goal" TO "service_role";

-- ─── Seed data: system goals ──────────────────────────────────────────────────
-- private_for = NULL means these are visible to (and shared across) all users.
-- They cannot be modified via RLS by any authenticated user.

INSERT INTO "public"."goal"
    ("id", "name", "private_for", "default_technique", "base_intervals")
VALUES
    -- recall: pure FSRS spaced-repetition (the original baseline goal)
    ('00000000-0000-0000-0000-000000000001', 'recall',              NULL, 'fsrs',           NULL),
    -- initial_learn: short-interval ladder for first-pass memorisation
    ('00000000-0000-0000-0000-000000000002', 'initial_learn',       NULL, 'base_interval',  '[0.1, 0.5, 1, 2, 4]'),
    -- fluency: medium-interval ladder for comfortable playing
    ('00000000-0000-0000-0000-000000000003', 'fluency',             NULL, 'base_interval',  '[1, 3, 7, 14, 21]'),
    -- session_ready: tight ladder for tunes needed in an upcoming session
    ('00000000-0000-0000-0000-000000000004', 'session_ready',       NULL, 'base_interval',  '[0.5, 1, 2, 3, 5]'),
    -- performance_polish: longer ladder for concert-ready material
    ('00000000-0000-0000-0000-000000000005', 'performance_polish',  NULL, 'base_interval',  '[2, 5, 10, 15, 21]')
ON CONFLICT ("id") DO NOTHING;
