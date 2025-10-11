/**
 * Tune Grid Column Definitions
 *
 * Column configurations for all three tune grids (Scheduled, Repertoire, Catalog).
 * Ported from legacy React implementation to SolidJS with fine-grained reactivity.
 */

import type { ColumnDef } from "@tanstack/solid-table";
import { type Component, Show } from "solid-js";
import type { ICellEditorCallbacks, TablePurpose } from "./types";

/**
 * Sorting function for datetime strings (reserved for future use)
 */
// const datetimeSortingFn = (rowA: any, rowB: any, columnId: string) => {
//   const dateA = new Date(rowA.getValue(columnId) || 0);
//   const dateB = new Date(rowB.getValue(columnId) || 0);
//   return dateA < dateB ? -1 : dateA > dateB ? 1 : 0;
// };

/**
 * Sorting function for numeric values
 */
const numericSortingFn = (rowA: any, rowB: any, columnId: string) => {
  const numA = Number(rowA.getValue(columnId)) || 0;
  const numB = Number(rowB.getValue(columnId)) || 0;
  return numA < numB ? -1 : numA > numB ? 1 : 0;
};

/**
 * Sortable column header component
 */
const SortableHeader: Component<{ column: any; title: string }> = (props) => {
  const sortState = () => props.column.getIsSorted();

  return (
    <button
      type="button"
      class="flex items-center gap-2 select-none hover:text-blue-600 dark:hover:text-blue-400"
      onClick={() => props.column.toggleSorting()}
      title={
        sortState() === "asc"
          ? "Sorted ascending - click to sort descending"
          : sortState() === "desc"
          ? "Sorted descending - click to clear sort"
          : "Not sorted - click to sort ascending"
      }
    >
      <span>{props.title}</span>
      <span class="text-gray-400">
        {sortState() === "asc" ? "↑" : sortState() === "desc" ? "↓" : "↕"}
      </span>
    </button>
  );
};

/**
 * Get column definitions for Catalog grid
 */
export function getCatalogColumns(
  _callbacks?: ICellEditorCallbacks
): ColumnDef<any>[] {
  return [
    // Selection checkbox
    {
      id: "select",
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
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          disabled={!row.getCanSelect()}
          onChange={row.getToggleSelectedHandler()}
          class="w-4 h-4 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={`Select row ${row.id}`}
          onClick={(e) => e.stopPropagation()}
        />
      ),
      size: 50,
      minSize: 50,
      maxSize: 50,
      enableSorting: false,
      enableResizing: false,
    },

    // ID
    {
      accessorKey: "id",
      header: ({ column }) => <SortableHeader column={column} title="ID" />,
      cell: (info) => (
        <span class="text-gray-600 dark:text-gray-400">
          {info.getValue() as number}
        </span>
      ),
      sortingFn: numericSortingFn,
      size: 80,
      minSize: 60,
      maxSize: 120,
    },

    // Title (with link)
    {
      accessorKey: "title",
      header: ({ column }) => <SortableHeader column={column} title="Title" />,
      cell: (info) => {
        const tune = info.row.original;
        const title = (info.getValue() as string) || "";
        // Use favorite_url if available, otherwise use irishtune.info
        const href = `https://www.irishtune.info/tune/${tune.id}/`;
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            class="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
            onClick={(e) => e.stopPropagation()}
          >
            {title}
          </a>
        );
      },
      size: 250,
      minSize: 150,
      maxSize: 400,
    },

    // Type
    {
      accessorKey: "type",
      header: ({ column }) => <SortableHeader column={column} title="Type" />,
      cell: (info) => {
        const value = info.getValue() as string | null;
        return (
          <Show when={value} fallback={<span class="text-gray-400">—</span>}>
            <span class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
              {value}
            </span>
          </Show>
        );
      },
      size: 100,
      minSize: 80,
      maxSize: 150,
    },

    // Mode
    {
      accessorKey: "mode",
      header: ({ column }) => <SortableHeader column={column} title="Mode" />,
      cell: (info) => {
        const value = info.getValue() as string | null;
        return (
          <Show when={value} fallback={<span class="text-gray-400">—</span>}>
            <span class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
              {value}
            </span>
          </Show>
        );
      },
      size: 80,
      minSize: 60,
      maxSize: 120,
    },

    // Structure
    {
      accessorKey: "structure",
      header: ({ column }) => (
        <SortableHeader column={column} title="Structure" />
      ),
      cell: (info) => {
        const value = info.getValue() as string | null;
        return value ? (
          <span class="font-mono text-sm text-gray-600 dark:text-gray-400">
            {value}
          </span>
        ) : (
          <span class="text-gray-400">—</span>
        );
      },
      size: 120,
      minSize: 80,
      maxSize: 180,
    },

    // Incipit
    {
      accessorKey: "incipit",
      header: ({ column }) => (
        <SortableHeader column={column} title="Incipit" />
      ),
      cell: (info) => {
        const value = info.getValue() as string | null;
        return value ? (
          <span
            class="font-mono text-xs text-gray-500 dark:text-gray-400 truncate block max-w-xs"
            title={value}
          >
            {value}
          </span>
        ) : (
          <span class="text-gray-400">—</span>
        );
      },
      size: 200,
      minSize: 150,
      maxSize: 300,
    },

    // Status (Public/Private)
    {
      accessorKey: "private_for",
      header: ({ column }) => <SortableHeader column={column} title="Status" />,
      cell: (info) => {
        const value = info.getValue() as string | null;
        return value ? (
          <span class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
            🔒 Private
          </span>
        ) : (
          <span class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
            Public
          </span>
        );
      },
      size: 100,
      minSize: 80,
      maxSize: 120,
    },
  ];
}

/**
 * Get column definitions for Repertoire grid
 * TODO: Implement with staging indicators and goal editor
 */
export function getRepertoireColumns(
  callbacks?: ICellEditorCallbacks
): ColumnDef<any>[] {
  // For now, return catalog columns - will extend in next phase
  return getCatalogColumns(callbacks);
}

/**
 * Get column definitions for Scheduled/Practice grid
 * TODO: Implement with recall eval editor and scheduling indicators
 */
export function getScheduledColumns(
  callbacks?: ICellEditorCallbacks
): ColumnDef<any>[] {
  // For now, return catalog columns - will extend in next phase
  return getCatalogColumns(callbacks);
}

/**
 * Main function to get columns based on table purpose
 */
export function getColumns(
  purpose: TablePurpose,
  callbacks?: ICellEditorCallbacks
): ColumnDef<any>[] {
  switch (purpose) {
    case "catalog":
      return getCatalogColumns(callbacks);
    case "repertoire":
      return getRepertoireColumns(callbacks);
    case "scheduled":
      return getScheduledColumns(callbacks);
    default:
      return getCatalogColumns(callbacks);
  }
}
