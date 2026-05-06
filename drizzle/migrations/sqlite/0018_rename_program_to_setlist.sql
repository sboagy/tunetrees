ALTER TABLE `program` RENAME TO `setlist`;
--> statement-breakpoint
ALTER TABLE `program_item` RENAME TO `setlist_item`;
--> statement-breakpoint
ALTER TABLE `setlist_item` RENAME COLUMN `program_ref` TO `setlist_ref`;
--> statement-breakpoint
ALTER TABLE `setlist` ADD COLUMN `user_ref` text REFERENCES `user_profile`(`id`) ON DELETE CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS `idx_program_group_ref`;
--> statement-breakpoint
DROP INDEX IF EXISTS `idx_program_item_program_ref`;
--> statement-breakpoint
DROP INDEX IF EXISTS `idx_program_item_tune_ref`;
--> statement-breakpoint
DROP INDEX IF EXISTS `idx_program_item_tune_set_ref`;
--> statement-breakpoint
DROP INDEX IF EXISTS `idx_program_item_program_position`;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_setlist_group_ref` ON `setlist` (`group_ref`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_setlist_user_ref` ON `setlist` (`user_ref`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_setlist_item_setlist_ref` ON `setlist_item` (`setlist_ref`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_setlist_item_tune_ref` ON `setlist_item` (`tune_ref`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_setlist_item_tune_set_ref` ON `setlist_item` (`tune_set_ref`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_setlist_item_setlist_position` ON `setlist_item` (`setlist_ref`, `position`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `event` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `event_date` text,
  `description` text,
  `setlist_ref` text REFERENCES `setlist`(`id`) ON DELETE SET NULL,
  `group_ref` text REFERENCES `user_group`(`id`) ON DELETE CASCADE,
  `user_ref` text REFERENCES `user_profile`(`id`) ON DELETE CASCADE,
  `deleted` integer DEFAULT 0 NOT NULL,
  `created_at` text NOT NULL,
  `sync_version` integer DEFAULT 1 NOT NULL,
  `last_modified_at` text NOT NULL,
  `device_id` text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_event_event_date` ON `event` (`event_date`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_event_group_ref` ON `event` (`group_ref`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_event_setlist_ref` ON `event` (`setlist_ref`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_event_user_ref` ON `event` (`user_ref`);
