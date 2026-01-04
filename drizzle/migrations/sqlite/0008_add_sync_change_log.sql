CREATE TABLE IF NOT EXISTS `sync_change_log` (
  `table_name` text PRIMARY KEY NOT NULL,
  `changed_at` text NOT NULL
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_sync_change_log_changed_at`
  ON `sync_change_log` (`changed_at`);

