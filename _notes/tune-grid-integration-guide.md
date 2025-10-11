# TunesGridCatalog Integration Guide

**Quick reference for integrating the new Catalog grid into the app**

---

## Import

```typescript
import { TunesGridCatalog } from "@/components/grids";
```

---

## Basic Usage

```typescript
<TunesGridCatalog
  userId={user()!.id}
  playlistId={currentPlaylistId() || 0}
  tablePurpose="catalog"
  onTuneSelect={(tune) => {
    // Handle tune selection (e.g., navigate to details)
    console.log("Selected tune:", tune.title);
  }}
/>
```

---

## Full Example (Replace TuneList in `/src/routes/catalog.tsx`)

```typescript
import { TunesGridCatalog } from "@/components/grids";
import { useAuth } from "@/lib/auth/AuthContext";
import { useCurrentPlaylist } from "@/lib/context/CurrentPlaylistContext";
import { useNavigate } from "@solidjs/router";
import { Component, Show } from "solid-js";

const CatalogPage: Component = () => {
  const { user } = useAuth();
  const { currentPlaylistId } = useCurrentPlaylist();
  const navigate = useNavigate();

  return (
    <div class="h-full flex flex-col">
      {/* Control Banner (existing) */}
      <CatalogControlBanner />

      {/* Grid replaces TuneList */}
      <div class="flex-1 overflow-hidden">
        <Show when={user()}>
          <TunesGridCatalog
            userId={user()!.id}
            playlistId={currentPlaylistId() || 0}
            tablePurpose="catalog"
            onTuneSelect={(tune) => {
              // Navigate to tune details or open modal
              navigate(`/tunes/${tune.id}`);
            }}
          />
        </Show>
      </div>
    </div>
  );
};

export default CatalogPage;
```

---

## Props Reference

| Prop                 | Type                                              | Required | Description                           |
| -------------------- | ------------------------------------------------- | -------- | ------------------------------------- |
| `userId`             | `number`                                          | ✅ Yes   | Current user ID                       |
| `playlistId`         | `number`                                          | ✅ Yes   | Current playlist ID (or 0 for global) |
| `tablePurpose`       | `"catalog"`                                       | ✅ Yes   | Grid type identifier                  |
| `onTuneSelect`       | `(tune: ITuneOverview) => void`                   | ❌ No    | Callback when row is clicked          |
| `onRecallEvalChange` | `(tuneId: number, value: string) => void`         | ❌ No    | For custom editors (future)           |
| `onGoalChange`       | `(tuneId: number, value: string \| null) => void` | ❌ No    | For custom editors (future)           |

---

## Features Available

✅ **Sticky Header** - Stays visible while scrolling  
✅ **Virtual Scrolling** - Only renders visible rows  
✅ **Sortable Columns** - Click headers to sort  
✅ **Resizable Columns** - Drag column edges  
✅ **Row Selection** - Multi-select with checkboxes  
✅ **State Persistence** - Remembers column sizes, sort, scroll position  
✅ **Responsive** - Works on mobile and desktop  
✅ **Dark Mode** - Supports theme switching

---

## Styling

The grid uses Tailwind classes and inherits the app theme. It fills its container, so wrap it in a container with defined height:

```typescript
// ✅ Good - Grid fills parent
<div class="h-full">
  <TunesGridCatalog {...props} />
</div>

// ❌ Bad - Grid may collapse
<TunesGridCatalog {...props} />
```

---

## State Persistence

Grid state is automatically saved to localStorage with the key:

```
table-state:{userId}:catalog:{playlistId}
```

Persisted data includes:

- Column widths
- Column order (future)
- Column visibility (future)
- Sort state
- Scroll position

To clear persisted state:

```typescript
import { clearTableState } from "@/components/grids";

clearTableState({
  userId: user()!.id,
  tablePurpose: "catalog",
  playlistId: currentPlaylistId() || 0,
});
```

---

## Troubleshooting

**Grid not loading:**

- Check that `user()` is defined
- Verify `localDb()` is initialized
- Check browser console for SQL errors

**Columns too wide/narrow:**

- Manually resize and refresh - sizes will persist
- Or clear localStorage state (see above)

**Performance issues:**

- Virtual scrolling handles thousands of rows
- If still slow, check for console errors
- Ensure data query is optimized

**Selection not working:**

- Click the checkbox, not the row (for selection)
- Row click triggers `onTuneSelect` callback

---

## Next Steps

After verifying the grid works in Catalog tab:

1. Add search/filter bar above grid
2. Add sticky footer with statistics
3. Add column visibility toggle in control banner
4. Build TunesGridRepertoire with similar patterns
5. Build TunesGridScheduled for Practice tab

---

## Related Files

- `/src/components/grids/TunesGridCatalog.tsx` - Main component
- `/src/components/grids/TuneColumns.tsx` - Column definitions
- `/src/components/grids/types.ts` - TypeScript types
- `/src/components/grids/table-state-persistence.ts` - Persistence utilities
