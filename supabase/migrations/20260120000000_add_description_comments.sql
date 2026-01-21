-- Migration: Add table/view/column description comments
-- Date: 2026-01-20

-- Table descriptions
COMMENT ON TABLE public.tune IS 'Master catalog of tunes, including metadata like type, mode, and genre.';
COMMENT ON TABLE public.tune_override IS 'User-specific overrides for tune metadata in the repertoire.';
COMMENT ON TABLE public.playlist IS 'User playlists (repertoires) for organizing tunes.';
COMMENT ON TABLE public.playlist_tune IS 'Join table linking tunes to playlists with per-playlist status and goals.';
COMMENT ON TABLE public.practice_record IS 'Historical practice records for tunes, used for scheduling.';
COMMENT ON TABLE public.daily_practice_queue IS 'Generated practice queue snapshot for a user and playlist.';
COMMENT ON TABLE public.table_transient_data IS 'Staged practice data awaiting submission to practice_record.';
COMMENT ON TABLE public.genre IS 'Reference list of tune genres.';
COMMENT ON TABLE public.tune_type IS 'Reference list of tune types (reel, jig, etc.).';
COMMENT ON TABLE public.genre_tune_type IS 'Many-to-many association between tune genres and tune types.';
COMMENT ON TABLE public.instrument IS 'Instrument catalog for playlists, including per-user private instruments.';
COMMENT ON TABLE public.note IS 'User notes attached to tunes.';
COMMENT ON TABLE public.reference IS 'User references (links) attached to tunes.';
COMMENT ON TABLE public.tag IS 'User tags attached to tunes.';
COMMENT ON TABLE public.prefs_scheduling_options IS 'User scheduling preferences for practice queue generation.';
COMMENT ON TABLE public.prefs_spaced_repetition IS 'User spaced repetition configuration (FSRS/SM-2).';
COMMENT ON TABLE public.user_profile IS 'User profile data synced from Supabase auth.';
COMMENT ON TABLE public.tab_group_main_state IS 'Persisted UI state for main tab selections.';
COMMENT ON TABLE public.table_state IS 'Persisted UI table state (columns, sorting, selection).';

-- Tune column descriptions
COMMENT ON COLUMN public.tune.id IS 'Primary key for the tune.';
COMMENT ON COLUMN public.tune.title IS 'Tune title as displayed in the UI.';
COMMENT ON COLUMN public.tune.type IS 'Tune type classification (reel, jig, etc.) used in filtering.';
COMMENT ON COLUMN public.tune.structure IS 'Tune structure shorthand (e.g. AABB).';
COMMENT ON COLUMN public.tune.mode IS 'Musical mode of the tune.';
COMMENT ON COLUMN public.tune.incipit IS 'Opening notes or incipit text.';
COMMENT ON COLUMN public.tune.genre IS 'Genre identifier assigned to the tune.';
COMMENT ON COLUMN public.tune.composer IS 'Composer name for classical/choral tunes.';
COMMENT ON COLUMN public.tune.artist IS 'Artist name for pop/rock/jazz tunes.';
COMMENT ON COLUMN public.tune.id_foreign IS 'External tune identifier (e.g. irishtune.info, Spotify).';
COMMENT ON COLUMN public.tune.release_year IS 'Release year for the recording or tune.';
COMMENT ON COLUMN public.tune.private_for IS 'User profile ID if the tune is private.';
COMMENT ON COLUMN public.tune.deleted IS 'Soft-delete flag for the tune.';

-- Practice list staged view descriptions
COMMENT ON VIEW public.practice_list_staged IS 'View of playlist tunes enriched with overrides, practice history, and staged data for UI grids.';

COMMENT ON COLUMN public.practice_list_staged.id IS 'Unique tune ID for this row.';
COMMENT ON COLUMN public.practice_list_staged.title IS 'Tune title (uses any user override).';
COMMENT ON COLUMN public.practice_list_staged.type IS 'Tune type classification (reel, jig, hornpipe, etc.).';
COMMENT ON COLUMN public.practice_list_staged.structure IS 'Tune structure shorthand (e.g. AABB).';
COMMENT ON COLUMN public.practice_list_staged.mode IS 'Musical mode of the tune.';
COMMENT ON COLUMN public.practice_list_staged.incipit IS 'Opening notes or incipit text for the tune.';
COMMENT ON COLUMN public.practice_list_staged.genre IS 'Genre classification for the tune.';
COMMENT ON COLUMN public.practice_list_staged.learned IS 'Timestamp when the tune was marked learned.';
COMMENT ON COLUMN public.practice_list_staged.goal IS 'Practice goal for this tune in the playlist.';
COMMENT ON COLUMN public.practice_list_staged.scheduled IS 'Manual schedule override for the next review.';
COMMENT ON COLUMN public.practice_list_staged.instrument IS 'Instrument name for the playlist.';
COMMENT ON COLUMN public.practice_list_staged.latest_state IS 'Latest scheduler state (new/learning/review/relearning).';
COMMENT ON COLUMN public.practice_list_staged.latest_practiced IS 'Most recent practice timestamp.';
COMMENT ON COLUMN public.practice_list_staged.latest_quality IS 'Most recent quality rating.';
COMMENT ON COLUMN public.practice_list_staged.latest_easiness IS 'Most recent easiness value.';
COMMENT ON COLUMN public.practice_list_staged.latest_difficulty IS 'Most recent difficulty value.';
COMMENT ON COLUMN public.practice_list_staged.latest_stability IS 'Most recent stability value.';
COMMENT ON COLUMN public.practice_list_staged.latest_interval IS 'Most recent interval (days).';
COMMENT ON COLUMN public.practice_list_staged.latest_step IS 'Most recent learning step.';
COMMENT ON COLUMN public.practice_list_staged.latest_repetitions IS 'Most recent repetitions count.';
COMMENT ON COLUMN public.practice_list_staged.latest_due IS 'Next due date after latest review.';
COMMENT ON COLUMN public.practice_list_staged.tags IS 'Tags applied to the tune.';
COMMENT ON COLUMN public.practice_list_staged.note_private IS 'Private practice note for this tune.';
COMMENT ON COLUMN public.practice_list_staged.note_public IS 'Public practice note for this tune.';
COMMENT ON COLUMN public.practice_list_staged.recall_eval IS 'Latest recall evaluation selection.';
COMMENT ON COLUMN public.practice_list_staged.favorite_url IS 'Favorite reference URL for the tune.';
COMMENT ON COLUMN public.practice_list_staged.has_override IS 'Whether the tune has user-specific overrides.';
COMMENT ON COLUMN public.practice_list_staged.has_staged IS 'Whether staged changes are present for this tune.';
COMMENT ON COLUMN public.practice_list_staged.composer IS 'Composer name (classical/choral).';
COMMENT ON COLUMN public.practice_list_staged.artist IS 'Artist name (pop/rock/jazz).';
COMMENT ON COLUMN public.practice_list_staged.id_foreign IS 'External tune identifier (e.g. irishtune.info, Spotify).';
COMMENT ON COLUMN public.practice_list_staged.release_year IS 'Release year for the recording or tune.';
