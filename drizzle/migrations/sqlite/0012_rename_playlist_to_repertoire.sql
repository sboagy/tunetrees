ALTER TABLE `playlist` RENAME TO `repertoire`;
--> statement-breakpoint
ALTER TABLE `repertoire` RENAME COLUMN `playlist_id` TO `repertoire_id`;
--> statement-breakpoint
ALTER TABLE `playlist_tune` RENAME TO `repertoire_tune`;
--> statement-breakpoint
ALTER TABLE `repertoire_tune` RENAME COLUMN `playlist_ref` TO `repertoire_ref`;
--> statement-breakpoint
ALTER TABLE `daily_practice_queue` RENAME COLUMN `playlist_ref` TO `repertoire_ref`;
--> statement-breakpoint
ALTER TABLE `practice_record` RENAME COLUMN `playlist_ref` TO `repertoire_ref`;
--> statement-breakpoint
ALTER TABLE `note` RENAME COLUMN `playlist_ref` TO `repertoire_ref`;
--> statement-breakpoint
ALTER TABLE `tab_group_main_state` RENAME COLUMN `playlist_id` TO `repertoire_id`;
--> statement-breakpoint
ALTER TABLE `table_state` RENAME COLUMN `playlist_id` TO `repertoire_id`;
--> statement-breakpoint
ALTER TABLE `table_transient_data` RENAME COLUMN `playlist_id` TO `repertoire_id`;
