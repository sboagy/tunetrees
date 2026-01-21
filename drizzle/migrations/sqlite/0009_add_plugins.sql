PRAGMA foreign_keys = OFF;

--> statement-breakpoint
CREATE TABLE "plugin" (
  "id" text PRIMARY KEY NOT NULL,
  "user_ref" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "script" text NOT NULL,
  "capabilities" text NOT NULL,
  "is_public" integer DEFAULT 0 NOT NULL,
  "enabled" integer DEFAULT 1 NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "deleted" integer DEFAULT 0 NOT NULL,
  "sync_version" integer DEFAULT 1 NOT NULL,
  "last_modified_at" text NOT NULL,
  "device_id" text,
  FOREIGN KEY ("user_ref") REFERENCES "user_profile" ("id") ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE INDEX "idx_plugin_user_ref" ON "plugin" ("user_ref");

--> statement-breakpoint
CREATE INDEX "idx_plugin_public" ON "plugin" ("is_public");

--> statement-breakpoint
PRAGMA foreign_keys = ON;
