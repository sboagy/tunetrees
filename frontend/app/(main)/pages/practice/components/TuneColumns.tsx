"use client";

import RecallEvalComboBox from "@/app/(main)/pages/practice/components/RowRecallEvalComboBox";
import RowGoalComboBox from "@/app/(main)/pages/practice/components/RowGoalComboBox";
import {
  getQualityListForGoalAndTechnique,
  lookupQualityItem,
} from "../quality-lists";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { transformToDatetimeLocalForDisplay } from "@/lib/date-utils";
import type { CheckedState } from "@radix-ui/react-checkbox";
import type {
  CellContext,
  Column,
  ColumnDef,
  Row,
  RowSelectionState,
  SortingFn,
  Table as TanstackTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useState } from "react";
import { updateTableStateInDb } from "../settings";
import type {
  ITuneOverview,
  TablePurpose,
  TunesGridColumnGeneralType,
} from "../types";
import "./TuneColumns.css";
import { saveTableState } from "./TunesTable";
import { logVerbose } from "@/lib/logging";

// =================================================================================================
// For now, I'm going to feature-down the column control menu, as it's going to be more complex than
// I need to maintain column filters, sync the menu sort state with visible arrows, etc.  Also, it's
// less cluttered without them.  For filters, might be better to just have a qualifier that one can type
// in the global filter box.
//
// function columnControlMenu() {
//   return (
//     <DropdownMenu>
//       <DropdownMenuTrigger asChild>
//         <Button variant="ghost" className="p-1">
//           {" "}
//           <span className="font-bold text-opacity-100">&#8942;</span>
//         </Button>
//       </DropdownMenuTrigger>
//       <DropdownMenuContent>
//         {/* <DropdownMenuLabel>Column Control</DropdownMenuLabel> */}
//         <DropdownMenuItem>
//           <ArrowUp size={16} className="column-menu-icon-style" />
//           <span>Sort ascending</span>
//         </DropdownMenuItem>
//         <DropdownMenuItem>
//           <ArrowDown size={16} className="column-menu-icon-style" />
//           <span>Sort descending</span>
//         </DropdownMenuItem>
//         <DropdownMenuItem>
//           <ArrowUpDown size={16} className="column-menu-icon-style" />
//           <span>Unsort</span>
//         </DropdownMenuItem>
//         {/* <DropdownMenuSeparator />
//         <DropdownMenuItem>
//           <Filter size={16} className="column-menu-icon-style" />
//           <span>Filter...</span>
//         </DropdownMenuItem>
//         <DropdownMenuSeparator />
//         <DropdownMenuItem>
//           <EyeOff size={16} className="column-menu-icon-style" />
//           <span>Hide Column</span>
//         </DropdownMenuItem>
//         <DropdownMenuItem>
//           <Columns size={16} className="column-menu-icon-style" />
//           <span>Manage Columns...</span>
//         </DropdownMenuItem> */}
//       </DropdownMenuContent>
//     </DropdownMenu>
//   );
// }
// =================================================================================================

const datetimeTextSortingFn: SortingFn<ITuneOverview> = (
  rowA: Row<ITuneOverview>,
  rowB: Row<ITuneOverview>,
  columnId: string,
) => {
  const dateA = new Date(rowA.getValue(columnId));
  const dateB = new Date(rowB.getValue(columnId));

  const sortSpec = dateA < dateB ? -1 : dateA > dateB ? 1 : 0;
  return sortSpec;
  // return -1; //-1, 0, or 1 - access any row dat using rowA.original and rowB.original
};

const numericSortingFn: SortingFn<ITuneOverview> = (
  rowA: Row<ITuneOverview>,
  rowB: Row<ITuneOverview>,
  columnId: string,
) => {
  const numA = Number(rowA.getValue(columnId)) || 0;
  const numB = Number(rowB.getValue(columnId)) || 0;
  return numA < numB ? -1 : numA > numB ? 1 : 0;
};

// Note: rely on TanStack's column.getToggleSortingHandler for sorting behavior.

