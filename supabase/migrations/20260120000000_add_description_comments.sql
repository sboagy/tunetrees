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

-- Practice list joined view descriptions
COMMENT ON VIEW public.practice_list_joined IS 'Denormalized view joining tunes with overrides, playlists, and latest practice records for UI grids.';

COMMENT ON COLUMN public.practice_list_joined.id IS 'Unique tune ID for this row.';
COMMENT ON COLUMN public.practice_list_joined.title IS 'Tune title (uses any user override).';
COMMENT ON COLUMN public.practice_list_joined.type IS 'Tune type classification (reel, jig, hornpipe, etc.).';
COMMENT ON COLUMN public.practice_list_joined.structure IS 'Tune structure shorthand (e.g. AABB).';
COMMENT ON COLUMN public.practice_list_joined.mode IS 'Musical mode of the tune.';
COMMENT ON COLUMN public.practice_list_joined.incipit IS 'Opening notes or incipit text for the tune.';
COMMENT ON COLUMN public.practice_list_joined.genre IS 'Genre classification for the tune.';
COMMENT ON COLUMN public.practice_list_joined.deleted IS 'Soft-delete flag for the tune.';
COMMENT ON COLUMN public.practice_list_joined.private_for IS 'User profile ID if the tune is private.';
COMMENT ON COLUMN public.practice_list_joined.learned IS 'Timestamp when the tune was marked learned in the playlist.';
COMMENT ON COLUMN public.practice_list_joined.goal IS 'Practice goal for this tune in the playlist.';
COMMENT ON COLUMN public.practice_list_joined.scheduled IS 'Manual schedule override for the next review.';
COMMENT ON COLUMN public.practice_list_joined.latest_state IS 'Latest scheduler state (new/learning/review/relearning).';
COMMENT ON COLUMN public.practice_list_joined.latest_practiced IS 'Most recent practice timestamp.';
COMMENT ON COLUMN public.practice_list_joined.latest_quality IS 'Most recent quality rating.';
COMMENT ON COLUMN public.practice_list_joined.latest_easiness IS 'Most recent easiness value.';
COMMENT ON COLUMN public.practice_list_joined.latest_difficulty IS 'Most recent difficulty value.';
COMMENT ON COLUMN public.practice_list_joined.latest_interval IS 'Most recent interval (days).';
COMMENT ON COLUMN public.practice_list_joined.latest_stability IS 'Most recent stability value.';
COMMENT ON COLUMN public.practice_list_joined.latest_step IS 'Most recent learning step.';
COMMENT ON COLUMN public.practice_list_joined.latest_repetitions IS 'Most recent repetitions count.';
COMMENT ON COLUMN public.practice_list_joined.latest_due IS 'Next due date after latest review.';
COMMENT ON COLUMN public.practice_list_joined.latest_goal IS 'Latest goal value from practice record.';
COMMENT ON COLUMN public.practice_list_joined.latest_technique IS 'Latest technique note from practice record.';
COMMENT ON COLUMN public.practice_list_joined.tags IS 'Tags applied to the tune (aggregated).';
COMMENT ON COLUMN public.practice_list_joined.playlist_ref IS 'Reference to the playlist (repertoire).';
COMMENT ON COLUMN public.practice_list_joined.user_ref IS 'User ID who owns the playlist.';
COMMENT ON COLUMN public.practice_list_joined.playlist_deleted IS 'Soft-delete flag for the playlist entry.';
COMMENT ON COLUMN public.practice_list_joined.notes IS 'User notes for the tune (aggregated).';
COMMENT ON COLUMN public.practice_list_joined.favorite_url IS 'Favorite reference URL for the tune.';
COMMENT ON COLUMN public.practice_list_joined.has_override IS 'Whether the tune has user-specific overrides.';

