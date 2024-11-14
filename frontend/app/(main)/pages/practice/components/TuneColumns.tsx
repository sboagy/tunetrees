"use client";

import RecallEvalComboBox from "@/app/(main)/pages/practice/components/RowRecallEvalComboBox";
import type { TablePurpose, Tune, TunesGridColumnGeneralType } from "../types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
  CellContext,
  Column,
  ColumnDef,
  Row,
  SortingFn,
  TableState,
  Table as TanstackTable,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Columns,
  EyeOff,
  Filter,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { createOrUpdateTableState, getTableCurrentTune } from "../settings";
import type { CheckedState } from "@radix-ui/react-checkbox";

function columnControlMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="text-black">
          {" "}
          <span className="font-bold">&#8942;</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {/* <DropdownMenuLabel>Column Control</DropdownMenuLabel> */}
        <DropdownMenuItem>
          <ArrowUp className="mr-2 h-4 w-4" />
          <span>Sort ascending</span>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <ArrowDown className="mr-2 h-4 w-4" />
          <span>Sort descending</span>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <ArrowUpDown className="mr-2 h-4 w-4" />
          <span>Unsort</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Filter className="mr-2 h-4 w-4" />
          <span>Filter...</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <EyeOff className="mr-2 h-4 w-4" />
          <span>Hide Column</span>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Columns className="mr-2 h-4 w-4" />
          <span>Manage Columns...</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const datetimeTextSortingFn: SortingFn<Tune> = (
  rowA: Row<Tune>,
  rowB: Row<Tune>,
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
  // console.log("column: ", column);
  const isSorted = column.getIsSorted();
  column.getCanMultiSort();
  return (
    <div
      className="flex items-center"
      onClick={() => rotateSorting(column)}
      onKeyDown={() => {}}
      onKeyUp={() => {}}
      onKeyPress={() => {}}
    >
      {title}
      {isSorted === "asc" ? (
        <ArrowUp className="ml-2 h-4 w-4" />
      ) : isSorted === "desc" ? (
        <ArrowDown className="ml-2 h-4 w-4" />
      ) : (
        <ArrowUpDown className="ml-2 h-4 w-4" />
      )}
      {columnControlMenu()}
    </div>
  );
}

