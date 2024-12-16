"use client";

import RecallEvalComboBox from "@/app/(main)/pages/practice/components/RowRecallEvalComboBox";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

function rotateSorting<TData, TValue>(column: Column<TData, TValue>) {
  if (column.getIsSorted() === "desc") {
    column.clearSorting();
  } else if (column.getIsSorted() === "asc") {
    column.toggleSorting(true, true);
  } else {
    column.toggleSorting(false, true);
  }
  console.log("column.getIsSorted(): ", column.getIsSorted());

  // column.toggleSorting(column.getIsSorted() === "asc");
}

function sortableHeader<TData, TValue>(
  column: Column<TData, TValue>,
  title: string,
) {
  const [, setRenderKey] = useState(0);

  return (
    <div className="flex items-center space-x-1 whitespace-nowrap">
      <span>{title}</span>
      <Button
        variant="ghost"
        className="p-1"
        onClick={() => {
          rotateSorting(column);
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
      header: ({ column }) => sortableHeader(column, "Id"),
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
          header: ({ column }) => sortableHeader(column, "Evaluation"),
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
      header: ({ column }) => sortableHeader(column, "Title"),
      cell: (info: CellContext<ITuneOverview, TunesGridColumnGeneralType>) => {
        const favoriteUrl = info.row.original.favorite_url;
        return favoriteUrl ? (
          <a
            href={favoriteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline hover:text-blue-700"
            // className="underline hover:text-blue-700"
            // className="text-blue-500 underline hover:text-blue-700"
          >
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
    {
      accessorKey: "type",
      header: ({ column }) => sortableHeader(column, "Type"),
      cell: (info) => {
        return info.getValue();
      },
      enableSorting: true,
      enableHiding: true,
      size: 100,
    },
    {
      accessorKey: "structure",
      header: ({ column }) => sortableHeader(column, "Structure"),
      cell: (info) => {
        return info.getValue();
      },
      enableSorting: true,
      enableHiding: true,
      size: 145,
    },
    {
      accessorKey: "mode",
      header: ({ column }) => sortableHeader(column, "Mode"),
      cell: (info) => {
        return info.getValue();
      },
      enableSorting: true,
      enableHiding: true,
      size: 100,
    },
    {
      accessorKey: "incipit",
      header: ({ column }) => sortableHeader(column, "Incipit"),
      cell: (info) => {
        return info.getValue();
      },
      enableSorting: true,
      enableHiding: true,
      size: 200,
    },
    {
      accessorKey: "genre",
      header: ({ column }) => sortableHeader(column, "Genre"),
      cell: (info) => {
        return info.getValue();
      },
      enableSorting: true,
      enableHiding: true,
      size: 200,
    },
    {
      accessorKey: "deleted",
      header: ({ column }) => sortableHeader(column, "Deleted?"),
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
        header: ({ column }) => sortableHeader(column, "Learned"),
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
        header: ({ column }) => sortableHeader(column, "Practiced"),
        cell: (info) => {
          return info.getValue();
        },
        enableSorting: true,
        enableHiding: true,
        sortingFn: datetimeTextSortingFn,
        size: 120,
      },
      {
        accessorKey: "quality",
        header: ({ column }) => sortableHeader(column, "Quality"),
        cell: (info) => {
          return info.getValue();
        },
        enableSorting: true,
        enableHiding: true,
      },
      {
        accessorKey: "easiness",
        header: ({ column }) => sortableHeader(column, "Easiness"),
        cell: (info) => {
          return info.getValue();
        },
        enableSorting: true,
        enableHiding: true,
      },
      {
        accessorKey: "interval",
        header: ({ column }) => sortableHeader(column, "Interval"),
        cell: (info) => {
          return info.getValue();
        },
        enableSorting: true,
        enableHiding: true,
      },
      {
        accessorKey: "repetitions",
        header: ({ column }) => sortableHeader(column, "Repetitions"),
        cell: (info) => {
          return info.getValue();
        },
        enableSorting: true,
        enableHiding: true,
      },
      {
        accessorKey: "review_date",
        header: ({ column }) => sortableHeader(column, "Scheduled"),
        cell: (info) => {
          return new Date(info.getValue() as string).toLocaleDateString();
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
        header: ({ column }) => sortableHeader(column, "External Ref"),
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
        header: ({ column }) => sortableHeader(column, "Tags"),
        cell: (info) => {
          return info.getValue();
        },
        enableSorting: true,
        enableHiding: true,
      },
      {
        accessorKey: "notes",
        header: ({ column }) => sortableHeader(column, "Notes"),
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
          sortableHeader(column, "Deleted in Repertoire?"),
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
