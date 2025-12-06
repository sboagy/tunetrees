PRAGMA foreign_keys = OFF;

--> statement-breakpoint
CREATE TABLE
	`__new_instrument` (
		`id` text PRIMARY KEY NOT NULL,
		`private_to_user` text,
		`instrument` text,
		`description` text,
		`genre_default` text,
		`deleted` integer DEFAULT 0 NOT NULL,
		`sync_version` integer DEFAULT 1 NOT NULL,
		`last_modified_at` text NOT NULL,
		`device_id` text,
		FOREIGN KEY (`private_to_user`) REFERENCES `user_profile` (`supabase_user_id`) ON UPDATE no action ON DELETE no action
	);

--> statement-breakpoint
INSERT INTO
	`__new_instrument` (
		"id",
		"private_to_user",
		"instrument",
		"description",
		"genre_default",
		"deleted",
		"sync_version",
		"last_modified_at",
		"device_id"
	)
SELECT
	"id",
	"private_to_user",
	"instrument",
	"description",
	"genre_default",
	"deleted",
	"sync_version",
	"last_modified_at",
	"device_id"
FROM
	`instrument`;

--> statement-breakpoint
DROP TABLE `instrument`;

--> statement-breakpoint
ALTER TABLE `__new_instrument`
RENAME TO `instrument`;

--> statement-breakpoint
CREATE UNIQUE INDEX `instrument_private_to_user_instrument_unique` ON `instrument` (`private_to_user`, `instrument`);

--> statement-breakpoint
CREATE INDEX `idx_instrument_private_to_user` ON `instrument` (`private_to_user`);

--> statement-breakpoint
CREATE INDEX `idx_instrument_instrument` ON `instrument` (`instrument`);

--> statement-breakpoint
CREATE TABLE
	`__new_note` (
		`id` text PRIMARY KEY NOT NULL,
		`user_ref` text,
		`tune_ref` text NOT NULL,
		`playlist_ref` text,
		`created_date` text,
		`note_text` text,
		`public` integer DEFAULT 0 NOT NULL,
		`favorite` integer,
		`deleted` integer DEFAULT 0 NOT NULL,
		`sync_version` integer DEFAULT 1 NOT NULL,
		`last_modified_at` text NOT NULL,
		`device_id` text,
		FOREIGN KEY (`user_ref`) REFERENCES `user_profile` (`supabase_user_id`) ON UPDATE no action ON DELETE no action,
		FOREIGN KEY (`tune_ref`) REFERENCES `tune` (`id`) ON UPDATE no action ON DELETE no action,
		FOREIGN KEY (`playlist_ref`) REFERENCES `playlist` (`id`) ON UPDATE no action ON DELETE no action
	);

--> statement-breakpoint
INSERT INTO
	`__new_note` (
		"id",
		"user_ref",
		"tune_ref",
		"playlist_ref",
		"created_date",
		"note_text",
		"public",
		"favorite",
		"deleted",
		"sync_version",
		"last_modified_at",
		"device_id"
	)
SELECT
	"id",
	"user_ref",
	"tune_ref",
	"playlist_ref",
	"created_date",
	"note_text",
	"public",
	"favorite",
	"deleted",
	"sync_version",
	"last_modified_at",
	"device_id"
FROM
	`note`;

--> statement-breakpoint
DROP TABLE `note`;

--> statement-breakpoint
ALTER TABLE `__new_note`
RENAME TO `note`;

--> statement-breakpoint
CREATE INDEX `idx_note_tune_user` ON `note` (`tune_ref`, `user_ref`);

--> statement-breakpoint
CREATE INDEX `idx_note_tune_playlist_user_public` ON `note` (`tune_ref`, `playlist_ref`, `user_ref`, `public`);

--> statement-breakpoint
CREATE INDEX `idx_note_tune_playlist` ON `note` (`tune_ref`, `playlist_ref`);

