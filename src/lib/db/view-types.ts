/**
 * View/Join Types
 *
 * Canonical TypeScript types for DB-backed VIEWs and complex joined query shapes.
 * These are shared across UI and query layers to avoid drift.
 */

/**
 * Tune overview data structure from practice_list_staged view.
 *
 * Combines tune data with playlist + practice + transient staging data.
 *
 * Note: `bucket`/`order_index`/`completed_at` are optional because they come from
 * `daily_practice_queue` when the view is joined against the queue (scheduled
 * practice), but are not present in the raw view.
 */
export interface ITuneOverview {
  // Tune basic info
  id: string;
  title: string | null;
  type: string | null;
  structure: string | null;
  mode: string | null;
  incipit: string | null;
  genre: string | null;
  composer: string | null;
  artist: string | null;
  id_foreign: string | null;
  primary_origin: string | null;
  release_year: number | null;
  private_for: string | null;
  deleted: number;

  // Repertoire info
  user_ref: string;
  repertoire_id: string;
  instrument: string | null;
  learned: number | null;
  scheduled: number | null;
  playlist_deleted: number | null;

  // Practice record data (latest or staged)
  latest_state: number | null;
  latest_practiced: string | null;
  latest_quality: number | null;
  latest_easiness: number | null;
  latest_difficulty: number | null;
  latest_stability: number | null;
  latest_interval: number | null;
  latest_step: number | null;
  latest_repetitions: number | null;
  latest_due: string | null;
  latest_backup_practiced: string | null;
  latest_goal: string | null;
  latest_technique: string | null;

  // Transient/staging data
  goal: string | null;
  purpose: string | null;
  note_private: string | null;
  note_public: string | null;
  recall_eval: string | null;

  // Queue data (from daily_practice_queue)
  bucket?: number | null; // Queue bucket (1=Due Today, 2=Lapsed, 3=New, 4=Old Lapsed)
  order_index?: number | null; // Position in queue
  completed_at?: string | null; // Timestamp when evaluation was submitted

  // Metadata
  tags: string | null;
  notes: string | null;
  favorite_url: string | null;
  has_override: number;
  has_staged: number;
}
