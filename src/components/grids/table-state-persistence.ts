/**
 * Table State Persistence Utilities
 *
 * Handles saving and loading table state to/from localStorage.
 * Persists: column order, sizing, visibility, scroll position, sorting.
 */

import type {
  ITableStateExtended,
  ITableStateKey,
  TablePurpose,
} from "./types";

/**
 * Generate localStorage key for table state
 */
function getStorageKey(key: ITableStateKey): string {
  return `table-state:${key.userId}:${key.tablePurpose}:${key.repertoireId}`;
}

/**
 * Save table state to localStorage
 */
export function saveTableState(
  key: ITableStateKey,
  state: ITableStateExtended
): void {
  try {
    const storageKey = getStorageKey(key);
    const serialized = JSON.stringify(state);
    localStorage.setItem(storageKey, serialized);
  } catch (error) {
    console.warn("Failed to save table state:", error);
  }
}

/**
 * Load table state from localStorage
 */
export function loadTableState(
  key: ITableStateKey
): ITableStateExtended | null {
  try {
    const storageKey = getStorageKey(key);
    const serialized = localStorage.getItem(storageKey);
    if (!serialized) return null;

    return JSON.parse(serialized) as ITableStateExtended;
  } catch (error) {
    console.warn("Failed to load table state:", error);
    return null;
  }
}

/**
 * Clear table state from localStorage
 */
export function clearTableState(key: ITableStateKey): void {
  try {
    const storageKey = getStorageKey(key);
    localStorage.removeItem(storageKey);
  } catch (error) {
    console.warn("Failed to clear table state:", error);
  }
}

/**
 * Get default table state for a given purpose
 */
export function getDefaultTableState(
  purpose: TablePurpose
): ITableStateExtended {
  const baseState: ITableStateExtended = {
    columnSizing: {},
    columnOrder: [],
    columnVisibility: {},
    columnPinning: { left: [], right: [] },
    scrollTop: 0,
    sorting: [],
    globalFilter: "",
    rowSelection: {},
  };

  // Purpose-specific defaults — only the most essential columns are shown by default.
  // Users can reveal additional columns using the column-visibility control.
  switch (purpose) {
    case "scheduled":
      baseState.columnVisibility = {
        // Show only the essentials for the daily practice queue
        bucket: true,
        evaluation: true,
        scheduled: true,
        latest_practiced: true,
        // Hide everything else
        id: false,
        goal: false,
        type: false,
        mode: false,
        structure: false,
        incipit: false,
        genre: false,
        composer: false,
        artist: false,
        release_year: false,
        id_foreign: false,
        private_for: false,
        latest_state: false,
        learned: false,
        latest_due: false,
        recall_eval: false, // "evaluation" column is used in the scheduled grid instead
        latest_quality: false,
        latest_easiness: false,
        latest_stability: false,
        latest_interval: false,
        tags: false,
        purpose: false,
        note_private: false,
        note_public: false,
        has_override: false,
        has_staged: false,
      };
      baseState.sorting = [{ id: "id", desc: true }]; // Default sort by id
      break;

    case "repertoire":
      baseState.columnVisibility = {
        // Show only genre and the two most useful date columns
        genre: true,
        latest_practiced: true,
        latest_due: true,
        // Hide everything else
        select: false,
        id: false,
        type: false,
        mode: false,
        structure: false,
        incipit: false,
        composer: false,
        artist: false,
        release_year: false,
        id_foreign: false,
        private_for: false,
        latest_state: false,
        learned: false,
        goal: false,
        scheduled: false,
        recall_eval: false,
        latest_quality: false,
        latest_easiness: false,
        latest_stability: false,
        latest_interval: false,
        tags: false,
        purpose: false,
        note_private: false,
        note_public: false,
        has_override: false,
        has_staged: false,
      };
      baseState.sorting = [{ id: "title", desc: false }]; // Sort by title
      break;

    case "catalog":
      baseState.columnVisibility = {
        // Show only composer alongside title
        composer: true,
        // Hide everything else
        select: false,
        id: false,
        type: false,
        mode: false,
        structure: false,
        incipit: false,
        genre: false,
        artist: false,
        release_year: false,
        id_foreign: false,
        private_for: false,
      };
      baseState.sorting = [{ id: "title", desc: false }]; // Sort by title
      break;
  }

  return baseState;
}

/**
 * Merge loaded state with defaults (handles missing fields from old versions)
 */
export function mergeWithDefaults(
  loadedState: ITableStateExtended | null,
  purpose: TablePurpose
): ITableStateExtended {
  const defaults = getDefaultTableState(purpose);

  if (!loadedState) return defaults;

  // Merge column visibility so defaults for new columns apply when upgrading.
  // If loaded visibility map is empty, fall back entirely to defaults.
  const mergedVisibility =
    loadedState.columnVisibility &&
    Object.keys(loadedState.columnVisibility).length > 0
      ? { ...defaults.columnVisibility, ...loadedState.columnVisibility }
      : defaults.columnVisibility;

  return {
    columnSizing: loadedState.columnSizing ?? defaults.columnSizing,
    columnOrder: loadedState.columnOrder ?? defaults.columnOrder,
    columnVisibility: mergedVisibility,
    columnPinning: loadedState.columnPinning ?? defaults.columnPinning,
    scrollTop: loadedState.scrollTop ?? defaults.scrollTop,
    sorting: loadedState.sorting ?? defaults.sorting,
    globalFilter: loadedState.globalFilter ?? defaults.globalFilter,
    rowSelection: loadedState.rowSelection ?? defaults.rowSelection,
  };
}
