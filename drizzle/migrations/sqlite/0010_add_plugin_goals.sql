PRAGMA foreign_keys = OFF;

--> statement-breakpoint
ALTER TABLE "plugin" ADD COLUMN "goals" text DEFAULT '[]' NOT NULL;

--> statement-breakpoint
PRAGMA foreign_keys = ON;
