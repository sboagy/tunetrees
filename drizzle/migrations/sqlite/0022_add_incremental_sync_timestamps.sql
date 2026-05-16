ALTER TABLE `genre` ADD COLUMN `last_modified_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL;
--> statement-breakpoint
ALTER TABLE `genre_tune_type` ADD COLUMN `last_modified_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL;
--> statement-breakpoint
ALTER TABLE `tune_type` ADD COLUMN `last_modified_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL;
--> statement-breakpoint
ALTER TABLE `rhythm_patterns` ADD COLUMN `last_modified_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL;