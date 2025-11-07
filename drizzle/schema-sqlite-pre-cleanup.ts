import { sqliteTable, foreignKey, serial, integer, text, timestamp, index, unique, uuid, boolean, real, primaryKey } from "drizzle-orm/sqlite-core"
import { sql } from "drizzle-orm"



export const tabGroupMainState = sqliteTable("tab_group_main_state", {
	id: integer("id").primaryKey({ autoIncrement: true }).notNull(),
	userId: integer("user_id").notNull(),
	whichTab: text("which_tab").default('practice'),
	playlistId: integer("playlist_id"),
	tabSpec: text("tab_spec"),
	practiceShowSubmitted: integer("practice_show_submitted").default(0),
	practiceModeFlashcard: integer("practice_mode_flashcard").default(0),
	syncVersion: integer("sync_version").default(1).notNull(),
	lastModifiedAt: text("lastModifiedAt").$defaultFn(() => new Date().toISOString()).notNull(),
	deviceId: text("device_id"),
}, (table) => [
	foreignKey({
			columns: [table.playlistId],
			foreignColumns: [playlist.playlistId],
			name: "tab_group_main_state_playlist_fk"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [userProfile.id],
			name: "tab_group_main_state_user_id_user_profile_id_fk"
		}),]);

export const tuneType = sqliteTable("tune_type", {
	id: text().primaryKey().notNull(),
	name: text(),
	rhythm: text(),
	description: text(),
}, (table) => []);

export const tag = sqliteTable("tag", {
	tagId: integer("tag_id").primaryKey({ autoIncrement: true }).notNull(),
	userRef: integer("user_ref").notNull(),
	tuneRef: integer("tune_ref").notNull(),
	tagText: text("tag_text").notNull(),
	syncVersion: integer("sync_version").default(1).notNull(),
	lastModifiedAt: text("lastModifiedAt").$defaultFn(() => new Date().toISOString()).notNull(),
	deviceId: text("device_id"),
}, (table) => [
	index("idx_tag_user_ref_tag_text").on(table.userRef, table.tagText),
	index("idx_tag_user_ref_tune_ref").on(table.userRef, table.tuneRef),
	foreignKey({
			columns: [table.tuneRef],
			foreignColumns: [tune.id],
			name: "tag_tune_ref_tune_id_fk"
		}),
	foreignKey({
			columns: [table.userRef],
			foreignColumns: [userProfile.id],
			name: "tag_user_ref_user_profile_id_fk"
		}),
	unique("tag_user_ref_tune_ref_tag_text_unique").on(table.userRef, table.tuneRef, table.tagText),]);

export const userProfile = sqliteTable("user_profile", {
	id: integer("id").primaryKey({ autoIncrement: true }).notNull(),
	supabaseUserId: text("supabase_user_id").notNull(),
	name: text(),
	email: text(),
	srAlgType: text("sr_alg_type"),
	phone: text(),
	phoneVerified: text("phoneVerified"),
	acceptableDelinquencyWindow: integer("acceptable_delinquency_window").default(21),
	deleted: integer("deleted").default(0).notNull(),
	syncVersion: integer("sync_version").default(1).notNull(),
	lastModifiedAt: text("lastModifiedAt").$defaultFn(() => new Date().toISOString()).notNull(),
	deviceId: text("device_id"),
}, (table) => [
	unique("user_profile_supabase_user_id_unique").on(table.supabaseUserId),]);