function sortableHeader(
  column: Column<ITuneOverview, unknown>,
  table: TanstackTable<ITuneOverview>,
  title: string,
) {
  const [, setRenderKey] = useState(0);

  return (
    <div className="flex items-center space-x-1 whitespace-nowrap">
      <span>{title}</span>
      <Button
        variant="ghost"
        className="p-1"
        data-testid={`col-${column.id}-sort-button`}
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          // Determine current sort state for this column from table state
          const currentEntry = (table.getState().sorting || []).find(
            (s) => s.id === column.id,
          );
          const current: "none" | "asc" | "desc" = currentEntry
            ? currentEntry.desc
              ? "desc"
              : "asc"
            : "none";
          const next: "none" | "asc" | "desc" =
            current === "none" ? "asc" : current === "asc" ? "desc" : "none";
          // Debug log to help diagnose headless behavior
          logVerbose(
            `sortableHeader click: column=${column.id} current=${current} -> next=${next}`,
          );
          if (next === "none") {
            column.clearSorting();
          } else {
            // Use TanStack's API to update sorting for this column deterministically
            column.toggleSorting(next === "desc", false);
          }
          setRenderKey((prev) => prev + 1); // Force button re-render, special magic
        }}
        title={
          column.getIsSorted() === "asc"
            ? "Ascending column sort"
            : column.getIsSorted() === "desc"
              ? "Descending column sort"
              : "Column not sorted"
        } // For screen readers
      >
        {column.getIsSorted() === "asc" ? (
          <ArrowUp size={16} className="flex-shrink-0 column-icon-style" />
        ) : column.getIsSorted() === "desc" ? (
          <ArrowDown size={16} className="flex-shrink-0 column-icon-style" />
        ) : (
          <ArrowUpDown size={16} className="flex-shrink-0 column-icon-style" />
        )}
      </Button>
      {/* See coment above about not doing a column menu, for now. */}
      {/* {columnControlMenu()} */}
    </div>
  );
}

export interface IColumnMeta {
  headerLabel?: string;
  type?: string;
}

export type ExtendedColumnDef<TData, TValue> = ColumnDef<TData, TValue> & {
  meta?: IColumnMeta;
};

