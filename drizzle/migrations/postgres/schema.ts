import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgPolicy,
  pgTable,
  pgView,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const tabGroupMainState = pgTable(
  "tab_group_main_state",
  {
    id: serial().primaryKey().notNull(),
    userId: integer("user_id").notNull(),
    whichTab: text("which_tab").default("practice"),
    repertoireId: integer("repertoire_id"),
    tabSpec: text("tab_spec"),
    practiceShowSubmitted: integer("practice_show_submitted").default(0),
    practiceModeFlashcard: integer("practice_mode_flashcard").default(0),
    syncVersion: integer("sync_version").default(1).notNull(),
    lastModifiedAt: timestamp("last_modified_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    deviceId: text("device_id"),
  },
  (table) => [
    foreignKey({
      columns: [table.repertoireId],
      foreignColumns: [repertoire.repertoireId],
      name: "tab_group_main_state_repertoire_fk",
    }),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [userProfile.id],
      name: "tab_group_main_state_user_id_user_profile_id_fk",
    }),
    pgPolicy("Users can view own tab group state", {
      as: "permissive",
      for: "select",
      to: ["public"],
      using: sql`(user_id IN ( SELECT user_profile.id
   FROM user_profile
  WHERE (user_profile.supabase_user_id = auth.uid())))`,
    }),
    pgPolicy("Users can insert own tab group state", {
      as: "permissive",
      for: "insert",
      to: ["public"],
    }),
    pgPolicy("Users can update own tab group state", {
      as: "permissive",
      for: "update",
      to: ["public"],
    }),
    pgPolicy("Users can delete own tab group state", {
      as: "permissive",
      for: "delete",
      to: ["public"],
    }),
    check(
      "check_name",
      sql`which_tab = ANY (ARRAY['scheduled'::text, 'repertoire'::text, 'catalog'::text, 'analysis'::text])`
    ),
  ]
);

export const tuneType = pgTable(
  "tune_type",
  {
    id: text().primaryKey().notNull(),
    name: text(),
    rhythm: text(),
    description: text(),
  },
  () => [
    pgPolicy("Authenticated users can view tune types", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`true`,
    }),
  ]
);

