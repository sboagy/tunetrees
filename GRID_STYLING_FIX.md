# Grid Styling Consistency Fix

**Date:** October 12, 2025  
**Issue:** Despite using shared-grid-styles.ts, the three grids (Practice, Repertoire, Catalog) still appeared visually different.

## Root Cause

The **Practice grid (TunesGridScheduled.tsx)** had redundant font styling applied inline to the header button element that was duplicating styles already present in `HEADER_CELL_BASE_CLASSES`:

```tsx
// ❌ BEFORE (Line 462 in TunesGridScheduled.tsx)
<button
  type="button"
  class="flex items-center gap-1 flex-1 min-w-0 bg-transparent border-0 p-0 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider"
  // These styles ^^^^ were duplicating HEADER_CELL_BASE_CLASSES
```

Meanwhile, **Repertoire and Catalog grids** used a simpler `<span>` element:

```tsx
// ✅ Repertoire & Catalog (correct approach)
<span class="flex items-center gap-1 flex-1 min-w-0">
```

## The Problem

`shared-grid-styles.ts` defines:

```typescript
export const HEADER_CELL_BASE_CLASSES =
  "px-3 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider relative group";
```

This styling is applied to the `<th>` element via `getHeaderCellClasses()`. The Practice grid's button was **re-applying** these same font styles (`text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider`), which:

1. Created unnecessary duplication
2. Could cause inconsistent rendering due to specificity issues
3. Made the code harder to maintain

## The Solution

**Removed redundant font styling** from the Practice grid's button element:

```tsx
// ✅ AFTER (Fixed in TunesGridScheduled.tsx)
<button
  type="button"
  class="flex items-center gap-1 flex-1 min-w-0 bg-transparent border-0 p-0 text-left"
  // Removed: text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider
  // These styles are already applied to the parent <th> via getHeaderCellClasses()
```

The button now only includes:

- **Layout classes:** `flex items-center gap-1 flex-1 min-w-0` (needed for flexbox)
- **Button reset styles:** `bg-transparent border-0 p-0` (to remove default button styling)
- **Alignment:** `text-left` (to ensure left-aligned text)

Font styling is **inherited** from the parent `<th>` element that has `getHeaderCellClasses()` applied.

## Verification

All three grids now correctly use shared styles:

| Component      | Element     | Classes                      | Source            |
| -------------- | ----------- | ---------------------------- | ----------------- |
| `<table>`      | All 3 grids | `TABLE_CLASSES`              | ✅ Shared         |
| `<thead>`      | All 3 grids | `HEADER_CLASSES`             | ✅ Shared         |
| `<th>`         | All 3 grids | `getHeaderCellClasses()`     | ✅ Shared         |
| `<tbody>`      | All 3 grids | `TBODY_CLASSES`              | ✅ Shared         |
| Header content | Practice    | `<button>` with reset styles | ✅ Now consistent |
| Header content | Rep/Cat     | `<span>` (simpler)           | ✅ Correct        |

## Expected Result

- **Header heights** are now identical across all three grids (controlled by `py-2` in `HEADER_CELL_BASE_CLASSES`)
- **Font styling** (size, weight, color, spacing) is consistent
- **No borders** on outer containers (as defined in `CONTAINER_CLASSES`)
- All grids use the **exact same shared styling constants**

## Testing

After this fix, all three grids should appear visually identical in terms of:

- Header row height
- Header text styling
- Border treatment
- Background colors
- Hover states
- Dark mode appearance

## Files Modified

- `/Users/sboag/gittt/tunetrees/src/components/grids/TunesGridScheduled.tsx` (Line 462)

## Related Files

- `/Users/sboag/gittt/tunetrees/src/components/grids/shared-grid-styles.ts` (Shared styles)
- `/Users/sboag/gittt/tunetrees/src/components/grids/TunesGridCatalog.tsx` (Reference)
- `/Users/sboag/gittt/tunetrees/src/components/grids/TunesGridRepertoire.tsx` (Reference)
