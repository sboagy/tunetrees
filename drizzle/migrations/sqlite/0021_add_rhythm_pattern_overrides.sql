ALTER TABLE `rhythm_patterns` ADD COLUMN `tune_id` text;
--> statement-breakpoint
ALTER TABLE `rhythm_patterns` ADD COLUMN `user_id` text;
--> statement-breakpoint
ALTER TABLE `rhythm_patterns` ADD COLUMN `pattern_type` text DEFAULT 'seed' NOT NULL CHECK (`pattern_type` IN ('seed', 'full_track'));