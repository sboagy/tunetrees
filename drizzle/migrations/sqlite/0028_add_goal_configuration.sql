ALTER TABLE goal ADD COLUMN display_name TEXT;
--> statement-breakpoint
ALTER TABLE goal ADD COLUMN description TEXT;
--> statement-breakpoint
ALTER TABLE goal ADD COLUMN default_config TEXT;
--> statement-breakpoint
CREATE TABLE goal_user_settings (
  user_id TEXT NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
  goal_id TEXT NOT NULL REFERENCES goal(id),
  overrides TEXT NOT NULL DEFAULT '{}',
  deleted INTEGER NOT NULL DEFAULT 0,
  sync_version INTEGER NOT NULL DEFAULT 1,
  last_modified_at TEXT NOT NULL,
  device_id TEXT,
  PRIMARY KEY (user_id, goal_id)
);
--> statement-breakpoint
CREATE INDEX idx_goal_user_settings_goal ON goal_user_settings(goal_id);
