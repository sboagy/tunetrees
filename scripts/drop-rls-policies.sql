-- Drop all RLS policies temporarily to allow UUID migration
-- These will be recreated after the migration completes
-- user_profile policies
DROP POLICY IF EXISTS "Users can delete own SR preferences" ON public.prefs_spaced_repetition;

DROP POLICY IF EXISTS "Users can delete own notes" ON public.note;

DROP POLICY IF EXISTS "Users can delete own playlist tunes" ON public.playlist_tune;

DROP POLICY IF EXISTS "Users can delete own playlists" ON public.playlist;

DROP POLICY IF EXISTS "Users can delete own practice queue items" ON public.daily_practice_queue;

DROP POLICY IF EXISTS "Users can delete own private instruments" ON public.instrument;

DROP POLICY IF EXISTS "Users can delete own private tunes" ON public.tune;

DROP POLICY IF EXISTS "Users can delete own references" ON public.reference;

DROP POLICY IF EXISTS "Users can delete own scheduling preferences" ON public.prefs_scheduling_options;

DROP POLICY IF EXISTS "Users can delete own tab group state" ON public.tab_group_main_state;

DROP POLICY IF EXISTS "Users can delete own table state" ON public.table_state;

DROP POLICY IF EXISTS "Users can delete own tags" ON public.tag;

DROP POLICY IF EXISTS "Users can delete own transient data" ON public.table_transient_data;

DROP POLICY IF EXISTS "Users can delete own tune overrides" ON public.tune_override;

DROP POLICY IF EXISTS "Users can insert own SR preferences" ON public.prefs_spaced_repetition;

DROP POLICY IF EXISTS "Users can insert own notes" ON public.note;

DROP POLICY IF EXISTS "Users can insert own playlist tunes" ON public.playlist_tune;

DROP POLICY IF EXISTS "Users can insert own playlists" ON public.playlist;

DROP POLICY IF EXISTS "Users can insert own practice queue items" ON public.daily_practice_queue;

DROP POLICY IF EXISTS "Users can insert own practice records" ON public.practice_record;

DROP POLICY IF EXISTS "Users can insert own private instruments" ON public.instrument;

DROP POLICY IF EXISTS "Users can insert own private tunes" ON public.tune;

DROP POLICY IF EXISTS "Users can insert own references" ON public.reference;

DROP POLICY IF EXISTS "Users can insert own scheduling preferences" ON public.prefs_scheduling_options;

DROP POLICY IF EXISTS "Users can insert own tab group state" ON public.tab_group_main_state;

DROP POLICY IF EXISTS "Users can insert own table state" ON public.table_state;

DROP POLICY IF EXISTS "Users can insert own tags" ON public.tag;

DROP POLICY IF EXISTS "Users can insert own transient data" ON public.table_transient_data;

DROP POLICY IF EXISTS "Users can insert own tune overrides" ON public.tune_override;

DROP POLICY IF EXISTS "Users can update own SR preferences" ON public.prefs_spaced_repetition;

DROP POLICY IF EXISTS "Users can update own notes" ON public.note;

DROP POLICY IF EXISTS "Users can update own playlist tunes" ON public.playlist_tune;

DROP POLICY IF EXISTS "Users can update own playlists" ON public.playlist;

DROP POLICY IF EXISTS "Users can update own practice queue items" ON public.daily_practice_queue;

DROP POLICY IF EXISTS "Users can update own practice records" ON public.practice_record;

DROP POLICY IF EXISTS "Users can update own private instruments" ON public.instrument;

DROP POLICY IF EXISTS "Users can update own private tunes" ON public.tune;

DROP POLICY IF EXISTS "Users can update own references" ON public.reference;

DROP POLICY IF EXISTS "Users can update own scheduling preferences" ON public.prefs_scheduling_options;

DROP POLICY IF EXISTS "Users can update own tab group state" ON public.tab_group_main_state;

DROP POLICY IF EXISTS "Users can update own table state" ON public.table_state;

DROP POLICY IF EXISTS "Users can update own tags" ON public.tag;

DROP POLICY IF EXISTS "Users can update own transient data" ON public.table_transient_data;

DROP POLICY IF EXISTS "Users can update own tune overrides" ON public.tune_override;

DROP POLICY IF EXISTS "Users can view own SR preferences" ON public.prefs_spaced_repetition;

DROP POLICY IF EXISTS "Users can view own or public notes" ON public.note;

DROP POLICY IF EXISTS "Users can view own or public references" ON public.reference;

DROP POLICY IF EXISTS "Users can view own playlist tunes" ON public.playlist_tune;

DROP POLICY IF EXISTS "Users can view own playlists" ON public.playlist;

DROP POLICY IF EXISTS "Users can view own practice queue" ON public.daily_practice_queue;

DROP POLICY IF EXISTS "Users can view own practice records" ON public.practice_record;

DROP POLICY IF EXISTS "Users can view own scheduling preferences" ON public.prefs_scheduling_options;

DROP POLICY IF EXISTS "Users can view own tab group state" ON public.tab_group_main_state;

DROP POLICY IF EXISTS "Users can view own table state" ON public.table_state;

DROP POLICY IF EXISTS "Users can view own tags" ON public.tag;

DROP POLICY IF EXISTS "Users can view own transient data" ON public.table_transient_data;

DROP POLICY IF EXISTS "Users can view own tune overrides" ON public.tune_override;

DROP POLICY IF EXISTS "Users can view public or own private instruments" ON public.instrument;

DROP POLICY IF EXISTS "Users can view public or own private tunes" ON public.tune;

-- Disable RLS temporarily on all tables
ALTER TABLE IF EXISTS public.prefs_spaced_repetition DISABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.note DISABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.playlist_tune DISABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.playlist DISABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.daily_practice_queue DISABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.practice_record DISABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.instrument DISABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.tune DISABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.reference DISABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.prefs_scheduling_options DISABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.tab_group_main_state DISABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.table_state DISABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.tag DISABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.table_transient_data DISABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.tune_override DISABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.user_profile DISABLE ROW LEVEL SECURITY;