--> statement-breakpoint
CREATE TABLE
	`__new_playlist` (
		`id` text PRIMARY KEY NOT NULL,
		`user_ref` text NOT NULL,
		`name` text,
		`instrument_ref` text,
		`genre_default` text,
		`sr_alg_type` text,
		`deleted` integer DEFAULT 0 NOT NULL,
		`sync_version` integer DEFAULT 1 NOT NULL,
		`last_modified_at` text NOT NULL,
		`device_id` text,
		FOREIGN KEY (`user_ref`) REFERENCES `user_profile` (`supabase_user_id`) ON UPDATE no action ON DELETE no action,
		FOREIGN KEY (`genre_default`) REFERENCES `genre` (`id`) ON UPDATE no action ON DELETE no action
	);

--> statement-breakpoint
INSERT INTO
	`__new_playlist` (
		"id",
		"user_ref",
		"name",
		"instrument_ref",
		"genre_default",
		"sr_alg_type",
		"deleted",
		"sync_version",
		"last_modified_at",
		"device_id"
	)
SELECT
	"id",
	"user_ref",
	"name",
	"instrument_ref",
	"genre_default",
	"sr_alg_type",
	"deleted",
	"sync_version",
	"last_modified_at",
	"device_id"
FROM
	`playlist`;

--> statement-breakpoint
DROP TABLE `playlist`;

--> statement-breakpoint
ALTER TABLE `__new_playlist`
RENAME TO `playlist`;

--> statement-breakpoint
CREATE TABLE
	`__new_playlist_tune` (
		`playlist_ref` text NOT NULL,
		`tune_ref` text NOT NULL,
		`current` text,
		`learned` text,
		`scheduled` text,
		`goal` text DEFAULT 'recall',
		`deleted` integer DEFAULT 0 NOT NULL,
		`sync_version` integer DEFAULT 1 NOT NULL,
		`last_modified_at` text NOT NULL,
		`device_id` text,
		PRIMARY KEY (`playlist_ref`, `tune_ref`),
		FOREIGN KEY (`playlist_ref`) REFERENCES `playlist` (`id`) ON UPDATE no action ON DELETE no action,
		FOREIGN KEY (`tune_ref`) REFERENCES `tune` (`id`) ON UPDATE no action ON DELETE no action
	);

--> statement-breakpoint
INSERT INTO
	`__new_playlist_tune` (
		"playlist_ref",
		"tune_ref",
		"current",
		"learned",
		"scheduled",
		"goal",
		"deleted",
		"sync_version",
		"last_modified_at",
		"device_id"
	)
SELECT
	"playlist_ref",
	"tune_ref",
	"current",
	"learned",
	"scheduled",
	"goal",
	"deleted",
	"sync_version",
	"last_modified_at",
	"device_id"
FROM
	`playlist_tune`;

--> statement-breakpoint
DROP TABLE `playlist_tune`;

--> statement-breakpoint
ALTER TABLE `__new_playlist_tune`
RENAME TO `playlist_tune`;

--> statement-breakpoint
CREATE TABLE
	`__new_practice_record` (
		`id` text PRIMARY KEY NOT NULL,
		`playlist_ref` text NOT NULL,
		`tune_ref` text NOT NULL,
		`practiced` text,
		`quality` integer,
		`easiness` real,
		`difficulty` real,
		`stability` real,
		`interval` integer,
		`step` integer,
		`repetitions` integer,
		`lapses` integer,
		`elapsed_days` integer,
		`state` integer,
		`due` text,
		`backup_practiced` text,
		`goal` text DEFAULT 'recall',
		`technique` text,
		`sync_version` integer DEFAULT 1 NOT NULL,
		`last_modified_at` text NOT NULL,
		`device_id` text,
		FOREIGN KEY (`playlist_ref`) REFERENCES `playlist` (`id`) ON UPDATE no action ON DELETE no action,
		FOREIGN KEY (`tune_ref`) REFERENCES `tune` (`id`) ON UPDATE no action ON DELETE no action
	);