-- Tune override table column descriptions
COMMENT ON COLUMN public.tune_override.id IS 'Primary key for the override record.';
COMMENT ON COLUMN public.tune_override.tune_ref IS 'Reference to the tune being overridden.';
COMMENT ON COLUMN public.tune_override.user_ref IS 'User ID who owns this override.';
COMMENT ON COLUMN public.tune_override.title IS 'User-specific tune title override.';
COMMENT ON COLUMN public.tune_override.type IS 'User-specific tune type override.';
COMMENT ON COLUMN public.tune_override.structure IS 'User-specific tune structure override.';
COMMENT ON COLUMN public.tune_override.genre IS 'User-specific genre override.';
COMMENT ON COLUMN public.tune_override.mode IS 'User-specific mode override.';
COMMENT ON COLUMN public.tune_override.incipit IS 'User-specific incipit override.';
COMMENT ON COLUMN public.tune_override.deleted IS 'Soft-delete flag for the override.';
COMMENT ON COLUMN public.tune_override.sync_version IS 'Sync version for conflict resolution.';
COMMENT ON COLUMN public.tune_override.last_modified_at IS 'Timestamp of last modification.';
COMMENT ON COLUMN public.tune_override.device_id IS 'Device that last modified this record.';

-- Playlist table column descriptions
COMMENT ON COLUMN public.playlist.playlist_id IS 'Primary key for the playlist.';
COMMENT ON COLUMN public.playlist.user_ref IS 'User ID who owns this playlist.';
COMMENT ON COLUMN public.playlist.name IS 'Name of the playlist (repertoire).';
COMMENT ON COLUMN public.playlist.instrument_ref IS 'Reference to the instrument for this playlist.';
COMMENT ON COLUMN public.playlist.genre_default IS 'Default genre filter for this playlist.';
COMMENT ON COLUMN public.playlist.sr_alg_type IS 'Spaced repetition algorithm type (SM2/FSRS).';
COMMENT ON COLUMN public.playlist.deleted IS 'Soft-delete flag for the playlist.';
COMMENT ON COLUMN public.playlist.sync_version IS 'Sync version for conflict resolution.';
COMMENT ON COLUMN public.playlist.last_modified_at IS 'Timestamp of last modification.';
COMMENT ON COLUMN public.playlist.device_id IS 'Device that last modified this record.';

-- Playlist tune table column descriptions
COMMENT ON COLUMN public.playlist_tune.playlist_ref IS 'Reference to the playlist.';
COMMENT ON COLUMN public.playlist_tune.tune_ref IS 'Reference to the tune.';
COMMENT ON COLUMN public.playlist_tune.current IS 'Timestamp when added to current learnings.';
COMMENT ON COLUMN public.playlist_tune.learned IS 'Timestamp when marked as fully learned.';
COMMENT ON COLUMN public.playlist_tune.scheduled IS 'Manual schedule override for next review.';
COMMENT ON COLUMN public.playlist_tune.goal IS 'Practice goal (recall/sight_read/technique).';
COMMENT ON COLUMN public.playlist_tune.deleted IS 'Soft-delete flag for this playlist entry.';
COMMENT ON COLUMN public.playlist_tune.sync_version IS 'Sync version for conflict resolution.';
COMMENT ON COLUMN public.playlist_tune.last_modified_at IS 'Timestamp of last modification.';
COMMENT ON COLUMN public.playlist_tune.device_id IS 'Device that last modified this record.';

-- Practice record table column descriptions
COMMENT ON COLUMN public.practice_record.id IS 'Primary key for the practice record.';
COMMENT ON COLUMN public.practice_record.playlist_ref IS 'Reference to the playlist.';
COMMENT ON COLUMN public.practice_record.tune_ref IS 'Reference to the tune practiced.';
COMMENT ON COLUMN public.practice_record.practiced IS 'Timestamp when the tune was practiced.';
COMMENT ON COLUMN public.practice_record.quality IS 'Quality rating (0-5) for this practice session.';
COMMENT ON COLUMN public.practice_record.easiness IS 'Easiness factor (SM2) or retention value (FSRS).';
COMMENT ON COLUMN public.practice_record.difficulty IS 'Difficulty rating for FSRS scheduling.';
COMMENT ON COLUMN public.practice_record.stability IS 'Memory stability value from spaced repetition algorithm.';
COMMENT ON COLUMN public.practice_record.interval IS 'Days until next review (interval).';
COMMENT ON COLUMN public.practice_record.step IS 'Current learning step.';
COMMENT ON COLUMN public.practice_record.repetitions IS 'Total number of repetitions completed.';
COMMENT ON COLUMN public.practice_record.lapses IS 'Number of times forgotten (lapses).';
COMMENT ON COLUMN public.practice_record.elapsed_days IS 'Days since previous review.';
COMMENT ON COLUMN public.practice_record.state IS 'Scheduler state (0=new, 1=learning, 2=review, 3=relearning).';
COMMENT ON COLUMN public.practice_record.due IS 'Due date for next review.';
COMMENT ON COLUMN public.practice_record.backup_practiced IS 'Backup timestamp (pre-update stored value).';
COMMENT ON COLUMN public.practice_record.goal IS 'Practice goal for this record.';
COMMENT ON COLUMN public.practice_record.technique IS 'Technique note for this practice session.';
COMMENT ON COLUMN public.practice_record.sync_version IS 'Sync version for conflict resolution.';
COMMENT ON COLUMN public.practice_record.last_modified_at IS 'Timestamp of last modification.';
COMMENT ON COLUMN public.practice_record.device_id IS 'Device that last modified this record.';

