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
  return `table-state:${key.userId}:${key.tablePurpose}:${key.playlistId}`;
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
    scrollTop: 0,
    sorting: [],
    globalFilter: "",
  };

  // Purpose-specific defaults
  switch (purpose) {
    case "scheduled":
      baseState.columnVisibility = {
        id: false, // Hide ID by default
        incipit: false, // Hide incipit by default
        structure: false, // Hide structure by default
      };
      baseState.sorting = [{ id: "latest_due", desc: false }]; // Sort by due date
      break;

    case "repertoire":
      baseState.columnVisibility = {
        id: false,
        incipit: false,
        latest_quality: false,
        latest_easiness: false,
        latest_stability: false,
        latest_interval: false,
        latest_due: false,
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
        incipit: false,
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

  return {
    columnSizing: loadedState.columnSizing ?? defaults.columnSizing,
    columnOrder: loadedState.columnOrder ?? defaults.columnOrder,
    columnVisibility: loadedState.columnVisibility ?? defaults.columnVisibility,
    scrollTop: loadedState.scrollTop ?? defaults.scrollTop,
    sorting: loadedState.sorting ?? defaults.sorting,
    globalFilter: loadedState.globalFilter ?? defaults.globalFilter,
  };
}
