CREATE TABLE IF NOT EXISTS `media_draft_outbox` (
  `id` text PRIMARY KEY NOT NULL,
  `user_ref` text NOT NULL,
  `blob_url` text NOT NULL,
  `file_name` text NOT NULL,
  `content_type` text NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_media_draft_outbox_user_created` ON `media_draft_outbox` (`user_ref`, `created_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `user_genre_selection` (
  `user_id` text NOT NULL REFERENCES `user_profile`(`id`) ON DELETE CASCADE,
  `genre_id` text NOT NULL REFERENCES `genre`(`id`) ON DELETE CASCADE,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `last_modified_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `sync_version` integer DEFAULT 1 NOT NULL,
  `device_id` text,
  PRIMARY KEY (`user_id`, `genre_id`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_user_genre_selection_user_id` ON `user_genre_selection` (`user_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_user_genre_selection_genre_id` ON `user_genre_selection` (`genre_id`);