-- Daily practice queue table column descriptions
COMMENT ON COLUMN public.daily_practice_queue.id IS 'Primary key for the queue entry.';
COMMENT ON COLUMN public.daily_practice_queue.user_ref IS 'User ID who owns this queue entry.';
COMMENT ON COLUMN public.daily_practice_queue.playlist_ref IS 'Reference to the playlist.';
COMMENT ON COLUMN public.daily_practice_queue.mode IS 'Practice mode (e.g., flashcard, listening).';
COMMENT ON COLUMN public.daily_practice_queue.queue_date IS 'Date this queue was generated for.';
COMMENT ON COLUMN public.daily_practice_queue.window_start_utc IS 'Start of practice window (UTC).';
COMMENT ON COLUMN public.daily_practice_queue.window_end_utc IS 'End of practice window (UTC).';
COMMENT ON COLUMN public.daily_practice_queue.tune_ref IS 'Reference to the tune in queue.';
COMMENT ON COLUMN public.daily_practice_queue.bucket IS 'Priority bucket (lower = higher priority).';
COMMENT ON COLUMN public.daily_practice_queue.order_index IS 'Order within the bucket.';
COMMENT ON COLUMN public.daily_practice_queue.snapshot_coalesced_ts IS 'Timestamp when queue was coalesced.';
COMMENT ON COLUMN public.daily_practice_queue.scheduled_snapshot IS 'Snapshot of scheduled time.';
COMMENT ON COLUMN public.daily_practice_queue.latest_due_snapshot IS 'Snapshot of latest due date.';
COMMENT ON COLUMN public.daily_practice_queue.acceptable_delinquency_window_snapshot IS 'Snapshot of delinquency window.';
COMMENT ON COLUMN public.daily_practice_queue.tz_offset_minutes_snapshot IS 'Snapshot of user timezone offset.';
COMMENT ON COLUMN public.daily_practice_queue.generated_at IS 'Timestamp when queue entry was generated.';
COMMENT ON COLUMN public.daily_practice_queue.completed_at IS 'Timestamp when queue entry was completed.';
COMMENT ON COLUMN public.daily_practice_queue.exposures_required IS 'Number of exposures required for this queue item.';
COMMENT ON COLUMN public.daily_practice_queue.exposures_completed IS 'Number of exposures completed so far.';
COMMENT ON COLUMN public.daily_practice_queue.outcome IS 'Outcome of the queue entry (pass/fail/skip).';
COMMENT ON COLUMN public.daily_practice_queue.active IS 'Whether this queue entry is still active.';
COMMENT ON COLUMN public.daily_practice_queue.sync_version IS 'Sync version for conflict resolution.';
COMMENT ON COLUMN public.daily_practice_queue.last_modified_at IS 'Timestamp of last modification.';
COMMENT ON COLUMN public.daily_practice_queue.device_id IS 'Device that last modified this record.';