export function get_columns(
  userId: number,
  playlistId: number,
  purpose: TablePurpose,
  onRecallEvalChange?: (tuneId: number, newValue: string) => void,
  setTunesRefreshId?: (newRefreshId: number) => void,
  onGoalChange?: (tuneId: number, newValue: string | null) => void,
  srAlgType?: "FSRS" | "SM2" | null,
): ColumnDef<ITuneOverview, TunesGridColumnGeneralType>[] {
  const determineHeaderCheckedState = (
    table: TanstackTable<ITuneOverview>,
  ): CheckedState => {
    // Over-assigning to variables for logging purposes
    // const selectedCount = Object.keys(table.getState().rowSelection).length;
    const selectedCount = table.getFilteredSelectedRowModel().rows.length;
    const rowCount = table.getFilteredRowModel().rows.length;
    const allSelected = selectedCount === rowCount;
    const noneSelected = selectedCount === 0;
    const checkedState = allSelected
      ? true
      : noneSelected
        ? false
        : "indeterminate";

    logVerbose(
      `LF6: selectionHeader->determineHeaderCheckedState: selectedCount=${selectedCount}, ` +
        `rowCount=${rowCount} noneSelected=${noneSelected}, allSelected=${allSelected}, ` +
        `checkedState=${checkedState}`,
    );

    return checkedState;
  };
  // const { triggerRefresh } = useTuneDataRefresh();

  const triggerRefreshGuarded = () => {
    // An optimization would be to only trigger a refresh on the table that
    // changes, rather than signal that the overall data has changed.
    if (setTunesRefreshId) {
      setTunesRefreshId(0);
    }
  };

  const handleHeaderCheckboxChange = (
    checked: boolean | string,
    table: TanstackTable<ITuneOverview>,
  ) => {
    const checkedResolved =
      typeof checked === "string" ? checked === "true" : checked;

    // setIsAllChecked(checkedResolved);
    table.toggleAllRowsSelected(checkedResolved);

    if (!checkedResolved) {
      table.getState().rowSelection = {};
    } else {
      // const rowSelection: RowSelectionState = table.getState().rowSelection;
      const rowSelection: RowSelectionState = {};
      for (const row of table.getCoreRowModel().rows) {
        if (row.original.id !== undefined) {
          rowSelection[row.original.id] = true;
        }
      }

      table.getState().rowSelection = rowSelection;
    }
    void saveTableState(table, userId, purpose, playlistId);

    triggerRefreshGuarded();
  };

  // const isIndeterminate = () => {
  //   const data = useTableDataFromContext();

  //   data && checkedItems.length > 0 && checkedItems.length < data.length;
  // };

  function selectionHeader<TData, TValue>(
    column: Column<TData, TValue>,
    table: TanstackTable<ITuneOverview>,
  ) {
    // console.log("column: ", column);
    return (
      <Checkbox
        className="mt-3"
        checked={determineHeaderCheckedState(table)}
        onCheckedChange={(checked) =>
          handleHeaderCheckboxChange(checked, table)
        }
        ref={(input: HTMLButtonElement | null) => {
          if (input) {
            // console.log("input: ", input);
            // input.state = isIndeterminate;
          }
        }}
      />
    );
  }

  function refreshHeader(
    info: CellContext<ITuneOverview, TunesGridColumnGeneralType>,
  ) {
    // Ugly trick to force a refresh of the header
    info.table.getColumn(info.column.id)?.toggleVisibility();
    info.table.getColumn(info.column.id)?.toggleVisibility();
  }

  function RowSelectedCheckBox(
    info: CellContext<ITuneOverview, TunesGridColumnGeneralType>,
  ) {
    const handleItemCheckboxChange = () => {
      refreshHeader(info);

      info.row.toggleSelected();
      const rowSelection = { ...info.table.getState().rowSelection };
      const rowIdAsString = info.row.id.toString();
      rowSelection[rowIdAsString] =
        rowSelection[rowIdAsString] === undefined
          ? true
          : !rowSelection[rowIdAsString];

      for (const key in rowSelection) {
        if (!rowSelection[key]) {
          delete rowSelection[key];
        }
      }
      info.table.getState().rowSelection = rowSelection;
      refreshHeader(info);

      console.log(
        "LF7: handleItemCheckboxChange, calling updateTableStateInDb rowSelection: ",
        rowSelection,
      );
      void updateTableStateInDb(
        userId,
        "full",
        purpose,
        playlistId,
        info.table.getState(),
      );
      triggerRefreshGuarded();
    };

    return (
      <Checkbox
        checked={info.row.getIsSelected()}
        onCheckedChange={handleItemCheckboxChange}
        data-testid="tt-row-checkbox"
      />
    );
  }

  // Map bucket numeric value to user-friendly label
  const bucketLabel = (bucket?: number | null): string => {
    if (bucket === 1) return "Due Today";
    if (bucket === 2) return "Recently Lapsed";
    if (bucket === 3) return "Backfill";
    return ""; // Future / not in snapshot
  };

  const columns: ExtendedColumnDef<
    ITuneOverview,
    TunesGridColumnGeneralType
  >[] = [
    // Selection or evaluation column handled later; Bucket column placed early for practice mode
    {
      id: "id",
      header: ({ column, table }) => sortableHeader(column, table, "Id"),
      cell: (info: CellContext<ITuneOverview, TunesGridColumnGeneralType>) => {
        return info.getValue();
      },
      accessorFn: (row) => row.id,
      sortingFn: numericSortingFn,
      sortDescFirst: false,
      enableSorting: true,
      enableHiding: true,
      size: 80,
      minSize: 80,
      meta: { headerLabel: "Id" },
    },
    ...(purpose === "practice"
      ? [
          {
            id: "bucket",
            accessorKey: "bucket",
            header: ({ column, table }) => (
              <div
                className="flex items-center"
                data-testid="col-bucket-header"
              >
                {sortableHeader(
                  column as Column<ITuneOverview, unknown>,
                  table,
                  "Bucket",
                )}
              </div>
            ),
            cell: ({ row }) => {
              const b = (row.original as unknown as { bucket?: number | null })
                .bucket;
              const label = bucketLabel(b);
              return (
                <div
                  className="truncate max-w-[10rem]"
                  title={label}
                  data-testid={`cell-bucket-${row.original.id}`}
                >
                  {label}
                </div>
              );
            },
            enableSorting: true,
            sortingFn: numericSortingFn,
            size: 140,
            minSize: 110,
            meta: { headerLabel: "Bucket" },
          } as ColumnDef<ITuneOverview, TunesGridColumnGeneralType>,
        ]
      : []),
    "practice" === purpose
      ? {
          accessorKey: "recall_eval",
          header: ({ column, table }) =>
            sortableHeader(column, table, "Evaluation"),
          enableHiding: false,
          cell: (
            info: CellContext<ITuneOverview, TunesGridColumnGeneralType>,
          ) => {
            const completed = Boolean(info.row.original.completed_at);
            const qualityList = getQualityListForGoalAndTechnique(
              info.row.original.goal,
              info.row.original.latest_technique,
            );
            const stored = info.row.original.recall_eval;
            let label = "(Not Set)";
            if (stored) {
              label =
                qualityList.find((q) => q.value === stored)?.label2 ?? stored;
            } else {
              // Try numeric/latest fields (server-side submitted values)
              const latestQuality = info.row.original.latest_quality;
              const latestEasiness = info.row.original.latest_easiness;
              if (latestQuality !== null && latestQuality !== undefined) {
                const found = lookupQualityItem(latestQuality, qualityList);
                if (found) label = found.label2;
              } else if (
                latestEasiness !== null &&
                latestEasiness !== undefined
              ) {
                const rounded = Math.round(latestEasiness);
                const found = lookupQualityItem(rounded, qualityList);
                if (found) label = found.label2;
              }
            }

            if (completed) {
              return (
                <div
                  className="truncate"
                  title={label}
                  data-testid={`tt-recal-eval-static-${info.row.original.id}`}
                >
                  {label}
                </div>
              );
            }

            return (
              <RecallEvalComboBox
                info={info}
                userId={userId}
                playlistId={playlistId}
                purpose={purpose}
                onRecallEvalChange={onRecallEvalChange}
                readOnly={Boolean(info.row.original.completed_at)}
              />
            );
          },
          accessorFn: (row) => row.recall_eval,
          size: 284,
          minSize: 260,
          meta: { headerLabel: "Evaluation" },
        }
      : {
          accessorKey: "select",
          header: ({ column, table }) => selectionHeader(column, table),
          enableHiding: false,
          cell: (
            info: CellContext<ITuneOverview, TunesGridColumnGeneralType>,
          ) => RowSelectedCheckBox(info),
          accessorFn: () => null, // Return null since we don't need a value
          meta: {
            type: "boolean", // Set the type to boolean for consistency
          },
          size: 50,
        },
    {
      accessorKey: "title",
      header: ({ column, table }) => sortableHeader(column, table, "Title"),
      cell: (info: CellContext<ITuneOverview, TunesGridColumnGeneralType>) => {
        const favoriteUrl = info.row.original.favorite_url;
        const cellValue = favoriteUrl ? (
          <a href={favoriteUrl} target="_blank" rel="noopener noreferrer">
            {info.getValue()}
          </a>
        ) : (
          info.getValue()
        );
        return cellValue;
      },
      enableSorting: true,
      enableHiding: true,
      enableResizing: true,
      size: 180,
      minSize: 120,
      meta: { headerLabel: "Title" },
    },
    ...(purpose === "practice"
      ? [
          {
            accessorKey: "goal",
            header: ({
              column,
              table,
            }: {
              column: Column<ITuneOverview, unknown>;
              table: TanstackTable<ITuneOverview>;
            }) => sortableHeader(column, table, "Goal"),
            enableHiding: true,
            cell: (
              info: CellContext<ITuneOverview, TunesGridColumnGeneralType>,
            ) => {
              return info.getValue() || "recall";
            },
            accessorFn: (row: ITuneOverview) => row.goal,
            size: 150,
            minSize: 90,
            meta: { headerLabel: "Goal" },
          },
        ]
      : []),
    ...(purpose === "repertoire"
      ? [
          {
            accessorKey: "goal",
            header: ({
              column,
              table,
            }: {
              column: Column<ITuneOverview, unknown>;
              table: TanstackTable<ITuneOverview>;
            }) => sortableHeader(column, table, "Goal"),
            enableHiding: true,
            cell: (
              info: CellContext<ITuneOverview, TunesGridColumnGeneralType>,
            ) => (
              <RowGoalComboBox
                info={info}
                userId={userId}
                playlistId={playlistId}
                purpose={purpose}
                onGoalChange={onGoalChange}
              />
            ),
            accessorFn: (row: ITuneOverview) => row.goal,
            size: 150,
            minSize: 90,
            meta: { headerLabel: "Goal" },
          },
        ]
      : []),
    {
      accessorKey: "type",
      header: ({ column, table }) => sortableHeader(column, table, "Type"),
      cell: (info) => {
        return info.getValue();
      },
      enableSorting: true,
      enableHiding: true,
      size: 100,
      minSize: 90,
      meta: { headerLabel: "Type" },
    },
    {
      accessorKey: "structure",
      header: ({ column, table }) => sortableHeader(column, table, "Structure"),
      cell: (info) => {
        return info.getValue();
      },
      enableSorting: true,
      enableHiding: true,
      size: 145,
      minSize: 120,
      meta: { headerLabel: "Structure" },
    },
    {
      accessorKey: "mode",
      header: ({ column, table }) => sortableHeader(column, table, "Mode"),
      cell: (info) => {
        return info.getValue();
      },
      enableSorting: true,
      enableHiding: true,
      size: 100,
      minSize: 80,
      meta: { headerLabel: "Mode" },
    },
    {
      accessorKey: "incipit",
      header: ({ column, table }) => sortableHeader(column, table, "Incipit"),
      cell: (info) => {
        return info.getValue();
      },
      enableSorting: true,
      enableHiding: true,
      size: 200,
      minSize: 140,
      meta: { headerLabel: "Incipit" },
    },
    {
      accessorKey: "genre",
      header: ({ column, table }) => sortableHeader(column, table, "Genre"),
      cell: (info) => {
        return info.getValue();
      },
      enableSorting: true,
      enableHiding: true,
      size: 200,
      minSize: 140,
      meta: { headerLabel: "Genre" },
    },
    {
      accessorKey: "deleted",
      header: ({ column, table }) => sortableHeader(column, table, "Deleted?"),
      cell: (info) => {
        return info.getValue() ? "Yes" : "No";
      },
      meta: { headerLabel: "Deleted?" },
    },
  ];

  if ("catalog" !== purpose) {
    const columnsUserSpecific: ColumnDef<
      ITuneOverview,
      TunesGridColumnGeneralType
    >[] = [
      {
        id: "scheduled",
        accessorFn: (row) => row.scheduled || row.latest_review_date || "",
        header: ({ column, table }) =>
          sortableHeader(
            column as Column<ITuneOverview, unknown>,
            table,
            "Scheduled",
          ),
        cell: (info) => {
          return transformToDatetimeLocalForDisplay(info.getValue() as string);
        },
        enableSorting: true,
        enableHiding: true,
        size: 140,
        minSize: 130,
        sortingFn: datetimeTextSortingFn,
        meta: { headerLabel: "Scheduled" },
      },
      {
        accessorKey: "learned",
        header: ({ column, table }) =>
          sortableHeader(
            column as Column<ITuneOverview, unknown>,
            table,
            "Learned",
          ),
        cell: (info) => {
          return info.getValue();
        },
        enableSorting: true,
        enableHiding: true,
        sortingFn: datetimeTextSortingFn,
        size: 140,
        minSize: 130,
        meta: { headerLabel: "Learned" },
      },
      {
        accessorKey: "latest_practiced",
        header: ({ column, table }) =>
          sortableHeader(
            column as Column<ITuneOverview, unknown>,
            table,
            "Practiced",
          ),
        cell: (info) => {
          return transformToDatetimeLocalForDisplay(info.getValue() as string);
        },
        enableSorting: true,
        enableHiding: true,
        sortingFn: datetimeTextSortingFn,
        size: 140,
        minSize: 130,
        meta: { headerLabel: "Practiced" },
      },
      {
        accessorKey: "latest_goal",
        header: ({ column, table }) =>
          sortableHeader(
            column as Column<ITuneOverview, unknown>,
            table,
            "Goal",
          ),
        cell: (info) => {
          return info.getValue();
        },
        enableSorting: true,
        enableHiding: true,
        meta: { headerLabel: "Goal" },
        size: 130,
        minSize: 110,
      },
      {
        accessorKey: "latest_technique",
        header: ({ column, table }) =>
          sortableHeader(
            column as Column<ITuneOverview, unknown>,
            table,
            "Alg",
          ),
        cell: (info) => {
          return info.getValue() ?? "sm2";
        },
        enableSorting: true,
        enableHiding: true,
        meta: { headerLabel: "Alg" },
        size: 130,
        minSize: 110,
      },
      {
        accessorKey: "latest_quality",
        header: ({ column, table }) =>
          sortableHeader(
            column as Column<ITuneOverview, unknown>,
            table,
            "Qual",
          ),
        cell: (info) => {
          return info.getValue();
        },
        enableSorting: true,
        enableHiding: true,
        size: 12 * 9, // Approximate width for 11 characters
        minSize: 90,
        meta: { headerLabel: "Qual" },
      },
      {
        // Adaptive column: shows Difficulty for FSRS playlists, Easiness for SM2 playlists (re-uses persisted id 'latest_easiness')
        accessorKey: "latest_easiness",
        header: ({ column, table }) =>
          sortableHeader(
            column as Column<ITuneOverview, unknown>,
            table,
            srAlgType === "FSRS" ? "Difficulty" : "Easiness",
          ),
        cell: (info) => {
          const original = info.row.original;
          const rawValue =
            srAlgType === "FSRS"
              ? original.latest_difficulty
              : original.latest_easiness;
          return rawValue !== null && rawValue !== undefined
            ? rawValue.toFixed(2)
            : "";
        },
        enableSorting: true,
        enableHiding: true,
        sortingFn: numericSortingFn,
        size: 14 * 8, // Approximate width for 11 characters
        minSize: 90,
        meta: {
          headerLabel: srAlgType === "FSRS" ? "Difficulty" : "Easiness",
          type: srAlgType === "FSRS" ? "difficulty" : "easiness",
        },
      },
      {
        accessorKey:
          srAlgType === "FSRS" ? "latest_stability" : "latest_interval",
        header: ({ column, table }) =>
          sortableHeader(
            column as Column<ITuneOverview, unknown>,
            table,
            srAlgType === "FSRS" ? "Stability" : "Interval",
          ),
        cell: (info) => {
          const original = info.row.original;
          const rawValue =
            srAlgType === "FSRS"
              ? original.latest_stability
              : original.latest_interval;
          return rawValue !== null && rawValue !== undefined
            ? rawValue.toFixed(2)
            : "";
        },
        enableSorting: true,
        enableHiding: true,
        size: 13 * 8, // Approximate width for 11 characters
        minSize: 90,
        meta: { headerLabel: srAlgType === "FSRS" ? "Stability" : "Interval" },
      },
      {
        accessorKey: "latest_repetitions",
        header: ({ column, table }) =>
          sortableHeader(
            column as Column<ITuneOverview, unknown>,
            table,
            "Repetitions",
          ),
        cell: (info) => {
          return info.getValue();
        },
        enableSorting: true,
        enableHiding: true,
        size: 16 * 8, // Approximate width for 11 characters
        minSize: 100,
        meta: { headerLabel: "Repetitions" },
      },
      {
        accessorKey: "latest_review_date",
        header: ({ column, table }) =>
          sortableHeader(
            column as Column<ITuneOverview, unknown>,
            table,
            "SR Scheduled",
          ),
        cell: (info) => {
          return transformToDatetimeLocalForDisplay(info.getValue() as string);
        },
        enableSorting: true,
        enableHiding: true,
        size: 160,
        minSize: 150,
        sortingFn: datetimeTextSortingFn,
        meta: { headerLabel: "SR Scheduled" },
      },
      // {
      //   accessorKey: "backup_practiced",
      //   header: "Backup Practiced",
      //   cell: (info) => {
      //     return info.getValue();
      //   },
      //   enableSorting: true,
      //   enableHiding: true,
      // },
      {
        accessorKey: "external_ref",
        header: ({ column, table }) =>
          sortableHeader(
            column as Column<ITuneOverview, unknown>,
            table,
            "External Ref",
          ),
        cell: (
          info: CellContext<ITuneOverview, TunesGridColumnGeneralType>,
        ) => {
          // return info.getValue();
          if (!info.row.original.external_ref) {
            return (
              <a
                href={`https://www.irishtune.info/tune/${info.row.original.id}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 underline"
              >
                {`https://www.irishtune.info/tune/${info.row.original.id}/`}
              </a>
            );
          }
          return (
            <a
              href={info.row.original.external_ref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 underline"
            >
              {info.row.original.external_ref}
            </a>
          );
        },
        enableSorting: true,
        enableHiding: true,
        meta: { headerLabel: "External Ref" },
        size: 220,
        minSize: 160,
      },
      // {
      //   accessorKey: "note_private",
      //   header: "Private Note",
      //   cell: (info) => {
      //     return info.getValue();
      //   },
      //   enableSorting: true,
      //   enableHiding: true,
      // },
      // {
      //   accessorKey: "note_public",
      //   header: "Public Note",
      //   cell: (info) => {
      //     return info.getValue();
      //   },
      //   enableSorting: true,
      //   enableHiding: true,
      // },
      {
        accessorKey: "tags",
        header: ({ column, table }) =>
          sortableHeader(
            column as Column<ITuneOverview, unknown>,
            table,
            "Tags",
          ),
        cell: (info) => {
          return info.getValue();
        },
        enableSorting: true,
        enableHiding: true,
        meta: { headerLabel: "Tags" },
        size: 140,
        minSize: 110,
      },
      {
        accessorKey: "notes",
        header: ({ column, table }) =>
          sortableHeader(
            column as Column<ITuneOverview, unknown>,
            table,
            "Notes",
          ),
        cell: (info) => {
          return (
            <div className="truncate" style={{ maxWidth: "30ch" }}>
              {info.getValue()}
            </div>
          );
        },
        enableSorting: true,
        enableHiding: true,
        meta: { headerLabel: "Notes" },
        size: 200,
        minSize: 140,
      },
      {
        accessorKey: "playlist_deleted",
        header: ({ column, table }) =>
          sortableHeader(
            column as Column<ITuneOverview, unknown>,
            table,
            "Deleted in Repertoire?",
          ),
        meta: {
          headerLabel: "Deleted in Repertoire?", // Store headerLabel in meta
        },
        cell: (info) => {
          return info.getValue() ? "Yes" : "No";
        },
        enableSorting: true,
        enableHiding: true,
      },
    ];
    columns.push(...columnsUserSpecific);
  }
  return columns;
}
