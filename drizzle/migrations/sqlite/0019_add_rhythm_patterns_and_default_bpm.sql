ALTER TABLE `genre_tune_type` ADD COLUMN `default_bpm` integer;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `rhythm_patterns` (
  `id` text PRIMARY KEY NOT NULL,
  `genre_id` text NOT NULL REFERENCES `genre`(`id`),
  `tune_type_id` text NOT NULL REFERENCES `tune_type`(`id`),
  `name` text NOT NULL,
  `part_target` text DEFAULT '*',
  `abc_string` text NOT NULL,
  `is_default` integer DEFAULT 0 NOT NULL,
  `premium_audio_url` text
);