-- Table transient data column descriptions
COMMENT ON COLUMN public.table_transient_data.user_id IS 'User ID who owns this transient data.';
COMMENT ON COLUMN public.table_transient_data.tune_id IS 'Reference to the tune.';
COMMENT ON COLUMN public.table_transient_data.playlist_id IS 'Reference to the playlist.';
COMMENT ON COLUMN public.table_transient_data.purpose IS 'Purpose/context of this staged data.';
COMMENT ON COLUMN public.table_transient_data.note_private IS 'Private practice note (not synced to others).';
COMMENT ON COLUMN public.table_transient_data.note_public IS 'Public practice note (shared).';
COMMENT ON COLUMN public.table_transient_data.recall_eval IS 'Recall evaluation selection.';
COMMENT ON COLUMN public.table_transient_data.practiced IS 'Timestamp when practiced (staged).';
COMMENT ON COLUMN public.table_transient_data.quality IS 'Quality rating (staged).';
COMMENT ON COLUMN public.table_transient_data.easiness IS 'Easiness factor (staged).';
COMMENT ON COLUMN public.table_transient_data.difficulty IS 'Difficulty rating (staged).';
COMMENT ON COLUMN public.table_transient_data.interval IS 'Interval (staged).';
COMMENT ON COLUMN public.table_transient_data.step IS 'Learning step (staged).';
COMMENT ON COLUMN public.table_transient_data.repetitions IS 'Repetitions count (staged).';
COMMENT ON COLUMN public.table_transient_data.due IS 'Next due date (staged).';
COMMENT ON COLUMN public.table_transient_data.backup_practiced IS 'Backup practiced timestamp.';
COMMENT ON COLUMN public.table_transient_data.goal IS 'Practice goal (staged).';
COMMENT ON COLUMN public.table_transient_data.technique IS 'Technique note (staged).';
COMMENT ON COLUMN public.table_transient_data.stability IS 'Memory stability (staged).';
COMMENT ON COLUMN public.table_transient_data.state IS 'Scheduler state (staged).';
COMMENT ON COLUMN public.table_transient_data.sync_version IS 'Sync version for conflict resolution.';
COMMENT ON COLUMN public.table_transient_data.last_modified_at IS 'Timestamp of last modification.';
COMMENT ON COLUMN public.table_transient_data.device_id IS 'Device that last modified this record.';

-- Genre table column descriptions
COMMENT ON COLUMN public.genre.id IS 'Primary key (genre identifier).';
COMMENT ON COLUMN public.genre.name IS 'Genre name.';
COMMENT ON COLUMN public.genre.region IS 'Geographic region associated with the genre.';
COMMENT ON COLUMN public.genre.description IS 'Description of the genre.';

-- Tune type table column descriptions
COMMENT ON COLUMN public.tune_type.id IS 'Primary key (tune type identifier).';
COMMENT ON COLUMN public.tune_type.name IS 'Tune type name (reel, jig, hornpipe, etc.).';
COMMENT ON COLUMN public.tune_type.rhythm IS 'Rhythmic pattern of the tune type.';
COMMENT ON COLUMN public.tune_type.description IS 'Description of the tune type.';

-- Genre tune type table column descriptions
COMMENT ON COLUMN public.genre_tune_type.genre_id IS 'Reference to the genre.';
COMMENT ON COLUMN public.genre_tune_type.tune_type_id IS 'Reference to the tune type.';

-- Instrument table column descriptions
COMMENT ON COLUMN public.instrument.id IS 'Primary key for the instrument.';
COMMENT ON COLUMN public.instrument.private_to_user IS 'User ID if this is a private instrument (null = public).';
COMMENT ON COLUMN public.instrument.instrument IS 'Instrument name.';
COMMENT ON COLUMN public.instrument.description IS 'Description of the instrument.';
COMMENT ON COLUMN public.instrument.genre_default IS 'Default genre associated with this instrument.';
COMMENT ON COLUMN public.instrument.deleted IS 'Soft-delete flag for the instrument.';
COMMENT ON COLUMN public.instrument.sync_version IS 'Sync version for conflict resolution.';
COMMENT ON COLUMN public.instrument.last_modified_at IS 'Timestamp of last modification.';
COMMENT ON COLUMN public.instrument.device_id IS 'Device that last modified this record.';

-- Note table column descriptions
COMMENT ON COLUMN public.note.id IS 'Primary key for the note.';
COMMENT ON COLUMN public.note.user_ref IS 'User ID who created this note.';
COMMENT ON COLUMN public.note.tune_ref IS 'Reference to the tune.';
COMMENT ON COLUMN public.note.playlist_ref IS 'Reference to the playlist (optional).';
COMMENT ON COLUMN public.note.created_date IS 'Timestamp when the note was created.';
COMMENT ON COLUMN public.note.note_text IS 'Text content of the note.';
COMMENT ON COLUMN public.note.public IS 'Whether the note is public (true) or private (false).';
COMMENT ON COLUMN public.note.favorite IS 'Whether this is marked as a favorite note.';
COMMENT ON COLUMN public.note.deleted IS 'Soft-delete flag for the note.';
COMMENT ON COLUMN public.note.sync_version IS 'Sync version for conflict resolution.';
COMMENT ON COLUMN public.note.last_modified_at IS 'Timestamp of last modification.';
COMMENT ON COLUMN public.note.device_id IS 'Device that last modified this record.';

