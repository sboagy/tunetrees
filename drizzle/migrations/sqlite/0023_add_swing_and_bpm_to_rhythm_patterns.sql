ALTER TABLE `rhythm_patterns` ADD COLUMN `swing_percentage` real DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `rhythm_patterns` ADD COLUMN `swing_desc` text;
--> statement-breakpoint
ALTER TABLE `rhythm_patterns` ADD COLUMN `bpm_override` integer;