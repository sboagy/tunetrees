-- Migration: Switch to UUID primary keys (Phase 1.3 - BREAKING CHANGE)
-- ⚠️ BREAKING: This drops integer ID columns and renames UUID columns
-- Final schema will have clean column names (id, user_ref, etc.)
-- Step 1: Drop all foreign key constraints that reference integer PKs
ALTER TABLE public.daily_practice_queue
DROP CONSTRAINT IF EXISTS daily_practice_queue_playlist_fk;

ALTER TABLE public.daily_practice_queue
DROP CONSTRAINT IF EXISTS daily_practice_queue_tune_fk;

ALTER TABLE public.daily_practice_queue
DROP CONSTRAINT IF EXISTS daily_practice_queue_user_profile_fk;

ALTER TABLE public.genre_tune_type
DROP CONSTRAINT IF EXISTS genre_tune_type_genre_id_genre_id_fk;

ALTER TABLE public.genre_tune_type
DROP CONSTRAINT IF EXISTS genre_tune_type_tune_type_id_tune_type_id_fk;

ALTER TABLE public.instrument
DROP CONSTRAINT IF EXISTS instrument_genre_fk;

ALTER TABLE public.instrument
DROP CONSTRAINT IF EXISTS instrument_private_to_user_user_profile_id_fk;

ALTER TABLE public.note
DROP CONSTRAINT IF EXISTS note_playlist_ref_playlist_playlist_id_fk;

ALTER TABLE public.note
DROP CONSTRAINT IF EXISTS note_tune_ref_tune_id_fk;

ALTER TABLE public.note
DROP CONSTRAINT IF EXISTS note_user_ref_user_profile_id_fk;

ALTER TABLE public.playlist
DROP CONSTRAINT IF EXISTS playlist_instrument_fk;

ALTER TABLE public.playlist
DROP CONSTRAINT IF EXISTS playlist_user_ref_user_profile_id_fk;

ALTER TABLE public.playlist_tune
DROP CONSTRAINT IF EXISTS playlist_tune_playlist_ref_playlist_playlist_id_fk;

ALTER TABLE public.playlist_tune
DROP CONSTRAINT IF EXISTS playlist_tune_tune_ref_tune_id_fk;

ALTER TABLE public.practice_record
DROP CONSTRAINT IF EXISTS practice_record_playlist_ref_playlist_playlist_id_fk;

ALTER TABLE public.practice_record
DROP CONSTRAINT IF EXISTS practice_record_tune_ref_tune_id_fk;

ALTER TABLE public.prefs_scheduling_options
DROP CONSTRAINT IF EXISTS prefs_scheduling_options_user_id_user_profile_id_fk;

ALTER TABLE public.prefs_spaced_repetition
DROP CONSTRAINT IF EXISTS prefs_spaced_repetition_user_id_user_profile_id_fk;

ALTER TABLE public.reference
DROP CONSTRAINT IF EXISTS reference_tune_ref_tune_id_fk;

ALTER TABLE public.reference
DROP CONSTRAINT IF EXISTS reference_user_ref_user_profile_id_fk;

ALTER TABLE public.tab_group_main_state
DROP CONSTRAINT IF EXISTS tab_group_main_state_playlist_fk;

ALTER TABLE public.tab_group_main_state
DROP CONSTRAINT IF EXISTS tab_group_main_state_user_id_user_profile_id_fk;

ALTER TABLE public.table_state
DROP CONSTRAINT IF EXISTS table_state_playlist_id_playlist_playlist_id_fk;

ALTER TABLE public.table_state
DROP CONSTRAINT IF EXISTS table_state_user_id_user_profile_id_fk;

ALTER TABLE public.table_transient_data
DROP CONSTRAINT IF EXISTS table_transient_data_playlist_id_playlist_playlist_id_fk;

ALTER TABLE public.table_transient_data
DROP CONSTRAINT IF EXISTS table_transient_data_tune_id_tune_id_fk;

ALTER TABLE public.table_transient_data
DROP CONSTRAINT IF EXISTS table_transient_data_user_id_user_profile_id_fk;

ALTER TABLE public.tag
DROP CONSTRAINT IF EXISTS tag_tune_ref_tune_id_fk;

ALTER TABLE public.tag
DROP CONSTRAINT IF EXISTS tag_user_ref_user_profile_id_fk;

ALTER TABLE public.tune
DROP CONSTRAINT IF EXISTS tune_genre_genre_id_fk;