--> statement-breakpoint
INSERT INTO
	`__new_practice_record` (
		"id",
		"playlist_ref",
		"tune_ref",
		"practiced",
		"quality",
		"easiness",
		"difficulty",
		"stability",
		"interval",
		"step",
		"repetitions",
		"lapses",
		"elapsed_days",
		"state",
		"due",
		"backup_practiced",
		"goal",
		"technique",
		"sync_version",
		"last_modified_at",
		"device_id"
	)
SELECT
	"id",
	"playlist_ref",
	"tune_ref",
	"practiced",
	"quality",
	"easiness",
	"difficulty",
	"stability",
	"interval",
	"step",
	"repetitions",
	"lapses",
	"elapsed_days",
	"state",
	"due",
	"backup_practiced",
	"goal",
	"technique",
	"sync_version",
	"last_modified_at",
	"device_id"
FROM
	`practice_record`;

--> statement-breakpoint
DROP TABLE `practice_record`;

--> statement-breakpoint
ALTER TABLE `__new_practice_record`
RENAME TO `practice_record`;

--> statement-breakpoint
CREATE UNIQUE INDEX `practice_record_tune_ref_playlist_ref_practiced_unique` ON `practice_record` (`tune_ref`, `playlist_ref`, `practiced`);

--> statement-breakpoint
CREATE INDEX `idx_practice_record_practiced` ON `practice_record` (`practiced`);

--> statement-breakpoint
CREATE INDEX `idx_practice_record_tune_playlist_practiced` ON `practice_record` (`tune_ref`, `playlist_ref`, `practiced`);

--> statement-breakpoint
CREATE INDEX `idx_practice_record_id` ON `practice_record` (`id`);

--> statement-breakpoint
CREATE TABLE
	`__new_prefs_scheduling_options` (
		`user_id` text PRIMARY KEY NOT NULL,
		`acceptable_delinquency_window` integer DEFAULT 21 NOT NULL,
		`min_reviews_per_day` integer,
		`max_reviews_per_day` integer,
		`days_per_week` integer,
		`weekly_rules` text,
		`exceptions` text,
		`sync_version` integer DEFAULT 1 NOT NULL,
		`last_modified_at` text NOT NULL,
		`device_id` text,
		FOREIGN KEY (`user_id`) REFERENCES `user_profile` (`supabase_user_id`) ON UPDATE no action ON DELETE no action
	);

--> statement-breakpoint
INSERT INTO
	`__new_prefs_scheduling_options` (
		"user_id",
		"acceptable_delinquency_window",
		"min_reviews_per_day",
		"max_reviews_per_day",
		"days_per_week",
		"weekly_rules",
		"exceptions",
		"sync_version",
		"last_modified_at",
		"device_id"
	)
SELECT
	"user_id",
	"acceptable_delinquency_window",
	"min_reviews_per_day",
	"max_reviews_per_day",
	"days_per_week",
	"weekly_rules",
	"exceptions",
	"sync_version",
	"last_modified_at",
	"device_id"
FROM
	`prefs_scheduling_options`;

--> statement-breakpoint
DROP TABLE `prefs_scheduling_options`;

--> statement-breakpoint
ALTER TABLE `__new_prefs_scheduling_options`
RENAME TO `prefs_scheduling_options`;

--> statement-breakpoint
CREATE TABLE
	`__new_prefs_spaced_repetition` (
		`user_id` text NOT NULL,
		`alg_type` text NOT NULL,
		`fsrs_weights` text,
		`request_retention` real,
		`maximum_interval` integer,
		`learning_steps` text,
		`relearning_steps` text,
		`enable_fuzzing` integer,
		`sync_version` integer DEFAULT 1 NOT NULL,
		`last_modified_at` text NOT NULL,
		`device_id` text,
		PRIMARY KEY (`user_id`, `alg_type`),
		FOREIGN KEY (`user_id`) REFERENCES `user_profile` (`supabase_user_id`) ON UPDATE no action ON DELETE no action
	);