export const practiceRecord = sqliteTable("practice_record", {
	id: integer("id").primaryKey({ autoIncrement: true }).notNull(),
	playlistRef: integer("playlist_ref").notNull(),
	tuneRef: integer("tune_ref").notNull(),
	practiced: text("practiced"),
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
	due: text("due"),
	backupPracticed: text("backupPracticed"),
	goal: text().default('recall'),
	technique: text(),
	syncVersion: integer("sync_version").default(1).notNull(),
	lastModifiedAt: text("lastModifiedAt").$defaultFn(() => new Date().toISOString()).notNull(),
	deviceId: text("device_id"),
}, (table) => [
	index("idx_practice_record_id").on(table.id),
	index("idx_practice_record_practiced").on(table.practiced),
	index("idx_practice_record_tune_playlist_practiced").on(table.tuneRef, table.playlistRef, table.practiced),
	foreignKey({
			columns: [table.playlistRef],
			foreignColumns: [playlist.playlistId],
			name: "practice_record_playlist_ref_playlist_playlist_id_fk"
		}),
	foreignKey({
			columns: [table.tuneRef],
			foreignColumns: [tune.id],
			name: "practice_record_tune_ref_tune_id_fk"
		}),
	unique("practice_record_tune_ref_playlist_ref_practiced_unique").on(table.playlistRef, table.tuneRef, table.practiced),]);

export const tune = sqliteTable("tune", {
	id: integer("id").primaryKey({ autoIncrement: true }).notNull(),
	title: text(),
	type: text(),
	structure: text(),
	mode: text(),
	incipit: text(),
	genre: text(),
	privateFor: integer("private_for"),
	deleted: integer("deleted").default(0).notNull(),
	syncVersion: integer("sync_version").default(1).notNull(),
	lastModifiedAt: text("lastModifiedAt").$defaultFn(() => new Date().toISOString()).notNull(),
	deviceId: text("device_id"),
}, (table) => [
	foreignKey({
			columns: [table.genre],
			foreignColumns: [genre.id],
			name: "tune_genre_genre_id_fk"
		}),
	foreignKey({
			columns: [table.privateFor],
			foreignColumns: [userProfile.id],
			name: "tune_private_for_user_profile_id_fk"
		}),]);

export const tuneOverride = sqliteTable("tune_override", {
	id: integer("id").primaryKey({ autoIncrement: true }).notNull(),
	tuneRef: integer("tune_ref").notNull(),
	userRef: integer("user_ref").notNull(),
	title: text(),
	type: text(),
	structure: text(),
	genre: text(),
	mode: text(),
	incipit: text(),
	deleted: integer("deleted").default(0).notNull(),
	syncVersion: integer("sync_version").default(1).notNull(),
	lastModifiedAt: text("lastModifiedAt").$defaultFn(() => new Date().toISOString()).notNull(),
	deviceId: text("device_id"),
}, (table) => [
	foreignKey({
			columns: [table.genre],
			foreignColumns: [genre.id],
			name: "tune_override_genre_genre_id_fk"
		}),
	foreignKey({
			columns: [table.tuneRef],
			foreignColumns: [tune.id],
			name: "tune_override_tune_ref_tune_id_fk"
		}),
	foreignKey({
			columns: [table.userRef],
			foreignColumns: [userProfile.id],
			name: "tune_override_user_ref_user_profile_id_fk"
		}),]);

export const instrument = sqliteTable("instrument", {
	id: integer("id").primaryKey({ autoIncrement: true }).notNull(),
	privateToUser: integer("private_to_user"),
	instrument: text(),
	description: text(),
	genreDefault: text("genre_default"),
	deleted: integer("deleted").default(0).notNull(),
	syncVersion: integer("sync_version").default(1).notNull(),
	lastModifiedAt: text("lastModifiedAt").$defaultFn(() => new Date().toISOString()).notNull(),
	deviceId: text("device_id"),
}, (table) => [
	index("idx_instrument_instrument").on(table.instrument),
	index("idx_instrument_private_to_user").on(table.privateToUser),
	foreignKey({
			columns: [table.genreDefault],
			foreignColumns: [genre.id],
			name: "instrument_genre_fk"
		}),
	foreignKey({
			columns: [table.privateToUser],
			foreignColumns: [userProfile.id],
			name: "instrument_private_to_user_user_profile_id_fk"
		}),
	unique("instrument_private_to_user_instrument_unique").on(table.privateToUser, table.instrument),]);

