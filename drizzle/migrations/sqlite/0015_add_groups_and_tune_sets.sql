CREATE TABLE IF NOT EXISTS `user_group` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_user_ref` text NOT NULL REFERENCES `user_profile`(`id`) ON DELETE CASCADE,
  `name` text NOT NULL,
  `description` text,
  `deleted` integer DEFAULT 0 NOT NULL,
  `created_at` text NOT NULL,
  `sync_version` integer DEFAULT 1 NOT NULL,
  `last_modified_at` text NOT NULL,
  `device_id` text
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_user_group_owner_user_ref` ON `user_group` (`owner_user_ref`);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `group_member` (
  `id` text PRIMARY KEY NOT NULL,
  `group_ref` text NOT NULL REFERENCES `user_group`(`id`) ON DELETE CASCADE,
  `user_ref` text NOT NULL REFERENCES `user_profile`(`id`) ON DELETE CASCADE,
  `role` text NOT NULL DEFAULT 'member' CHECK (`role` IN ('owner', 'admin', 'member')),
  `deleted` integer DEFAULT 0 NOT NULL,
  `joined_at` text NOT NULL,
  `sync_version` integer DEFAULT 1 NOT NULL,
  `last_modified_at` text NOT NULL,
  `device_id` text,
  CONSTRAINT `group_member_group_user_unique` UNIQUE (`group_ref`, `user_ref`)
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_group_member_group_ref` ON `group_member` (`group_ref`);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_group_member_user_ref` ON `group_member` (`user_ref`);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `tune_set` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_user_ref` text REFERENCES `user_profile`(`id`) ON DELETE CASCADE,
  `group_ref` text REFERENCES `user_group`(`id`) ON DELETE CASCADE,
  `name` text NOT NULL,
  `description` text,
  `set_kind` text NOT NULL CHECK (`set_kind` IN ('practice_set', 'group_setlist')),
  `deleted` integer DEFAULT 0 NOT NULL,
  `created_at` text NOT NULL,
  `sync_version` integer DEFAULT 1 NOT NULL,
  `last_modified_at` text NOT NULL,
  `device_id` text,
  CONSTRAINT `tune_set_single_owner_scope` CHECK ((`owner_user_ref` IS NULL) <> (`group_ref` IS NULL))
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_tune_set_owner_user_ref` ON `tune_set` (`owner_user_ref`);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_tune_set_group_ref` ON `tune_set` (`group_ref`);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_tune_set_set_kind` ON `tune_set` (`set_kind`);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `tune_set_item` (
  `id` text PRIMARY KEY NOT NULL,
  `tune_set_ref` text NOT NULL REFERENCES `tune_set`(`id`) ON DELETE CASCADE,
  `tune_ref` text NOT NULL REFERENCES `tune`(`id`) ON DELETE CASCADE,
  `position` integer NOT NULL CHECK (`position` >= 0),
  `deleted` integer DEFAULT 0 NOT NULL,
  `sync_version` integer DEFAULT 1 NOT NULL,
  `last_modified_at` text NOT NULL,
  `device_id` text,
  CONSTRAINT `tune_set_item_set_tune_unique` UNIQUE (`tune_set_ref`, `tune_ref`),
  CONSTRAINT `tune_set_item_set_position_unique` UNIQUE (`tune_set_ref`, `position`)
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_tune_set_item_tune_set_ref` ON `tune_set_item` (`tune_set_ref`);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_tune_set_item_tune_ref` ON `tune_set_item` (`tune_ref`);