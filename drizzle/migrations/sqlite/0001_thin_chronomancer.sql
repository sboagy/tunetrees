CREATE TABLE `sync_queue` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
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
ALTER TABLE `playlist` ADD `name` text;--> statement-breakpoint
ALTER TABLE `playlist` ADD `genre_default` text REFERENCES genre(id);