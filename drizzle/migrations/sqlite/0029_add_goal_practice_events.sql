ALTER TABLE practice_record ADD COLUMN goal_id TEXT REFERENCES goal(id);
--> statement-breakpoint
ALTER TABLE practice_record ADD COLUMN evaluation_id TEXT;
--> statement-breakpoint
ALTER TABLE practice_record ADD COLUMN evaluation_snapshot TEXT;
--> statement-breakpoint
ALTER TABLE practice_record ADD COLUMN scheduler_id TEXT;
--> statement-breakpoint
ALTER TABLE practice_record ADD COLUMN scheduler_version INTEGER;
--> statement-breakpoint
ALTER TABLE practice_record ADD COLUMN scheduler_state TEXT;
--> statement-breakpoint
ALTER TABLE practice_record ADD COLUMN interval_days REAL;
--> statement-breakpoint
CREATE INDEX idx_practice_record_goal_id ON practice_record(goal_id);
--> statement-breakpoint
ALTER TABLE table_transient_data ADD COLUMN goal_id TEXT REFERENCES goal(id);
--> statement-breakpoint
ALTER TABLE table_transient_data ADD COLUMN evaluation_id TEXT;
--> statement-breakpoint
ALTER TABLE table_transient_data ADD COLUMN evaluation_snapshot TEXT;
--> statement-breakpoint
ALTER TABLE table_transient_data ADD COLUMN scheduler_id TEXT;
--> statement-breakpoint
ALTER TABLE table_transient_data ADD COLUMN scheduler_version INTEGER;
--> statement-breakpoint
ALTER TABLE table_transient_data ADD COLUMN scheduler_state TEXT;
--> statement-breakpoint
ALTER TABLE table_transient_data ADD COLUMN interval_days REAL;
--> statement-breakpoint
ALTER TABLE table_transient_data ADD COLUMN predecessor_record_id TEXT;
--> statement-breakpoint
ALTER TABLE table_transient_data ADD COLUMN predecessor_fingerprint TEXT;
--> statement-breakpoint
ALTER TABLE table_transient_data ADD COLUMN calculation_config_hash TEXT;
--> statement-breakpoint
ALTER TABLE table_transient_data ADD COLUMN practice_record_id TEXT;
--> statement-breakpoint
CREATE INDEX idx_table_transient_data_goal_id ON table_transient_data(goal_id);
--> statement-breakpoint
ALTER TABLE repertoire_tune ADD COLUMN goal_id TEXT REFERENCES goal(id);
--> statement-breakpoint
CREATE INDEX idx_repertoire_tune_goal_id ON repertoire_tune(goal_id);
--> statement-breakpoint
ALTER TABLE daily_practice_queue ADD COLUMN allocation_goal_id TEXT REFERENCES goal(id);
--> statement-breakpoint
ALTER TABLE daily_practice_queue ADD COLUMN selection_reason TEXT;
--> statement-breakpoint
ALTER TABLE daily_practice_queue ADD COLUMN displayed_practice_record_id TEXT;
--> statement-breakpoint
CREATE INDEX idx_daily_practice_queue_allocation_goal_id ON daily_practice_queue(allocation_goal_id);