export const dailyPracticeQueue = sqliteTable("daily_practice_queue", {
	id: integer("id").primaryKey({ autoIncrement: true }).notNull(),
	userRef: integer("user_ref").notNull(),
	playlistRef: integer("playlist_ref").notNull(),
	mode: text(),
	queueDate: text("queueDate"),
	windowStartUtc: text("windowStartUtc").notNull(),
	windowEndUtc: text("windowEndUtc").notNull(),
	tuneRef: integer("tune_ref").notNull(),
	bucket: integer().notNull(),
	orderIndex: integer("order_index").notNull(),
	snapshotCoalescedTs: text("snapshotCoalescedTs").notNull(),
	scheduledSnapshot: text("scheduled_snapshot"),
	latestDueSnapshot: text("latest_due_snapshot"),
	acceptableDelinquencyWindowSnapshot: integer("acceptable_delinquency_window_snapshot"),
	tzOffsetMinutesSnapshot: integer("tz_offset_minutes_snapshot"),
	generatedAt: text("generatedAt").notNull(),
	completedAt: text("completedAt"),
	exposuresRequired: integer("exposures_required"),
	exposuresCompleted: integer("exposures_completed").default(0),
	outcome: text(),
	active: integer("active").default(1).notNull(),
	syncVersion: integer("sync_version").default(1).notNull(),
	lastModifiedAt: text("lastModifiedAt").$defaultFn(() => new Date().toISOString()).notNull(),
	deviceId: text("device_id"),
}, (table) => [
	index("idx_queue_generated_at").on(table.generatedAt),
	index("idx_queue_user_playlist_active").on(table.userRef, table.playlistRef, table.active),
	index("idx_queue_user_playlist_bucket").on(table.userRef, table.playlistRef, table.bucket),
	index("idx_queue_user_playlist_window").on(table.userRef, table.playlistRef, table.windowStartUtc),
	foreignKey({
			columns: [table.playlistRef],
			foreignColumns: [playlist.playlistId],
			name: "daily_practice_queue_playlist_fk"
		}),
	foreignKey({
			columns: [table.tuneRef],
			foreignColumns: [tune.id],
			name: "daily_practice_queue_tune_fk"
		}),
	foreignKey({
			columns: [table.userRef],
			foreignColumns: [userProfile.id],
			name: "daily_practice_queue_user_profile_fk"
		}),
	unique("daily_practice_queue_user_ref_playlist_ref_window_start_utc_tun").on(table.userRef, table.playlistRef, table.windowStartUtc, table.tuneRef),]);

export const genre = sqliteTable("genre", {
	id: text().primaryKey().notNull(),
	name: text(),
	region: text(),
	description: text(),
}, (table) => []);

export const note = sqliteTable("note", {
	id: integer("id").primaryKey({ autoIncrement: true }).notNull(),
	userRef: integer("user_ref"),
	tuneRef: integer("tune_ref").notNull(),
	playlistRef: integer("playlist_ref"),
	createdDate: text("createdDate"),
	noteText: text("note_text"),
	public: integer("public").default(0).notNull(),
	favorite: integer("favorite"),
	deleted: integer("deleted").default(0).notNull(),
	syncVersion: integer("sync_version").default(1).notNull(),
	lastModifiedAt: text("lastModifiedAt").$defaultFn(() => new Date().toISOString()).notNull(),
	deviceId: text("device_id"),
}, (table) => [
	index("idx_note_tune_playlist").on(table.tuneRef, table.playlistRef),
	index("idx_note_tune_playlist_user_public").on(table.tuneRef, table.playlistRef, table.userRef, table.public),
	index("idx_note_tune_user").on(table.tuneRef, table.userRef),
	foreignKey({
			columns: [table.playlistRef],
			foreignColumns: [playlist.playlistId],
			name: "note_playlist_ref_playlist_playlist_id_fk"
		}),
	foreignKey({
			columns: [table.tuneRef],
			foreignColumns: [tune.id],
			name: "note_tune_ref_tune_id_fk"
		}),
	foreignKey({
			columns: [table.userRef],
			foreignColumns: [userProfile.id],
			name: "note_user_ref_user_profile_id_fk"
		}),]);