--> statement-breakpoint
INSERT INTO
	`__new_prefs_spaced_repetition` (
		"user_id",
		"alg_type",
		"fsrs_weights",
		"request_retention",
		"maximum_interval",
		"learning_steps",
		"relearning_steps",
		"enable_fuzzing",
		"sync_version",
		"last_modified_at",
		"device_id"
	)
SELECT
	"user_id",
	"alg_type",
	"fsrs_weights",
	"request_retention",
	"maximum_interval",
	"learning_steps",
	"relearning_steps",
	"enable_fuzzing",
	"sync_version",
	"last_modified_at",
	"device_id"
FROM
	`prefs_spaced_repetition`;

--> statement-breakpoint
DROP TABLE `prefs_spaced_repetition`;

--> statement-breakpoint
ALTER TABLE `__new_prefs_spaced_repetition`
RENAME TO `prefs_spaced_repetition`;

--> statement-breakpoint
CREATE TABLE
	`__new_reference` (
		`id` text PRIMARY KEY NOT NULL,
		`url` text NOT NULL,
		`ref_type` text,
		`tune_ref` text NOT NULL,
		`user_ref` text,
		`comment` text,
		`title` text,
		`public` integer,
		`favorite` integer,
		`deleted` integer DEFAULT 0 NOT NULL,
		`sync_version` integer DEFAULT 1 NOT NULL,
		`last_modified_at` text NOT NULL,
		`device_id` text,
		FOREIGN KEY (`tune_ref`) REFERENCES `tune` (`id`) ON UPDATE no action ON DELETE no action,
		FOREIGN KEY (`user_ref`) REFERENCES `user_profile` (`supabase_user_id`) ON UPDATE no action ON DELETE no action
	);

--> statement-breakpoint
INSERT INTO
	`__new_reference` (
		"id",
		"url",
		"ref_type",
		"tune_ref",
		"user_ref",
		"comment",
		"title",
		"public",
		"favorite",
		"deleted",
		"sync_version",
		"last_modified_at",
		"device_id"
	)
SELECT
	"id",
	"url",
	"ref_type",
	"tune_ref",
	"user_ref",
	"comment",
	"title",
	"public",
	"favorite",
	"deleted",
	"sync_version",
	"last_modified_at",
	"device_id"
FROM
	`reference`;

--> statement-breakpoint
DROP TABLE `reference`;

--> statement-breakpoint
ALTER TABLE `__new_reference`
RENAME TO `reference`;

--> statement-breakpoint
CREATE INDEX `idx_reference_user_tune_public` ON `reference` (`user_ref`, `tune_ref`, `public`);

--> statement-breakpoint
CREATE INDEX `idx_reference_tune_user_ref` ON `reference` (`tune_ref`, `user_ref`);

--> statement-breakpoint
CREATE INDEX `idx_reference_tune_public` ON `reference` (`tune_ref`, `public`);

--> statement-breakpoint
CREATE TABLE
	`__new_tab_group_main_state` (
		`id` text PRIMARY KEY NOT NULL,
		`user_id` text NOT NULL,
		`which_tab` text DEFAULT 'practice',
		`playlist_id` text,
		`tab_spec` text,
		`practice_show_submitted` integer DEFAULT 0,
		`practice_mode_flashcard` integer DEFAULT 0,
		`sidebar_dock_position` text DEFAULT 'left',
		`sync_version` integer DEFAULT 1 NOT NULL,
		`last_modified_at` text NOT NULL,
		`device_id` text,
		FOREIGN KEY (`user_id`) REFERENCES `user_profile` (`supabase_user_id`) ON UPDATE no action ON DELETE no action
	);

--> statement-breakpoint
INSERT INTO
	`__new_tab_group_main_state` (
		"id",
		"user_id",
		"which_tab",
		"playlist_id",
		"tab_spec",
		"practice_show_submitted",
		"practice_mode_flashcard",
		"sidebar_dock_position",
		"sync_version",
		"last_modified_at",
		"device_id"
	)
