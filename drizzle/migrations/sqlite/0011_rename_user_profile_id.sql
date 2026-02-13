PRAGMA foreign_keys = OFF;
--> statement-breakpoint
ALTER TABLE `user_profile` RENAME COLUMN `supabase_user_id` TO `id`;
--> statement-breakpoint
DROP INDEX IF EXISTS `user_profile_supabase_user_id_unique`;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `user_profile_id_unique` ON `user_profile` (`id`);
--> statement-breakpoint
PRAGMA foreign_keys = ON;
