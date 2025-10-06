import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgPolicy,
  pgTable,
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
    playlistId: integer("playlist_id"),
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
      sql`which_tab = ANY (ARRAY['scheduled'::text, 'repertoire'::text, 'catalog'::text, 'analysis'::text])`,
    ),
  ],
);

export const tuneType = pgTable(
  "tune_type",
  {
    id: text().primaryKey().notNull(),
    name: text(),
    rhythm: text(),
    description: text(),
  },
  (table) => [
    pgPolicy("Authenticated users can view tune types", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`true`,
    }),
  ],
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
      table.tagText.asc().nullsLast().op("text_ops"),
    ),
    index("idx_tag_user_ref_tune_ref").using(
      "btree",
      table.userRef.asc().nullsLast().op("int4_ops"),
      table.tuneRef.asc().nullsLast().op("int4_ops"),
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
      table.tagText,
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
  ],
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
      "acceptable_delinquency_window",
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
  ],
);

export const practiceRecord = pgTable(
  "practice_record",
  {
    id: serial().primaryKey().notNull(),
    playlistRef: integer("playlist_ref").notNull(),
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
      table.id.desc().nullsLast().op("int4_ops"),
    ),
    index("idx_practice_record_practiced").using(
      "btree",
      table.practiced.desc().nullsLast().op("timestamp_ops"),
    ),
    index("idx_practice_record_tune_playlist_practiced").using(
      "btree",
      table.tuneRef.asc().nullsLast().op("int4_ops"),
      table.playlistRef.asc().nullsLast().op("timestamp_ops"),
      table.practiced.desc().nullsLast().op("timestamp_ops"),
    ),
    foreignKey({
      columns: [table.playlistRef],
      foreignColumns: [playlist.playlistId],
      name: "practice_record_playlist_ref_playlist_playlist_id_fk",
    }),
    foreignKey({
      columns: [table.tuneRef],
      foreignColumns: [tune.id],
      name: "practice_record_tune_ref_tune_id_fk",
    }),
    unique("practice_record_tune_ref_playlist_ref_practiced_unique").on(
      table.playlistRef,
      table.tuneRef,
      table.practiced,
    ),
    pgPolicy("Users can view own practice records", {
      as: "permissive",
      for: "select",
      to: ["public"],
      using: sql`(playlist_ref IN ( SELECT playlist.playlist_id
   FROM playlist
  WHERE (playlist.user_ref IN ( SELECT user_profile.id
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
  ],
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
  ],
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
  ],
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
      table.instrument.asc().nullsLast().op("text_ops"),
    ),
    index("idx_instrument_private_to_user").using(
      "btree",
      table.privateToUser.asc().nullsLast().op("int4_ops"),
    ),
    foreignKey({
      columns: [table.privateToUser],
      foreignColumns: [userProfile.id],
      name: "instrument_private_to_user_user_profile_id_fk",
    }),
    unique("instrument_private_to_user_instrument_unique").on(
      table.privateToUser,
      table.instrument,
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
  ],
);

export const dailyPracticeQueue = pgTable(
  "daily_practice_queue",
  {
    id: serial().primaryKey().notNull(),
    userRef: integer("user_ref").notNull(),
    playlistRef: integer("playlist_ref").notNull(),
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
      "acceptable_delinquency_window_snapshot",
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
      table.generatedAt.asc().nullsLast().op("timestamp_ops"),
    ),
    index("idx_queue_user_playlist_active").using(
      "btree",
      table.userRef.asc().nullsLast().op("int4_ops"),
      table.playlistRef.asc().nullsLast().op("bool_ops"),
      table.active.asc().nullsLast().op("bool_ops"),
    ),
    index("idx_queue_user_playlist_bucket").using(
      "btree",
      table.userRef.asc().nullsLast().op("int4_ops"),
      table.playlistRef.asc().nullsLast().op("int4_ops"),
      table.bucket.asc().nullsLast().op("int4_ops"),
    ),
    index("idx_queue_user_playlist_window").using(
      "btree",
      table.userRef.asc().nullsLast().op("int4_ops"),
      table.playlistRef.asc().nullsLast().op("timestamp_ops"),
      table.windowStartUtc.asc().nullsLast().op("int4_ops"),
    ),
    unique(
      "daily_practice_queue_user_ref_playlist_ref_window_start_utc_tun",
    ).on(table.userRef, table.playlistRef, table.windowStartUtc, table.tuneRef),
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
  ],
);

export const genre = pgTable(
  "genre",
  {
    id: text().primaryKey().notNull(),
    name: text(),
    region: text(),
    description: text(),
  },
  (table) => [
    pgPolicy("Authenticated users can view genres", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`true`,
    }),
  ],
);

export const note = pgTable(
  "note",
  {
    id: serial().primaryKey().notNull(),
    userRef: integer("user_ref"),
    tuneRef: integer("tune_ref").notNull(),
    playlistRef: integer("playlist_ref"),
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
    index("idx_note_tune_playlist").using(
      "btree",
      table.tuneRef.asc().nullsLast().op("int4_ops"),
      table.playlistRef.asc().nullsLast().op("int4_ops"),
    ),
    index("idx_note_tune_playlist_user_public").using(
      "btree",
      table.tuneRef.asc().nullsLast().op("int4_ops"),
      table.playlistRef.asc().nullsLast().op("bool_ops"),
      table.userRef.asc().nullsLast().op("int4_ops"),
      table.public.asc().nullsLast().op("bool_ops"),
    ),
    index("idx_note_tune_user").using(
      "btree",
      table.tuneRef.asc().nullsLast().op("int4_ops"),
      table.userRef.asc().nullsLast().op("int4_ops"),
    ),
    foreignKey({
      columns: [table.playlistRef],
      foreignColumns: [playlist.playlistId],
      name: "note_playlist_ref_playlist_playlist_id_fk",
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
  ],
);

export const playlist = pgTable(
  "playlist",
  {
    playlistId: serial("playlist_id").primaryKey().notNull(),
    userRef: integer("user_ref").notNull(),
    instrumentRef: integer("instrument_ref"),
    srAlgType: text("sr_alg_type"),
    deleted: boolean().default(false).notNull(),
    syncVersion: integer("sync_version").default(1).notNull(),
    lastModifiedAt: timestamp("last_modified_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    deviceId: text("device_id"),
  },
  (table) => [
    foreignKey({
      columns: [table.userRef],
      foreignColumns: [userProfile.id],
      name: "playlist_user_ref_user_profile_id_fk",
    }),
    unique("playlist_user_ref_instrument_ref_unique").on(
      table.userRef,
      table.instrumentRef,
    ),
    pgPolicy("Users can view own playlists", {
      as: "permissive",
      for: "select",
      to: ["public"],
      using: sql`(user_ref IN ( SELECT user_profile.id
   FROM user_profile
  WHERE (user_profile.supabase_user_id = auth.uid())))`,
    }),
    pgPolicy("Users can insert own playlists", {
      as: "permissive",
      for: "insert",
      to: ["public"],
    }),
    pgPolicy("Users can update own playlists", {
      as: "permissive",
      for: "update",
      to: ["public"],
    }),
    pgPolicy("Users can delete own playlists", {
      as: "permissive",
      for: "delete",
      to: ["public"],
    }),
  ],
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
  ],
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
      table.public.asc().nullsLast().op("int4_ops"),
    ),
    index("idx_reference_tune_user_ref").using(
      "btree",
      table.tuneRef.asc().nullsLast().op("int4_ops"),
      table.userRef.asc().nullsLast().op("int4_ops"),
    ),
    index("idx_reference_user_tune_public").using(
      "btree",
      table.userRef.asc().nullsLast().op("int4_ops"),
      table.tuneRef.asc().nullsLast().op("int4_ops"),
      table.public.asc().nullsLast().op("bool_ops"),
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
    pgPolicy("Users can view own or public references", {
      as: "permissive",
      for: "select",
      to: ["public"],
      using: sql`((user_ref IN ( SELECT user_profile.id
   FROM user_profile
  WHERE (user_profile.supabase_user_id = auth.uid()))) OR (public = true))`,
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
      sql`ref_type = ANY (ARRAY['website'::text, 'audio'::text, 'video'::text])`,
    ),
  ],
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
  ],
);

export const tableState = pgTable(
  "table_state",
  {
    userId: integer("user_id").notNull(),
    screenSize: text("screen_size").notNull(),
    purpose: text().notNull(),
    playlistId: integer("playlist_id").notNull(),
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
      columns: [table.playlistId],
      foreignColumns: [playlist.playlistId],
      name: "table_state_playlist_id_playlist_playlist_id_fk",
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
        table.playlistId,
      ],
      name: "table_state_user_id_screen_size_purpose_playlist_id_pk",
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
      sql`purpose = ANY (ARRAY['practice'::text, 'repertoire'::text, 'catalog'::text, 'analysis'::text])`,
    ),
    check(
      "screen_size_check",
      sql`screen_size = ANY (ARRAY['small'::text, 'full'::text])`,
    ),
  ],
);

export const playlistTune = pgTable(
  "playlist_tune",
  {
    playlistRef: integer("playlist_ref").notNull(),
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
      columns: [table.playlistRef],
      foreignColumns: [playlist.playlistId],
      name: "playlist_tune_playlist_ref_playlist_playlist_id_fk",
    }),
    foreignKey({
      columns: [table.tuneRef],
      foreignColumns: [tune.id],
      name: "playlist_tune_tune_ref_tune_id_fk",
    }),
    primaryKey({
      columns: [table.playlistRef, table.tuneRef],
      name: "playlist_tune_playlist_ref_tune_ref_pk",
    }),
    pgPolicy("Users can view own playlist tunes", {
      as: "permissive",
      for: "select",
      to: ["public"],
      using: sql`(playlist_ref IN ( SELECT playlist.playlist_id
   FROM playlist
  WHERE (playlist.user_ref IN ( SELECT user_profile.id
           FROM user_profile
          WHERE (user_profile.supabase_user_id = auth.uid())))))`,
    }),
    pgPolicy("Users can insert own playlist tunes", {
      as: "permissive",
      for: "insert",
      to: ["public"],
    }),
    pgPolicy("Users can update own playlist tunes", {
      as: "permissive",
      for: "update",
      to: ["public"],
    }),
    pgPolicy("Users can delete own playlist tunes", {
      as: "permissive",
      for: "delete",
      to: ["public"],
    }),
  ],
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
  ],
);

export const tableTransientData = pgTable(
  "table_transient_data",
  {
    userId: integer("user_id").notNull(),
    tuneId: integer("tune_id").notNull(),
    playlistId: integer("playlist_id").notNull(),
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
      columns: [table.playlistId],
      foreignColumns: [playlist.playlistId],
      name: "table_transient_data_playlist_id_playlist_playlist_id_fk",
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
      columns: [table.userId, table.tuneId, table.playlistId],
      name: "table_transient_data_tune_id_user_id_playlist_id_pk",
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
  ],
);
