# Grid Styling Guide

## Overview

All three grid components (Catalog, Repertoire, and Practice) now share consistent styling defined in `shared-grid-styles.ts`. This ensures uniform appearance and makes it easy to adjust styles globally.

## Location of Shared Styles

**File:** `src/components/grids/shared-grid-styles.ts`

This file contains all the shared Tailwind CSS classes used across the grids.

## Customization Guide

### Header Height

To adjust the header row height, modify the `py-` value in `HEADER_CELL_BASE_CLASSES`:

```typescript
// Current: py-2 (8px padding top/bottom)
export const HEADER_CELL_BASE_CLASSES =
  "px-3 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider relative group";

// For taller headers, change to py-3:
export const HEADER_CELL_BASE_CLASSES =
  "px-3 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider relative group";

// For shorter headers, change to py-1:
export const HEADER_CELL_BASE_CLASSES =
  "px-3 py-1 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider relative group";
```

### Borders

#### Outer Container Borders

The Practice grid currently has no outer borders (preferred style). To remove borders from Catalog and Repertoire grids, the `CONTAINER_CLASSES` constant is already set without border classes:

```typescript
export const CONTAINER_CLASSES = "flex-1 overflow-auto relative touch-pan-y";
```

If you want to add outer borders back, modify this to:

```typescript
export const CONTAINER_CLASSES =
  "flex-1 overflow-auto relative touch-pan-y border border-gray-300 dark:border-gray-600 rounded-lg";
```

#### Column Divider Borders

To remove the vertical lines between columns, modify `HEADER_CELL_BORDER_CLASSES`:

```typescript
// Current: Has right border between columns
export const HEADER_CELL_BORDER_CLASSES =
  "border-r border-gray-200 dark:border-gray-700";

// To remove column dividers:
export const HEADER_CELL_BORDER_CLASSES = "";
```

#### Row Borders

Row borders are defined in `ROW_CLASSES`:

```typescript
// Current: Bottom border on each row
export const ROW_CLASSES =
  "border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors";

// To remove row borders:
export const ROW_CLASSES =
  "hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors";
```

### Colors

#### Header Background

Modify `HEADER_CLASSES`:

```typescript
// Current: Light gray
export const HEADER_CLASSES =
  "sticky top-0 z-10 bg-gray-100 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-600";

// For white header:
export const HEADER_CLASSES =
  "sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-300 dark:border-gray-600";

// For blue header:
export const HEADER_CLASSES =
  "sticky top-0 z-10 bg-blue-50 dark:bg-blue-900 border-b border-blue-300 dark:border-blue-600";
```

#### Row Hover Color

Modify `ROW_CLASSES`:

```typescript
// Current: Gray on hover
export const ROW_CLASSES =
  "border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors";

// For blue hover:
export const ROW_CLASSES =
  "border-b border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/50 cursor-pointer transition-colors";
```

#### Cell Text Color

Modify `CELL_CLASSES`:

```typescript
// Current: Dark gray text
export const CELL_CLASSES =
  "px-3 py-2 text-sm text-gray-900 dark:text-gray-100";

// For black text:
export const CELL_CLASSES = "px-3 py-2 text-sm text-black dark:text-white";
```

### Cell Padding

To adjust cell spacing, modify the `px-` and `py-` values in `CELL_CLASSES`:

```typescript
// Current: 12px horizontal, 8px vertical
export const CELL_CLASSES =
  "px-3 py-2 text-sm text-gray-900 dark:text-gray-100";

// For more compact:
export const CELL_CLASSES =
  "px-2 py-1 text-sm text-gray-900 dark:text-gray-100";

// For more spacious:
export const CELL_CLASSES =
  "px-4 py-3 text-sm text-gray-900 dark:text-gray-100";
```

## Grid-Specific Customizations

If you need to override styles for a specific grid (Catalog, Repertoire, or Practice), you can still add additional classes in the component files:

```typescript
// In TunesGridCatalog.tsx, for example:
<thead class={`${HEADER_CLASSES} custom-catalog-header`}>
```

Or use the `getHeaderCellClasses()` helper to add conditional classes:

```typescript
<th class={getHeaderCellClasses(
  `${additionalCondition ? "bg-blue-50" : ""}`
)}>
```

## After Making Changes

1. Edit `src/components/grids/shared-grid-styles.ts`
2. Save the file
3. The hot reload will update all three grids automatically
4. Test in the browser to verify the changes look correct

## Files Using These Styles

- `src/components/grids/TunesGridCatalog.tsx`
- `src/components/grids/TunesGridRepertoire.tsx`
- `src/components/grids/TunesGridScheduled.tsx`

All three files import from `shared-grid-styles.ts`, so any changes there will affect all grids simultaneously.