SELECT
	"id",
	"user_id",
	"which_tab",
	"playlist_id",
	"tab_spec",
	"practice_show_submitted",
	"practice_mode_flashcard",
	"sidebar_dock_position",
	"sync_version",
	"last_modified_at",
	"device_id"
FROM
	`tab_group_main_state`;

--> statement-breakpoint
DROP TABLE `tab_group_main_state`;

--> statement-breakpoint
ALTER TABLE `__new_tab_group_main_state`
RENAME TO `tab_group_main_state`;

--> statement-breakpoint
CREATE TABLE
	`__new_table_state` (
		`user_id` text NOT NULL,
		`screen_size` text NOT NULL,
		`purpose` text NOT NULL,
		`playlist_id` text NOT NULL,
		`settings` text,
		`current_tune` text,
		`sync_version` integer DEFAULT 1 NOT NULL,
		`last_modified_at` text NOT NULL,
		`device_id` text,
		PRIMARY KEY (
			`user_id`,
			`screen_size`,
			`purpose`,
			`playlist_id`
		),
		FOREIGN KEY (`user_id`) REFERENCES `user_profile` (`supabase_user_id`) ON UPDATE no action ON DELETE no action,
		FOREIGN KEY (`playlist_id`) REFERENCES `playlist` (`id`) ON UPDATE no action ON DELETE no action
	);

--> statement-breakpoint
INSERT INTO
	`__new_table_state` (
		"user_id",
		"screen_size",
		"purpose",
		"playlist_id",
		"settings",
		"current_tune",
		"sync_version",
		"last_modified_at",
		"device_id"
	)
SELECT
	"user_id",
	"screen_size",
	"purpose",
	"playlist_id",
	"settings",
	"current_tune",
	"sync_version",
	"last_modified_at",
	"device_id"
FROM
	`table_state`;

--> statement-breakpoint
DROP TABLE `table_state`;

--> statement-breakpoint
ALTER TABLE `__new_table_state`
RENAME TO `table_state`;

--> statement-breakpoint
CREATE TABLE
	`__new_table_transient_data` (
		`user_id` text NOT NULL,
		`tune_id` text NOT NULL,
		`playlist_id` text NOT NULL,
		`purpose` text,
		`note_private` text,
		`note_public` text,
		`recall_eval` text,
		`practiced` text,
		`quality` integer,
		`easiness` real,
		`difficulty` real,
		`interval` integer,
		`step` integer,
		`repetitions` integer,
		`due` text,
		`backup_practiced` text,
		`goal` text,
		`technique` text,
		`stability` real,
		`state` integer DEFAULT 2,
		`sync_version` integer DEFAULT 1 NOT NULL,
		`last_modified_at` text NOT NULL,
		`device_id` text,
		PRIMARY KEY (`user_id`, `tune_id`, `playlist_id`),
		FOREIGN KEY (`user_id`) REFERENCES `user_profile` (`supabase_user_id`) ON UPDATE no action ON DELETE no action,
		FOREIGN KEY (`tune_id`) REFERENCES `tune` (`id`) ON UPDATE no action ON DELETE no action,
		FOREIGN KEY (`playlist_id`) REFERENCES `playlist` (`id`) ON UPDATE no action ON DELETE no action
	);

--> statement-breakpoint
INSERT INTO
	`__new_table_transient_data` (
		"user_id",
		"tune_id",
		"playlist_id",
		"purpose",
		"note_private",
		"note_public",
		"recall_eval",
		"practiced",
		"quality",
		"easiness",
		"difficulty",
		"interval",
		"step",
		"repetitions",
		"due",
		"backup_practiced",
		"goal",
		"technique",
		"stability",
		"state",
		"sync_version",
		"last_modified_at",
		"device_id"
	)
