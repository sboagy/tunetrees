/**
 * Tune Grid Column Definitions
 *
 * Column configurations for all three tune grids (Scheduled, Repertoire, Catalog).
 * Ported from legacy React implementation to SolidJS with fine-grained reactivity.
 */

import type { ColumnDef, Table } from "@tanstack/solid-table";
import { type Component, createEffect, Show } from "solid-js";
import { RecallEvalComboBox } from "./RecallEvalComboBox";
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

const noSortingFn = (_rowA: any, _rowB: any, _columnId: string) => {
  return 1;
};

/**
 * Format date for display (matches legacy app format)
 */
const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });
};

const formatJustDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
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
 * Non-sortable column header component
 */
const StaticHeader: Component<{ title: string }> = (props) => {
  return <span class="normal-case">{props.title}</span>;
};

/**
 * Select All Checkbox Header Component
 * Reactively updates indeterminate state when selection changes
 */
const SelectAllCheckbox: Component<{ table: Table<any> }> = (props) => {
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
      header: ({ table }) => <SelectAllCheckbox table={table} />,
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          disabled={!row.getCanSelect()}
          onChange={row.getToggleSelectedHandler()}
          class="w-4 h-4 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={`Select row ${row.original?.id ?? row.id}`}
          onClick={(e) => e.stopPropagation()}
        />
      ),
      size: 50,
      minSize: 50,
      maxSize: 50,
      enableSorting: false,
      enableResizing: false,
    },

    // ID (prevent wrap for UUIDs; truncate with ellipsis)
    {
      accessorKey: "id",
      header: ({ column }) => <SortableHeader column={column} title="ID" />,
      cell: (info) => {
        const value = info.getValue() as string | number | null;
        const text = value == null ? "" : String(value);
        return (
          <span
            class="font-mono text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis block max-w-full"
            title={text}
          >
            {text}
          </span>
        );
      },
      // Keep numeric sorting for legacy numeric ids; string cast will yield NaN => sorts as 0 which groups UUIDs; acceptable fallback
      sortingFn: numericSortingFn,
      size: 140,
      minSize: 80,
      maxSize: 310,
    },

    // Title (with link)
    {
      accessorKey: "title",
      header: ({ column }) => <SortableHeader column={column} title="Title" />,
      cell: (info) => {
        const tune = info.row.original;
        const title = (info.getValue() as string) || "";
        // Row shape differs by grid:
        // - Repertoire/Scheduled: raw VIEW row (snake_case)
        // - Catalog: Tune row from Drizzle (camelCase)
        const favoriteUrl =
          (tune as any).favorite_url ?? (tune as any).favoriteUrl ?? null;
        const primaryOrigin =
          (tune as any).primary_origin ?? (tune as any).primaryOrigin ?? null;
        const idForeign =
          (tune as any).id_foreign ?? (tune as any).idForeign ?? null;

        // Use favorite_url if available, otherwise fallback to irishtune.info
        // Note: id_foreign is used as the irishtune.info tune id (not a general URL)
        const href =
          favoriteUrl ??
          (primaryOrigin === "irishtune.info" && idForeign
            ? `https://www.irishtune.info/tune/${idForeign}/`
            : undefined);
        if (href) {
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
        } else {
          return title;
        }
      },
      size: 250,
      minSize: 100,
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

    {
      accessorKey: "genre",
      header: ({ column }) => <SortableHeader column={column} title="Genre" />,
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

    // Composer (for Classical/Choral)
    {
      accessorKey: "composer",
      header: ({ column }) => (
        <SortableHeader column={column} title="Composer" />
      ),
      cell: (info) => {
        const value = info.getValue() as string | null;
        return value ? (
          <span
            class="text-sm text-gray-700 dark:text-gray-300 truncate block max-w-xs"
            title={value}
          >
            {value}
          </span>
        ) : (
          <span class="text-gray-400">—</span>
        );
      },
      size: 200,
      minSize: 120,
      maxSize: 300,
    },

    // Artist (for Pop/Rock/Jazz)
    {
      accessorKey: "artist",
      header: ({ column }) => <SortableHeader column={column} title="Artist" />,
      cell: (info) => {
        const value = info.getValue() as string | null;
        return value ? (
          <span
            class="text-sm text-gray-700 dark:text-gray-300 truncate block max-w-xs"
            title={value}
          >
            {value}
          </span>
        ) : (
          <span class="text-gray-400">—</span>
        );
      },
      size: 200,
      minSize: 120,
      maxSize: 300,
    },

    // Release Year
    {
      id: "release_year",
      accessorFn: (row) =>
        (row as any).release_year ?? (row as any).releaseYear ?? null,
      header: ({ column }) => <SortableHeader column={column} title="Year" />,
      cell: (info) => {
        const value = info.getValue() as number | null;
        return value ? (
          <span class="text-sm font-mono text-gray-600 dark:text-gray-400">
            {value}
          </span>
        ) : (
          <span class="text-gray-400">—</span>
        );
      },
      sortingFn: numericSortingFn,
      size: 80,
      minSize: 70,
      maxSize: 100,
    },

    // Foreign ID (Spotify/YouTube)
    {
      id: "id_foreign",
      accessorFn: (row) =>
        (row as any).id_foreign ?? (row as any).idForeign ?? null,
      header: ({ column }) => (
        <SortableHeader column={column} title="External ID" />
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
      size: 150,
      minSize: 100,
      maxSize: 250,
    },

    // Status (Public/Private)
    {
      id: "private_for",
      accessorFn: (row) =>
        (row as any).private_for ?? (row as any).privateFor ?? null,
      header: ({ column }) => (
        <SortableHeader column={column} title="Ownership" />
      ),
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
 * Shows practice-related fields from practice_list_staged view
 */
export function getRepertoireColumns(
  callbacks?: ICellEditorCallbacks
): ColumnDef<any>[] {
  const catalogColumns = getCatalogColumns(callbacks);

  const coldef_private_for = catalogColumns.pop() as ColumnDef<any>;

  // Add practice-related columns after the basic tune columns
  const practiceColumns: ColumnDef<any>[] = [
    // Learned status
    {
      accessorKey: "latest_state",
      header: ({ column }) => <SortableHeader column={column} title="State" />,
      cell: (info) => {
        const valueNum = info.getValue() as number | null;

        if (valueNum === null || valueNum === undefined) {
          return <span class="text-gray-400">—</span>;
        }

        const statuses: Record<number, { label: string; class: string }> = {
          0: {
            label: "New",
            class:
              "inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400",
          },
          1: {
            label: "Learning",
            class:
              "inline-flex items-center px-2 py-0.5 rounded text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200",
          },
          2: {
            label: "Review",
            class:
              "inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200",
          },
          3: {
            label: "Relearning",
            class:
              "inline-flex items-center px-2 py-0.5 rounded text-xs bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200",
          },
        };

        const status = statuses[valueNum] ?? statuses[0];

        return <span class={status.class}>{status.label}</span>;
      },
      size: 100,
      minSize: 80,
      maxSize: 120,
    },

    {
      accessorKey: "learned",
      header: ({ column }) => (
        <SortableHeader column={column} title="Learned" />
      ),
      cell: (info) => {
        const value = info.getValue() as string | null;
        return value !== null ? (
          <span class="text-sm text-gray-600 dark:text-gray-400">
            {formatJustDate(value)}
          </span>
        ) : (
          <span class="text-gray-400">—</span>
        );
      },
      size: 80,
      minSize: 60,
      maxSize: 100,
    },

    // Goal
    {
      accessorKey: "goal",
      header: ({ column }) => <SortableHeader column={column} title="Goal" />,
      cell: (info) => {
        const value = (info.getValue() as string) || "recall";
        const colors = {
          recall:
            "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200",
          notes:
            "bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200",
          technique:
            "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200",
          backup:
            "bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200",
        };
        const colorClass =
          colors[value as keyof typeof colors] || colors.recall;
        return (
          <span
            class={`inline-flex items-center px-2 py-0.5 rounded text-xs ${colorClass}`}
          >
            {value}
          </span>
        );
      },
      size: 100,
      minSize: 80,
      maxSize: 120,
    },

    {
      id: "scheduled",
      // accessorFn: (row) => row.scheduled,
      accessorFn: (row) => row.scheduled || row.latest_due || "",
      header: ({ column }) => (
        <SortableHeader column={column} title="Scheduled" />
      ),
      cell: (info) => {
        // Scheduling override semantics:
        // - `playlist_tune.scheduled` is a transient, manual override of the FSRS-derived next due date.
        // - While an evaluation is STAGED (present in `table_transient_data` / practice_list_staged view),
        //   we intentionally IGNORE any existing override and display the newly computed `latest_due`.
        // - Upon COMMIT (see `commitStagedEvaluations` in `practice-recording.ts`), the override column
        //   is cleared (`scheduled = NULL`) so future renders rely exclusively on FSRS scheduling unless
        //   a new manual override is set.
        // - The `completed_at` timestamp originates from `daily_practice_queue.completed_at`,
        //   and indicates the evaluation for that queue window has been submitted. After completion we
        //   respect any subsequently set manual override (since staging is no longer active).
        const completedAt = info.cell.row.original.completed_at;
        const value =
          info.row.getValue("recall_eval") && !completedAt
            ? (info.row.getValue("latest_due") as string | null)
            : (info.getValue() as string | null);

        if (!value) return <span class="text-gray-400">—</span>;

        const date = new Date(value);
        const now = new Date();

        // Compare dates only (ignore time) to avoid timezone/time-of-day issues
        const dateOnly = new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate()
        );
        const nowOnly = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate()
        );
        const diffDays = Math.round(
          (dateOnly.getTime() - nowOnly.getTime()) / (1000 * 60 * 60 * 24)
        );

        let color = "text-gray-600 dark:text-gray-400";
        if (diffDays < 0) color = "text-red-600 dark:text-red-400";
        else if (diffDays === 0) color = "text-orange-600 dark:text-orange-400";
        else if (diffDays <= 7) color = "text-yellow-600 dark:text-yellow-400";
        else color = "text-green-600 dark:text-green-400";

        const label =
          diffDays === 0
            ? "Today"
            : diffDays === -1
              ? "Yesterday"
              : diffDays < 0
                ? `${Math.abs(diffDays)}d overdue`
                : diffDays === 1
                  ? "Tomorrow"
                  : `In ${diffDays}d`;

        return (
          <span
            class={`text-sm font-medium ${color}`}
            title={date.toLocaleDateString()}
          >
            {label}
          </span>
        );
      },
      size: 120,
      minSize: 100,
      maxSize: 150,
    },

    {
      id: "scheduled_raw",
      // accessorKey: "scheduled",
      accessorFn: (row) => row.scheduled || "",
      header: ({ column }) => (
        <SortableHeader column={column} title="Sched Override" />
      ),
      cell: (info) => {
        const value = info.getValue() as string | null;
        if (!value) return <span class="text-gray-400">—</span>;

        return (
          <span class="text-sm text-gray-600 dark:text-gray-400">
            {formatDate(value)}
          </span>
        );
      },
      size: 200,
      minSize: 180,
      maxSize: 250,
    },

    {
      id: "latest_due",
      accessorFn: (row) => row.latest_due,
      header: ({ column }) => <SortableHeader column={column} title="Due" />,
      cell: (info) => {
        const value = info.getValue() as string | null;
        if (!value) return <span class="text-gray-400">—</span>;

        return (
          <span class="text-sm text-gray-600 dark:text-gray-400">
            {formatDate(value)}
          </span>
        );
      },
      size: 200,
      minSize: 180,
      maxSize: 250,
    },

    // Latest Practiced
    {
      accessorKey: "latest_practiced",
      header: ({ column }) => (
        <SortableHeader column={column} title="Last Practiced" />
      ),
      cell: (info) => {
        const value = info.getValue() as string | null;
        if (!value) return <span class="text-gray-400">Never</span>;

        return (
          <span class="text-sm text-gray-600 dark:text-gray-400">
            {formatDate(value)}
          </span>
        );
      },
      size: 200,
      minSize: 180,
      maxSize: 250,
    },

    // Recall Eval (transient field - editable)
    {
      accessorKey: "recall_eval",
      header: ({ column }) => (
        <SortableHeader column={column} title="Recall Eval" />
      ),
      cell: (info) => {
        const value = (info.getValue() as string) || "";
        const ratings = {
          "": "—",
          again: "Again",
          hard: "Hard",
          good: "Good",
          easy: "Easy",
        };
        const colors = {
          "": "text-gray-400",
          again: "text-red-600 dark:text-red-400",
          hard: "text-orange-600 dark:text-orange-400",
          good: "text-green-600 dark:text-green-400",
          easy: "text-blue-600 dark:text-blue-400",
        };
        return (
          <span
            class={`text-sm font-medium ${colors[value as keyof typeof colors] || "text-gray-400"}`}
          >
            {ratings[value as keyof typeof ratings] || value}
          </span>
        );
      },
      size: 100,
      minSize: 80,
      maxSize: 120,
    },

    // Latest Quality
    {
      accessorKey: "latest_quality",
      header: ({ column }) => (
        <SortableHeader column={column} title="Quality" />
      ),
      cell: (info) => {
        const value = info.getValue() as number | null;
        return value !== null ? (
          <span class="text-sm text-gray-600 dark:text-gray-400">{value}</span>
        ) : (
          <span class="text-gray-400">—</span>
        );
      },
      size: 80,
      minSize: 60,
      maxSize: 100,
    },

    // Latest Easiness
    {
      accessorKey: "latest_easiness",
      header: ({ column }) => (
        <SortableHeader column={column} title="Easiness" />
      ),
      cell: (info) => {
        const value = info.getValue() as number | null;
        return value !== null ? (
          <span class="text-sm text-gray-600 dark:text-gray-400">
            {value.toFixed(2)}
          </span>
        ) : (
          <span class="text-gray-400">—</span>
        );
      },
      size: 90,
      minSize: 70,
      maxSize: 110,
    },

    // Latest Stability
    {
      accessorKey: "latest_stability",
      header: ({ column }) => (
        <SortableHeader column={column} title="Stability" />
      ),
      cell: (info) => {
        const value = info.getValue() as number | null;
        return value !== null ? (
          <span class="text-sm text-gray-600 dark:text-gray-400">
            {value.toFixed(1)}
          </span>
        ) : (
          <span class="text-gray-400">—</span>
        );
      },
      size: 90,
      minSize: 70,
      maxSize: 110,
    },

    // Latest Interval
    {
      accessorKey: "latest_interval",
      header: ({ column }) => (
        <SortableHeader column={column} title="Interval" />
      ),
      cell: (info) => {
        const value = info.getValue() as number | null;
        return value !== null ? (
          <span class="text-sm text-gray-600 dark:text-gray-400">{value}d</span>
        ) : (
          <span class="text-gray-400">—</span>
        );
      },
      size: 80,
      minSize: 60,
      maxSize: 100,
    },

    // Latest Due
    // {
    //   accessorKey: "latest_due",
    //   header: ({ column }) => <SortableHeader column={column} title="Due" />,
    //   cell: (info) => {
    //     const value = info.getValue() as string | null;
    //     if (!value) return <span class="text-gray-400">—</span>;

    //     return (
    //       <span class="text-sm text-gray-600 dark:text-gray-400">
    //         {formatDate(value)}
    //       </span>
    //     );
    //   },
    //   size: 200,
    //   minSize: 180,
    //   maxSize: 250,
    // },

    // Tags
    {
      accessorKey: "tags",
      header: ({ column }) => <SortableHeader column={column} title="Tags" />,
      cell: (info) => {
        const value = info.getValue() as string | null;
        return value ? (
          <span
            class="text-xs text-gray-500 dark:text-gray-400 truncate block max-w-xs"
            title={value}
          >
            {value}
          </span>
        ) : (
          <span class="text-gray-400">—</span>
        );
      },
      size: 150,
      minSize: 100,
      maxSize: 250,
    },

    // Purpose (transient)
    {
      accessorKey: "purpose",
      header: ({ column }) => (
        <SortableHeader column={column} title="Purpose" />
      ),
      cell: (info) => {
        const value = info.getValue() as string | null;
        return value ? (
          <span
            class="text-sm text-gray-600 dark:text-gray-400 truncate block max-w-xs"
            title={value}
          >
            {value}
          </span>
        ) : (
          <span class="text-gray-400">—</span>
        );
      },
      size: 120,
      minSize: 100,
      maxSize: 200,
    },

    // Note Private (transient)
    {
      accessorKey: "note_private",
      header: ({ column }) => (
        <SortableHeader column={column} title="Private Note" />
      ),
      cell: (info) => {
        const value = info.getValue() as string | null;
        return value ? (
          <span
            class="text-xs text-purple-600 dark:text-purple-400 truncate block max-w-xs"
            title={value}
          >
            🔒 {value}
          </span>
        ) : (
          <span class="text-gray-400">—</span>
        );
      },
      size: 150,
      minSize: 100,
      maxSize: 250,
    },

    // Note Public (transient)
    {
      accessorKey: "note_public",
      header: ({ column }) => (
        <SortableHeader column={column} title="Public Note" />
      ),
      cell: (info) => {
        const value = info.getValue() as string | null;
        return value ? (
          <span
            class="text-xs text-blue-600 dark:text-blue-400 truncate block max-w-xs"
            title={value}
          >
            {value}
          </span>
        ) : (
          <span class="text-gray-400">—</span>
        );
      },
      size: 150,
      minSize: 100,
      maxSize: 250,
    },

    // Has Override
    {
      accessorKey: "has_override",
      header: ({ column }) => (
        <SortableHeader column={column} title="Override" />
      ),
      cell: (info) => {
        const value = info.getValue() as number | null;
        return value === 1 ? (
          <span class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
            ✓ Override
          </span>
        ) : (
          <span class="text-gray-400">—</span>
        );
      },
      size: 100,
      minSize: 80,
      maxSize: 120,
    },

    // Has Staged
    {
      accessorKey: "has_staged",
      header: ({ column }) => <SortableHeader column={column} title="Staged" />,
      cell: (info) => {
        const value = info.getValue() as number | null;
        return value === 1 ? (
          <span class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200">
            ✓ Staged
          </span>
        ) : (
          <span class="text-gray-400">—</span>
        );
      },
      size: 90,
      minSize: 70,
      maxSize: 110,
    },
  ];

  // Insert practice columns after Structure (index 7) and before Status
  return [
    ...catalogColumns, // select, id, title, type, mode, structure, incipit, genre
    ...practiceColumns,
    coldef_private_for, // status (private_for)
  ];
}

/**
 * Get column definitions for Scheduled/Practice grid
 * Includes embedded RecallEvalComboBox in Evaluation column
 */
export function getScheduledColumns(
  callbacks?: ICellEditorCallbacks
): ColumnDef<any>[] {
  // const baseColumns = getCatalogColumns(callbacks);
  const baseColumns = getRepertoireColumns(callbacks);

  // Practice-specific columns with Evaluation
  const practiceSpecificColumns: ColumnDef<any>[] = [
    // Bucket (Due Today, Lapsed, New, Old Lapsed)
    {
      id: "bucket",
      accessorFn: (row) => row.bucket || "Due Today",
      header: ({ column }) => <SortableHeader column={column} title="Bucket" />,
      cell: (info) => {
        const value = (info.getValue() as string) || "Due Today";
        const colors: Record<string, string> = {
          "Due Today":
            "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200",
          Lapsed:
            "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200",
          New: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200",
          "Old Lapsed":
            "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200",
        };
        const colorClass =
          colors[value] ||
          "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400";
        return (
          <span
            class={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}
          >
            {value}
          </span>
        );
      },
      size: 100,
      minSize: 80,
      maxSize: 120,
    },

    // Evaluation (RecallEvalComboBox or static text if completed)
    {
      id: "evaluation",
      accessorFn: (row) => row.recall_eval || "",
      header: () => <StaticHeader title="Evaluation" />,
      enableSorting: false,
      sortingFn: noSortingFn,
      cell: (info) => {
        const row = info.row.original;
        const tuneId = row.tune?.id || row.tuneRef || row.id;
        const currentEval = info.getValue() as string;
        const completedAt = row.completed_at;

        // If completed_at is set, show static text (tune already submitted)
        if (completedAt) {
          let label = "(Not Set)";
          let colorClass = "text-gray-600 dark:text-gray-400";

          // Check if we have quality data to display
          if (row.latest_quality !== null && row.latest_quality !== undefined) {
            const quality = row.latest_quality;
            const technique = row.latest_technique || "fsrs"; // Default to FSRS if technique not set

            if (technique === "sm2") {
              // SM2 uses 0-5 scale
              const sm2Labels: Record<number, string> = {
                0: "Complete blackout",
                1: "Incorrect response",
                2: "Incorrect (easy to recall)",
                3: "Correct (serious difficulty)",
                4: "Correct (hesitation)",
                5: "Perfect response",
              };
              const sm2Colors: Record<number, string> = {
                0: "text-red-600 dark:text-red-400",
                1: "text-red-600 dark:text-red-400",
                2: "text-orange-600 dark:text-orange-400",
                3: "text-yellow-600 dark:text-yellow-400",
                4: "text-green-600 dark:text-green-400",
                5: "text-blue-600 dark:text-blue-400",
              };
              label = sm2Labels[quality] || `Quality ${quality}`;
              colorClass = sm2Colors[quality] || colorClass;
            } else {
              // FSRS uses 1-4 scale (Rating.Again=1, Rating.Hard=2, Rating.Good=3, Rating.Easy=4)
              const fsrsLabels: Record<number, string> = {
                1: "Again",
                2: "Hard",
                3: "Good",
                4: "Easy",
              };
              const fsrsColors: Record<number, string> = {
                1: "text-red-600 dark:text-red-400",
                2: "text-orange-600 dark:text-orange-400",
                3: "text-green-600 dark:text-green-400",
                4: "text-blue-600 dark:text-blue-400",
              };
              label = fsrsLabels[quality] || `Quality ${quality}`;
              colorClass = fsrsColors[quality] || colorClass;
            }
          }
          // Fallback to recall_eval text if quality not available (shouldn't happen for completed tunes)
          else if (currentEval) {
            const fsrsLabels: Record<string, string> = {
              again: "Again",
              hard: "Hard",
              good: "Good",
              easy: "Easy",
            };
            const fsrsColors: Record<string, string> = {
              again: "text-red-600 dark:text-red-400",
              hard: "text-orange-600 dark:text-orange-400",
              good: "text-green-600 dark:text-green-400",
              easy: "text-blue-600 dark:text-blue-400",
            };
            label = fsrsLabels[currentEval] || currentEval;
            colorClass = fsrsColors[currentEval] || colorClass;
          }

          return (
            <span class={`text-sm ${colorClass} italic font-medium`}>
              {label}
            </span>
          );
        }

        // Otherwise show editable combobox
        return (
          <RecallEvalComboBox
            tuneId={tuneId}
            value={currentEval}
            // Persist open state across grid refreshes if callbacks provided
            open={callbacks?.getRecallEvalOpen?.(tuneId)}
            onOpenChange={(isOpen) =>
              callbacks?.setRecallEvalOpen?.(tuneId, isOpen)
            }
            onChange={(value) => {
              if (callbacks?.onRecallEvalChange) {
                callbacks.onRecallEvalChange(tuneId, value);
              }
            }}
          />
        );
      },
      size: 220,
      minSize: 120,
      maxSize: 280,
    },
  ];

  // Combine: id, practice-specific, then core tune columns (no select checkbox for practice grid)
  return [
    baseColumns[1], // id
    ...practiceSpecificColumns, // Bucket, Evaluation, Goal
    ...baseColumns.slice(2),
  ];
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