-- Reference table column descriptions
COMMENT ON COLUMN public.reference.id IS 'Primary key for the reference.';
COMMENT ON COLUMN public.reference.url IS 'URL of the reference.';
COMMENT ON COLUMN public.reference.ref_type IS 'Type of reference (website/audio/video).';
COMMENT ON COLUMN public.reference.tune_ref IS 'Reference to the tune.';
COMMENT ON COLUMN public.reference.user_ref IS 'User ID who created this reference.';
COMMENT ON COLUMN public.reference.comment IS 'Optional comment about the reference.';
COMMENT ON COLUMN public.reference.title IS 'Title/label for the reference.';
COMMENT ON COLUMN public.reference.public IS 'Whether the reference is public.';
COMMENT ON COLUMN public.reference.favorite IS 'Whether this is marked as a favorite reference.';
COMMENT ON COLUMN public.reference.deleted IS 'Soft-delete flag for the reference.';
COMMENT ON COLUMN public.reference.sync_version IS 'Sync version for conflict resolution.';
COMMENT ON COLUMN public.reference.last_modified_at IS 'Timestamp of last modification.';
COMMENT ON COLUMN public.reference.device_id IS 'Device that last modified this record.';

-- Tag table column descriptions
COMMENT ON COLUMN public.tag.tag_id IS 'Primary key for the tag.';
COMMENT ON COLUMN public.tag.user_ref IS 'User ID who owns this tag.';
COMMENT ON COLUMN public.tag.tune_ref IS 'Reference to the tune.';
COMMENT ON COLUMN public.tag.tag_text IS 'Text content of the tag.';
COMMENT ON COLUMN public.tag.sync_version IS 'Sync version for conflict resolution.';
COMMENT ON COLUMN public.tag.last_modified_at IS 'Timestamp of last modification.';
COMMENT ON COLUMN public.tag.device_id IS 'Device that last modified this record.';

-- Prefs scheduling options table column descriptions
COMMENT ON COLUMN public.prefs_scheduling_options.user_id IS 'User ID who owns these preferences.';
COMMENT ON COLUMN public.prefs_scheduling_options.acceptable_delinquency_window IS 'Days allowed before tune is considered delinquent.';
COMMENT ON COLUMN public.prefs_scheduling_options.min_reviews_per_day IS 'Minimum reviews per day target.';
COMMENT ON COLUMN public.prefs_scheduling_options.max_reviews_per_day IS 'Maximum reviews per day cap.';
COMMENT ON COLUMN public.prefs_scheduling_options.days_per_week IS 'Number of days per week to practice.';
COMMENT ON COLUMN public.prefs_scheduling_options.weekly_rules IS 'Weekly scheduling rules (JSON format).';
COMMENT ON COLUMN public.prefs_scheduling_options.exceptions IS 'Schedule exceptions/off-days (JSON format).';
COMMENT ON COLUMN public.prefs_scheduling_options.sync_version IS 'Sync version for conflict resolution.';
COMMENT ON COLUMN public.prefs_scheduling_options.last_modified_at IS 'Timestamp of last modification.';
COMMENT ON COLUMN public.prefs_scheduling_options.device_id IS 'Device that last modified this record.';

-- Prefs spaced repetition table column descriptions
COMMENT ON COLUMN public.prefs_spaced_repetition.user_id IS 'User ID who owns these preferences.';
COMMENT ON COLUMN public.prefs_spaced_repetition.alg_type IS 'Algorithm type (SM2 or FSRS).';
COMMENT ON COLUMN public.prefs_spaced_repetition.fsrs_weights IS 'FSRS algorithm weights (JSON format).';
COMMENT ON COLUMN public.prefs_spaced_repetition.request_retention IS 'Target retention rate (FSRS).';
COMMENT ON COLUMN public.prefs_spaced_repetition.maximum_interval IS 'Maximum interval in days.';
COMMENT ON COLUMN public.prefs_spaced_repetition.learning_steps IS 'Learning steps configuration (JSON format).';
COMMENT ON COLUMN public.prefs_spaced_repetition.relearning_steps IS 'Relearning steps configuration (JSON format).';
COMMENT ON COLUMN public.prefs_spaced_repetition.enable_fuzzing IS 'Whether to enable interval fuzzing.';
COMMENT ON COLUMN public.prefs_spaced_repetition.sync_version IS 'Sync version for conflict resolution.';
COMMENT ON COLUMN public.prefs_spaced_repetition.last_modified_at IS 'Timestamp of last modification.';
COMMENT ON COLUMN public.prefs_spaced_repetition.device_id IS 'Device that last modified this record.';

