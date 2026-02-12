-- Migration: Rename playlist to repertoire in SQLite
-- Note: SQLite uses ALTER TABLE RENAME for renaming tables and columns

-- Step 1: Rename the main tables
ALTER TABLE `playlist` RENAME TO `repertoire`;
--> statement-breakpoint
ALTER TABLE `playlist_tune` RENAME TO `repertoire_tune`;

-- Step 2: Rename columns in repertoire table
--> statement-breakpoint
ALTER TABLE `repertoire` RENAME COLUMN `playlist_id` TO `repertoire_id`;

-- Step 3: Rename foreign key columns in repertoire_tune table
--> statement-breakpoint
ALTER TABLE `repertoire_tune` RENAME COLUMN `playlist_ref` TO `repertoire_ref`;

-- Step 4: Rename foreign key columns in other tables
--> statement-breakpoint
ALTER TABLE `tab_group_main_state` RENAME COLUMN `playlist_id` TO `repertoire_id`;
--> statement-breakpoint
ALTER TABLE `practice_record` RENAME COLUMN `playlist_ref` TO `repertoire_ref`;
--> statement-breakpoint
ALTER TABLE `daily_practice_queue` RENAME COLUMN `playlist_ref` TO `repertoire_ref`;
--> statement-breakpoint
ALTER TABLE `note` RENAME COLUMN `playlist_ref` TO `repertoire_ref`;
--> statement-breakpoint
ALTER TABLE `table_state` RENAME COLUMN `playlist_id` TO `repertoire_id`;
--> statement-breakpoint
ALTER TABLE `table_transient_data` RENAME COLUMN `playlist_id` TO `repertoire_id`;
