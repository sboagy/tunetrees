-- Migration: Add Hybrid Genre Support (Trad/Pop/Classical)
-- Date: 2025-12-16
-- Issue: #246
--
-- This migration adds support for different music genres:
-- 1. composer (text) - For Classical/Choral ("The Creator")
-- 2. artist (text) - For Pop/Rock/Jazz ("The Performer")
-- 3. id_foreign type change (int4 → text) - For Spotify/YouTube IDs
-- 4. release_year (int4) - For decade-based filtering

-- PART 1: Add new columns to tune table
ALTER TABLE public.tune 
  ADD COLUMN IF NOT EXISTS composer text NULL,
  ADD COLUMN IF NOT EXISTS artist text NULL,
  ADD COLUMN IF NOT EXISTS release_year int4 NULL;

-- PART 2: Ensure id_foreign is text (convert in-place when needed)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tune'
      AND column_name = 'id_foreign'
  ) THEN
    IF (
      SELECT data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'tune'
        AND column_name = 'id_foreign'
    ) <> 'text' THEN
      EXECUTE 'ALTER TABLE public.tune ALTER COLUMN id_foreign TYPE text USING id_foreign::text';
    END IF;
  ELSE
    EXECUTE 'ALTER TABLE public.tune ADD COLUMN id_foreign text NULL';
  END IF;
END $$;

-- PART 3: Add same columns to tune_override table
ALTER TABLE public.tune_override 
  ADD COLUMN IF NOT EXISTS composer text NULL,
  ADD COLUMN IF NOT EXISTS artist text NULL,
  ADD COLUMN IF NOT EXISTS release_year int4 NULL;

-- Ensure tune_override.id_foreign is text (convert in-place when needed)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tune_override'
      AND column_name = 'id_foreign'
  ) THEN
    IF (
      SELECT data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'tune_override'
        AND column_name = 'id_foreign'
    ) <> 'text' THEN
      EXECUTE 'ALTER TABLE public.tune_override ALTER COLUMN id_foreign TYPE text USING id_foreign::text';
    END IF;
  ELSE
    EXECUTE 'ALTER TABLE public.tune_override ADD COLUMN id_foreign text NULL';
  END IF;
END $$;

