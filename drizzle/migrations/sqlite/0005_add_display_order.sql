ALTER TABLE `note` ADD `display_order` integer DEFAULT 0 NOT NULL;

--> statement-breakpoint
ALTER TABLE `reference` ADD `display_order` integer DEFAULT 0 NOT NULL;