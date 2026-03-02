CREATE TABLE IF NOT EXISTS `goal` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `private_for` text REFERENCES `user_profile`(`id`),
  `default_technique` text DEFAULT 'fsrs' NOT NULL,
  `base_intervals` text,
  `deleted` integer DEFAULT 0 NOT NULL,
  `sync_version` integer DEFAULT 1 NOT NULL,
  `last_modified_at` text NOT NULL,
  `device_id` text
);

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `goal_name_owner_uniq` ON `goal` (`name`, `private_for`);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_goal_private_for` ON `goal` (`private_for`);