export const tag = pgTable(
  "tag",
  {
    tagId: serial("tag_id").primaryKey().notNull(),
    userRef: integer("user_ref").notNull(),
    tuneRef: integer("tune_ref").notNull(),
    tagText: text("tag_text").notNull(),
    syncVersion: integer("sync_version").default(1).notNull(),
    lastModifiedAt: timestamp("last_modified_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    deviceId: text("device_id"),
  },
  (table) => [
    index("idx_tag_user_ref_tag_text").using(
      "btree",
      table.userRef.asc().nullsLast().op("int4_ops"),
      table.tagText.asc().nullsLast().op("text_ops")
    ),
    index("idx_tag_user_ref_tune_ref").using(
      "btree",
      table.userRef.asc().nullsLast().op("int4_ops"),
      table.tuneRef.asc().nullsLast().op("int4_ops")
    ),
    foreignKey({
      columns: [table.tuneRef],
      foreignColumns: [tune.id],
      name: "tag_tune_ref_tune_id_fk",
    }),
    foreignKey({
      columns: [table.userRef],
      foreignColumns: [userProfile.id],
      name: "tag_user_ref_user_profile_id_fk",
    }),
    unique("tag_user_ref_tune_ref_tag_text_unique").on(
      table.userRef,
      table.tuneRef,
      table.tagText
    ),
    pgPolicy("Users can view own tags", {
      as: "permissive",
      for: "select",
      to: ["public"],
      using: sql`(user_ref IN ( SELECT user_profile.id
   FROM user_profile
  WHERE (user_profile.supabase_user_id = auth.uid())))`,
    }),
    pgPolicy("Users can insert own tags", {
      as: "permissive",
      for: "insert",
      to: ["public"],
    }),
    pgPolicy("Users can update own tags", {
      as: "permissive",
      for: "update",
      to: ["public"],
    }),
    pgPolicy("Users can delete own tags", {
      as: "permissive",
      for: "delete",
      to: ["public"],
    }),
  ]
);

export const userProfile = pgTable(
  "user_profile",
  {
    id: serial().primaryKey().notNull(),
    supabaseUserId: uuid("supabase_user_id").notNull(),
    name: text(),
    email: text(),
    srAlgType: text("sr_alg_type"),
    phone: text(),
    phoneVerified: timestamp("phone_verified", { mode: "string" }),
    acceptableDelinquencyWindow: integer(
      "acceptable_delinquency_window"
    ).default(21),
    deleted: boolean().default(false).notNull(),
    syncVersion: integer("sync_version").default(1).notNull(),
    lastModifiedAt: timestamp("last_modified_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    deviceId: text("device_id"),
  },
  (table) => [
    unique("user_profile_supabase_user_id_unique").on(table.supabaseUserId),
    pgPolicy("Users can view own profile", {
      as: "permissive",
      for: "select",
      to: ["public"],
      using: sql`(auth.uid() = supabase_user_id)`,
    }),
    pgPolicy("Users can update own profile", {
      as: "permissive",
      for: "update",
      to: ["public"],
    }),
    pgPolicy("Users can insert own profile", {
      as: "permissive",
      for: "insert",
      to: ["public"],
    }),
  ]
);

export const practiceRecord = pgTable(
  "practice_record",
  {
    id: serial().primaryKey().notNull(),
    repertoireRef: integer("repertoire_ref").notNull(),
    tuneRef: integer("tune_ref").notNull(),
    practiced: timestamp({ mode: "string" }),
    quality: integer(),
    easiness: real(),
    difficulty: real(),
    stability: real(),
    interval: integer(),
    step: integer(),
    repetitions: integer(),
    lapses: integer(),
    elapsedDays: integer("elapsed_days"),
    state: integer(),
    due: timestamp({ mode: "string" }),
    backupPracticed: timestamp("backup_practiced", { mode: "string" }),
    goal: text().default("recall"),
    technique: text(),
    syncVersion: integer("sync_version").default(1).notNull(),
    lastModifiedAt: timestamp("last_modified_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    deviceId: text("device_id"),
  },
  (table) => [
    index("idx_practice_record_id").using(
      "btree",
      table.id.desc().nullsLast().op("int4_ops")
    ),
    index("idx_practice_record_practiced").using(
      "btree",
      table.practiced.desc().nullsLast().op("timestamp_ops")
    ),
    index("idx_practice_record_tune_repertoire_practiced").using(
      "btree",
      table.tuneRef.asc().nullsLast().op("int4_ops"),
      table.repertoireRef.asc().nullsLast().op("timestamp_ops"),
      table.practiced.desc().nullsLast().op("timestamp_ops")
    ),
    foreignKey({
      columns: [table.repertoireRef],
      foreignColumns: [repertoire.repertoireId],
      name: "practice_record_repertoire_ref_repertoire_repertoire_id_fk",
    }),
    foreignKey({
      columns: [table.tuneRef],
      foreignColumns: [tune.id],
      name: "practice_record_tune_ref_tune_id_fk",
    }),
    unique("practice_record_tune_ref_repertoire_ref_practiced_unique").on(
      table.repertoireRef,
      table.tuneRef,
      table.practiced
    ),
    pgPolicy("Users can view own practice records", {
      as: "permissive",
      for: "select",
      to: ["public"],
      using: sql`(repertoire_ref IN ( SELECT repertoire.repertoire_id
   FROM repertoire
  WHERE (repertoire.user_ref IN ( SELECT user_profile.id
           FROM user_profile
          WHERE (user_profile.supabase_user_id = auth.uid())))))`,
    }),
    pgPolicy("Users can insert own practice records", {
      as: "permissive",
      for: "insert",
      to: ["public"],
    }),
    pgPolicy("Users can update own practice records", {
      as: "permissive",
      for: "update",
      to: ["public"],
    }),
  ]
);

export const tune = pgTable(
  "tune",
  {
    id: serial().primaryKey().notNull(),
    title: text(),
    type: text(),
    structure: text(),
    mode: text(),
    incipit: text(),
    genre: text(),
    privateFor: integer("private_for"),
    deleted: boolean().default(false).notNull(),
    syncVersion: integer("sync_version").default(1).notNull(),
    lastModifiedAt: timestamp("last_modified_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    deviceId: text("device_id"),
  },
  (table) => [
    foreignKey({
      columns: [table.genre],
      foreignColumns: [genre.id],
      name: "tune_genre_genre_id_fk",
    }),
    foreignKey({
      columns: [table.privateFor],
      foreignColumns: [userProfile.id],
      name: "tune_private_for_user_profile_id_fk",
    }),
    pgPolicy("Users can view public or own private tunes", {
      as: "permissive",
      for: "select",
      to: ["public"],
      using: sql`((private_for IS NULL) OR (private_for IN ( SELECT user_profile.id
   FROM user_profile
  WHERE (user_profile.supabase_user_id = auth.uid()))))`,
    }),
    pgPolicy("Users can insert own private tunes", {
      as: "permissive",
      for: "insert",
      to: ["public"],
    }),
    pgPolicy("Users can update own private tunes", {
      as: "permissive",
      for: "update",
      to: ["public"],
    }),
    pgPolicy("Users can delete own private tunes", {
      as: "permissive",
      for: "delete",
      to: ["public"],
    }),
  ]
);

export const tuneOverride = pgTable(
  "tune_override",
  {
    id: serial().primaryKey().notNull(),
    tuneRef: integer("tune_ref").notNull(),
    userRef: integer("user_ref").notNull(),
    title: text(),
    type: text(),
    structure: text(),
    genre: text(),
    mode: text(),
    incipit: text(),
    deleted: boolean().default(false).notNull(),
    syncVersion: integer("sync_version").default(1).notNull(),
    lastModifiedAt: timestamp("last_modified_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    deviceId: text("device_id"),
  },
  (table) => [
    foreignKey({
      columns: [table.genre],
      foreignColumns: [genre.id],
      name: "tune_override_genre_genre_id_fk",
    }),
    foreignKey({
      columns: [table.tuneRef],
      foreignColumns: [tune.id],
      name: "tune_override_tune_ref_tune_id_fk",
    }),
    foreignKey({
      columns: [table.userRef],
      foreignColumns: [userProfile.id],
      name: "tune_override_user_ref_user_profile_id_fk",
    }),
    pgPolicy("Users can view own tune overrides", {
      as: "permissive",
      for: "select",
      to: ["public"],
      using: sql`(user_ref IN ( SELECT user_profile.id
   FROM user_profile
  WHERE (user_profile.supabase_user_id = auth.uid())))`,
    }),
    pgPolicy("Users can insert own tune overrides", {
      as: "permissive",
      for: "insert",
      to: ["public"],
    }),
    pgPolicy("Users can update own tune overrides", {
      as: "permissive",
      for: "update",
      to: ["public"],
    }),
    pgPolicy("Users can delete own tune overrides", {
      as: "permissive",
      for: "delete",
      to: ["public"],
    }),
  ]
);

export const instrument = pgTable(
  "instrument",
  {
    id: serial().primaryKey().notNull(),
    privateToUser: integer("private_to_user"),
    instrument: text(),
    description: text(),
    genreDefault: text("genre_default"),
    deleted: boolean().default(false).notNull(),
    syncVersion: integer("sync_version").default(1).notNull(),
    lastModifiedAt: timestamp("last_modified_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    deviceId: text("device_id"),
  },
  (table) => [
    index("idx_instrument_instrument").using(
      "btree",
      table.instrument.asc().nullsLast().op("text_ops")
    ),
    index("idx_instrument_private_to_user").using(
      "btree",
      table.privateToUser.asc().nullsLast().op("int4_ops")
    ),
    foreignKey({
      columns: [table.genreDefault],
      foreignColumns: [genre.id],
      name: "instrument_genre_fk",
    }),
    foreignKey({
      columns: [table.privateToUser],
      foreignColumns: [userProfile.id],
      name: "instrument_private_to_user_user_profile_id_fk",
    }),
    unique("instrument_private_to_user_instrument_unique").on(
      table.privateToUser,
      table.instrument
    ),
    pgPolicy("Users can view public or own private instruments", {
      as: "permissive",
      for: "select",
      to: ["public"],
      using: sql`((private_to_user IS NULL) OR (private_to_user IN ( SELECT user_profile.id
   FROM user_profile
  WHERE (user_profile.supabase_user_id = auth.uid()))))`,
    }),
    pgPolicy("Users can insert own private instruments", {
      as: "permissive",
      for: "insert",
      to: ["public"],
    }),
    pgPolicy("Users can update own private instruments", {
      as: "permissive",
      for: "update",
      to: ["public"],
    }),
    pgPolicy("Users can delete own private instruments", {
      as: "permissive",
      for: "delete",
      to: ["public"],
    }),
  ]
);

export const dailyPracticeQueue = pgTable(
  "daily_practice_queue",
  {
    id: serial().primaryKey().notNull(),
    userRef: integer("user_ref").notNull(),
    repertoireRef: integer("repertoire_ref").notNull(),
    mode: text(),
    queueDate: timestamp("queue_date", { mode: "string" }),
    windowStartUtc: timestamp("window_start_utc", { mode: "string" }).notNull(),
    windowEndUtc: timestamp("window_end_utc", { mode: "string" }).notNull(),
    tuneRef: integer("tune_ref").notNull(),
    bucket: integer().notNull(),
    orderIndex: integer("order_index").notNull(),
    snapshotCoalescedTs: timestamp("snapshot_coalesced_ts", {
      mode: "string",
    }).notNull(),
    scheduledSnapshot: text("scheduled_snapshot"),
    latestDueSnapshot: text("latest_due_snapshot"),
    acceptableDelinquencyWindowSnapshot: integer(
      "acceptable_delinquency_window_snapshot"
    ),
    tzOffsetMinutesSnapshot: integer("tz_offset_minutes_snapshot"),
    generatedAt: timestamp("generated_at", { mode: "string" }).notNull(),
    completedAt: timestamp("completed_at", { mode: "string" }),
    exposuresRequired: integer("exposures_required"),
    exposuresCompleted: integer("exposures_completed").default(0),
    outcome: text(),
    active: boolean().default(true).notNull(),
    syncVersion: integer("sync_version").default(1).notNull(),
    lastModifiedAt: timestamp("last_modified_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    deviceId: text("device_id"),
  },
  (table) => [
    index("idx_queue_generated_at").using(
      "btree",
      table.generatedAt.asc().nullsLast().op("timestamp_ops")
    ),
    index("idx_queue_user_repertoire_active").using(
      "btree",
      table.userRef.asc().nullsLast().op("int4_ops"),
      table.repertoireRef.asc().nullsLast().op("bool_ops"),
      table.active.asc().nullsLast().op("bool_ops")
    ),
    index("idx_queue_user_repertoire_bucket").using(
      "btree",
      table.userRef.asc().nullsLast().op("int4_ops"),
      table.repertoireRef.asc().nullsLast().op("int4_ops"),
      table.bucket.asc().nullsLast().op("int4_ops")
    ),
    index("idx_queue_user_repertoire_window").using(
      "btree",
      table.userRef.asc().nullsLast().op("int4_ops"),
      table.repertoireRef.asc().nullsLast().op("timestamp_ops"),
      table.windowStartUtc.asc().nullsLast().op("int4_ops")
    ),
    foreignKey({
      columns: [table.repertoireRef],
      foreignColumns: [repertoire.repertoireId],
      name: "daily_practice_queue_repertoire_fk",
    }),
    foreignKey({
      columns: [table.tuneRef],
      foreignColumns: [tune.id],
      name: "daily_practice_queue_tune_fk",
    }),
    foreignKey({
      columns: [table.userRef],
      foreignColumns: [userProfile.id],
      name: "daily_practice_queue_user_profile_fk",
    }),
    unique(
      "daily_practice_queue_user_ref_repertoire_ref_window_start_utc_tun"
    ).on(table.userRef, table.repertoireRef, table.windowStartUtc, table.tuneRef),
    pgPolicy("Users can view own practice queue", {
      as: "permissive",
      for: "select",
      to: ["public"],
      using: sql`(user_ref IN ( SELECT user_profile.id
   FROM user_profile
  WHERE (user_profile.supabase_user_id = auth.uid())))`,
    }),
    pgPolicy("Users can insert own practice queue items", {
      as: "permissive",
      for: "insert",
      to: ["public"],
    }),
    pgPolicy("Users can update own practice queue items", {
      as: "permissive",
      for: "update",
      to: ["public"],
    }),
    pgPolicy("Users can delete own practice queue items", {
      as: "permissive",
      for: "delete",
      to: ["public"],
    }),
  ]
);

export const genre = pgTable(
  "genre",
  {
    id: text().primaryKey().notNull(),
    name: text(),
    region: text(),
    description: text(),
  },
  () => [
    pgPolicy("Authenticated users can view genres", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`true`,
    }),
  ]
);

export const note = pgTable(
  "note",
  {
    id: serial().primaryKey().notNull(),
    userRef: integer("user_ref"),
    tuneRef: integer("tune_ref").notNull(),
    repertoireRef: integer("repertoire_ref"),
    createdDate: timestamp("created_date", { mode: "string" }),
    noteText: text("note_text"),
    public: boolean().default(false).notNull(),
    favorite: boolean(),
    deleted: boolean().default(false).notNull(),
    syncVersion: integer("sync_version").default(1).notNull(),
    lastModifiedAt: timestamp("last_modified_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    deviceId: text("device_id"),
  },
  (table) => [
    index("idx_note_tune_repertoire").using(
      "btree",
      table.tuneRef.asc().nullsLast().op("int4_ops"),
      table.repertoireRef.asc().nullsLast().op("int4_ops")
    ),
    index("idx_note_tune_repertoire_user_public").using(
      "btree",
      table.tuneRef.asc().nullsLast().op("int4_ops"),
      table.repertoireRef.asc().nullsLast().op("bool_ops"),
      table.userRef.asc().nullsLast().op("int4_ops"),
      table.public.asc().nullsLast().op("bool_ops")
    ),
    index("idx_note_tune_user").using(
      "btree",
      table.tuneRef.asc().nullsLast().op("int4_ops"),
      table.userRef.asc().nullsLast().op("int4_ops")
    ),
    foreignKey({
      columns: [table.repertoireRef],
      foreignColumns: [repertoire.repertoireId],
      name: "note_repertoire_ref_repertoire_repertoire_id_fk",
    }),
    foreignKey({
      columns: [table.tuneRef],
      foreignColumns: [tune.id],
      name: "note_tune_ref_tune_id_fk",
    }),
    foreignKey({
      columns: [table.userRef],
      foreignColumns: [userProfile.id],
      name: "note_user_ref_user_profile_id_fk",
    }),
    pgPolicy("Users can view own or public notes", {
      as: "permissive",
      for: "select",
      to: ["public"],
      using: sql`((user_ref IN ( SELECT user_profile.id
   FROM user_profile
  WHERE (user_profile.supabase_user_id = auth.uid()))) OR (public = true))`,
    }),
    pgPolicy("Users can insert own notes", {
      as: "permissive",
      for: "insert",
      to: ["public"],
    }),
    pgPolicy("Users can update own notes", {
      as: "permissive",
      for: "update",
      to: ["public"],
    }),
    pgPolicy("Users can delete own notes", {
      as: "permissive",
      for: "delete",
      to: ["public"],
    }),
    check("chk_favorite_bool", sql`favorite = ANY (ARRAY[true, false])`),
    check("chk_public_bool", sql`public = ANY (ARRAY[true, false])`),
  ]
);

export const repertoire = pgTable(
  "repertoire",
  {
    repertoireId: serial("repertoire_id").primaryKey().notNull(),
    userRef: integer("user_ref").notNull(),
    instrumentRef: integer("instrument_ref"),
    srAlgType: text("sr_alg_type"),
    deleted: boolean().default(false).notNull(),
    syncVersion: integer("sync_version").default(1).notNull(),
    lastModifiedAt: timestamp("last_modified_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    deviceId: text("device_id"),
    name: text(),
    genreDefault: text("genre_default"),
  },
  (table) => [
    foreignKey({
      columns: [table.instrumentRef],
      foreignColumns: [instrument.id],
      name: "repertoire_instrument_fk",
    }),
    foreignKey({
      columns: [table.userRef],
      foreignColumns: [userProfile.id],
      name: "repertoire_user_ref_user_profile_id_fk",
    }),
    unique("repertoire_user_ref_instrument_ref_unique").on(
      table.userRef,
      table.instrumentRef
    ),
    pgPolicy("Users can view own repertoires", {
      as: "permissive",
      for: "select",
      to: ["public"],
      using: sql`(user_ref IN ( SELECT user_profile.id
   FROM user_profile
  WHERE (user_profile.supabase_user_id = auth.uid())))`,
    }),
    pgPolicy("Users can insert own repertoires", {
      as: "permissive",
      for: "insert",
      to: ["public"],
    }),
    pgPolicy("Users can update own repertoires", {
      as: "permissive",
      for: "update",
      to: ["public"],
    }),
    pgPolicy("Users can delete own repertoires", {
      as: "permissive",
      for: "delete",
      to: ["public"],
    }),
  ]
);

export const prefsSchedulingOptions = pgTable(
  "prefs_scheduling_options",
  {
    userId: integer("user_id").primaryKey().notNull(),
    acceptableDelinquencyWindow: integer("acceptable_delinquency_window")
      .default(21)
      .notNull(),
    minReviewsPerDay: integer("min_reviews_per_day"),
    maxReviewsPerDay: integer("max_reviews_per_day"),
    daysPerWeek: integer("days_per_week"),
    weeklyRules: text("weekly_rules"),
    exceptions: text(),
    syncVersion: integer("sync_version").default(1).notNull(),
    lastModifiedAt: timestamp("last_modified_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    deviceId: text("device_id"),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [userProfile.id],
      name: "prefs_scheduling_options_user_id_user_profile_id_fk",
    }),
    pgPolicy("Users can view own scheduling preferences", {
      as: "permissive",
      for: "select",
      to: ["public"],
      using: sql`(user_id IN ( SELECT user_profile.id
   FROM user_profile
  WHERE (user_profile.supabase_user_id = auth.uid())))`,
    }),
    pgPolicy("Users can insert own scheduling preferences", {
      as: "permissive",
      for: "insert",
      to: ["public"],
    }),
    pgPolicy("Users can update own scheduling preferences", {
      as: "permissive",
      for: "update",
      to: ["public"],
    }),
    pgPolicy("Users can delete own scheduling preferences", {
      as: "permissive",
      for: "delete",
      to: ["public"],
    }),
  ]
);

export const reference = pgTable(
  "reference",
  {
    id: serial().primaryKey().notNull(),
    url: text().notNull(),
    refType: text("ref_type"),
    tuneRef: integer("tune_ref").notNull(),
    userRef: integer("user_ref"),
    comment: text(),
    title: text(),
    public: boolean(),
    favorite: boolean(),
    deleted: boolean().default(false).notNull(),
    syncVersion: integer("sync_version").default(1).notNull(),
    lastModifiedAt: timestamp("last_modified_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    deviceId: text("device_id"),
  },
  (table) => [
    index("idx_reference_tune_public").using(
      "btree",
      table.tuneRef.asc().nullsLast().op("int4_ops"),
      table.public.asc().nullsLast().op("int4_ops")
    ),
    index("idx_reference_tune_user_ref").using(
      "btree",
      table.tuneRef.asc().nullsLast().op("int4_ops"),
      table.userRef.asc().nullsLast().op("int4_ops")
    ),
    index("idx_reference_user_tune_public").using(
      "btree",
      table.userRef.asc().nullsLast().op("int4_ops"),
      table.tuneRef.asc().nullsLast().op("int4_ops"),
      table.public.asc().nullsLast().op("bool_ops")
    ),
    foreignKey({
      columns: [table.tuneRef],
      foreignColumns: [tune.id],
      name: "reference_tune_ref_tune_id_fk",
    }),
    foreignKey({
      columns: [table.userRef],
      foreignColumns: [userProfile.id],
      name: "reference_user_ref_user_profile_id_fk",
    }),
    pgPolicy("Users can view own or system references", {
      as: "permissive",
      for: "select",
      to: ["public"],
      using: sql`((user_ref IS NULL) OR (user_ref IN ( SELECT user_profile.id
   FROM user_profile
  WHERE (user_profile.supabase_user_id = auth.uid()))))`,
    }),
    pgPolicy("Users can insert own references", {
      as: "permissive",
      for: "insert",
      to: ["public"],
    }),
    pgPolicy("Users can update own references", {
      as: "permissive",
      for: "update",
      to: ["public"],
    }),
    pgPolicy("Users can delete own references", {
      as: "permissive",
      for: "delete",
      to: ["public"],
    }),
    check("check_favorite", sql`favorite = ANY (ARRAY[true, false])`),
    check("check_public", sql`public = ANY (ARRAY[true, false])`),
    check(
      "check_ref_type",
      sql`ref_type = ANY (ARRAY['website'::text, 'audio'::text, 'video'::text, 'sheet-music'::text, 'article'::text, 'social'::text, 'lesson'::text, 'other'::text]) OR ref_type IS NULL`
    ),
  ]
);

export const genreTuneType = pgTable(
  "genre_tune_type",
  {
    genreId: text("genre_id").notNull(),
    tuneTypeId: text("tune_type_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.genreId],
      foreignColumns: [genre.id],
      name: "genre_tune_type_genre_id_genre_id_fk",
    }),
    foreignKey({
      columns: [table.tuneTypeId],
      foreignColumns: [tuneType.id],
      name: "genre_tune_type_tune_type_id_tune_type_id_fk",
    }),
    primaryKey({
      columns: [table.genreId, table.tuneTypeId],
      name: "genre_tune_type_genre_id_tune_type_id_pk",
    }),
    pgPolicy("Authenticated users can view genre-tune type relationships", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`true`,
    }),
  ]
);

export const tableState = pgTable(
  "table_state",
  {
    userId: integer("user_id").notNull(),
    screenSize: text("screen_size").notNull(),
    purpose: text().notNull(),
    repertoireId: integer("repertoire_id").notNull(),
    settings: text(),
    currentTune: integer("current_tune"),
    syncVersion: integer("sync_version").default(1).notNull(),
    lastModifiedAt: timestamp("last_modified_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    deviceId: text("device_id"),
  },
  (table) => [
    foreignKey({
      columns: [table.repertoireId],
      foreignColumns: [repertoire.repertoireId],
      name: "table_state_repertoire_id_repertoire_repertoire_id_fk",
    }),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [userProfile.id],
      name: "table_state_user_id_user_profile_id_fk",
    }),
    primaryKey({
      columns: [
        table.userId,
        table.screenSize,
        table.purpose,
        table.repertoireId,
      ],
      name: "table_state_user_id_screen_size_purpose_repertoire_id_pk",
    }),
    pgPolicy("Users can view own table state", {
      as: "permissive",
      for: "select",
      to: ["public"],
      using: sql`(user_id IN ( SELECT user_profile.id
   FROM user_profile
  WHERE (user_profile.supabase_user_id = auth.uid())))`,
    }),
    pgPolicy("Users can insert own table state", {
      as: "permissive",
      for: "insert",
      to: ["public"],
    }),
    pgPolicy("Users can update own table state", {
      as: "permissive",
      for: "update",
      to: ["public"],
    }),
    pgPolicy("Users can delete own table state", {
      as: "permissive",
      for: "delete",
      to: ["public"],
    }),
    check(
      "purpose_check",
      sql`purpose = ANY (ARRAY['practice'::text, 'repertoire'::text, 'catalog'::text, 'analysis'::text])`
    ),
    check(
      "screen_size_check",
      sql`screen_size = ANY (ARRAY['small'::text, 'full'::text])`
    ),
  ]
);

export const repertoireTune = pgTable(
  "repertoire_tune",
  {
    repertoireRef: integer("repertoire_ref").notNull(),
    tuneRef: integer("tune_ref").notNull(),
    current: timestamp({ mode: "string" }),
    learned: timestamp({ mode: "string" }),
    scheduled: timestamp({ mode: "string" }),
    goal: text().default("recall"),
    deleted: boolean().default(false).notNull(),
    syncVersion: integer("sync_version").default(1).notNull(),
    lastModifiedAt: timestamp("last_modified_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    deviceId: text("device_id"),
  },
  (table) => [
    foreignKey({
      columns: [table.repertoireRef],
      foreignColumns: [repertoire.repertoireId],
      name: "repertoire_tune_repertoire_ref_repertoire_repertoire_id_fk",
    }),
    foreignKey({
      columns: [table.tuneRef],
      foreignColumns: [tune.id],
      name: "repertoire_tune_tune_ref_tune_id_fk",
    }),
    primaryKey({
      columns: [table.repertoireRef, table.tuneRef],
      name: "repertoire_tune_repertoire_ref_tune_ref_pk",
    }),
    pgPolicy("Users can view own repertoire tunes", {
      as: "permissive",
      for: "select",
      to: ["public"],
      using: sql`(repertoire_ref IN ( SELECT repertoire.repertoire_id
   FROM repertoire
  WHERE (repertoire.user_ref IN ( SELECT user_profile.id
           FROM user_profile
          WHERE (user_profile.supabase_user_id = auth.uid())))))`,
    }),
    pgPolicy("Users can insert own repertoire tunes", {
      as: "permissive",
      for: "insert",
      to: ["public"],
    }),
    pgPolicy("Users can update own repertoire tunes", {
      as: "permissive",
      for: "update",
      to: ["public"],
    }),
    pgPolicy("Users can delete own repertoire tunes", {
      as: "permissive",
      for: "delete",
      to: ["public"],
    }),
  ]
);

export const prefsSpacedRepetition = pgTable(
  "prefs_spaced_repetition",
  {
    userId: integer("user_id").notNull(),
    algType: text("alg_type").notNull(),
    fsrsWeights: text("fsrs_weights"),
    requestRetention: real("request_retention"),
    maximumInterval: integer("maximum_interval"),
    learningSteps: text("learning_steps"),
    relearningSteps: text("relearning_steps"),
    enableFuzzing: boolean("enable_fuzzing"),
    syncVersion: integer("sync_version").default(1).notNull(),
    lastModifiedAt: timestamp("last_modified_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    deviceId: text("device_id"),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [userProfile.id],
      name: "prefs_spaced_repetition_user_id_user_profile_id_fk",
    }),
    primaryKey({
      columns: [table.userId, table.algType],
      name: "prefs_spaced_repetition_user_id_alg_type_pk",
    }),
    pgPolicy("Users can view own SR preferences", {
      as: "permissive",
      for: "select",
      to: ["public"],
      using: sql`(user_id IN ( SELECT user_profile.id
   FROM user_profile
  WHERE (user_profile.supabase_user_id = auth.uid())))`,
    }),
    pgPolicy("Users can insert own SR preferences", {
      as: "permissive",
      for: "insert",
      to: ["public"],
    }),
    pgPolicy("Users can update own SR preferences", {
      as: "permissive",
      for: "update",
      to: ["public"],
    }),
    pgPolicy("Users can delete own SR preferences", {
      as: "permissive",
      for: "delete",
      to: ["public"],
    }),
    check("check_name", sql`alg_type = ANY (ARRAY['SM2'::text, 'FSRS'::text])`),
  ]
);

export const tableTransientData = pgTable(
  "table_transient_data",
  {
    userId: integer("user_id").notNull(),
    tuneId: integer("tune_id").notNull(),
    repertoireId: integer("repertoire_id").notNull(),
    purpose: text(),
    notePrivate: text("note_private"),
    notePublic: text("note_public"),
    recallEval: text("recall_eval"),
    practiced: timestamp({ mode: "string" }),
    quality: integer(),
    easiness: real(),
    difficulty: real(),
    interval: integer(),
    step: integer(),
    repetitions: integer(),
    due: timestamp({ mode: "string" }),
    backupPracticed: timestamp("backup_practiced", { mode: "string" }),
    goal: text(),
    technique: text(),
    stability: real(),
    state: integer().default(2),
    syncVersion: integer("sync_version").default(1).notNull(),
    lastModifiedAt: timestamp("last_modified_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    deviceId: text("device_id"),
  },
  (table) => [
    foreignKey({
      columns: [table.repertoireId],
      foreignColumns: [repertoire.repertoireId],
      name: "table_transient_data_repertoire_id_repertoire_repertoire_id_fk",
    }),
    foreignKey({
      columns: [table.tuneId],
      foreignColumns: [tune.id],
      name: "table_transient_data_tune_id_tune_id_fk",
    }),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [userProfile.id],
      name: "table_transient_data_user_id_user_profile_id_fk",
    }),
    primaryKey({
      columns: [table.userId, table.tuneId, table.repertoireId],
      name: "table_transient_data_tune_id_user_id_repertoire_id_pk",
    }),
    pgPolicy("Users can view own transient data", {
      as: "permissive",
      for: "select",
      to: ["public"],
      using: sql`(user_id IN ( SELECT user_profile.id
   FROM user_profile
  WHERE (user_profile.supabase_user_id = auth.uid())))`,
    }),
    pgPolicy("Users can insert own transient data", {
      as: "permissive",
      for: "insert",
      to: ["public"],
    }),
    pgPolicy("Users can update own transient data", {
      as: "permissive",
      for: "update",
      to: ["public"],
    }),
    pgPolicy("Users can delete own transient data", {
      as: "permissive",
      for: "delete",
      to: ["public"],
    }),
  ]
);
export const viewRepertoireJoined = pgView("view_repertoire_joined", {
  repertoireId: integer("repertoire_id"),
  userRef: integer("user_ref"),
  repertoireDeleted: boolean("repertoire_deleted"),
  instrumentRef: integer("instrument_ref"),
  privateToUser: integer("private_to_user"),
  instrument: text(),
  description: text(),
  genreDefault: text("genre_default"),
  instrumentDeleted: boolean("instrument_deleted"),
}).as(
  sql`SELECT p.repertoire_id, p.user_ref, p.deleted AS repertoire_deleted, p.instrument_ref, i.private_to_user, i.instrument, i.description, i.genre_default, i.deleted AS instrument_deleted FROM repertoire p JOIN instrument i ON p.instrument_ref = i.id`
);

export const practiceListJoined = pgView("practice_list_joined", {
  id: integer(),
  title: text(),
  type: text(),
  structure: text(),
  mode: text(),
  incipit: text(),
  genre: text(),
  deleted: boolean(),
  privateFor: integer("private_for"),
  learned: timestamp({ mode: "string" }),
  goal: text(),
  scheduled: timestamp({ mode: "string" }),
  latestState: integer("latest_state"),
  latestPracticed: timestamp("latest_practiced", { mode: "string" }),
  latestQuality: integer("latest_quality"),
  latestEasiness: real("latest_easiness"),
  latestDifficulty: real("latest_difficulty"),
  latestInterval: integer("latest_interval"),
  latestStability: real("latest_stability"),
  latestStep: integer("latest_step"),
  latestRepetitions: integer("latest_repetitions"),
  latestDue: timestamp("latest_due", { mode: "string" }),
  latestGoal: text("latest_goal"),
  latestTechnique: text("latest_technique"),
  tags: text(),
  repertoireRef: integer("repertoire_ref"),
  userRef: integer("user_ref"),
  repertoireDeleted: boolean("repertoire_deleted"),
  notes: text(),
  favoriteUrl: text("favorite_url"),
  hasOverride: integer("has_override"),
}).as(
  sql`SELECT tune.id, COALESCE(tune_override.title, tune.title) AS title, COALESCE(tune_override.type, tune.type) AS type, COALESCE(tune_override.structure, tune.structure) AS structure, COALESCE(tune_override.mode, tune.mode) AS mode, COALESCE(tune_override.incipit, tune.incipit) AS incipit, COALESCE(tune_override.genre, tune.genre) AS genre, tune.deleted, tune.private_for, repertoire_tune.learned, repertoire_tune.goal, repertoire_tune.scheduled, practice_record.state AS latest_state, practice_record.practiced AS latest_practiced, practice_record.quality AS latest_quality, practice_record.easiness AS latest_easiness, practice_record.difficulty AS latest_difficulty, practice_record."interval" AS latest_interval, practice_record.stability AS latest_stability, practice_record.step AS latest_step, practice_record.repetitions AS latest_repetitions, practice_record.due AS latest_due, practice_record.goal AS latest_goal, practice_record.technique AS latest_technique, ( SELECT string_agg(tag_1.tag_text, ' '::text) AS string_agg FROM tag tag_1 WHERE tag_1.tune_ref = tune.id AND tag_1.user_ref = repertoire.user_ref) AS tags, repertoire_tune.repertoire_ref, repertoire.user_ref, repertoire_tune.deleted AS repertoire_deleted, ( SELECT string_agg(note.note_text, ' '::text) AS string_agg FROM note WHERE note.tune_ref = tune.id AND note.user_ref = repertoire.user_ref) AS notes, ( SELECT ref.url FROM reference ref WHERE ref.tune_ref = tune.id AND ref.user_ref = repertoire.user_ref AND ref.favorite = true LIMIT 1) AS favorite_url, CASE WHEN tune_override.user_ref = repertoire.user_ref THEN 1 ELSE 0 END AS has_override FROM tune LEFT JOIN repertoire_tune ON repertoire_tune.tune_ref = tune.id LEFT JOIN repertoire ON repertoire.repertoire_id = repertoire_tune.repertoire_ref LEFT JOIN tune_override ON tune_override.tune_ref = tune.id LEFT JOIN ( SELECT DISTINCT ON (pr.tune_ref, pr.repertoire_ref) pr.id, pr.repertoire_ref, pr.tune_ref, pr.practiced, pr.quality, pr.easiness, pr.difficulty, pr.stability, pr."interval", pr.step, pr.repetitions, pr.lapses, pr.elapsed_days, pr.state, pr.due, pr.backup_practiced, pr.goal, pr.technique, pr.sync_version, pr.last_modified_at, pr.device_id FROM practice_record pr ORDER BY pr.tune_ref, pr.repertoire_ref, pr.id DESC) practice_record ON practice_record.tune_ref = tune.id AND practice_record.repertoire_ref = repertoire_tune.repertoire_ref LEFT JOIN tag ON tag.tune_ref = COALESCE(tune_override.id, tune.id) WHERE tune_override.user_ref IS NULL OR tune_override.user_ref = repertoire.user_ref`
);

export const practiceListStaged = pgView("practice_list_staged", {
  id: integer(),
  title: text(),
  type: text(),
  structure: text(),
  mode: text(),
  incipit: text(),
  genre: text(),
  privateFor: integer("private_for"),
  deleted: boolean(),
  learned: timestamp({ mode: "string" }),
  goal: text(),
  scheduled: timestamp({ mode: "string" }),
  userRef: integer("user_ref"),
  repertoireId: integer("repertoire_id"),
  instrument: text(),
  repertoireDeleted: boolean("repertoire_deleted"),
  latestState: integer("latest_state"),
  latestPracticed: timestamp("latest_practiced", { mode: "string" }),
  latestQuality: integer("latest_quality"),
  latestEasiness: real("latest_easiness"),
  latestDifficulty: real("latest_difficulty"),
  latestStability: real("latest_stability"),
  latestInterval: integer("latest_interval"),
  latestStep: integer("latest_step"),
  latestRepetitions: integer("latest_repetitions"),
  latestDue: timestamp("latest_due", { mode: "string" }),
  latestBackupPracticed: timestamp("latest_backup_practiced", {
    mode: "string",
  }),
  latestGoal: text("latest_goal"),
  latestTechnique: text("latest_technique"),
  tags: text(),
  purpose: text(),
  notePrivate: text("note_private"),
  notePublic: text("note_public"),
  recallEval: text("recall_eval"),
  notes: text(),
  favoriteUrl: text("favorite_url"),
  hasOverride: integer("has_override"),
  hasStaged: integer("has_staged"),
}).as(
  sql`SELECT tune.id, COALESCE(tune_override.title, tune.title) AS title, COALESCE(tune_override.type, tune.type) AS type, COALESCE(tune_override.structure, tune.structure) AS structure, COALESCE(tune_override.mode, tune.mode) AS mode, COALESCE(tune_override.incipit, tune.incipit) AS incipit, COALESCE(tune_override.genre, tune.genre) AS genre, tune.private_for, tune.deleted, repertoire_tune.learned, COALESCE(td.goal, COALESCE(pr.goal, 'recall'::text)) AS goal, repertoire_tune.scheduled, repertoire.user_ref, repertoire.repertoire_id, instrument.instrument, repertoire_tune.deleted AS repertoire_deleted, COALESCE(td.state, pr.state) AS latest_state, COALESCE(td.practiced, pr.practiced) AS latest_practiced, COALESCE(td.quality, pr.quality) AS latest_quality, COALESCE(td.easiness, pr.easiness) AS latest_easiness, COALESCE(td.difficulty, pr.difficulty) AS latest_difficulty, COALESCE(td.stability, pr.stability) AS latest_stability, COALESCE(td."interval", pr."interval") AS latest_interval, COALESCE(td.step, pr.step) AS latest_step, COALESCE(td.repetitions, pr.repetitions) AS latest_repetitions, COALESCE(td.due, pr.due) AS latest_due, COALESCE(td.backup_practiced, pr.backup_practiced) AS latest_backup_practiced, COALESCE(td.goal, pr.goal) AS latest_goal, COALESCE(td.technique, pr.technique) AS latest_technique, ( SELECT string_agg(tag_1.tag_text, ' '::text) AS string_agg FROM tag tag_1 WHERE tag_1.tune_ref = tune.id AND tag_1.user_ref = repertoire.user_ref) AS tags, td.purpose, td.note_private, td.note_public, td.recall_eval, ( SELECT string_agg(note.note_text, ' '::text) AS string_agg FROM note WHERE note.tune_ref = tune.id AND note.user_ref = repertoire.user_ref) AS notes, ( SELECT ref.url FROM reference ref WHERE ref.tune_ref = tune.id AND ref.user_ref = repertoire.user_ref AND ref.favorite = true LIMIT 1) AS favorite_url, CASE WHEN tune_override.user_ref = repertoire.user_ref THEN 1 ELSE 0 END AS has_override, CASE WHEN td.practiced IS NOT NULL OR td.quality IS NOT NULL OR td.easiness IS NOT NULL OR td.difficulty IS NOT NULL OR td."interval" IS NOT NULL OR td.step IS NOT NULL OR td.repetitions IS NOT NULL OR td.due IS NOT NULL OR td.backup_practiced IS NOT NULL OR td.goal IS NOT NULL OR td.technique IS NOT NULL OR td.stability IS NOT NULL THEN 1 ELSE 0 END AS has_staged FROM tune LEFT JOIN repertoire_tune ON repertoire_tune.tune_ref = tune.id LEFT JOIN repertoire ON repertoire.repertoire_id = repertoire_tune.repertoire_ref LEFT JOIN tune_override ON tune_override.tune_ref = tune.id LEFT JOIN instrument ON instrument.id = repertoire.instrument_ref LEFT JOIN ( SELECT DISTINCT ON (pr_1.tune_ref, pr_1.repertoire_ref) pr_1.id, pr_1.repertoire_ref, pr_1.tune_ref, pr_1.practiced, pr_1.quality, pr_1.easiness, pr_1.difficulty, pr_1.stability, pr_1."interval", pr_1.step, pr_1.repetitions, pr_1.lapses, pr_1.elapsed_days, pr_1.state, pr_1.due, pr_1.backup_practiced, pr_1.goal, pr_1.technique, pr_1.sync_version, pr_1.last_modified_at, pr_1.device_id FROM practice_record pr_1 ORDER BY pr_1.tune_ref, pr_1.repertoire_ref, pr_1.id DESC) pr ON pr.tune_ref = tune.id AND pr.repertoire_ref = repertoire_tune.repertoire_ref LEFT JOIN tag ON tag.tune_ref = tune.id LEFT JOIN table_transient_data td ON td.tune_id = tune.id AND td.repertoire_id = repertoire_tune.repertoire_ref WHERE tune_override.user_ref IS NULL OR tune_override.user_ref = repertoire.user_ref`
);