-- PART 3b: Refresh views that surface tune + override fields
CREATE OR REPLACE VIEW public.practice_list_staged
AS SELECT tune.id,
    COALESCE(tune_override.title, tune.title) AS title,
    COALESCE(tune_override.type, tune.type) AS type,
    COALESCE(tune_override.structure, tune.structure) AS structure,
    COALESCE(tune_override.mode, tune.mode) AS mode,
    COALESCE(tune_override.incipit, tune.incipit) AS incipit,
    COALESCE(tune_override.genre, tune.genre) AS genre,
    tune.private_for,
    tune.deleted,
    playlist_tune.learned,
    COALESCE(td.goal, COALESCE(pr.goal, 'recall'::text)) AS goal,
    playlist_tune.scheduled,
    playlist.user_ref,
    playlist.playlist_id,
    instrument.instrument,
    playlist_tune.deleted AS playlist_deleted,
    COALESCE(td.state, pr.state) AS latest_state,
    COALESCE(td.practiced, pr.practiced) AS latest_practiced,
    COALESCE(td.quality, pr.quality) AS latest_quality,
    COALESCE(td.easiness, pr.easiness) AS latest_easiness,
    COALESCE(td.difficulty, pr.difficulty) AS latest_difficulty,
    COALESCE(td.stability, pr.stability) AS latest_stability,
    COALESCE(td."interval", pr."interval") AS latest_interval,
    COALESCE(td.step, pr.step) AS latest_step,
    COALESCE(td.repetitions, pr.repetitions) AS latest_repetitions,
    COALESCE(td.due, pr.due) AS latest_due,
    COALESCE(td.backup_practiced, pr.backup_practiced) AS latest_backup_practiced,
    COALESCE(td.goal, pr.goal) AS latest_goal,
    COALESCE(td.technique, pr.technique) AS latest_technique,
    ( SELECT string_agg(tag_1.tag_text, ' '::text) AS string_agg
           FROM tag tag_1
          WHERE tag_1.tune_ref = tune.id AND tag_1.user_ref = playlist.user_ref) AS tags,
    td.purpose,
    td.note_private,
    td.note_public,
    td.recall_eval,
    ( SELECT string_agg(note.note_text, ' '::text) AS string_agg
           FROM note
          WHERE note.tune_ref = tune.id AND note.user_ref = playlist.user_ref) AS notes,
    ( SELECT ref.url
           FROM reference ref
          WHERE ref.tune_ref = tune.id AND ref.user_ref = playlist.user_ref AND ref.favorite = true
         LIMIT 1) AS favorite_url,
        CASE
            WHEN tune_override.user_ref = playlist.user_ref THEN 1
            ELSE 0
        END AS has_override,
        CASE
            WHEN td.practiced IS NOT NULL OR td.quality IS NOT NULL OR td.easiness IS NOT NULL OR td.difficulty IS NOT NULL OR td."interval" IS NOT NULL OR td.step IS NOT NULL OR td.repetitions IS NOT NULL OR td.due IS NOT NULL OR td.backup_practiced IS NOT NULL OR td.goal IS NOT NULL OR td.technique IS NOT NULL OR td.stability IS NOT NULL THEN 1
            ELSE 0
        END AS has_staged,
      COALESCE(tune_override.composer, tune.composer) AS composer,
      COALESCE(tune_override.artist, tune.artist) AS artist,
      COALESCE(tune_override.id_foreign, tune.id_foreign) AS id_foreign,
      COALESCE(tune_override.release_year, tune.release_year) AS release_year
   FROM tune
     LEFT JOIN playlist_tune ON playlist_tune.tune_ref = tune.id
     LEFT JOIN playlist ON playlist.playlist_id = playlist_tune.playlist_ref
     LEFT JOIN tune_override ON tune_override.tune_ref = tune.id
     LEFT JOIN instrument ON instrument.id = playlist.instrument_ref
     LEFT JOIN ( SELECT DISTINCT ON (pr_1.tune_ref, pr_1.playlist_ref) pr_1.id,
            pr_1.playlist_ref,
            pr_1.tune_ref,
            pr_1.practiced,
            pr_1.quality,
            pr_1.easiness,
            pr_1.difficulty,
            pr_1.stability,
            pr_1."interval",
            pr_1.step,
            pr_1.repetitions,
            pr_1.lapses,
            pr_1.elapsed_days,
            pr_1.state,
            pr_1.due,
            pr_1.backup_practiced,
            pr_1.goal,
            pr_1.technique,
            pr_1.sync_version,
            pr_1.last_modified_at,
            pr_1.device_id
           FROM practice_record pr_1
          ORDER BY pr_1.tune_ref, pr_1.playlist_ref, pr_1.id DESC) pr ON pr.tune_ref = tune.id AND pr.playlist_ref = playlist_tune.playlist_ref
     LEFT JOIN tag ON tag.tune_ref = tune.id
     LEFT JOIN table_transient_data td ON td.tune_id = tune.id AND td.playlist_id = playlist_tune.playlist_ref
  WHERE tune_override.user_ref IS NULL OR tune_override.user_ref = playlist.user_ref;

-- PART 4: Update RLS policies (if any exist for these columns)
-- Currently no specific RLS policies needed for these metadata fields

-- PART 5: Create indexes for common query patterns (optional, for performance)
-- These can be added later based on query patterns:
-- CREATE INDEX IF NOT EXISTS idx_tune_composer ON public.tune(composer) WHERE composer IS NOT NULL;
-- CREATE INDEX IF NOT EXISTS idx_tune_artist ON public.tune(artist) WHERE artist IS NOT NULL;
-- CREATE INDEX IF NOT EXISTS idx_tune_release_year ON public.tune(release_year) WHERE release_year IS NOT NULL;

-- Verification queries (uncomment to run):
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'tune' AND column_name IN ('composer', 'artist', 'release_year', 'id_foreign');
-- 
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'tune_override' AND column_name IN ('composer', 'artist', 'release_year', 'id_foreign');