SELECT
	"user_id",
	"tune_id",
	"playlist_id",
	"purpose",
	"note_private",
	"note_public",
	"recall_eval",
	"practiced",
	"quality",
	"easiness",
	"difficulty",
	"interval",
	"step",
	"repetitions",
	"due",
	"backup_practiced",
	"goal",
	"technique",
	"stability",
	"state",
	"sync_version",
	"last_modified_at",
	"device_id"
FROM
	`table_transient_data`;

--> statement-breakpoint
DROP TABLE `table_transient_data`;

--> statement-breakpoint
ALTER TABLE `__new_table_transient_data`
RENAME TO `table_transient_data`;

--> statement-breakpoint
CREATE TABLE
	`__new_tag` (
		`id` text PRIMARY KEY NOT NULL,
		`user_ref` text NOT NULL,
		`tune_ref` text NOT NULL,
		`tag_text` text NOT NULL,
		`sync_version` integer DEFAULT 1 NOT NULL,
		`last_modified_at` text NOT NULL,
		`device_id` text,
		FOREIGN KEY (`user_ref`) REFERENCES `user_profile` (`supabase_user_id`) ON UPDATE no action ON DELETE no action,
		FOREIGN KEY (`tune_ref`) REFERENCES `tune` (`id`) ON UPDATE no action ON DELETE no action
	);

--> statement-breakpoint
INSERT INTO
	`__new_tag` (
		"id",
		"user_ref",
		"tune_ref",
		"tag_text",
		"sync_version",
		"last_modified_at",
		"device_id"
	)
SELECT
	"id",
	"user_ref",
	"tune_ref",
	"tag_text",
	"sync_version",
	"last_modified_at",
	"device_id"
FROM
	`tag`;

--> statement-breakpoint
DROP TABLE `tag`;

--> statement-breakpoint
ALTER TABLE `__new_tag`
RENAME TO `tag`;

--> statement-breakpoint
CREATE UNIQUE INDEX `tag_user_ref_tune_ref_tag_text_unique` ON `tag` (`user_ref`, `tune_ref`, `tag_text`);

--> statement-breakpoint
CREATE INDEX `idx_tag_user_ref_tune_ref` ON `tag` (`user_ref`, `tune_ref`);

--> statement-breakpoint
CREATE INDEX `idx_tag_user_ref_tag_text` ON `tag` (`user_ref`, `tag_text`);

--> statement-breakpoint
CREATE TABLE
	`__new_tune` (
		`id` text PRIMARY KEY NOT NULL,
		`id_foreign` integer,
		`primary_origin` text DEFAULT 'irishtune.info',
		`title` text,
		`type` text,
		`structure` text,
		`mode` text,
		`incipit` text,
		`genre` text,
		`private_for` text,
		`deleted` integer DEFAULT 0 NOT NULL,
		`sync_version` integer DEFAULT 1 NOT NULL,
		`last_modified_at` text NOT NULL,
		`device_id` text,
		FOREIGN KEY (`genre`) REFERENCES `genre` (`id`) ON UPDATE no action ON DELETE no action,
		FOREIGN KEY (`private_for`) REFERENCES `user_profile` (`supabase_user_id`) ON UPDATE no action ON DELETE no action
	);

--> statement-breakpoint
INSERT INTO
	`__new_tune` (
		"id",
		"id_foreign",
		"primary_origin",
		"title",
		"type",
		"structure",
		"mode",
		"incipit",
		"genre",
		"private_for",
		"deleted",
		"sync_version",
		"last_modified_at",
		"device_id"
	)
SELECT
	"id",
	"id_foreign",
	"primary_origin",
	"title",
	"type",
	"structure",
	"mode",
	"incipit",
	"genre",
	"private_for",
	"deleted",
	"sync_version",
	"last_modified_at",
	"device_id"
FROM
	`tune`;

--> statement-breakpoint
DROP TABLE `tune`;

--> statement-breakpoint
ALTER TABLE `__new_tune`
RENAME TO `tune`;