-- Tab group main state table column descriptions
COMMENT ON COLUMN public.tab_group_main_state.id IS 'Primary key for this state record.';
COMMENT ON COLUMN public.tab_group_main_state.user_id IS 'User ID who owns this state.';
COMMENT ON COLUMN public.tab_group_main_state.which_tab IS 'Currently selected main tab (practice/repertoire/catalog/analysis).';
COMMENT ON COLUMN public.tab_group_main_state.playlist_id IS 'Currently selected playlist.';
COMMENT ON COLUMN public.tab_group_main_state.tab_spec IS 'Additional tab specification.';
COMMENT ON COLUMN public.tab_group_main_state.practice_show_submitted IS 'Whether to show submitted items in practice view.';
COMMENT ON COLUMN public.tab_group_main_state.practice_mode_flashcard IS 'Whether practice mode is flashcard (1) or list (0).';
COMMENT ON COLUMN public.tab_group_main_state.sidebar_dock_position IS 'Sidebar position (left/right/hidden).';
COMMENT ON COLUMN public.tab_group_main_state.sync_version IS 'Sync version for conflict resolution.';
COMMENT ON COLUMN public.tab_group_main_state.last_modified_at IS 'Timestamp of last modification.';
COMMENT ON COLUMN public.tab_group_main_state.device_id IS 'Device that last modified this record.';

-- Table state table column descriptions
COMMENT ON COLUMN public.table_state.user_id IS 'User ID who owns this table state.';
COMMENT ON COLUMN public.table_state.screen_size IS 'Screen size category (small/full).';
COMMENT ON COLUMN public.table_state.purpose IS 'Purpose/view this state applies to (practice/repertoire/catalog/analysis).';
COMMENT ON COLUMN public.table_state.playlist_id IS 'Reference to the playlist.';
COMMENT ON COLUMN public.table_state.settings IS 'Table settings (column order, sorting, filters) in JSON format.';
COMMENT ON COLUMN public.table_state.current_tune IS 'Currently selected tune ID.';
COMMENT ON COLUMN public.table_state.sync_version IS 'Sync version for conflict resolution.';
COMMENT ON COLUMN public.table_state.last_modified_at IS 'Timestamp of last modification.';
COMMENT ON COLUMN public.table_state.device_id IS 'Device that last modified this record.';

-- User profile table column descriptions
COMMENT ON COLUMN public.user_profile.id IS 'Primary key for the user profile.';
COMMENT ON COLUMN public.user_profile.supabase_user_id IS 'Reference to Supabase auth user ID.';
COMMENT ON COLUMN public.user_profile.name IS 'User display name.';
COMMENT ON COLUMN public.user_profile.email IS 'User email address.';
COMMENT ON COLUMN public.user_profile.sr_alg_type IS 'Preferred spaced repetition algorithm (SM2/FSRS).';
COMMENT ON COLUMN public.user_profile.phone IS 'User phone number.';
COMMENT ON COLUMN public.user_profile.phone_verified IS 'Timestamp when phone was verified.';
COMMENT ON COLUMN public.user_profile.acceptable_delinquency_window IS 'User default delinquency window in days.';
COMMENT ON COLUMN public.user_profile.avatar_url IS 'URL to user avatar/profile picture.';
COMMENT ON COLUMN public.user_profile.deleted IS 'Soft-delete flag for the user profile.';
COMMENT ON COLUMN public.user_profile.sync_version IS 'Sync version for conflict resolution.';
COMMENT ON COLUMN public.user_profile.last_modified_at IS 'Timestamp of last modification.';
COMMENT ON COLUMN public.user_profile.device_id IS 'Device that last modified this record.';
