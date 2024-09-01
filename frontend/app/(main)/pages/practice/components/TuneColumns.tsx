"use client";

import RecallEvalComboBox from "@/app/(main)/pages/practice/components/RecallEvalComboBox";
import type { Tune } from "../types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CellContext, Column, ColumnDef } from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Columns,
  EyeOff,
  Filter,
} from "lucide-react";

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

function sortableHeader<TData, TValue>(
  column: Column<TData, TValue>,
  title: string,
) {
  // console.log("column: ", column);
  const is_sorted = column.getIsSorted();
  return (
    <div
      className="flex items-center"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      onKeyDown={() => {}}
      onKeyUp={() => {}}
      onKeyPress={() => {}}
    >
      {title}
      {is_sorted === "asc" ? (
        <ArrowUp className="ml-2 h-4 w-4" />
      ) : (
        <ArrowDown className="ml-2 h-4 w-4" />
      )}
      {columnControlMenu()}
    </div>
  );
}

const columns: ColumnDef<Tune>[] = [
  {
    id: "id",
    // header: ({ column }) => sortableHeader(column, "Id"),
    header: "Id",
    cell: (info: CellContext<Tune, string>) => {
      // return info.getValue();
      if (!info.row.original?.external_ref) {
        return (
          <a
            href={`https://www.irishtune.info/tune/${info.row.original.id}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 underline"
          >
            {info.row.original.id}
          </a>
        );
      }
      return info.row.original.id;
    },

    enableSorting: true,
    enableHiding: true,
    size: 20,
  },
  {
    accessorKey: "title",
    header: ({ column }) => sortableHeader(column, "Title"),
    cell: (info: CellContext<Tune, string>) => {
      return info.getValue();
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
  },
  {
    accessorKey: "practiced",
    header: ({ column }) => sortableHeader(column, "Practiced"),
    cell: (info) => {
      return info.getValue();
    },
    enableSorting: true,
    enableHiding: true,
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
  },
  {
    accessorKey: "backup_practiced",
    header: "Backup Practiced",
    cell: (info) => {
      return info.getValue();
    },
    enableSorting: true,
    enableHiding: true,
  },
  {
    accessorKey: "external_ref",
    header: "External Ref",
    cell: (info: CellContext<Tune, string>) => {
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
  {
    accessorKey: "notes_private",
    header: "Private Note",
    cell: (info) => {
      return info.getValue();
    },
    enableSorting: true,
    enableHiding: true,
  },
  {
    accessorKey: "note_public",
    header: "Public Note",
    cell: (info) => {
      return info.getValue();
    },
    enableSorting: true,
    enableHiding: true,
  },
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
    accessorKey: "recallEval",
    header: "Recall Evaluation",
    enableHiding: false,
    cell: RecallEvalComboBox,
  },
];

export function get_columns(): ColumnDef<Tune>[] {
  return columns;
}