--> statement-breakpoint
CREATE TABLE
	`__new_tune_override` (
		`id` text PRIMARY KEY NOT NULL,
		`tune_ref` text NOT NULL,
		`user_ref` text NOT NULL,
		`title` text,
		`type` text,
		`structure` text,
		`genre` text,
		`mode` text,
		`incipit` text,
		`deleted` integer DEFAULT 0 NOT NULL,
		`sync_version` integer DEFAULT 1 NOT NULL,
		`last_modified_at` text NOT NULL,
		`device_id` text,
		FOREIGN KEY (`tune_ref`) REFERENCES `tune` (`id`) ON UPDATE no action ON DELETE no action,
		FOREIGN KEY (`user_ref`) REFERENCES `user_profile` (`supabase_user_id`) ON UPDATE no action ON DELETE no action,
		FOREIGN KEY (`genre`) REFERENCES `genre` (`id`) ON UPDATE no action ON DELETE no action
	);

--> statement-breakpoint
INSERT INTO
	`__new_tune_override` (
		"id",
		"tune_ref",
		"user_ref",
		"title",
		"type",
		"structure",
		"genre",
		"mode",
		"incipit",
		"deleted",
		"sync_version",
		"last_modified_at",
		"device_id"
	)
SELECT
	"id",
	"tune_ref",
	"user_ref",
	"title",
	"type",
	"structure",
	"genre",
	"mode",
	"incipit",
	"deleted",
	"sync_version",
	"last_modified_at",
	"device_id"
FROM
	`tune_override`;

--> statement-breakpoint
DROP TABLE `tune_override`;

--> statement-breakpoint
ALTER TABLE `__new_tune_override`
RENAME TO `tune_override`;

--> statement-breakpoint
CREATE TABLE
	`__new_daily_practice_queue` (
		`id` text PRIMARY KEY NOT NULL,
		`user_ref` text NOT NULL,
		`playlist_ref` text NOT NULL,
		`mode` text,
		`queue_date` text,
		`window_start_utc` text NOT NULL,
		`window_end_utc` text NOT NULL,
		`tune_ref` text NOT NULL,
		`bucket` integer NOT NULL,
		`order_index` integer NOT NULL,
		`snapshot_coalesced_ts` text NOT NULL,
		`scheduled_snapshot` text,
		`latest_due_snapshot` text,
		`acceptable_delinquency_window_snapshot` integer,
		`tz_offset_minutes_snapshot` integer,
		`generated_at` text NOT NULL,
		`completed_at` text,
		`exposures_required` integer,
		`exposures_completed` integer DEFAULT 0,
		`outcome` text,
		`active` integer DEFAULT 1 NOT NULL,
		`sync_version` integer DEFAULT 1 NOT NULL,
		`last_modified_at` text NOT NULL,
		`device_id` text
	);

--> statement-breakpoint
INSERT INTO
	`__new_daily_practice_queue` (
		"id",
		"user_ref",
		"playlist_ref",
		"mode",
		"queue_date",
		"window_start_utc",
		"window_end_utc",
		"tune_ref",
		"bucket",
		"order_index",
		"snapshot_coalesced_ts",
		"scheduled_snapshot",
		"latest_due_snapshot",
		"acceptable_delinquency_window_snapshot",
		"tz_offset_minutes_snapshot",
		"generated_at",
		"completed_at",
		"exposures_required",
		"exposures_completed",
		"outcome",
		"active",
		"sync_version",
		"last_modified_at",
		"device_id"
	)
SELECT
	"id",
	"user_ref",
	"playlist_ref",
	"mode",
	"queue_date",
	"window_start_utc",
	"window_end_utc",
	"tune_ref",
	"bucket",
	"order_index",
	"snapshot_coalesced_ts",
	"scheduled_snapshot",
	"latest_due_snapshot",
	"acceptable_delinquency_window_snapshot",
	"tz_offset_minutes_snapshot",
	"generated_at",
	"completed_at",
	"exposures_required",
	"exposures_completed",
	"outcome",
	"active",
	"sync_version",
	"last_modified_at",
	"device_id"
