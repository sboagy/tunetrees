ALTER TABLE `playlist` RENAME COLUMN "id" TO "playlist_id";--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_note` (
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
	FOREIGN KEY (`user_ref`) REFERENCES `user_profile`(`supabase_user_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tune_ref`) REFERENCES `tune`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`playlist_ref`) REFERENCES `playlist`(`playlist_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_note`("id", "user_ref", "tune_ref", "playlist_ref", "created_date", "note_text", "public", "favorite", "deleted", "sync_version", "last_modified_at", "device_id") SELECT "id", "user_ref", "tune_ref", "playlist_ref", "created_date", "note_text", "public", "favorite", "deleted", "sync_version", "last_modified_at", "device_id" FROM `note`;--> statement-breakpoint
DROP TABLE `note`;--> statement-breakpoint
ALTER TABLE `__new_note` RENAME TO `note`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_note_tune_user` ON `note` (`tune_ref`,`user_ref`);--> statement-breakpoint
CREATE INDEX `idx_note_tune_playlist_user_public` ON `note` (`tune_ref`,`playlist_ref`,`user_ref`,`public`);--> statement-breakpoint
CREATE INDEX `idx_note_tune_playlist` ON `note` (`tune_ref`,`playlist_ref`);--> statement-breakpoint
CREATE TABLE `__new_playlist_tune` (
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
	PRIMARY KEY(`playlist_ref`, `tune_ref`),
	FOREIGN KEY (`playlist_ref`) REFERENCES `playlist`(`playlist_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tune_ref`) REFERENCES `tune`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_playlist_tune`("playlist_ref", "tune_ref", "current", "learned", "scheduled", "goal", "deleted", "sync_version", "last_modified_at", "device_id") SELECT "playlist_ref", "tune_ref", "current", "learned", "scheduled", "goal", "deleted", "sync_version", "last_modified_at", "device_id" FROM `playlist_tune`;--> statement-breakpoint
DROP TABLE `playlist_tune`;--> statement-breakpoint
ALTER TABLE `__new_playlist_tune` RENAME TO `playlist_tune`;--> statement-breakpoint
CREATE TABLE `__new_practice_record` (
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
	FOREIGN KEY (`playlist_ref`) REFERENCES `playlist`(`playlist_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tune_ref`) REFERENCES `tune`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_practice_record`("id", "playlist_ref", "tune_ref", "practiced", "quality", "easiness", "difficulty", "stability", "interval", "step", "repetitions", "lapses", "elapsed_days", "state", "due", "backup_practiced", "goal", "technique", "sync_version", "last_modified_at", "device_id") SELECT "id", "playlist_ref", "tune_ref", "practiced", "quality", "easiness", "difficulty", "stability", "interval", "step", "repetitions", "lapses", "elapsed_days", "state", "due", "backup_practiced", "goal", "technique", "sync_version", "last_modified_at", "device_id" FROM `practice_record`;--> statement-breakpoint
DROP TABLE `practice_record`;--> statement-breakpoint
ALTER TABLE `__new_practice_record` RENAME TO `practice_record`;--> statement-breakpoint
CREATE UNIQUE INDEX `practice_record_tune_ref_playlist_ref_practiced_unique` ON `practice_record` (`tune_ref`,`playlist_ref`,`practiced`);--> statement-breakpoint
CREATE INDEX `idx_practice_record_practiced` ON `practice_record` (`practiced`);--> statement-breakpoint
CREATE INDEX `idx_practice_record_tune_playlist_practiced` ON `practice_record` (`tune_ref`,`playlist_ref`,`practiced`);--> statement-breakpoint
CREATE INDEX `idx_practice_record_id` ON `practice_record` (`id`);--> statement-breakpoint
CREATE TABLE `__new_table_state` (
	`user_id` text NOT NULL,
	`screen_size` text NOT NULL,
	`purpose` text NOT NULL,
	`playlist_id` text NOT NULL,
	`settings` text,
	`current_tune` text,
	`sync_version` integer DEFAULT 1 NOT NULL,
	`last_modified_at` text NOT NULL,
	`device_id` text,
	PRIMARY KEY(`user_id`, `screen_size`, `purpose`, `playlist_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user_profile`(`supabase_user_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`playlist_id`) REFERENCES `playlist`(`playlist_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_table_state`("user_id", "screen_size", "purpose", "playlist_id", "settings", "current_tune", "sync_version", "last_modified_at", "device_id") SELECT "user_id", "screen_size", "purpose", "playlist_id", "settings", "current_tune", "sync_version", "last_modified_at", "device_id" FROM `table_state`;--> statement-breakpoint
DROP TABLE `table_state`;--> statement-breakpoint
ALTER TABLE `__new_table_state` RENAME TO `table_state`;--> statement-breakpoint
CREATE TABLE `__new_table_transient_data` (
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
	PRIMARY KEY(`user_id`, `tune_id`, `playlist_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user_profile`(`supabase_user_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tune_id`) REFERENCES `tune`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`playlist_id`) REFERENCES `playlist`(`playlist_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_table_transient_data`("user_id", "tune_id", "playlist_id", "purpose", "note_private", "note_public", "recall_eval", "practiced", "quality", "easiness", "difficulty", "interval", "step", "repetitions", "due", "backup_practiced", "goal", "technique", "stability", "state", "sync_version", "last_modified_at", "device_id") SELECT "user_id", "tune_id", "playlist_id", "purpose", "note_private", "note_public", "recall_eval", "practiced", "quality", "easiness", "difficulty", "interval", "step", "repetitions", "due", "backup_practiced", "goal", "technique", "stability", "state", "sync_version", "last_modified_at", "device_id" FROM `table_transient_data`;--> statement-breakpoint
DROP TABLE `table_transient_data`;--> statement-breakpoint
ALTER TABLE `__new_table_transient_data` RENAME TO `table_transient_data`;--> statement-breakpoint