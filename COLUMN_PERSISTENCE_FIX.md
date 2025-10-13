# Column Persistence Fix - Practice Tab

**Issue:** Column visibility and order changes were not persisting between sessions in the Practice tab.

**Date:** January 12, 2025  
**Status:** ✅ Fixed

---

## Problem Analysis

### Symptoms

- User changed column visibility/order in Practice tab
- Changes were lost after page reload
- Other tabs (Repertoire, Catalog) didn't have this issue

### Root Cause

The Practice tab's parent component (`src/routes/practice/Index.tsx`) was **passing column visibility state as a prop** to the child grid component (`TunesGridScheduled`).

```tsx
// ❌ WRONG - Parent was doing this:
const [columnVisibility, setColumnVisibility] = createSignal({});

<TunesGridScheduled
  columnVisibility={columnVisibility()}  // Empty object!
  onColumnVisibilityChange={setColumnVisibility}
  ...
/>
```

**What Happened:**

1. `TunesGridScheduled` loaded persisted state from localStorage on mount
2. Parent passed `columnVisibility={{}}` as a prop
3. **Parent's empty object overrode the child's loaded state**
4. Changes were saved correctly to localStorage, but immediately overridden on next load

### Why Other Tabs Worked

Repertoire and Catalog tabs don't pass `columnVisibility` props to their grids. The grids manage their own state internally, allowing persistence to work correctly.

---

## Solution

**Removed parent-controlled column visibility state** from Practice/Index.tsx.

### Changed File: `src/routes/practice/Index.tsx`

**Before:**

```tsx
const PracticeIndex: Component = () => {
  const { user, localDb } = useAuth();
  const { currentPlaylistId } = useCurrentPlaylist();

  // ❌ Parent maintained state
  const [columnVisibility, setColumnVisibility] = createSignal({});

  const [evaluationsCount, setEvaluationsCount] = createSignal(0);
  const [showSubmitted, setShowSubmitted] = createSignal(false);
  const [tableInstance, setTableInstance] = createSignal<any>(null);

  // ...

  <TunesGridScheduled
    userId={1}
    playlistId={playlistId()}
    tablePurpose="scheduled"
    columnVisibility={columnVisibility()} // ❌ Overrides localStorage
    onColumnVisibilityChange={setColumnVisibility}
    onRecallEvalChange={handleRecallEvalChange}
    onGoalChange={handleGoalChange}
    onEvaluationsCountChange={setEvaluationsCount}
    onTableInstanceChange={setTableInstance}
  />;
};
```

**After:**

```tsx
const PracticeIndex: Component = () => {
  const { user, localDb } = useAuth();
  const { currentPlaylistId } = useCurrentPlaylist();

  // ✅ Removed columnVisibility state
  const [evaluationsCount, setEvaluationsCount] = createSignal(0);
  const [showSubmitted, setShowSubmitted] = createSignal(false);
  const [tableInstance, setTableInstance] = createSignal<any>(null);

  // ...

  <TunesGridScheduled
    userId={1}
    playlistId={playlistId()}
    tablePurpose="scheduled"
    // ✅ No columnVisibility props - grid manages internally
    onRecallEvalChange={handleRecallEvalChange}
    onGoalChange={handleGoalChange}
    onEvaluationsCountChange={setEvaluationsCount}
    onTableInstanceChange={setTableInstance}
  />;
};
```

---

## How Persistence Works (Already Existed)

### Grid Component: `TunesGridScheduled.tsx`

**Load State on Mount:**

```tsx
const stateKey = createMemo(() => ({
  userId: props.userId,
  tablePurpose: props.tablePurpose,
  playlistId: props.playlistId,
}));

const loadedState = loadTableState(stateKey());
const mergedState = mergeWithDefaults(loadedState, "scheduled");

const [columnVisibility, setColumnVisibility] = createSignal(
  mergedState.columnVisibility
);
const [columnOrder, setColumnOrder] = createSignal(mergedState.columnOrder);
```

**Save State on Changes:**

```tsx
createEffect(() => {
  const state = {
    sorting: sorting(),
    columnSizing: columnSizing(),
    columnOrder: columnOrder(),
    columnVisibility: columnVisibility(),
    scrollTop: containerRef?.scrollTop || 0,
  };
  saveTableState(stateKey(), state);
});
```

### Persistence Module: `table-state-persistence.ts`

```typescript
function getStorageKey(key: ITableStateKey): string {
  return `table-state:${key.userId}:${key.tablePurpose}:${key.playlistId}`;
}

export function saveTableState(
  key: ITableStateKey,
  state: ITableStateExtended
): void {
  const storageKey = getStorageKey(key);
  localStorage.setItem(storageKey, JSON.stringify(state));
}

export function loadTableState(
  key: ITableStateKey
): ITableStateExtended | null {
  const storageKey = getStorageKey(key);
  const serialized = localStorage.getItem(storageKey);
  return serialized ? JSON.parse(serialized) : null;
}
```

---

## Verification

### Test Steps

1. Open Practice tab
2. Change column visibility (hide/show columns)
3. Reorder columns by dragging
4. Resize columns
5. Reload page
6. ✅ All changes should persist

### localStorage Key Format

```
table-state:1:scheduled:123
```

Where:

- `1` = userId
- `scheduled` = tablePurpose
- `123` = playlistId

---

## Related Files

**Modified:**

- `src/routes/practice/Index.tsx` - Removed columnVisibility props

**Working Correctly (No Changes):**

- `src/components/grids/TunesGridScheduled.tsx` - Persistence logic
- `src/components/grids/table-state-persistence.ts` - localStorage utilities
- `src/routes/repertoire.tsx` - No columnVisibility props (already correct)
- `src/routes/catalog.tsx` - No columnVisibility props (already correct)

---

## Lessons Learned

### Pattern: Let Child Components Own Their State

**❌ Don't Do This:**

```tsx
// Parent
const [gridState, setGridState] = createSignal({});
<Grid state={gridState()} onChange={setGridState} />;
```

**✅ Do This Instead:**

```tsx
// Parent - no state management
<Grid />;

// Grid - manages its own state and persistence
const [state, setState] = createSignal(loadFromLocalStorage());
createEffect(() => saveToLocalStorage(state()));
```

### When Parent Control IS Needed

Only pass state props when:

1. Parent needs to read/react to the state
2. Multiple components share the same state
3. External controls modify the state

Otherwise, let components manage their own state internally.

---

## Status

✅ **Fixed and Tested**

- Column visibility persists ✅
- Column order persists ✅
- Column sizing persists ✅
- Scroll position persists ✅
- Sorting persists ✅

**Next:** Show cached data immediately on startup (#4)
