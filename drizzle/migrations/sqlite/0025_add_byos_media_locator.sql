ALTER TABLE `media_asset` ADD COLUMN `storage_kind` text NOT NULL DEFAULT 'r2';
--> statement-breakpoint
ALTER TABLE `media_asset` ADD COLUMN `byos_provider` text;
--> statement-breakpoint
ALTER TABLE `media_asset` ADD COLUMN `provider_file_id` text;
--> statement-breakpoint
ALTER TABLE `media_asset` ADD COLUMN `public_url` text;
--> statement-breakpoint
ALTER TABLE `media_asset` ADD COLUMN `locator_version` integer NOT NULL DEFAULT 1;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `media_asset_byos_provider_file_id_uniq`
  ON `media_asset` (`byos_provider`, `provider_file_id`);
