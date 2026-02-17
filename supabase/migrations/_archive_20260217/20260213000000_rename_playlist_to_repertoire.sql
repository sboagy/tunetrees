-- Migration: rename playlist domain objects to repertoire
-- Goal: preserve all production data while renaming table/column identifiers.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.playlist') IS NOT NULL
     AND to_regclass('public.repertoire') IS NULL THEN
    ALTER TABLE public.playlist RENAME TO repertoire;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('public.playlist_tune') IS NOT NULL
     AND to_regclass('public.repertoire_tune') IS NULL THEN
    ALTER TABLE public.playlist_tune RENAME TO repertoire_tune;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'repertoire'
      AND column_name = 'playlist_id'
  ) THEN
    ALTER TABLE public.repertoire RENAME COLUMN playlist_id TO repertoire_id;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'daily_practice_queue'
      AND column_name = 'playlist_ref'
  ) THEN
    ALTER TABLE public.daily_practice_queue RENAME COLUMN playlist_ref TO repertoire_ref;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'note'
      AND column_name = 'playlist_ref'
  ) THEN
    ALTER TABLE public.note RENAME COLUMN playlist_ref TO repertoire_ref;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'practice_record'
      AND column_name = 'playlist_ref'
  ) THEN
    ALTER TABLE public.practice_record RENAME COLUMN playlist_ref TO repertoire_ref;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'repertoire_tune'
      AND column_name = 'playlist_ref'
  ) THEN
    ALTER TABLE public.repertoire_tune RENAME COLUMN playlist_ref TO repertoire_ref;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tab_group_main_state'
      AND column_name = 'playlist_id'
  ) THEN
    ALTER TABLE public.tab_group_main_state RENAME COLUMN playlist_id TO repertoire_id;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'table_state'
      AND column_name = 'playlist_id'
  ) THEN
    ALTER TABLE public.table_state RENAME COLUMN playlist_id TO repertoire_id;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'table_transient_data'
      AND column_name = 'playlist_id'
  ) THEN
    ALTER TABLE public.table_transient_data RENAME COLUMN playlist_id TO repertoire_id;
  END IF;
END
$$;

COMMIT;
