CREATE TABLE "daily_practice_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_ref" integer NOT NULL,
	"playlist_ref" integer NOT NULL,
	"mode" text,
	"queue_date" timestamp,
	"window_start_utc" timestamp NOT NULL,
	"window_end_utc" timestamp NOT NULL,
	"tune_ref" integer NOT NULL,
	"bucket" integer NOT NULL,
	"order_index" integer NOT NULL,
	"snapshot_coalesced_ts" timestamp NOT NULL,
	"scheduled_snapshot" text,
	"latest_due_snapshot" text,
	"acceptable_delinquency_window_snapshot" integer,
	"tz_offset_minutes_snapshot" integer,
	"generated_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"exposures_required" integer,
	"exposures_completed" integer DEFAULT 0,
	"outcome" text,
	"active" boolean DEFAULT true NOT NULL,
	"sync_version" integer DEFAULT 1 NOT NULL,
	"last_modified_at" timestamp DEFAULT now() NOT NULL,
	"device_id" text,
	CONSTRAINT "daily_practice_queue_user_ref_playlist_ref_window_start_utc_tune_ref_unique" UNIQUE("user_ref","playlist_ref","window_start_utc","tune_ref")
);
--> statement-breakpoint
CREATE TABLE "genre" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"region" text,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "genre_tune_type" (
	"genre_id" text NOT NULL,
	"tune_type_id" text NOT NULL,
	CONSTRAINT "genre_tune_type_genre_id_tune_type_id_pk" PRIMARY KEY("genre_id","tune_type_id")
);
--> statement-breakpoint
CREATE TABLE "instrument" (
	"id" serial PRIMARY KEY NOT NULL,
	"private_to_user" integer,
	"instrument" text,
	"description" text,
	"genre_default" text,
	"deleted" boolean DEFAULT false NOT NULL,
	"sync_version" integer DEFAULT 1 NOT NULL,
	"last_modified_at" timestamp DEFAULT now() NOT NULL,
	"device_id" text,
	CONSTRAINT "instrument_private_to_user_instrument_unique" UNIQUE("private_to_user","instrument")
);
--> statement-breakpoint
CREATE TABLE "note" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_ref" integer,
	"tune_ref" integer NOT NULL,
	"playlist_ref" integer,
	"created_date" timestamp,
	"note_text" text,
	"public" boolean DEFAULT false NOT NULL,
	"favorite" boolean,
	"deleted" boolean DEFAULT false NOT NULL,
	"sync_version" integer DEFAULT 1 NOT NULL,
	"last_modified_at" timestamp DEFAULT now() NOT NULL,
	"device_id" text,
	CONSTRAINT "chk_public_bool" CHECK (public IN (true, false)),
	CONSTRAINT "chk_favorite_bool" CHECK (favorite IN (true, false))
);
--> statement-breakpoint
CREATE TABLE "playlist" (
	"playlist_id" serial PRIMARY KEY NOT NULL,
	"user_ref" integer NOT NULL,
	"instrument_ref" integer,
	"sr_alg_type" text,
	"deleted" boolean DEFAULT false NOT NULL,
	"sync_version" integer DEFAULT 1 NOT NULL,
	"last_modified_at" timestamp DEFAULT now() NOT NULL,
	"device_id" text,
	CONSTRAINT "playlist_user_ref_instrument_ref_unique" UNIQUE("user_ref","instrument_ref")
);
--> statement-breakpoint
CREATE TABLE "playlist_tune" (
	"playlist_ref" integer NOT NULL,
	"tune_ref" integer NOT NULL,
	"current" timestamp,
	"learned" timestamp,
	"scheduled" timestamp,
	"goal" text DEFAULT 'recall',
	"deleted" boolean DEFAULT false NOT NULL,
	"sync_version" integer DEFAULT 1 NOT NULL,
	"last_modified_at" timestamp DEFAULT now() NOT NULL,
	"device_id" text,
	CONSTRAINT "playlist_tune_playlist_ref_tune_ref_pk" PRIMARY KEY("playlist_ref","tune_ref")
);
--> statement-breakpoint
CREATE TABLE "practice_record" (
	"id" serial PRIMARY KEY NOT NULL,
	"playlist_ref" integer NOT NULL,
	"tune_ref" integer NOT NULL,
	"practiced" timestamp,
	"quality" integer,
	"easiness" real,
	"difficulty" real,
	"stability" real,
	"interval" integer,
	"step" integer,
	"repetitions" integer,
	"lapses" integer,
	"elapsed_days" integer,
	"state" integer,
	"due" timestamp,
	"backup_practiced" timestamp,
	"goal" text DEFAULT 'recall',
	"technique" text,
	"sync_version" integer DEFAULT 1 NOT NULL,
	"last_modified_at" timestamp DEFAULT now() NOT NULL,
	"device_id" text,
	CONSTRAINT "practice_record_tune_ref_playlist_ref_practiced_unique" UNIQUE("tune_ref","playlist_ref","practiced")
);
--> statement-breakpoint
CREATE TABLE "prefs_scheduling_options" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"acceptable_delinquency_window" integer DEFAULT 21 NOT NULL,
	"min_reviews_per_day" integer,
	"max_reviews_per_day" integer,
	"days_per_week" integer,
	"weekly_rules" text,
	"exceptions" text,
	"sync_version" integer DEFAULT 1 NOT NULL,
	"last_modified_at" timestamp DEFAULT now() NOT NULL,
	"device_id" text
);
--> statement-breakpoint
CREATE TABLE "prefs_spaced_repetition" (
	"user_id" integer NOT NULL,
	"alg_type" text NOT NULL,
	"fsrs_weights" text,
	"request_retention" real,
	"maximum_interval" integer,
	"learning_steps" text,
	"relearning_steps" text,
	"enable_fuzzing" boolean,
	"sync_version" integer DEFAULT 1 NOT NULL,
	"last_modified_at" timestamp DEFAULT now() NOT NULL,
	"device_id" text,
	CONSTRAINT "prefs_spaced_repetition_user_id_alg_type_pk" PRIMARY KEY("user_id","alg_type"),
	CONSTRAINT "check_name" CHECK (alg_type IN ('SM2', 'FSRS'))
);
--> statement-breakpoint
CREATE TABLE "reference" (
	"id" serial PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"ref_type" text,
	"tune_ref" integer NOT NULL,
	"user_ref" integer,
	"comment" text,
	"title" text,
	"public" boolean,
	"favorite" boolean,
	"deleted" boolean DEFAULT false NOT NULL,
	"sync_version" integer DEFAULT 1 NOT NULL,
	"last_modified_at" timestamp DEFAULT now() NOT NULL,
	"device_id" text,
	CONSTRAINT "check_ref_type" CHECK (ref_type IN ('website', 'audio', 'video')),
	CONSTRAINT "check_public" CHECK (public IN (true, false)),
	CONSTRAINT "check_favorite" CHECK (favorite IN (true, false))
);
--> statement-breakpoint
CREATE TABLE "tab_group_main_state" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"which_tab" text DEFAULT 'practice',
	"playlist_id" integer,
	"tab_spec" text,
	"practice_show_submitted" integer DEFAULT 0,
	"practice_mode_flashcard" integer DEFAULT 0,
	"sync_version" integer DEFAULT 1 NOT NULL,
	"last_modified_at" timestamp DEFAULT now() NOT NULL,
	"device_id" text,
	CONSTRAINT "check_name" CHECK (which_tab IN ('scheduled', 'repertoire', 'catalog', 'analysis'))
);
--> statement-breakpoint
CREATE TABLE "table_state" (
	"user_id" integer NOT NULL,
	"screen_size" text NOT NULL,
	"purpose" text NOT NULL,
	"playlist_id" integer NOT NULL,
	"settings" text,
	"current_tune" integer,
	"sync_version" integer DEFAULT 1 NOT NULL,
	"last_modified_at" timestamp DEFAULT now() NOT NULL,
	"device_id" text,
	CONSTRAINT "table_state_user_id_screen_size_purpose_playlist_id_pk" PRIMARY KEY("user_id","screen_size","purpose","playlist_id"),
	CONSTRAINT "purpose_check" CHECK (purpose IN ('practice', 'repertoire', 'catalog', 'analysis')),
	CONSTRAINT "screen_size_check" CHECK (screen_size IN ('small', 'full'))
);
--> statement-breakpoint
CREATE TABLE "table_transient_data" (
	"user_id" integer NOT NULL,
	"tune_id" integer NOT NULL,
	"playlist_id" integer NOT NULL,
	"purpose" text,
	"note_private" text,
	"note_public" text,
	"recall_eval" text,
	"practiced" timestamp,
	"quality" integer,
	"easiness" real,
	"difficulty" real,
	"interval" integer,
	"step" integer,
	"repetitions" integer,
	"due" timestamp,
	"backup_practiced" timestamp,
	"goal" text,
	"technique" text,
	"stability" real,
	"state" integer DEFAULT 2,
	"sync_version" integer DEFAULT 1 NOT NULL,
	"last_modified_at" timestamp DEFAULT now() NOT NULL,
	"device_id" text,
	CONSTRAINT "table_transient_data_tune_id_user_id_playlist_id_pk" PRIMARY KEY("tune_id","user_id","playlist_id")
);
--> statement-breakpoint
CREATE TABLE "tag" (
	"tag_id" serial PRIMARY KEY NOT NULL,
	"user_ref" integer NOT NULL,
	"tune_ref" integer NOT NULL,
	"tag_text" text NOT NULL,
	"sync_version" integer DEFAULT 1 NOT NULL,
	"last_modified_at" timestamp DEFAULT now() NOT NULL,
	"device_id" text,
	CONSTRAINT "tag_user_ref_tune_ref_tag_text_unique" UNIQUE("user_ref","tune_ref","tag_text")
);
--> statement-breakpoint
CREATE TABLE "tune" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text,
	"type" text,
	"structure" text,
	"mode" text,
	"incipit" text,
	"genre" text,
	"private_for" integer,
	"deleted" boolean DEFAULT false NOT NULL,
	"sync_version" integer DEFAULT 1 NOT NULL,
	"last_modified_at" timestamp DEFAULT now() NOT NULL,
	"device_id" text
);
--> statement-breakpoint
CREATE TABLE "tune_override" (
	"id" serial PRIMARY KEY NOT NULL,
	"tune_ref" integer NOT NULL,
	"user_ref" integer NOT NULL,
	"title" text,
	"type" text,
	"structure" text,
	"genre" text,
	"mode" text,
	"incipit" text,
	"deleted" boolean DEFAULT false NOT NULL,
	"sync_version" integer DEFAULT 1 NOT NULL,
	"last_modified_at" timestamp DEFAULT now() NOT NULL,
	"device_id" text
);
--> statement-breakpoint
CREATE TABLE "tune_type" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"rhythm" text,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "user_profile" (
	"id" serial PRIMARY KEY NOT NULL,
	"supabase_user_id" uuid NOT NULL,
	"name" text,
	"email" text,
	"sr_alg_type" text,
	"phone" text,
	"phone_verified" timestamp,
	"acceptable_delinquency_window" integer DEFAULT 21,
	"deleted" boolean DEFAULT false NOT NULL,
	"sync_version" integer DEFAULT 1 NOT NULL,
	"last_modified_at" timestamp DEFAULT now() NOT NULL,
	"device_id" text,
	CONSTRAINT "user_profile_supabase_user_id_unique" UNIQUE("supabase_user_id")
);
--> statement-breakpoint
ALTER TABLE "genre_tune_type" ADD CONSTRAINT "genre_tune_type_genre_id_genre_id_fk" FOREIGN KEY ("genre_id") REFERENCES "public"."genre"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "genre_tune_type" ADD CONSTRAINT "genre_tune_type_tune_type_id_tune_type_id_fk" FOREIGN KEY ("tune_type_id") REFERENCES "public"."tune_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instrument" ADD CONSTRAINT "instrument_private_to_user_user_profile_id_fk" FOREIGN KEY ("private_to_user") REFERENCES "public"."user_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note" ADD CONSTRAINT "note_user_ref_user_profile_id_fk" FOREIGN KEY ("user_ref") REFERENCES "public"."user_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note" ADD CONSTRAINT "note_tune_ref_tune_id_fk" FOREIGN KEY ("tune_ref") REFERENCES "public"."tune"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note" ADD CONSTRAINT "note_playlist_ref_playlist_playlist_id_fk" FOREIGN KEY ("playlist_ref") REFERENCES "public"."playlist"("playlist_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist" ADD CONSTRAINT "playlist_user_ref_user_profile_id_fk" FOREIGN KEY ("user_ref") REFERENCES "public"."user_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_tune" ADD CONSTRAINT "playlist_tune_playlist_ref_playlist_playlist_id_fk" FOREIGN KEY ("playlist_ref") REFERENCES "public"."playlist"("playlist_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_tune" ADD CONSTRAINT "playlist_tune_tune_ref_tune_id_fk" FOREIGN KEY ("tune_ref") REFERENCES "public"."tune"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_record" ADD CONSTRAINT "practice_record_playlist_ref_playlist_playlist_id_fk" FOREIGN KEY ("playlist_ref") REFERENCES "public"."playlist"("playlist_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_record" ADD CONSTRAINT "practice_record_tune_ref_tune_id_fk" FOREIGN KEY ("tune_ref") REFERENCES "public"."tune"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prefs_scheduling_options" ADD CONSTRAINT "prefs_scheduling_options_user_id_user_profile_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prefs_spaced_repetition" ADD CONSTRAINT "prefs_spaced_repetition_user_id_user_profile_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference" ADD CONSTRAINT "reference_tune_ref_tune_id_fk" FOREIGN KEY ("tune_ref") REFERENCES "public"."tune"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference" ADD CONSTRAINT "reference_user_ref_user_profile_id_fk" FOREIGN KEY ("user_ref") REFERENCES "public"."user_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tab_group_main_state" ADD CONSTRAINT "tab_group_main_state_user_id_user_profile_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_state" ADD CONSTRAINT "table_state_user_id_user_profile_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_state" ADD CONSTRAINT "table_state_playlist_id_playlist_playlist_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlist"("playlist_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_transient_data" ADD CONSTRAINT "table_transient_data_user_id_user_profile_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_transient_data" ADD CONSTRAINT "table_transient_data_tune_id_tune_id_fk" FOREIGN KEY ("tune_id") REFERENCES "public"."tune"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_transient_data" ADD CONSTRAINT "table_transient_data_playlist_id_playlist_playlist_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlist"("playlist_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag" ADD CONSTRAINT "tag_user_ref_user_profile_id_fk" FOREIGN KEY ("user_ref") REFERENCES "public"."user_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag" ADD CONSTRAINT "tag_tune_ref_tune_id_fk" FOREIGN KEY ("tune_ref") REFERENCES "public"."tune"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tune" ADD CONSTRAINT "tune_genre_genre_id_fk" FOREIGN KEY ("genre") REFERENCES "public"."genre"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tune" ADD CONSTRAINT "tune_private_for_user_profile_id_fk" FOREIGN KEY ("private_for") REFERENCES "public"."user_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tune_override" ADD CONSTRAINT "tune_override_tune_ref_tune_id_fk" FOREIGN KEY ("tune_ref") REFERENCES "public"."tune"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tune_override" ADD CONSTRAINT "tune_override_user_ref_user_profile_id_fk" FOREIGN KEY ("user_ref") REFERENCES "public"."user_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tune_override" ADD CONSTRAINT "tune_override_genre_genre_id_fk" FOREIGN KEY ("genre") REFERENCES "public"."genre"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_queue_user_playlist_window" ON "daily_practice_queue" USING btree ("user_ref","playlist_ref","window_start_utc");--> statement-breakpoint
CREATE INDEX "idx_queue_user_playlist_active" ON "daily_practice_queue" USING btree ("user_ref","playlist_ref","active");--> statement-breakpoint
CREATE INDEX "idx_queue_user_playlist_bucket" ON "daily_practice_queue" USING btree ("user_ref","playlist_ref","bucket");--> statement-breakpoint
CREATE INDEX "idx_queue_generated_at" ON "daily_practice_queue" USING btree ("generated_at");--> statement-breakpoint
CREATE INDEX "idx_instrument_instrument" ON "instrument" USING btree ("instrument");--> statement-breakpoint
CREATE INDEX "idx_instrument_private_to_user" ON "instrument" USING btree ("private_to_user");--> statement-breakpoint
CREATE INDEX "idx_note_tune_playlist" ON "note" USING btree ("tune_ref","playlist_ref");--> statement-breakpoint
CREATE INDEX "idx_note_tune_playlist_user_public" ON "note" USING btree ("tune_ref","playlist_ref","user_ref","public");--> statement-breakpoint
CREATE INDEX "idx_note_tune_user" ON "note" USING btree ("tune_ref","user_ref");--> statement-breakpoint
CREATE INDEX "idx_practice_record_id" ON "practice_record" USING btree ("id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_practice_record_tune_playlist_practiced" ON "practice_record" USING btree ("tune_ref","playlist_ref","practiced" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_practice_record_practiced" ON "practice_record" USING btree ("practiced" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_reference_tune_public" ON "reference" USING btree ("tune_ref","public");--> statement-breakpoint
CREATE INDEX "idx_reference_tune_user_ref" ON "reference" USING btree ("tune_ref","user_ref");--> statement-breakpoint
CREATE INDEX "idx_reference_user_tune_public" ON "reference" USING btree ("user_ref","tune_ref","public");--> statement-breakpoint
CREATE INDEX "idx_tag_user_ref_tag_text" ON "tag" USING btree ("user_ref","tag_text");--> statement-breakpoint
CREATE INDEX "idx_tag_user_ref_tune_ref" ON "tag" USING btree ("user_ref","tune_ref");