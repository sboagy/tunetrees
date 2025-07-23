"use client";

import RecallEvalComboBox from "@/app/(main)/pages/practice/components/RowRecallEvalComboBox";
import RowGoalComboBox from "@/app/(main)/pages/practice/components/RowGoalComboBox";
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

function rotateSorting<TData, TValue>(
  column: Column<TData, TValue>,
  setTunesRefreshId?: (newRefreshId: number) => void,
) {
  if (column.getIsSorted() === "desc") {
    column.clearSorting();
  } else if (column.getIsSorted() === "asc") {
    column.toggleSorting(true, true);
  } else {
    column.toggleSorting(false, true);
  }
  console.log("column.getIsSorted(): ", column.getIsSorted());
  
  // REMOVED: Don't trigger data refresh when sorting - this was breaking sorting
  // The sorting state will be saved by the table's sorting change handler
  // if (setTunesRefreshId) {
  //   setTunesRefreshId(-1);
  // }

  // column.toggleSorting(column.getIsSorted() === "asc");
}

function sortableHeader<TData, TValue>(
  column: Column<TData, TValue>,
  title: string,
  setTunesRefreshId?: (newRefreshId: number) => void,
) {
  const [, setRenderKey] = useState(0);

  return (
    <div className="flex items-center space-x-1 whitespace-nowrap">
      <span>{title}</span>
      <Button
        variant="ghost"
        className="p-1"
        onClick={() => {
          rotateSorting(column, setTunesRefreshId);
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

    console.log(
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

  const columns: ExtendedColumnDef<
    ITuneOverview,
    TunesGridColumnGeneralType
  >[] = [
    {
      id: "id",
      // header: ({ column }) => sortableHeader(column, "Id"),
      header: ({ column }) => sortableHeader(column, "Id", setTunesRefreshId),
      cell: (info: CellContext<ITuneOverview, TunesGridColumnGeneralType>) => {
        return info.getValue();
        // if (!info.row.original?.external_ref) {
        //   return (
        //     <a
        //       href={`https://www.irishtune.info/tune/${info.row.original.id}/`}
        //       target="_blank"
        //       rel="noopener noreferrer"
        //       className="text-blue-500 underline"
        //     >
        //       {info.row.original.id}
        //     </a>
        //   );
        // }
        // return <span>{info.row.original.id}</span>;
      },
      accessorFn: (row) => row.id,
      enableSorting: true,
      enableHiding: true,
      size: 80,
    },
    "practice" === purpose
      ? {
          accessorKey: "recall_eval",
          header: ({ column }) =>
            sortableHeader(column, "Evaluation", setTunesRefreshId),
          enableHiding: false,
          cell: (
            info: CellContext<ITuneOverview, TunesGridColumnGeneralType>,
          ) => (
            <RecallEvalComboBox
              info={info}
              userId={userId}
              playlistId={playlistId}
              purpose={purpose}
              onRecallEvalChange={onRecallEvalChange}
            />
          ),
          accessorFn: (row) => row.recall_eval,
          size: 284,
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
      header: ({ column }) =>
        sortableHeader(column, "Title", setTunesRefreshId),
      cell: (info: CellContext<ITuneOverview, TunesGridColumnGeneralType>) => {
        const favoriteUrl = info.row.original.favorite_url;
        return favoriteUrl ? (
          <a href={favoriteUrl} target="_blank" rel="noopener noreferrer">
            {info.getValue()}
          </a>
        ) : (
          info.getValue()
        );
      },
      enableSorting: true,
      enableHiding: true,
      enableResizing: true,
      size: 160,
    },
    ...(purpose === "practice"
      ? [
          {
            accessorKey: "goal",
            header: ({ column }: { column: Column<ITuneOverview, unknown> }) =>
              sortableHeader(column, "Goal", setTunesRefreshId),
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
          },
          {
            accessorKey: "technique",
            header: ({ column }: { column: Column<ITuneOverview, unknown> }) =>
              sortableHeader(column, "Algorithm", setTunesRefreshId),
            enableHiding: true,
            cell: (
              info: CellContext<ITuneOverview, TunesGridColumnGeneralType>,
            ) => {
              return info.getValue() || "SM2";
            },
            accessorFn: (row: ITuneOverview) => row.technique,
            size: 150,
          },
        ]
      : []),
    {
      accessorKey: "type",
      header: ({ column }) => sortableHeader(column, "Type", setTunesRefreshId),
      cell: (info) => {
        return info.getValue();
      },
      enableSorting: true,
      enableHiding: true,
      size: 100,
    },
    {
      accessorKey: "structure",
      header: ({ column }) =>
        sortableHeader(column, "Structure", setTunesRefreshId),
      cell: (info) => {
        return info.getValue();
      },
      enableSorting: true,
      enableHiding: true,
      size: 145,
    },
    {
      accessorKey: "mode",
      header: ({ column }) => sortableHeader(column, "Mode", setTunesRefreshId),
      cell: (info) => {
        return info.getValue();
      },
      enableSorting: true,
      enableHiding: true,
      size: 100,
    },
    {
      accessorKey: "incipit",
      header: ({ column }) =>
        sortableHeader(column, "Incipit", setTunesRefreshId),
      cell: (info) => {
        return info.getValue();
      },
      enableSorting: true,
      enableHiding: true,
      size: 200,
    },
    {
      accessorKey: "genre",
      header: ({ column }) =>
        sortableHeader(column, "Genre", setTunesRefreshId),
      cell: (info) => {
        return info.getValue();
      },
      enableSorting: true,
      enableHiding: true,
      size: 200,
    },
    {
      accessorKey: "deleted",
      header: ({ column }) =>
        sortableHeader(column, "Deleted?", setTunesRefreshId),
      cell: (info) => {
        return info.getValue() ? "Yes" : "No";
      },
    },
  ];

  if ("catalog" !== purpose) {
    const columnsUserSpecific: ColumnDef<
      ITuneOverview,
      TunesGridColumnGeneralType
    >[] = [
      {
        accessorKey: "learned",
        header: ({ column }) =>
          sortableHeader(column, "Learned", setTunesRefreshId),
        cell: (info) => {
          return info.getValue();
        },
        enableSorting: true,
        enableHiding: true,
        sortingFn: datetimeTextSortingFn,
        size: 120,
      },
      {
        accessorKey: "practiced",
        header: ({ column }) =>
          sortableHeader(column, "Practiced", setTunesRefreshId),
        cell: (info) => {
          return transformToDatetimeLocalForDisplay(info.getValue() as string);
        },
        enableSorting: true,
        enableHiding: true,
        sortingFn: datetimeTextSortingFn,
        size: 120,
      },
      {
        accessorKey: "quality",
        header: ({ column }) =>
          sortableHeader(column, "Quality", setTunesRefreshId),
        cell: (info) => {
          return info.getValue();
        },
        enableSorting: true,
        enableHiding: true,
        size: 12 * 8, // Approximate width for 11 characters
      },
      {
        accessorKey: "easiness",
        header: ({ column }) =>
          sortableHeader(column, "Easiness", setTunesRefreshId),
        cell: (info) => {
          const value = info.getValue() as number;
          return value.toFixed(2);
        },
        enableSorting: true,
        enableHiding: true,
        size: 14 * 8, // Approximate width for 11 characters
      },
      {
        accessorKey: "interval",
        header: ({ column }) =>
          sortableHeader(column, "Interval", setTunesRefreshId),
        cell: (info) => {
          return info.getValue();
        },
        enableSorting: true,
        enableHiding: true,
        size: 13 * 8, // Approximate width for 11 characters
      },
      {
        accessorKey: "repetitions",
        header: ({ column }) =>
          sortableHeader(column, "Repetitions", setTunesRefreshId),
        cell: (info) => {
          return info.getValue();
        },
        enableSorting: true,
        enableHiding: true,
        size: 16 * 8, // Approximate width for 11 characters
      },
      {
        accessorKey: "review_date",
        header: ({ column }) =>
          sortableHeader(column, "Scheduled", setTunesRefreshId),
        cell: (info) => {
          return transformToDatetimeLocalForDisplay(info.getValue() as string);
        },
        enableSorting: true,
        enableHiding: true,
        sortingFn: datetimeTextSortingFn,
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
        header: ({ column }) =>
          sortableHeader(column, "External Ref", setTunesRefreshId),
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
        header: ({ column }) =>
          sortableHeader(column, "Tags", setTunesRefreshId),
        cell: (info) => {
          return info.getValue();
        },
        enableSorting: true,
        enableHiding: true,
      },
      {
        accessorKey: "notes",
        header: ({ column }) =>
          sortableHeader(column, "Notes", setTunesRefreshId),
        cell: (info) => {
          return (
            <div className="truncate" style={{ maxWidth: "30ch" }}>
              {info.getValue()}
            </div>
          );
        },
        enableSorting: true,
        enableHiding: true,
      },
      {
        accessorKey: "playlist_deleted",
        header: ({ column }) =>
          sortableHeader(column, "Deleted in Repertoire?", setTunesRefreshId),
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
