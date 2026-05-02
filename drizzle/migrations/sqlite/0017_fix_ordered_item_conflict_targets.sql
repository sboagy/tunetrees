CREATE TABLE `__new_tune_set_item` (
  `id` text PRIMARY KEY NOT NULL,
  `tune_set_ref` text NOT NULL REFERENCES `tune_set`(`id`) ON DELETE CASCADE,
  `tune_ref` text NOT NULL REFERENCES `tune`(`id`) ON DELETE CASCADE,
  `position` integer NOT NULL CHECK (`position` >= 0),
  `deleted` integer DEFAULT 0 NOT NULL,
  `sync_version` integer DEFAULT 1 NOT NULL,
  `last_modified_at` text NOT NULL,
  `device_id` text,
  CONSTRAINT `tune_set_item_set_tune_unique` UNIQUE (`tune_set_ref`, `tune_ref`)
);

--> statement-breakpoint
INSERT INTO `__new_tune_set_item`
SELECT *
FROM `tune_set_item`;

--> statement-breakpoint
DROP TABLE `tune_set_item`;

--> statement-breakpoint
ALTER TABLE `__new_tune_set_item` RENAME TO `tune_set_item`;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_tune_set_item_tune_set_ref` ON `tune_set_item` (`tune_set_ref`);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_tune_set_item_tune_ref` ON `tune_set_item` (`tune_ref`);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_tune_set_item_set_position` ON `tune_set_item` (`tune_set_ref`, `position`);

--> statement-breakpoint
CREATE TABLE `__new_program_item` (
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
  )
);

--> statement-breakpoint
INSERT INTO `__new_program_item`
SELECT *
FROM `program_item`;

--> statement-breakpoint
DROP TABLE `program_item`;

--> statement-breakpoint
ALTER TABLE `__new_program_item` RENAME TO `program_item`;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_program_item_program_ref` ON `program_item` (`program_ref`);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_program_item_tune_ref` ON `program_item` (`tune_ref`);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_program_item_tune_set_ref` ON `program_item` (`tune_set_ref`);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_program_item_program_position` ON `program_item` (`program_ref`, `position`);