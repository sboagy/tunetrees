CREATE TABLE IF NOT EXISTS `program` (
  `id` text PRIMARY KEY NOT NULL,
  `group_ref` text NOT NULL REFERENCES `user_group`(`id`) ON DELETE CASCADE,
  `name` text NOT NULL,
  `description` text,
  `deleted` integer DEFAULT 0 NOT NULL,
  `created_at` text NOT NULL,
  `sync_version` integer DEFAULT 1 NOT NULL,
  `last_modified_at` text NOT NULL,
  `device_id` text
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_program_group_ref` ON `program` (`group_ref`);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `program_item` (
  `id` text PRIMARY KEY NOT NULL,
  `program_ref` text NOT NULL REFERENCES `program`(`id`) ON DELETE CASCADE,
  `item_kind` text NOT NULL CHECK (`item_kind` IN ('tune', 'tune_set')),
  `tune_ref` text REFERENCES `tune`(`id`) ON DELETE CASCADE,
  `tune_set_ref` text REFERENCES `tune_set`(`id`) ON DELETE CASCADE,
  `position` integer NOT NULL CHECK (`position` >= 0),
  `deleted` integer DEFAULT 0 NOT NULL,
  `sync_version` integer DEFAULT 1 NOT NULL,
  `last_modified_at` text NOT NULL,
  `device_id` text,
  CONSTRAINT `program_item_target_check` CHECK (
    (`item_kind` = 'tune' AND `tune_ref` IS NOT NULL AND `tune_set_ref` IS NULL)
    OR (`item_kind` = 'tune_set' AND `tune_ref` IS NULL AND `tune_set_ref` IS NOT NULL)
  ),
  CONSTRAINT `program_item_program_position_unique` UNIQUE (`program_ref`, `position`)
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_program_item_program_ref` ON `program_item` (`program_ref`);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_program_item_tune_ref` ON `program_item` (`tune_ref`);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_program_item_tune_set_ref` ON `program_item` (`tune_set_ref`);

--> statement-breakpoint
INSERT INTO `program` (
  `id`,
  `group_ref`,
  `name`,
  `description`,
  `deleted`,
  `created_at`,
  `sync_version`,
  `last_modified_at`,
  `device_id`
)
SELECT
  `id`,
  `group_ref`,
  `name`,
  `description`,
  `deleted`,
  `created_at`,
  `sync_version`,
  `last_modified_at`,
  `device_id`
FROM `tune_set`
WHERE `set_kind` = 'group_program';

--> statement-breakpoint
INSERT INTO `program_item` (
  `id`,
  `program_ref`,
  `item_kind`,
  `tune_ref`,
  `tune_set_ref`,
  `position`,
  `deleted`,
  `sync_version`,
  `last_modified_at`,
  `device_id`
)
SELECT
  tsi.`id`,
  tsi.`tune_set_ref`,
  'tune',
  tsi.`tune_ref`,
  NULL,
  tsi.`position`,
  tsi.`deleted`,
  tsi.`sync_version`,
  tsi.`last_modified_at`,
  tsi.`device_id`
FROM `tune_set_item` tsi
JOIN `tune_set` ts ON ts.`id` = tsi.`tune_set_ref`
WHERE ts.`set_kind` = 'group_program';

--> statement-breakpoint
CREATE TABLE `__new_tune_set` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_user_ref` text REFERENCES `user_profile`(`id`) ON DELETE CASCADE,
  `group_ref` text REFERENCES `user_group`(`id`) ON DELETE CASCADE,
  `name` text NOT NULL,
  `description` text,
  `set_kind` text NOT NULL CHECK (`set_kind` IN ('practice_set')),
  `deleted` integer DEFAULT 0 NOT NULL,
  `created_at` text NOT NULL,
  `sync_version` integer DEFAULT 1 NOT NULL,
  `last_modified_at` text NOT NULL,
  `device_id` text,
  CONSTRAINT `tune_set_single_owner_scope` CHECK ((`owner_user_ref` IS NULL) <> (`group_ref` IS NULL))
);

--> statement-breakpoint
INSERT INTO `__new_tune_set`
SELECT *
FROM `tune_set`
WHERE `set_kind` = 'practice_set';

--> statement-breakpoint
CREATE TABLE `__new_tune_set_item` (
  `id` text PRIMARY KEY NOT NULL,
  `tune_set_ref` text NOT NULL REFERENCES `__new_tune_set`(`id`) ON DELETE CASCADE,
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
INSERT INTO `__new_tune_set_item`
SELECT tsi.*
FROM `tune_set_item` tsi
JOIN `tune_set` ts ON ts.`id` = tsi.`tune_set_ref`
WHERE ts.`set_kind` = 'practice_set';

--> statement-breakpoint
DROP TABLE `tune_set_item`;

--> statement-breakpoint
DROP TABLE `tune_set`;

--> statement-breakpoint
ALTER TABLE `__new_tune_set` RENAME TO `tune_set`;

--> statement-breakpoint
ALTER TABLE `__new_tune_set_item` RENAME TO `tune_set_item`;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_tune_set_owner_user_ref` ON `tune_set` (`owner_user_ref`);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_tune_set_group_ref` ON `tune_set` (`group_ref`);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_tune_set_set_kind` ON `tune_set` (`set_kind`);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_tune_set_item_tune_set_ref` ON `tune_set_item` (`tune_set_ref`);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_tune_set_item_tune_ref` ON `tune_set_item` (`tune_ref`);