export const playlist = sqliteTable("playlist", {
	playlistId: integer("playlist_id").primaryKey({ autoIncrement: true }).notNull(),
	userRef: integer("user_ref").notNull(),
	instrumentRef: integer("instrument_ref"),
	srAlgType: text("sr_alg_type"),
	deleted: integer("deleted").default(0).notNull(),
	syncVersion: integer("sync_version").default(1).notNull(),
	lastModifiedAt: text("lastModifiedAt").$defaultFn(() => new Date().toISOString()).notNull(),
	deviceId: text("device_id"),
}, (table) => [
	foreignKey({
			columns: [table.instrumentRef],
			foreignColumns: [instrument.id],
			name: "playlist_instrument_fk"
		}),
	foreignKey({
			columns: [table.userRef],
			foreignColumns: [userProfile.id],
			name: "playlist_user_ref_user_profile_id_fk"
		}),
	unique("playlist_user_ref_instrument_ref_unique").on(table.userRef, table.instrumentRef),]);

export const prefsSchedulingOptions = sqliteTable("prefs_scheduling_options", {
	userId: integer("user_id").primaryKey().notNull(),
	acceptableDelinquencyWindow: integer("acceptable_delinquency_window").default(21).notNull(),
	minReviewsPerDay: integer("min_reviews_per_day"),
	maxReviewsPerDay: integer("max_reviews_per_day"),
	daysPerWeek: integer("days_per_week"),
	weeklyRules: text("weekly_rules"),
	exceptions: text(),
	syncVersion: integer("sync_version").default(1).notNull(),
	lastModifiedAt: text("lastModifiedAt").$defaultFn(() => new Date().toISOString()).notNull(),
	deviceId: text("device_id"),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [userProfile.id],
			name: "prefs_scheduling_options_user_id_user_profile_id_fk"
		}),]);

export const reference = sqliteTable("reference", {
	id: integer("id").primaryKey({ autoIncrement: true }).notNull(),
	url: text().notNull(),
	refType: text("ref_type"),
	tuneRef: integer("tune_ref").notNull(),
	userRef: integer("user_ref"),
	comment: text(),
	title: text(),
	public: integer("public"),
	favorite: integer("favorite"),
	deleted: integer("deleted").default(0).notNull(),
	syncVersion: integer("sync_version").default(1).notNull(),
	lastModifiedAt: text("lastModifiedAt").$defaultFn(() => new Date().toISOString()).notNull(),
	deviceId: text("device_id"),
}, (table) => [
	index("idx_reference_tune_public").on(table.tuneRef, table.public),
	index("idx_reference_tune_user_ref").on(table.tuneRef, table.userRef),
	index("idx_reference_user_tune_public").on(table.userRef, table.tuneRef, table.public),
	foreignKey({
			columns: [table.tuneRef],
			foreignColumns: [tune.id],
			name: "reference_tune_ref_tune_id_fk"
		}),
	foreignKey({
			columns: [table.userRef],
			foreignColumns: [userProfile.id],
			name: "reference_user_ref_user_profile_id_fk"
		}),]);

export const genreTuneType = sqliteTable("genre_tune_type", {
	genreId: text("genre_id").notNull(),
	tuneTypeId: text("tune_type_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.genreId],
			foreignColumns: [genre.id],
			name: "genre_tune_type_genre_id_genre_id_fk"
		}),
	foreignKey({
			columns: [table.tuneTypeId],
			foreignColumns: [tuneType.id],
			name: "genre_tune_type_tune_type_id_tune_type_id_fk"
		}),
	primaryKey({ columns: [table.genreId, table.tuneTypeId], name: "genre_tune_type_genre_id_tune_type_id_pk"}),]);