FROM
	`daily_practice_queue`;

--> statement-breakpoint
DROP TABLE `daily_practice_queue`;

--> statement-breakpoint
ALTER TABLE `__new_daily_practice_queue`
RENAME TO `daily_practice_queue`;

--> statement-breakpoint
CREATE UNIQUE INDEX `daily_practice_queue_user_ref_playlist_ref_window_start_utc_tune_ref_unique` ON `daily_practice_queue` (
	`user_ref`,
	`playlist_ref`,
	`window_start_utc`,
	`tune_ref`
);

--> statement-breakpoint
CREATE INDEX `idx_queue_generated_at` ON `daily_practice_queue` (`generated_at`);

--> statement-breakpoint
CREATE INDEX `idx_queue_user_playlist_bucket` ON `daily_practice_queue` (`user_ref`, `playlist_ref`, `bucket`);

--> statement-breakpoint
CREATE INDEX `idx_queue_user_playlist_active` ON `daily_practice_queue` (`user_ref`, `playlist_ref`, `active`);

--> statement-breakpoint
CREATE INDEX `idx_queue_user_playlist_window` ON `daily_practice_queue` (`user_ref`, `playlist_ref`, `window_start_utc`);

--> statement-breakpoint
CREATE TABLE
	`__new_sync_queue` (
		`id` text PRIMARY KEY NOT NULL,
		`table_name` text NOT NULL,
		`record_id` text NOT NULL,
		`operation` text NOT NULL,
		`data` text,
		`status` text DEFAULT 'pending' NOT NULL,
		`created_at` text NOT NULL,
		`synced_at` text,
		`attempts` integer DEFAULT 0 NOT NULL,
		`last_error` text
	);

--> statement-breakpoint
INSERT INTO
	`__new_sync_queue` (
		"id",
		"table_name",
		"record_id",
		"operation",
		"data",
		"status",
		"created_at",
		"synced_at",
		"attempts",
		"last_error"
	)
SELECT
	"id",
	"table_name",
	"record_id",
	"operation",
	"data",
	"status",
	"created_at",
	"synced_at",
	"attempts",
	"last_error"
FROM
	`sync_queue`;

--> statement-breakpoint
DROP TABLE `sync_queue`;

--> statement-breakpoint
ALTER TABLE `__new_sync_queue`
RENAME TO `sync_queue`;

--> statement-breakpoint
CREATE TABLE
	`__new_user_profile` (
		`supabase_user_id` text PRIMARY KEY NOT NULL,
		`name` text,
		`email` text,
		`sr_alg_type` text,
		`phone` text,
		`phone_verified` text,
		`acceptable_delinquency_window` integer DEFAULT 21,
		`avatar_url` text,
		`deleted` integer DEFAULT 0 NOT NULL,
		`sync_version` integer DEFAULT 1 NOT NULL,
		`last_modified_at` text NOT NULL,
		`device_id` text
	);

--> statement-breakpoint
INSERT INTO
	`__new_user_profile` (
		"supabase_user_id",
		"name",
		"email",
		"sr_alg_type",
		"phone",
		"phone_verified",
		"acceptable_delinquency_window",
		"avatar_url",
		"deleted",
		"sync_version",
		"last_modified_at",
		"device_id"
	)
SELECT
	"supabase_user_id",
	"name",
	"email",
	"sr_alg_type",
	"phone",
	"phone_verified",
	"acceptable_delinquency_window",
	"avatar_url",
	"deleted",
	"sync_version",
	"last_modified_at",
	"device_id"
FROM
	`user_profile`;

--> statement-breakpoint
DROP TABLE `user_profile`;

--> statement-breakpoint
ALTER TABLE `__new_user_profile`
RENAME TO `user_profile`;

--> statement-breakpoint
CREATE UNIQUE INDEX `user_profile_supabase_user_id_unique` ON `user_profile` (`supabase_user_id`);

--> statement-breakpoint
PRAGMA foreign_keys = ON;