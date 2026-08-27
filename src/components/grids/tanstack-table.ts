/**
 * Shared TanStack Table v9 feature set for TuneTrees grids.
 *
 * The existing grids used the complete v8 feature surface. Registering the
 * equivalent v9 set here keeps their shared columns and toolbars compatible
 * while allowing a future bundle-size pass to select features per grid.
 */
import {
  type ColumnVisibilityState,
  createExpandedRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  type RowData,
  stockFeatures,
  type Cell as TanStackCell,
  type Column as TanStackColumn,
  type ColumnDef as TanStackColumnDef,
  type Table as TanStackTable,
  tableFeatures,
} from "@tanstack/solid-table";

export const gridTableFeatures = tableFeatures({
  ...stockFeatures,
  sortedRowModel: createSortedRowModel(),
  expandedRowModel: createExpandedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
});

export type GridTableFeatures = typeof gridTableFeatures;
export type Table<TData extends RowData> = TanStackTable<
  GridTableFeatures,
  TData
>;
export type ColumnDef<
  TData extends RowData,
  TValue = unknown,
> = TanStackColumnDef<GridTableFeatures, TData, TValue>;
export type Column<TData extends RowData, TValue = unknown> = TanStackColumn<
  GridTableFeatures,
  TData,
  TValue
>;
export type Cell<TData extends RowData, TValue = unknown> = TanStackCell<
  GridTableFeatures,
  TData,
  TValue
>;
export type VisibilityState = ColumnVisibilityState;
