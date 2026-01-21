CREATE TABLE IF NOT EXISTS `view_column_meta` (
  `view_name` text NOT NULL,
  `column_name` text NOT NULL,
  `description` text NOT NULL,
  PRIMARY KEY (`view_name`, `column_name`)
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_view_column_meta_view` ON `view_column_meta` (`view_name`);
