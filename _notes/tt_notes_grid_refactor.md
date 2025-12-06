Updated todo list

Created [](file:///Users/sboag/gittt/tunetrees/src/components/grids/TunesGrid.tsx)

Read [](file:///Users/sboag/gittt/tunetrees/src/components/grids/table-state-persistence.ts)

Read [](file:///Users/sboag/gittt/tunetrees/src/components/grids/types.ts)

Using "Apply Patch"

```

```

Ran terminal command: npm run typecheck 2>&1 | head -30

Completed (1/5) _Create shared TunesGrid component_

You're right to push for a radical simplification. Here’s a clean, maintainable way to unify the three grids and eliminate the scroll hacks.

## What I built now

- Added a shared grid component: TunesGrid.tsx
  - Owns the table state (sorting, sizing, order, visibility) and persists it using your existing persistence utilities.
  - Owns virtualization with TanStack Virtual and uses a simple, reliable scroll persistence strategy:
    - On mount: wait for container + scrollability, restore once from localStorage
    - On scroll: debounce-save to localStorage
    - No polling, monkey patches, or re-apply windows
  - Generic over row type and accepts real columns and data
  - Stable row keys via `row.id` to avoid jumpiness after filtering/sorting
  - Exposes `onTableReady` and `onSelectionChange` callbacks

This gives us a single, small, reusable core the Catalog/Repertoire/Scheduled wrappers can compose. It cuts duplicate code and is designed to keep the scroll logic dead simple.

Files changed/added:

- Added TunesGrid.tsx – new shared grid component (render + table + virtualizer + scroll persistence inside)

Typecheck: PASS

## How to migrate the three grids

We can migrate incrementally (one grid at a time). The core idea: each screen component focuses on data fetching/filtering/columns; the shared `TunesGrid` handles rendering, state, virtualization, and scroll.

### 1) Catalog wrapper (minimal changes)

- Keep the current data fetch and `filteredTunes` memo.
- Keep your `getColumns('catalog', ...)`.
- Replace the large table rendering with:

```tsx
<TunesGrid
  tablePurpose="catalog"
  userId={props.userId}
  playlistId={currentPlaylistId() || undefined}
  data={filteredTunes()}
  columns={columns()}
  currentRowId={currentTuneId()}
  onRowClick={(row) => handleRowClick(row as Tune)}
  onSelectionChange={(count) => props.onSelectionChange?.(count)}
  columnVisibility={columnVisibility()}
  onColumnVisibilityChange={setColumnVisibility}
  onTableReady={props.onTableReady}
/>
```

- Remove the old scroll code and most of the table/virtualizer duplication from TunesGridCatalog.tsx. The shared component already includes:
  - container + virtual table markup
  - sticky header
  - consistent virtualization config
  - persistence of table state (no scrollTop there)
  - localStorage scroll persistence

Optional: keep your footer (“X tunes [in playlists]”) below `TunesGrid`. That remains specific to Catalog and easy to maintain.

### 2) Repertoire wrapper

- Same as Catalog, but pass `tablePurpose="repertoire"` and `playlistId` where relevant.
- Reuse your existing `getColumns('repertoire', ...)`.
- Delete the legacy scroll guard/polls and the duplicate rendering.

### 3) Scheduled wrapper

- Same pattern: `tablePurpose="scheduled"`.
- If you need special row styles (e.g., based on scheduling), you can push that through column renderers or add a `getRowClass` prop to `TunesGrid` later. For now, most of the styling in your existing code is column-based via `getColumns`.

## Why this fixes scroll instability

- We stop mixing scroll state with table-effect persistence. The shared component never reads `scrollTop` inside a reactive effect that also tracks sorting/sizing/order/visibility.
- We avoid poll-based re-application that fights user input.
- We stabilize virtual keys via `row.id`, so filtering/sorting doesn’t cause “teleporting.”

## API sketch for `TunesGrid`

Inputs:

- tablePurpose: "catalog" | "repertoire" | "scheduled"
- userId: string
- playlistId?: string
- data: T[]
- columns: ColumnDef<T, unknown>[]
- currentRowId?: string | number
- onRowClick?: (row: T) => void
- columnVisibility?: VisibilityState; onColumnVisibilityChange?: (vs: VisibilityState) => void
- onSelectionChange?: (count: number) => void
- onTableReady?: (table) => void

Behavior:

- Creates table and virtualizer internally
- Persists table state (excluding scrollTop)
- Restores/saves scroll via localStorage: TT*${PURPOSE}\_SCROLL*${userId}_${playlistId?}

## Suggested next steps

- Refactor TunesGridCatalog.tsx to use `TunesGrid` (I can make the code change when you’re ready).
- Repeat for Repertoire and Scheduled; once both are migrated, delete all the old scroll/poll/debug code in those files.
- Optional: add selection summary UI inside `TunesGrid` (simple “X tunes selected” + clear button) to remove even more duplication. I can wire this once you sign off on the approach.

## Notes

- I intentionally kept `TunesGrid` focused on the core: rendering + virtualization + persistence. All domain-specific bits (columns, click behaviors, playlist-scope logic) live at the wrapper level.
- If you’d prefer the legacy pattern (wrappers create the table and pass it into `TunesGrid`), I can add an optional `table` prop and bypass the internal table creation. The current version is simpler and reduces wiring.

If you want, I can go ahead and convert Catalog to use `TunesGrid` now and verify the runtime behavior.

Made changes.