ALTER TABLE public.tune
DROP CONSTRAINT IF EXISTS tune_private_for_user_profile_id_fk;

ALTER TABLE public.tune_override
DROP CONSTRAINT IF EXISTS tune_override_genre_genre_id_fk;

ALTER TABLE public.tune_override
DROP CONSTRAINT IF EXISTS tune_override_tune_ref_tune_id_fk;

ALTER TABLE public.tune_override
DROP CONSTRAINT IF EXISTS tune_override_user_ref_user_profile_id_fk;

-- Step 2: Drop old primary key constraints
ALTER TABLE public.daily_practice_queue
DROP CONSTRAINT IF EXISTS daily_practice_queue_pkey;

ALTER TABLE public.genre
DROP CONSTRAINT IF EXISTS genre_pkey;

ALTER TABLE public.genre_tune_type
DROP CONSTRAINT IF EXISTS genre_tune_type_genre_id_tune_type_id_pk;

ALTER TABLE public.instrument
DROP CONSTRAINT IF EXISTS instrument_pkey;

ALTER TABLE public.note
DROP CONSTRAINT IF EXISTS note_pkey;

ALTER TABLE public.playlist
DROP CONSTRAINT IF EXISTS playlist_pkey;

ALTER TABLE public.playlist_tune
DROP CONSTRAINT IF EXISTS playlist_tune_playlist_ref_tune_ref_pk;

ALTER TABLE public.practice_record
DROP CONSTRAINT IF EXISTS practice_record_pkey;

ALTER TABLE public.reference
DROP CONSTRAINT IF EXISTS reference_pkey;

ALTER TABLE public.tab_group_main_state
DROP CONSTRAINT IF EXISTS tab_group_main_state_pkey;

ALTER TABLE public.tag
DROP CONSTRAINT IF EXISTS tag_pkey;

ALTER TABLE public.tune
DROP CONSTRAINT IF EXISTS tune_pkey;

ALTER TABLE public.tune_override
DROP CONSTRAINT IF EXISTS tune_override_pkey;

ALTER TABLE public.tune_type
DROP CONSTRAINT IF EXISTS tune_type_pkey;

ALTER TABLE public.user_profile
DROP CONSTRAINT IF EXISTS user_profile_pkey;

-- Step 3: Drop old integer ID columns and FK columns
-- Note: user_profile keeps supabase_user_id as PK, drops id
ALTER TABLE public.user_profile
DROP COLUMN IF EXISTS id;

ALTER TABLE public.playlist
DROP COLUMN IF EXISTS playlist_id;

ALTER TABLE public.playlist
DROP COLUMN IF EXISTS user_ref;

ALTER TABLE public.playlist
DROP COLUMN IF EXISTS instrument_ref;

ALTER TABLE public.tune
DROP COLUMN IF EXISTS genre;

ALTER TABLE public.tune
DROP COLUMN IF EXISTS private_for;

