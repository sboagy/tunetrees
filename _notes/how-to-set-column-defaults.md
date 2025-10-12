# How to Set Column Defaults

**Location:** `src/components/grids/table-state-persistence.ts`

## Overview

The table grid system supports persistent column configuration with a priority system:

1. **User's saved state** (from localStorage) - highest priority
2. **Props passed to component**
3. **Defaults from `getDefaultTableState()`** - fallback

## Setting Default Column Visibility

Edit the `getDefaultTableState()` function in `table-state-persistence.ts`:

```typescript
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
        id: false, // Hide ID column
        incipit: false, // Hide incipit column
        structure: false, // Hide structure column
      };
      baseState.sorting = [{ id: "latest_due", desc: false }];
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
      baseState.sorting = [{ id: "title", desc: false }];
      break;

    case "catalog":
      baseState.columnVisibility = {
        incipit: false,
      };
      baseState.sorting = [{ id: "title", desc: false }];
      break;
  }

  return baseState;
}
```

### Column Visibility Rules

- **Not listed** = visible by default
- **Listed with `false`** = hidden by default
- **Listed with `true`** = explicitly visible (rarely needed)

### Examples

**Hide ID column in Catalog grid:**

```typescript
case "catalog":
  baseState.columnVisibility = {
    id: false,     // Add this line
    incipit: false,
  };
  break;
```

**Show more columns by default in Repertoire:**

```typescript
case "repertoire":
  baseState.columnVisibility = {
    // Remove lines to show columns by default
    // For example, remove 'tags: false' to show tags column
    id: false,
    incipit: false,
    // tags: false,  // <-- Comment out or remove to show by default
  };
  break;
```

## Setting Default Column Order

Specify the order columns should appear (left to right):

```typescript
case "repertoire":
  baseState.columnOrder = [
    "select",              // Checkbox column
    "title",               // Title column
    "type",                // Type column
    "mode",                // Mode column
    "structure",           // Structure column
    "learned",             // Learned status
    "scheduled",           // Scheduled info
    "latest_due",          // Due date
    "goal",                // Goal
    "latest_practiced",    // Last practiced
    "recall_eval",         // Recall evaluation
    "private_for",         // Status
    // ... add more in desired order
  ];
  break;
```

**Notes:**

- Empty array `[]` = use order from `TuneColumns.tsx` definitions
- Column IDs must match the `id` or `accessorKey` in column definitions
- Unlisted columns appear after ordered columns

## Setting Default Sorting

```typescript
case "repertoire":
  // Single column sort
  baseState.sorting = [{ id: "title", desc: false }];  // Ascending

  // Or descending
  baseState.sorting = [{ id: "latest_due", desc: true }];

  // Multi-column sort (primary, then secondary)
  baseState.sorting = [
    { id: "type", desc: false },
    { id: "title", desc: false }
  ];
  break;
```

## Preventing Columns from Being Hidden

In `src/components/grids/TuneColumns.tsx`, add `enableHiding: false` to column definition:

```typescript
{
  accessorKey: "title",
  header: ({ column }) => <SortableHeader column={column} title="Title" />,
  enableHiding: false,  // User cannot hide this column
  cell: (info) => { /* ... */ },
  size: 250,
}
```

**Good candidates for `enableHiding: false`:**

- `select` (checkbox column)
- `title` (primary identifier)
- Critical columns that should always be visible

## Testing Default Changes

After modifying defaults:

1. **Clear localStorage** to test fresh state:

   ```javascript
   // In browser console
   localStorage.clear();
   // Or specific key
   localStorage.removeItem("table-state:USER_ID:repertoire:PLAYLIST_ID");
   ```

2. **Refresh page** to see defaults applied

3. **Verify persistence** by:
   - Changing column visibility
   - Refreshing page
   - Confirming changes are saved

## Column ID Reference

Common column IDs (check `TuneColumns.tsx` for complete list):

| Column ID          | Description                        |
| ------------------ | ---------------------------------- |
| `select`           | Checkbox for row selection         |
| `id`               | Tune ID number                     |
| `title`            | Tune title with link               |
| `type`             | Tune type (Reel, Jig, Hpipe, etc.) |
| `mode`             | Musical mode (D Major, etc.)       |
| `structure`        | ABC structure (AABB, etc.)         |
| `learned`          | Learning status badge              |
| `scheduled`        | Scheduling information             |
| `latest_due`       | Due date                           |
| `goal`             | Practice goal                      |
| `latest_practiced` | Last practice date                 |
| `recall_eval`      | Recall evaluation                  |
| `private_for`      | Public/Private status              |
| `incipit`          | Musical notation preview           |
| `tags`             | Associated tags                    |

## Architecture Notes

- **localStorage key format:** `table-state:{userId}:{tablePurpose}:{playlistId}`
- **State shape:** See `ITableStateExtended` interface in `types.ts`
- **Merging logic:** `mergeWithDefaults()` combines loaded state with defaults
- **Three grid types:** `scheduled`, `repertoire`, `catalog` (each can have different defaults)

## Related Files

- `src/components/grids/table-state-persistence.ts` - State persistence logic & defaults
- `src/components/grids/TuneColumns.tsx` - Column definitions
- `src/components/grids/TunesGridRepertoire.tsx` - Repertoire grid implementation
- `src/components/grids/TunesGridCatalog.tsx` - Catalog grid implementation
- `src/components/grids/types.ts` - TypeScript interfaces