export const tableState = sqliteTable("table_state", {
	userId: integer("user_id").notNull(),
	screenSize: text("screen_size").notNull(),
	purpose: text().notNull(),
	playlistId: integer("playlist_id").notNull(),
	settings: text(),
	currentTune: integer("current_tune"),
	syncVersion: integer("sync_version").default(1).notNull(),
	lastModifiedAt: text("lastModifiedAt").$defaultFn(() => new Date().toISOString()).notNull(),
	deviceId: text("device_id"),
}, (table) => [
	foreignKey({
			columns: [table.playlistId],
			foreignColumns: [playlist.playlistId],
			name: "table_state_playlist_id_playlist_playlist_id_fk"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [userProfile.id],
			name: "table_state_user_id_user_profile_id_fk"
		}),
	primaryKey({ columns: [table.userId, table.screenSize, table.purpose, table.playlistId], name: "table_state_user_id_screen_size_purpose_playlist_id_pk"}),]);

export const playlistTune = sqliteTable("playlist_tune", {
	playlistRef: integer("playlist_ref").notNull(),
	tuneRef: integer("tune_ref").notNull(),
	current: text("current"),
	learned: text("learned"),
	scheduled: text("scheduled"),
	goal: text().default('recall'),
	deleted: integer("deleted").default(0).notNull(),
	syncVersion: integer("sync_version").default(1).notNull(),
	lastModifiedAt: text("lastModifiedAt").$defaultFn(() => new Date().toISOString()).notNull(),
	deviceId: text("device_id"),
}, (table) => [
	foreignKey({
			columns: [table.playlistRef],
			foreignColumns: [playlist.playlistId],
			name: "playlist_tune_playlist_ref_playlist_playlist_id_fk"
		}),
	foreignKey({
			columns: [table.tuneRef],
			foreignColumns: [tune.id],
			name: "playlist_tune_tune_ref_tune_id_fk"
		}),
	primaryKey({ columns: [table.playlistRef, table.tuneRef], name: "playlist_tune_playlist_ref_tune_ref_pk"}),]);

export const prefsSpacedRepetition = sqliteTable("prefs_spaced_repetition", {
	userId: integer("user_id").notNull(),
	algType: text("alg_type").notNull(),
	fsrsWeights: text("fsrs_weights"),
	requestRetention: real("request_retention"),
	maximumInterval: integer("maximum_interval"),
	learningSteps: text("learning_steps"),
	relearningSteps: text("relearning_steps"),
	enableFuzzing: integer("enable_fuzzing"),
	syncVersion: integer("sync_version").default(1).notNull(),
	lastModifiedAt: text("lastModifiedAt").$defaultFn(() => new Date().toISOString()).notNull(),
	deviceId: text("device_id"),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [userProfile.id],
			name: "prefs_spaced_repetition_user_id_user_profile_id_fk"
		}),
	primaryKey({ columns: [table.userId, table.algType], name: "prefs_spaced_repetition_user_id_alg_type_pk"}),]);

export const tableTransientData = sqliteTable("table_transient_data", {
	userId: integer("user_id").notNull(),
	tuneId: integer("tune_id").notNull(),
	playlistId: integer("playlist_id").notNull(),
	purpose: text(),
	notePrivate: text("note_private"),
	notePublic: text("note_public"),
	recallEval: text("recall_eval"),
	practiced: text("practiced"),
	quality: integer(),
	easiness: real(),
	difficulty: real(),
	interval: integer(),
	step: integer(),
	repetitions: integer(),
	due: text("due"),
	backupPracticed: text("backupPracticed"),
	goal: text(),
	technique: text(),
	stability: real(),
	state: integer().default(2),
	syncVersion: integer("sync_version").default(1).notNull(),
	lastModifiedAt: text("lastModifiedAt").$defaultFn(() => new Date().toISOString()).notNull(),
	deviceId: text("device_id"),
}, (table) => [
	foreignKey({
			columns: [table.playlistId],
			foreignColumns: [playlist.playlistId],
			name: "table_transient_data_playlist_id_playlist_playlist_id_fk"
		}),
	foreignKey({
			columns: [table.tuneId],
			foreignColumns: [tune.id],
			name: "table_transient_data_tune_id_tune_id_fk"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [userProfile.id],
			name: "table_transient_data_user_id_user_profile_id_fk"
		}),
	primaryKey({ columns: [table.userId, table.tuneId, table.playlistId], name: "table_transient_data_tune_id_user_id_playlist_id_pk"}),]);