-- Keep tune.id as id_foreign for provenance tracking (don't drop)
ALTER TABLE public.tune
RENAME COLUMN id TO id_foreign;

ALTER TABLE public.playlist_tune
DROP COLUMN IF EXISTS playlist_ref;

ALTER TABLE public.playlist_tune
DROP COLUMN IF EXISTS tune_ref;

ALTER TABLE public.practice_record
DROP COLUMN IF EXISTS id;

ALTER TABLE public.practice_record
DROP COLUMN IF EXISTS tune_ref;

ALTER TABLE public.practice_record
DROP COLUMN IF EXISTS playlist_ref;

ALTER TABLE public.daily_practice_queue
DROP COLUMN IF EXISTS id;

ALTER TABLE public.daily_practice_queue
DROP COLUMN IF EXISTS user_ref;

ALTER TABLE public.daily_practice_queue
DROP COLUMN IF EXISTS playlist_ref;

ALTER TABLE public.daily_practice_queue
DROP COLUMN IF EXISTS tune_ref;

ALTER TABLE public.note
DROP COLUMN IF EXISTS id;

ALTER TABLE public.note
DROP COLUMN IF EXISTS tune_ref;

ALTER TABLE public.note
DROP COLUMN IF EXISTS user_ref;

ALTER TABLE public.note
DROP COLUMN IF EXISTS playlist_ref;

ALTER TABLE public.reference
DROP COLUMN IF EXISTS id;

ALTER TABLE public.reference
DROP COLUMN IF EXISTS tune_ref;

ALTER TABLE public.reference
DROP COLUMN IF EXISTS user_ref;

ALTER TABLE public.tag
DROP COLUMN IF EXISTS tag_id;

ALTER TABLE public.tag
DROP COLUMN IF EXISTS tune_ref;

ALTER TABLE public.tag
DROP COLUMN IF EXISTS user_ref;

ALTER TABLE public.tune_override
DROP COLUMN IF EXISTS id;

ALTER TABLE public.tune_override
DROP COLUMN IF EXISTS tune_ref;

ALTER TABLE public.tune_override
DROP COLUMN IF EXISTS user_ref;

ALTER TABLE public.tune_override
DROP COLUMN IF EXISTS genre;

ALTER TABLE public.instrument
DROP COLUMN IF EXISTS id;

ALTER TABLE public.instrument
DROP COLUMN IF EXISTS private_to_user;

ALTER TABLE public.instrument
DROP COLUMN IF EXISTS genre_default;

ALTER TABLE public.tab_group_main_state
DROP COLUMN IF EXISTS id;

ALTER TABLE public.tab_group_main_state
DROP COLUMN IF EXISTS user_id;

ALTER TABLE public.tab_group_main_state
DROP COLUMN IF EXISTS playlist_id;

ALTER TABLE public.genre
DROP COLUMN IF EXISTS id;

ALTER TABLE public.tune_type
DROP COLUMN IF EXISTS id;

ALTER TABLE public.genre_tune_type
DROP COLUMN IF EXISTS genre_id;

ALTER TABLE public.genre_tune_type
DROP COLUMN IF EXISTS tune_type_id;

-- Drop sequences
DROP SEQUENCE IF EXISTS public.daily_practice_queue_id_seq;

DROP SEQUENCE IF EXISTS public.instrument_id_seq;

DROP SEQUENCE IF EXISTS public.note_id_seq;

DROP SEQUENCE IF EXISTS public.playlist_playlist_id_seq;

DROP SEQUENCE IF EXISTS public.tag_tag_id_seq;

DROP SEQUENCE IF EXISTS public.tune_id_seq;

DROP SEQUENCE IF EXISTS public.tune_override_id_seq;

DROP SEQUENCE IF EXISTS public.user_profile_id_seq;

-- Step 4: Rename UUID columns to remove _uuid suffix
-- Result: Clean column names (id, user_ref, playlist_ref, etc.)
-- Primary key columns
ALTER TABLE public.playlist
RENAME COLUMN id_uuid TO id;

ALTER TABLE public.tune
RENAME COLUMN id_uuid TO id;

ALTER TABLE public.practice_record
RENAME COLUMN id_uuid TO id;

ALTER TABLE public.daily_practice_queue
RENAME COLUMN id_uuid TO id;

ALTER TABLE public.note
RENAME COLUMN id_uuid TO id;

ALTER TABLE public.reference
RENAME COLUMN id_uuid TO id;

ALTER TABLE public.tag
RENAME COLUMN id_uuid TO id;

ALTER TABLE public.tune_override
RENAME COLUMN id_uuid TO id;

ALTER TABLE public.instrument
RENAME COLUMN id_uuid TO id;

ALTER TABLE public.tab_group_main_state
RENAME COLUMN id_uuid TO id;

ALTER TABLE public.genre
RENAME COLUMN id_uuid TO id;

ALTER TABLE public.tune_type
RENAME COLUMN id_uuid TO id;

-- Foreign key columns
ALTER TABLE public.playlist
RENAME COLUMN user_ref_uuid TO user_ref;

ALTER TABLE public.playlist_tune
RENAME COLUMN playlist_ref_uuid TO playlist_ref;

ALTER TABLE public.playlist_tune
RENAME COLUMN tune_ref_uuid TO tune_ref;

ALTER TABLE public.practice_record
RENAME COLUMN tune_ref_uuid TO tune_ref;

ALTER TABLE public.practice_record
RENAME COLUMN playlist_ref_uuid TO playlist_ref;

ALTER TABLE public.daily_practice_queue
RENAME COLUMN user_ref_uuid TO user_ref;

ALTER TABLE public.daily_practice_queue
RENAME COLUMN playlist_ref_uuid TO playlist_ref;

ALTER TABLE public.daily_practice_queue
RENAME COLUMN tune_ref_uuid TO tune_ref;

ALTER TABLE public.note
RENAME COLUMN tune_ref_uuid TO tune_ref;

ALTER TABLE public.note
RENAME COLUMN user_ref_uuid TO user_ref;

ALTER TABLE public.reference
RENAME COLUMN tune_ref_uuid TO tune_ref;

ALTER TABLE public.reference
RENAME COLUMN user_ref_uuid TO user_ref;

ALTER TABLE public.tag
RENAME COLUMN tune_ref_uuid TO tune_ref;

ALTER TABLE public.tag
RENAME COLUMN user_ref_uuid TO user_ref;

ALTER TABLE public.tune_override
RENAME COLUMN tune_ref_uuid TO tune_ref;

ALTER TABLE public.tune_override
RENAME COLUMN user_ref_uuid TO user_ref;

ALTER TABLE public.genre_tune_type
RENAME COLUMN genre_id_uuid TO genre_id;

ALTER TABLE public.genre_tune_type
RENAME COLUMN tune_type_id_uuid TO tune_type_id;

ALTER TABLE public.instrument
RENAME COLUMN private_to_user_uuid TO private_to_user;

-- Step 5: Add new UUID primary keys (with clean column names)
ALTER TABLE public.user_profile ADD PRIMARY KEY (supabase_user_id);

ALTER TABLE public.playlist ADD PRIMARY KEY (id);

ALTER TABLE public.tune ADD PRIMARY KEY (id);

ALTER TABLE public.practice_record ADD PRIMARY KEY (id);

ALTER TABLE public.daily_practice_queue ADD PRIMARY KEY (id);

ALTER TABLE public.note ADD PRIMARY KEY (id);

ALTER TABLE public.reference ADD PRIMARY KEY (id);

ALTER TABLE public.tag ADD PRIMARY KEY (id);

ALTER TABLE public.tune_override ADD PRIMARY KEY (id);

ALTER TABLE public.instrument ADD PRIMARY KEY (id);

ALTER TABLE public.tab_group_main_state ADD PRIMARY KEY (id);

ALTER TABLE public.genre ADD PRIMARY KEY (id);

ALTER TABLE public.tune_type ADD PRIMARY KEY (id);

-- Composite primary keys
ALTER TABLE public.playlist_tune ADD PRIMARY KEY (playlist_ref, tune_ref);

ALTER TABLE public.genre_tune_type ADD PRIMARY KEY (genre_id, tune_type_id);

-- Step 6: Add new UUID foreign key constraints (with clean column names)
ALTER TABLE public.playlist ADD CONSTRAINT playlist_user_ref_fkey FOREIGN KEY (user_ref) REFERENCES public.user_profile (supabase_user_id);

ALTER TABLE public.playlist_tune ADD CONSTRAINT playlist_tune_playlist_ref_fkey FOREIGN KEY (playlist_ref) REFERENCES public.playlist (id);

ALTER TABLE public.playlist_tune ADD CONSTRAINT playlist_tune_tune_ref_fkey FOREIGN KEY (tune_ref) REFERENCES public.tune (id);

ALTER TABLE public.practice_record ADD CONSTRAINT practice_record_tune_ref_fkey FOREIGN KEY (tune_ref) REFERENCES public.tune (id);

ALTER TABLE public.practice_record ADD CONSTRAINT practice_record_playlist_ref_fkey FOREIGN KEY (playlist_ref) REFERENCES public.playlist (id);

ALTER TABLE public.daily_practice_queue ADD CONSTRAINT daily_practice_queue_user_ref_fkey FOREIGN KEY (user_ref) REFERENCES public.user_profile (supabase_user_id);

ALTER TABLE public.daily_practice_queue ADD CONSTRAINT daily_practice_queue_playlist_ref_fkey FOREIGN KEY (playlist_ref) REFERENCES public.playlist (id);

ALTER TABLE public.daily_practice_queue ADD CONSTRAINT daily_practice_queue_tune_ref_fkey FOREIGN KEY (tune_ref) REFERENCES public.tune (id);

ALTER TABLE public.note ADD CONSTRAINT note_tune_ref_fkey FOREIGN KEY (tune_ref) REFERENCES public.tune (id);

ALTER TABLE public.note ADD CONSTRAINT note_user_ref_fkey FOREIGN KEY (user_ref) REFERENCES public.user_profile (supabase_user_id);

ALTER TABLE public.reference ADD CONSTRAINT reference_tune_ref_fkey FOREIGN KEY (tune_ref) REFERENCES public.tune (id);

ALTER TABLE public.reference ADD CONSTRAINT reference_user_ref_fkey FOREIGN KEY (user_ref) REFERENCES public.user_profile (supabase_user_id);

ALTER TABLE public.tag ADD CONSTRAINT tag_tune_ref_fkey FOREIGN KEY (tune_ref) REFERENCES public.tune (id);

ALTER TABLE public.tag ADD CONSTRAINT tag_user_ref_fkey FOREIGN KEY (user_ref) REFERENCES public.user_profile (supabase_user_id);

ALTER TABLE public.tune_override ADD CONSTRAINT tune_override_tune_ref_fkey FOREIGN KEY (tune_ref) REFERENCES public.tune (id);

ALTER TABLE public.tune_override ADD CONSTRAINT tune_override_user_ref_fkey FOREIGN KEY (user_ref) REFERENCES public.user_profile (supabase_user_id);

ALTER TABLE public.genre_tune_type ADD CONSTRAINT genre_tune_type_genre_id_fkey FOREIGN KEY (genre_id) REFERENCES public.genre (id);

ALTER TABLE public.genre_tune_type ADD CONSTRAINT genre_tune_type_tune_type_id_fkey FOREIGN KEY (tune_type_id) REFERENCES public.tune_type (id);

ALTER TABLE public.instrument ADD CONSTRAINT instrument_private_to_user_fkey FOREIGN KEY (private_to_user) REFERENCES public.user_profile (supabase_user_id);

-- Foreign keys from prefs tables (these reference user_profile.supabase_user_id now)
-- Note: These tables still use user_id column name, not user_ref
ALTER TABLE public.prefs_scheduling_options ADD CONSTRAINT prefs_scheduling_options_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profile (supabase_user_id);

ALTER TABLE public.prefs_spaced_repetition ADD CONSTRAINT prefs_spaced_repetition_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profile (supabase_user_id);

-- Foreign keys from state tables
ALTER TABLE public.tab_group_main_state ADD CONSTRAINT tab_group_main_state_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profile (supabase_user_id);

ALTER TABLE public.table_state ADD CONSTRAINT table_state_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profile (supabase_user_id);

ALTER TABLE public.table_transient_data ADD CONSTRAINT table_transient_data_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profile (supabase_user_id);

-- Step 7: Recreate indexes with UUID columns
CREATE INDEX idx_playlist_user_ref ON public.playlist (user_ref);

CREATE INDEX idx_playlist_tune_playlist_ref ON public.playlist_tune (playlist_ref);

CREATE INDEX idx_playlist_tune_tune_ref ON public.playlist_tune (tune_ref);

CREATE INDEX idx_practice_record_tune_ref ON public.practice_record (tune_ref);

CREATE INDEX idx_practice_record_playlist_ref ON public.practice_record (playlist_ref);

CREATE INDEX idx_daily_practice_queue_user_ref ON public.daily_practice_queue (user_ref);

CREATE INDEX idx_daily_practice_queue_playlist_ref ON public.daily_practice_queue (playlist_ref);

CREATE INDEX idx_daily_practice_queue_tune_ref ON public.daily_practice_queue (tune_ref);

CREATE INDEX idx_note_tune_ref ON public.note (tune_ref);

CREATE INDEX idx_note_user_ref ON public.note (user_ref);

CREATE INDEX idx_reference_tune_ref ON public.reference (tune_ref);

CREATE INDEX idx_reference_user_ref ON public.reference (user_ref);

CREATE INDEX idx_tag_user_ref ON public.tag (user_ref);

CREATE INDEX idx_tag_tune_ref ON public.tag (tune_ref);

-- Step 8: Add provenance tracking columns to tune table
-- Add primary_origin column to track source (irishtune.info, thesession.org, user_created, etc.)
ALTER TABLE public.tune
ADD COLUMN IF NOT EXISTS primary_origin text DEFAULT 'irishtune.info';

-- Create index on id_foreign for debugging/lookups (non-unique, allows duplicates)
CREATE INDEX IF NOT EXISTS idx_tune_id_foreign ON public.tune (id_foreign)
WHERE
    id_foreign IS NOT NULL;

-- ✅ MIGRATION COMPLETE
-- Final schema has clean column names:
--   - id (UUID, not id_uuid)
--   - user_ref (UUID, not user_ref_uuid)
--   - playlist_ref (UUID, not playlist_ref_uuid)
--   - etc.
-- All tables now use UUIDs for offline-safe record creation
-- Tune table includes provenance tracking (id_foreign, primary_origin)