export function get_columns(
  userId: number,
  playlistId: number,
  purpose: TablePurpose,
): ColumnDef<Tune, TunesGridColumnGeneralType>[] {
  const determineHeaderCheckedState = (
    table: TanstackTable<Tune>,
  ): CheckedState => {
    const rowSelection = table.getState().rowSelection;
    const allSelected =
      Object.keys(rowSelection).length === table.getRowCount();
    const noneSelected = Object.keys(rowSelection).length === 0;
    return allSelected ? true : noneSelected ? false : "indeterminate";
  };

  // const saveTableState = async (
  //   table: TanstackTable<Tune>,
  //   user_id: string,
  //   table_purpose: TablePurpose,
  //   currentTune: number | null,
  // ) => {
  //   const tableState: TableState = table.getState();

  //   try {
  //     const response = await createOrUpdateTableState(
  //       Number.parseInt(user_id),
  //       "full",
  //       table_purpose,
  //       tableState,
  //       currentTune,
  //     );
  //     // Handle the response as needed
  //     console.log("Server response:", response);
  //     return response;
  //   } catch (error) {
  //     console.error("Error calling server function:", error);
  //     return null;
  //   } finally {
  //     // setIsLoading(false);
  //   }
  // };

  const updateTableState = async (
    table: TanstackTable<Tune>,
    user_id: string,
    table_purpose: TablePurpose,
  ) => {
    const tableState: TableState = table.getState();
    let currentTune = -1;
    getTableCurrentTune(Number(user_id), "full", table_purpose)
      .then((result) => {
        currentTune = result;
      })
      .catch((error) => {
        console.error("Error getTableCurrentTune:", error);
        throw error;
      });
    try {
      const response = await createOrUpdateTableState(
        Number.parseInt(user_id),
        "full",
        table_purpose,
        tableState,
        currentTune,
      );
      // Handle the response as needed
      console.log("Server response:", response);
      return response;
    } catch (error) {
      console.error("Error calling server function:", error);
      throw error;
    } finally {
      // setIsLoading(false);
    }
  };

  const handleHeaderCheckboxChange = (
    checked: boolean | string,
    table: TanstackTable<Tune>,
  ) => {
    const checkedResolved =
      typeof checked === "string" ? checked === "true" : checked;

    // setIsAllChecked(checkedResolved);
    table.toggleAllRowsSelected(checkedResolved);

    if (!checkedResolved) {
      table.getState().rowSelection = {};
    } else {
      const rowSelection = table.getState().rowSelection;
      for (let i = 0; i < table.getRowCount(); i++) {
        const row = table.getRow(i.toString());
        rowSelection[row.id] = true;
      }
      table.getState().rowSelection = rowSelection;
    }
    const rowSelection = table.getState().rowSelection;
    console.log("rowSelection: ", rowSelection);
    const result = updateTableState(table, userId.toString(), purpose);
    result
      .then((result) => {
        console.log(
          "-> handleHeaderCheckboxChange - saveTableState result: ",
          result,
        );
      })
      .catch((error) => {
        console.error(
          "handleHeaderCheckboxChange - Error saveTableState: ",
          error,
        );
        throw error;
      });
  };

  // const isIndeterminate = () => {
  //   const data = useTableDataFromContext();

  //   data && checkedItems.length > 0 && checkedItems.length < data.length;
  // };

  function selectionHeader<TData, TValue>(
    column: Column<TData, TValue>,
    table: TanstackTable<Tune>,
  ) {
    // console.log("column: ", column);
    return (
      <Checkbox
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

  function refreshHeader(info: CellContext<Tune, TunesGridColumnGeneralType>) {
    // Ugly trick to force a refresh of the header
    info.table.getColumn(info.column.id)?.toggleVisibility();
    info.table.getColumn(info.column.id)?.toggleVisibility();
  }

  function RowSelectedCheckBox(
    info: CellContext<Tune, TunesGridColumnGeneralType>,
    userId: number,
    playlistId: number,
    purpose: TablePurpose,
  ) {
    const handleItemCheckboxChange = () => {
      console.log(
        `-> handleItemCheckboxChange - row.id: ${info.row.id}, ${JSON.stringify(info.table.getState().rowSelection)}`,
      );
      refreshHeader(info);

      info.row.toggleSelected();
      const rowSelection = { ...info.table.getState().rowSelection };
      rowSelection[info.row.id] =
        rowSelection[info.row.id] === undefined
          ? true
          : !rowSelection[info.row.id];

      for (const key in rowSelection) {
        if (!rowSelection[key]) {
          delete rowSelection[key];
        }
      }
      info.table.getState().rowSelection = rowSelection;

      console.log(
        `<- handleItemCheckboxChange - row.id: ${info.row.id}, ${JSON.stringify(info.table.getState().rowSelection)}`,
      );
      const promise = updateTableState(info.table, userId.toString(), purpose);
      promise
        .then((result) => {
          console.log(
            "handleItemCheckboxChange - saveTableState result: ",
            result,
          );
        })
        .catch((error) => {
          console.error(
            "handleItemCheckboxChange - Error saveTableState: ",
            error,
          );
        });
    };

    return (
      <Checkbox
        checked={info.row.getIsSelected()}
        onCheckedChange={handleItemCheckboxChange}
      />
    );
  }

  return [
    {
      id: "id",
      // header: ({ column }) => sortableHeader(column, "Id"),
      header: ({ column }) => sortableHeader(column, "Id"),
      cell: (info: CellContext<Tune, TunesGridColumnGeneralType>) => {
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
      size: 20,
    },
    "practice" === purpose
      ? {
          accessorKey: "recall_eval",
          header: ({ column }) => sortableHeader(column, "Evaluation"),
          enableHiding: false,
          cell: (info: CellContext<Tune, TunesGridColumnGeneralType>) =>
            RecallEvalComboBox(info, userId, playlistId, purpose),
          accessorFn: (row) => row.recall_eval,
        }
      : {
          accessorKey: "select",
          header: ({ column, table }) => selectionHeader(column, table),
          enableHiding: false,
          cell: (info: CellContext<Tune, TunesGridColumnGeneralType>) =>
            RowSelectedCheckBox(info, userId, playlistId, purpose),
          accessorFn: () => null, // Return null since we don't need a value
          meta: {
            type: "boolean", // Set the type to boolean for consistency
          },
        },
    {
      accessorKey: "title",
      header: ({ column }) => sortableHeader(column, "Title"),
      cell: (info: CellContext<Tune, TunesGridColumnGeneralType>) => {
        const favoriteUrl = info.row.original.favorite_url;
        return favoriteUrl ? (
          <a
            href={favoriteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 underline hover:text-blue-700"
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
      size: 400,
    },
    {
      accessorKey: "type",
      header: ({ column }) => sortableHeader(column, "Type"),
      cell: (info) => {
        return info.getValue();
      },
      enableSorting: true,
      enableHiding: true,
    },
    {
      accessorKey: "structure",
      header: ({ column }) => sortableHeader(column, "Structure"),
      cell: (info) => {
        return info.getValue();
      },
      enableSorting: true,
      enableHiding: true,
    },
    {
      accessorKey: "mode",
      header: ({ column }) => sortableHeader(column, "Mode"),
      cell: (info) => {
        return info.getValue();
      },
      enableSorting: true,
      enableHiding: true,
    },
    {
      accessorKey: "incipit",
      header: ({ column }) => sortableHeader(column, "Incipit"),
      cell: (info) => {
        return info.getValue();
      },
      enableSorting: true,
      enableHiding: true,
    },
    {
      accessorKey: "learned",
      header: ({ column }) => sortableHeader(column, "Learned"),
      cell: (info) => {
        return info.getValue();
      },
      enableSorting: true,
      enableHiding: true,
      sortingFn: datetimeTextSortingFn,
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
      header: "External Ref",
      cell: (info: CellContext<Tune, TunesGridColumnGeneralType>) => {
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
      header: "Notes",
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
  ];
}
