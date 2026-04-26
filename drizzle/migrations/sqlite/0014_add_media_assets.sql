CREATE TABLE IF NOT EXISTS `media_asset` (
  `id` text PRIMARY KEY NOT NULL,
  `reference_ref` text NOT NULL REFERENCES `reference`(`id`) ON DELETE CASCADE,
  `user_ref` text NOT NULL REFERENCES `user_profile`(`id`) ON DELETE CASCADE,
  `storage_path` text NOT NULL,
  `original_filename` text NOT NULL,
  `content_type` text NOT NULL,
  `file_size_bytes` integer NOT NULL,
  `duration_seconds` real,
  `regions_json` text,
  `deleted` integer DEFAULT 0 NOT NULL,
  `sync_version` integer DEFAULT 1 NOT NULL,
  `last_modified_at` text NOT NULL,
  `device_id` text
);

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `media_asset_reference_ref_uniq` ON `media_asset` (`reference_ref`);

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `media_asset_storage_path_uniq` ON `media_asset` (`storage_path`);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_media_asset_user_ref` ON `media_asset` (`user_ref`);