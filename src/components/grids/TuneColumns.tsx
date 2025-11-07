/**
 * Tune Grid Column Definitions
 *
 * Column configurations for all three tune grids (Scheduled, Repertoire, Catalog).
 * Ported from legacy React implementation to SolidJS with fine-grained reactivity.
 */

import type { ColumnDef } from "@tanstack/solid-table";
import { type Component, Show, createEffect } from "solid-js";
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
        // Use favorite_url if available, otherwise use irishtune.info
        const href = tune.favorite_url;
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
 * Shows practice-related fields from practice_list_staged view
 */
export function getRepertoireColumns(
  callbacks?: ICellEditorCallbacks
): ColumnDef<any>[] {
  const catalogColumns = getCatalogColumns(callbacks);

  // Add practice-related columns after the basic tune columns
  const practiceColumns: ColumnDef<any>[] = [
    // Learned status
    {
      accessorKey: "learned",
      header: ({ column }) => (
        <SortableHeader column={column} title="Learned" />
      ),
      cell: (info) => {
        const value = info.getValue() as number | null;
        return value === 1 ? (
          <span class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
            ✓ Learned
          </span>
        ) : (
          <span class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
            Learning
          </span>
        );
      },
      size: 100,
      minSize: 80,
      maxSize: 120,
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

    // Scheduled
    {
      accessorKey: "scheduled",
      header: ({ column }) => (
        <SortableHeader column={column} title="Scheduled" />
      ),
      cell: (info) => {
        const value = info.getValue() as number | null;
        return value === 1 ? (
          <span class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
            ✓ Yes
          </span>
        ) : (
          <span class="text-gray-400">—</span>
        );
      },
      size: 100,
      minSize: 80,
      maxSize: 120,
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
            class={`text-sm font-medium ${
              colors[value as keyof typeof colors] || "text-gray-400"
            }`}
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
    {
      accessorKey: "latest_due",
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
    ...catalogColumns.slice(0, 7), // select, id, title, type, mode, structure, incipit
    ...practiceColumns,
    catalogColumns[7], // status (private_for)
  ];
}

/**
 * Get column definitions for Scheduled/Practice grid
 * Includes embedded RecallEvalComboBox in Evaluation column
 */
export function getScheduledColumns(
  callbacks?: ICellEditorCallbacks
): ColumnDef<any>[] {
  const baseColumns = getCatalogColumns(callbacks);

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

    // Goal
    {
      id: "goal",
      accessorFn: (row) => row.goal || row.latest_goal || "recall",
      header: ({ column }) => <SortableHeader column={column} title="Goal" />,
      cell: (info) => {
        const value = (info.getValue() as string) || "recall";
        const colors: Record<string, string> = {
          recall:
            "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200",
          notes:
            "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200",
          technique:
            "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200",
          backup:
            "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200",
        };
        const colorClass = colors[value] || colors.recall;
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
  ];

  // Combine: id, practice-specific, then core tune columns (no select checkbox for practice grid)
  return [
    baseColumns[1], // id
    ...practiceSpecificColumns, // Bucket, Evaluation, Goal
    baseColumns[2], // title
    baseColumns[3], // type
    baseColumns[4], // mode
    baseColumns[5], // structure
    baseColumns[6], // incipit
    baseColumns[7], // status (private_for)
    // Add scheduling columns from repertoire
    {
      id: "scheduled",
      // accessorFn: (row) => row.scheduled,
      accessorFn: (row) => row.scheduled || row.latest_due || "",
      header: ({ column }) => (
        <SortableHeader column={column} title="Scheduled" />
      ),
      cell: (info) => {
        const value = info.getValue() as string | null;
        if (!value) return <span class="text-gray-400">—</span>;

        const date = new Date(value);
        const now = new Date();
        const diffDays = Math.floor(
          (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
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
      id: "latest_practiced",
      accessorFn: (row) => row.latest_practiced,
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
    {
      id: "latest_goal",
      accessorFn: (row) => row.latest_goal,
      header: ({ column }) => (
        <SortableHeader column={column} title="Latest Goal" />
      ),
      cell: (info) => {
        const value = (info.getValue() as string) || "";
        if (!value) return <span class="text-gray-400">—</span>;
        const colors: Record<string, string> = {
          recall:
            "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200",
          notes:
            "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200",
          technique:
            "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200",
          backup:
            "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200",
        };
        const colorClass = colors[value] || "bg-gray-100 dark:bg-gray-700";
        return (
          <span
            class={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}
          >
            {value}
          </span>
        );
      },
      size: 130,
      minSize: 110,
      maxSize: 150,
    },
    {
      id: "latest_technique",
      accessorFn: (row) => row.latest_technique ?? "sm2",
      header: ({ column }) => <SortableHeader column={column} title="Alg" />,
      cell: (info) => {
        const value = (info.getValue() as string) || "sm2";
        return (
          <span class="text-sm font-mono text-gray-600 dark:text-gray-400">
            {value}
          </span>
        );
      },
      size: 90,
      minSize: 80,
      maxSize: 110,
    },
    {
      id: "latest_quality",
      accessorFn: (row) => row.latest_quality,
      header: ({ column }) => <SortableHeader column={column} title="Qual" />,
      cell: (info) => {
        const value = info.getValue() as number | null;
        return value !== null ? (
          <span class="text-sm text-gray-600 dark:text-gray-400">{value}</span>
        ) : (
          <span class="text-gray-400">—</span>
        );
      },
      sortingFn: numericSortingFn,
      size: 90,
      minSize: 70,
      maxSize: 110,
    },
    {
      id: "latest_stability",
      accessorFn: (row) =>
        row.latest_stability ?? row.schedulingInfo?.stability ?? null,
      header: ({ column }) => (
        <SortableHeader column={column} title="Stability" />
      ),
      cell: (info) => {
        const value = info.getValue() as number | null | undefined;
        return value !== null && value !== undefined ? (
          <span class="text-sm text-gray-600 dark:text-gray-400">
            {value.toFixed(2)}
          </span>
        ) : (
          <span class="text-gray-400">—</span>
        );
      },
      sortingFn: numericSortingFn,
      size: 104,
      minSize: 90,
      maxSize: 120,
    },
    {
      id: "latest_easiness",
      accessorFn: (row) => row.latest_difficulty ?? row.latest_easiness ?? null, // FSRS uses difficulty, SM2 uses easiness
      header: ({ column }) => (
        <SortableHeader column={column} title="Easiness" />
      ),
      cell: (info) => {
        const value = info.getValue() as number | null | undefined;
        return value !== null && value !== undefined ? (
          <span class="text-sm text-gray-600 dark:text-gray-400">
            {value.toFixed(2)}
          </span>
        ) : (
          <span class="text-gray-400">—</span>
        );
      },
      sortingFn: numericSortingFn,
      size: 112,
      minSize: 90,
      maxSize: 130,
    },
    {
      id: "latest_repetitions",
      accessorFn: (row) => row.latest_repetitions,
      header: ({ column }) => <SortableHeader column={column} title="Reps" />,
      cell: (info) => {
        const value = info.getValue() as number | null;
        return value !== null ? (
          <span class="text-sm text-gray-600 dark:text-gray-400">{value}</span>
        ) : (
          <span class="text-gray-400">—</span>
        );
      },
      sortingFn: numericSortingFn,
      size: 100,
      minSize: 80,
      maxSize: 120,
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
