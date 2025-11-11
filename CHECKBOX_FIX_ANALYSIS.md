# Checkbox Header Indeterminate State Fix

## Problem
The checkbox in the table header (for selecting all rows) was not updating its indeterminate state when individual rows were selected. The indeterminate state would only appear after switching tabs and returning to the grid.

## Root Cause
The original implementation used a `ref` callback to set the `indeterminate` property:

```tsx
header: ({ table }) => (
  <input
    type="checkbox"
    checked={table.getIsAllRowsSelected()}
    ref={(el) => {
      if (el) {
        el.indeterminate =
          table.getIsSomeRowsSelected() && !table.getIsAllRowsSelected();
      }
    }}
    onChange={table.getToggleAllRowsSelectedHandler()}
    class="w-4 h-4 cursor-pointer"
    aria-label="Select all rows"
  />
)
```

**Problem**: The `ref` callback only executes **once** when the element is created. When the selection state changes (via row checkbox clicks), the ref callback does not re-execute, leaving the indeterminate property stale.

**Why it worked after tab switching**: When you switch tabs and return, the component unmounts and remounts, causing the ref callback to execute again with the current selection state. This gave the appearance that the checkbox "eventually" updated, but it wasn't reactive.

## Solution
Created a dedicated `SelectAllCheckbox` component that uses SolidJS's `createEffect` to reactively update the indeterminate property:

```tsx
const SelectAllCheckbox: Component<{ table: any }> = (props) => {
  let checkboxRef: HTMLInputElement | undefined;

  // Reactively update indeterminate property when selection state changes
  createEffect(() => {
    const allSelected = props.table.getIsAllRowsSelected();
    const someSelected = props.table.getIsSomeRowsSelected();
    
    if (checkboxRef) {
      checkboxRef.indeterminate = someSelected && !allSelected;
    }
  });

  return (
    <input
      ref={checkboxRef}
      type="checkbox"
      checked={props.table.getIsAllRowsSelected()}
      onChange={props.table.getToggleAllRowsSelectedHandler()}
      class="w-4 h-4 cursor-pointer"
      aria-label="Select all rows"
    />
  );
};
```

Then updated the column definition:
```tsx
{
  id: "select",
  header: ({ table }) => <SelectAllCheckbox table={table} />,
  cell: ({ row }) => (
    // ... cell implementation unchanged
  ),
}
```

## How It Works
1. `createEffect` automatically tracks reactive dependencies (the function calls to `getIsAllRowsSelected()` and `getIsSomeRowsSelected()`)
2. When these values change (i.e., when a row is selected or deselected), SolidJS automatically re-runs the effect
3. The effect updates the `indeterminate` property on the checkbox element
4. The checkbox immediately reflects the correct state (unchecked, checked, or indeterminate)

## Expected Behavior After Fix
- **No rows selected**: Checkbox is unchecked, not indeterminate
- **Some rows selected**: Checkbox shows indeterminate state (dash/minus icon)
- **All rows selected**: Checkbox is checked, not indeterminate
- **All then deselect one**: Checkbox returns to indeterminate state

All state changes happen **immediately** without needing to switch tabs.

## Testing
Created comprehensive E2E test suite (`e2e/tests/checkbox-header-indeterminate.spec.ts`) that verifies:
- Catalog grid: indeterminate state appears immediately when some rows are selected
- Catalog grid: checked state when all rows are selected
- Catalog grid: returns to indeterminate when one row is deselected
- Repertoire grid: same behavior as catalog
- Both grids: header checkbox functions correctly for select all/none

## Affected Components
- **Primary**: Catalog grid (uses `getCatalogColumns`)
- **Secondary**: Repertoire grid (extends `getCatalogColumns`)
- **Secondary**: Scheduled/Practice grid (extends `getCatalogColumns`)

All three grids share the same column definitions via `getCatalogColumns`, so the fix applies to all of them automatically.
