/**
 * Grid Types for TuneTrees
 *
 * Shared types and interfaces for the tune grid components.
 * Based on the practice_list_staged view and legacy implementation.
 */

import type { ITuneOverview } from "../../lib/db/view-types";

/**
 * Table purpose identifier - determines which grid variant to use
 */
export type TablePurpose = "scheduled" | "repertoire" | "catalog";

/**
 * Tune overview data structure from practice_list_staged view
 * Combines tune data with practice records and transient staging data
 */
export type { ITuneOverview };

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
  rowSelection?: { [key: string]: boolean };
}

/**
 * Table state persistence key
 */
export interface ITableStateKey {
  userId: string;
  tablePurpose: TablePurpose;
  playlistId: string;
}

/**
 * Props for grid components
 */
export interface IGridBaseProps {
  userId: string;
  playlistId: string;
  tablePurpose: TablePurpose;
  onTuneSelect?: (tune: ITuneOverview) => void;
  onRecallEvalChange?: (tuneId: string, newValue: string) => void;
  onGoalChange?: (tuneId: string, newValue: string | null) => void;
  onSelectionChange?: (selectedCount: number) => void;
  // Practice toolbar callbacks
  onEvaluationsCountChange?: (count: number) => void;
  onTableInstanceChange?: (table: any) => void;
  // Deprecated: onClearEvaluationsReady removed in favor of parent-managed clearing
  // onClearEvaluationsReady?: (callback: () => void) => void;
  // Flashcard mode callback
  onTunesChange?: (tunes: ITuneOverview[]) => void;
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
  selectedPlaylistIds?: string[];
  // Loading/error state for grid data
  isLoading?: boolean;
  loadError?: unknown;
  // Practice-specific props
  practiceListData?: any[]; // Pre-fetched practice list data (required for TunesGridScheduled)
  // Evaluation state management (for flashcard/grid coordination)
  evaluations?: Record<string, string>; // External evaluation state (keyed by tune ID string)
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
  onRecallEvalChange?: (tuneId: string, newValue: string) => void;
  onGoalChange?: (tuneId: string, newValue: string | null) => void;
  onNotePrivateChange?: (tuneId: string, newValue: string) => void;
  onNotePublicChange?: (tuneId: string, newValue: string) => void;
  // Optional control for keeping dropdowns open across refreshes
  getRecallEvalOpen?: (tuneId: string) => boolean;
  setRecallEvalOpen?: (tuneId: string, isOpen: boolean) => void;
}
