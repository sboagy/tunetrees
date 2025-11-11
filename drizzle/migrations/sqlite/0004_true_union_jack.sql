PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_sync_queue` (
	`id` text PRIMARY KEY NOT NULL,
	`table_name` text NOT NULL,
	`record_id` text,
	`operation` text NOT NULL,
	`data` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	`synced_at` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text
);
--> statement-breakpoint
INSERT INTO `__new_sync_queue`("id", "table_name", "record_id", "operation", "data", "status", "created_at", "synced_at", "attempts", "last_error") SELECT "id", "table_name", "record_id", "operation", "data", "status", "created_at", "synced_at", "attempts", "last_error" FROM `sync_queue`;--> statement-breakpoint
DROP TABLE `sync_queue`;--> statement-breakpoint
ALTER TABLE `__new_sync_queue` RENAME TO `sync_queue`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `user_profile` ADD `avatar_url` text;