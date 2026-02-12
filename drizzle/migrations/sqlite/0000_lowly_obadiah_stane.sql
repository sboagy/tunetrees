CREATE TABLE
	`daily_practice_queue` (
		`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
		`user_ref` integer NOT NULL,
		`playlist_ref` integer NOT NULL,
		`mode` text,
		`queue_date` text,
		`window_start_utc` text NOT NULL,
		`window_end_utc` text NOT NULL,
		`tune_ref` integer NOT NULL,
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
CREATE INDEX `idx_queue_user_playlist_window` ON `daily_practice_queue` (`user_ref`, `playlist_ref`, `window_start_utc`);

--> statement-breakpoint
CREATE INDEX `idx_queue_user_playlist_active` ON `daily_practice_queue` (`user_ref`, `playlist_ref`, `active`);

--> statement-breakpoint
CREATE INDEX `idx_queue_user_playlist_bucket` ON `daily_practice_queue` (`user_ref`, `playlist_ref`, `bucket`);

--> statement-breakpoint
CREATE INDEX `idx_queue_generated_at` ON `daily_practice_queue` (`generated_at`);

--> statement-breakpoint
CREATE UNIQUE INDEX `daily_practice_queue_user_ref_playlist_ref_window_start_utc_tune_ref_unique` ON `daily_practice_queue` (
	`user_ref`,
	`playlist_ref`,
	`window_start_utc`,
	`tune_ref`
);

--> statement-breakpoint
CREATE TABLE
	`genre` (
		`id` text PRIMARY KEY NOT NULL,
		`name` text,
		`region` text,
		`description` text
	);

--> statement-breakpoint
CREATE TABLE
	`genre_tune_type` (
		`genre_id` text NOT NULL,
		`tune_type_id` text NOT NULL,
		PRIMARY KEY (`genre_id`, `tune_type_id`),
		FOREIGN KEY (`genre_id`) REFERENCES `genre` (`id`) ON UPDATE no action ON DELETE no action,
		FOREIGN KEY (`tune_type_id`) REFERENCES `tune_type` (`id`) ON UPDATE no action ON DELETE no action
	);

--> statement-breakpoint
CREATE TABLE
	`instrument` (
		`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
		`private_to_user` integer,
		`instrument` text,
		`description` text,
		`genre_default` text,
		`deleted` integer DEFAULT 0 NOT NULL,
		`sync_version` integer DEFAULT 1 NOT NULL,
		`last_modified_at` text NOT NULL,
		`device_id` text,
	FOREIGN KEY (`private_to_user`) REFERENCES `user_profile` (`supabase_user_id`) ON UPDATE no action ON DELETE no action
--> statement-breakpoint
CREATE INDEX `idx_instrument_instrument` ON `instrument` (`instrument`);

--> statement-breakpoint
CREATE INDEX `idx_instrument_private_to_user` ON `instrument` (`private_to_user`);

--> statement-breakpoint
CREATE UNIQUE INDEX `instrument_private_to_user_instrument_unique` ON `instrument` (`private_to_user`, `instrument`);

--> statement-breakpoint
CREATE TABLE
	`note` (
		`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
		`user_ref` integer,
		`tune_ref` integer NOT NULL,
		`playlist_ref` integer,
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
		FOREIGN KEY (`playlist_ref`) REFERENCES `playlist` (`playlist_id`) ON UPDATE no action ON DELETE no action
	);

--> statement-breakpoint
CREATE INDEX `idx_note_tune_playlist` ON `note` (`tune_ref`, `playlist_ref`);

--> statement-breakpoint
CREATE INDEX `idx_note_tune_playlist_user_public` ON `note` (`tune_ref`, `playlist_ref`, `user_ref`, `public`);

--> statement-breakpoint
CREATE INDEX `idx_note_tune_user` ON `note` (`tune_ref`, `user_ref`);

--> statement-breakpoint
CREATE TABLE
	`playlist` (
		`playlist_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
		`user_ref` integer NOT NULL,
		`instrument_ref` integer,
		`sr_alg_type` text,
		`deleted` integer DEFAULT 0 NOT NULL,
		`sync_version` integer DEFAULT 1 NOT NULL,
		`last_modified_at` text NOT NULL,
		`device_id` text,
		FOREIGN KEY (`user_ref`) REFERENCES `user_profile` (`supabase_user_id`) ON UPDATE no action ON DELETE no action
	);

--> statement-breakpoint
CREATE TABLE
	`playlist_tune` (
		`playlist_ref` integer NOT NULL,
		`tune_ref` integer NOT NULL,
		`current` text,
		`learned` text,
		`scheduled` text,
		`goal` text DEFAULT 'recall',
		`deleted` integer DEFAULT 0 NOT NULL,
		`sync_version` integer DEFAULT 1 NOT NULL,
		`last_modified_at` text NOT NULL,
		`device_id` text,
		PRIMARY KEY (`playlist_ref`, `tune_ref`),
		FOREIGN KEY (`playlist_ref`) REFERENCES `playlist` (`playlist_id`) ON UPDATE no action ON DELETE no action,
		FOREIGN KEY (`tune_ref`) REFERENCES `tune` (`id`) ON UPDATE no action ON DELETE no action
	);

--> statement-breakpoint
CREATE TABLE
	`practice_record` (
		`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
		`playlist_ref` integer NOT NULL,
		`tune_ref` integer NOT NULL,
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
		FOREIGN KEY (`playlist_ref`) REFERENCES `playlist` (`playlist_id`) ON UPDATE no action ON DELETE no action,
		FOREIGN KEY (`tune_ref`) REFERENCES `tune` (`id`) ON UPDATE no action ON DELETE no action
	);

--> statement-breakpoint
CREATE INDEX `idx_practice_record_id` ON `practice_record` (`id`);

--> statement-breakpoint
CREATE INDEX `idx_practice_record_tune_playlist_practiced` ON `practice_record` (`tune_ref`, `playlist_ref`, `practiced`);

--> statement-breakpoint
CREATE INDEX `idx_practice_record_practiced` ON `practice_record` (`practiced`);

--> statement-breakpoint
CREATE UNIQUE INDEX `practice_record_tune_ref_playlist_ref_practiced_unique` ON `practice_record` (`tune_ref`, `playlist_ref`, `practiced`);

--> statement-breakpoint
CREATE TABLE
	`prefs_scheduling_options` (
		`user_id` integer PRIMARY KEY NOT NULL,
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
CREATE TABLE
	`prefs_spaced_repetition` (
		`user_id` integer NOT NULL,
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
--> statement-breakpoint
CREATE TABLE
	`reference` (
		`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
		`url` text NOT NULL,
		`ref_type` text,
		`tune_ref` integer NOT NULL,
		`user_ref` integer,
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
CREATE INDEX `idx_reference_tune_public` ON `reference` (`tune_ref`, `public`);

--> statement-breakpoint
CREATE INDEX `idx_reference_tune_user_ref` ON `reference` (`tune_ref`, `user_ref`);

--> statement-breakpoint
CREATE INDEX `idx_reference_user_tune_public` ON `reference` (`user_ref`, `tune_ref`, `public`);

--> statement-breakpoint
CREATE TABLE
	`tab_group_main_state` (
		`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
		`user_id` integer NOT NULL,
		`which_tab` text DEFAULT 'practice',
		`playlist_id` integer,
		`tab_spec` text,
		`practice_show_submitted` integer DEFAULT 0,
		`practice_mode_flashcard` integer DEFAULT 0,
		`sync_version` integer DEFAULT 1 NOT NULL,
		`last_modified_at` text NOT NULL,
		`device_id` text,
		FOREIGN KEY (`user_id`) REFERENCES `user_profile` (`supabase_user_id`) ON UPDATE no action ON DELETE no action
	);

--> statement-breakpoint
CREATE TABLE
	`table_state` (
		`user_id` integer NOT NULL,
		`screen_size` text NOT NULL,
		`purpose` text NOT NULL,
		`playlist_id` integer NOT NULL,
		`settings` text,
		`current_tune` integer,
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
		FOREIGN KEY (`playlist_id`) REFERENCES `playlist` (`playlist_id`) ON UPDATE no action ON DELETE no action
	);

--> statement-breakpoint
CREATE TABLE
	`table_transient_data` (
		`user_id` integer NOT NULL,
		`tune_id` integer NOT NULL,
		`playlist_id` integer NOT NULL,
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
		PRIMARY KEY (`tune_id`, `user_id`, `playlist_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user_profile` (`supabase_user_id`) ON UPDATE no action ON DELETE no action,
		FOREIGN KEY (`tune_id`) REFERENCES `tune` (`id`) ON UPDATE no action ON DELETE no action,
		FOREIGN KEY (`playlist_id`) REFERENCES `playlist` (`playlist_id`) ON UPDATE no action ON DELETE no action
	);

--> statement-breakpoint
CREATE TABLE
	`tag` (
		`tag_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
		`user_ref` integer NOT NULL,
		`tune_ref` integer NOT NULL,
		`tag_text` text NOT NULL,
		`sync_version` integer DEFAULT 1 NOT NULL,
		`last_modified_at` text NOT NULL,
		`device_id` text,
	FOREIGN KEY (`user_ref`) REFERENCES `user_profile` (`supabase_user_id`) ON UPDATE no action ON DELETE no action,

--> statement-breakpoint
CREATE INDEX `idx_tag_user_ref_tag_text` ON `tag` (`user_ref`, `tag_text`);

--> statement-breakpoint
CREATE INDEX `idx_tag_user_ref_tune_ref` ON `tag` (`user_ref`, `tune_ref`);

--> statement-breakpoint
CREATE UNIQUE INDEX `tag_user_ref_tune_ref_tag_text_unique` ON `tag` (`user_ref`, `tune_ref`, `tag_text`);

--> statement-breakpoint
CREATE TABLE
	`tune` (
		`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
		`title` text,
		`type` text,
		`structure` text,
		`mode` text,
		`incipit` text,
		`genre` text,
		`private_for` integer,
		`deleted` integer DEFAULT 0 NOT NULL,
		`sync_version` integer DEFAULT 1 NOT NULL,
		`last_modified_at` text NOT NULL,
		`device_id` text,
		FOREIGN KEY (`genre`) REFERENCES `genre` (`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`private_for`) REFERENCES `user_profile` (`supabase_user_id`) ON UPDATE no action ON DELETE no action
CREATE TABLE
	`tune_override` (
		`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
		`tune_ref` integer NOT NULL,
		`user_ref` integer NOT NULL,
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
--> statement-breakpoint
CREATE TABLE
	`tune_type` (
		`id` text PRIMARY KEY NOT NULL,
		`name` text,
		`rhythm` text,
		`description` text
	);

--> statement-breakpoint
CREATE TABLE
	`user_profile` (
		`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
		`supabase_user_id` text NOT NULL,
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
CREATE UNIQUE INDEX `user_profile_supabase_user_id_unique` ON `user_profile` (`supabase_user_id`);