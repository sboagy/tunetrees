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

  // Purpose-specific defaults
  switch (purpose) {
    case "scheduled":
      baseState.columnVisibility = {
        // Show all practice-relevant columns by default
        bucket: true,
        evaluation: true,
        goal: false,
        type: true,
        mode: true,
        incipit: false,
        genre: false,
        private_for: false, // Status column
        scheduled: true,
        scheduled_raw: true,
        latest_practiced: true,
        latest_goal: true,
        latest_technique: true,
        latest_quality: true,
        latest_stability: true,
        latest_easiness: true,
        latest_repetitions: true,
        latest_due: true,
        learned: false,
        // Hide less important columns
        id: false,
        structure: true,
      };
      baseState.sorting = [{ id: "id", desc: true }]; // Default sort by id
      break;

    case "repertoire":
      baseState.columnVisibility = {
        id: false,
        incipit: true,
        genre: true,
        scheduled: true,
        latest_practiced: true,
        latest_quality: false,
        latest_easiness: false,
        latest_stability: false,
        latest_interval: false,
        latest_due: true,
        tags: false,
        purpose: false,
        note_private: false,
        note_public: false,
        has_override: false,
        has_staged: false,
        learned: false,
      };
      baseState.sorting = [{ id: "title", desc: false }]; // Sort by title
      break;

    case "catalog":
      baseState.columnVisibility = {
        incipit: false,
        composer: true,
        artist: true,
        release_year: true,
        id_foreign: false,
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
