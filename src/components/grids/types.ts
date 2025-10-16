/**
 * Grid Types for TuneTrees
 *
 * Shared types and interfaces for the tune grid components.
 * Based on the practice_list_staged view and legacy implementation.
 */

/**
 * Table purpose identifier - determines which grid variant to use
 */
export type TablePurpose = "scheduled" | "repertoire" | "catalog";

/**
 * Tune overview data structure from practice_list_staged view
 * Combines tune data with practice records and transient staging data
 */
export interface ITuneOverview {
  // Tune basic info
  id: number;
  title: string | null;
  type: string | null;
  structure: string | null;
  mode: string | null;
  incipit: string | null;
  genre_ref: number | null;
  private_for: string | null;
  deleted: number;

  // Playlist info
  user_ref: number;
  playlist_id: number;
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

  // Metadata
  tags: string | null;
  notes: string | null;
  favorite_url: string | null;
  has_override: number;
  has_staged: number;
}

/**
 * Column sizing state
 */
export interface IColumnSizing {
  [key: string]: number;
}

/**
 * Column order state
 */
export type IColumnOrder = string[];

/**
 * Column visibility state
 */
export interface IColumnVisibility {
  [key: string]: boolean;
}

/**
 * Extended table state with persistence
 */
export interface ITableStateExtended {
  columnSizing?: IColumnSizing;
  columnOrder?: IColumnOrder;
  columnVisibility?: IColumnVisibility;
  scrollTop?: number;
  sorting?: Array<{ id: string; desc: boolean }>;
  globalFilter?: string;
}

/**
 * Table state persistence key
 */
export interface ITableStateKey {
  userId: number;
  tablePurpose: TablePurpose;
  playlistId: number;
}

/**
 * Props for grid components
 */
export interface IGridBaseProps {
  userId: number;
  playlistId: number;
  tablePurpose: TablePurpose;
  onTuneSelect?: (tune: ITuneOverview) => void;
  onRecallEvalChange?: (tuneId: number, newValue: string) => void;
  onGoalChange?: (tuneId: number, newValue: string | null) => void;
  onSelectionChange?: (selectedCount: number) => void;
  // Practice toolbar callbacks
  onEvaluationsCountChange?: (count: number) => void;
  onTableInstanceChange?: (table: any) => void;
  onClearEvaluationsReady?: (callback: () => void) => void;
  // Table instance callback
  onTableReady?: (table: any) => void;
  // Column visibility
  columnVisibility?: IColumnVisibility;
  onColumnVisibilityChange?: (visibility: IColumnVisibility) => void;
  // Search and filter props
  searchQuery?: string;
  selectedTypes?: string[];
  selectedModes?: string[];
  selectedGenres?: string[];
  selectedGenreNames?: string[];
  allGenres?: Array<{
    id: string;
    name: string | null;
    region: string | null;
    description: string | null;
  }>;
  selectedPlaylistIds?: number[];
  // Practice-specific props
  showSubmitted?: boolean; // Display already-submitted tunes in practice queue
}

/**
 * Footer statistics
 */
export interface IFooterStats {
  lapsedCount?: number | null;
  currentCount?: number | null;
  futureCount?: number | null;
  newCount?: number | null;
  reviewedTodayCount?: number | null;
  toBePracticedCount?: number | null;
  reviewedCount?: number | null;
}

/**
 * Scheduling state for styling rows
 */
export type SchedulingState =
  | "lapsed"
  | "current"
  | "future"
  | "new"
  | "reviewed";

/**
 * Cell editor callback signatures
 */
export interface ICellEditorCallbacks {
  onRecallEvalChange?: (tuneId: number, newValue: string) => void;
  onGoalChange?: (tuneId: number, newValue: string | null) => void;
  onNotePrivateChange?: (tuneId: number, newValue: string) => void;
  onNotePublicChange?: (tuneId: number, newValue: string) => void;
}
