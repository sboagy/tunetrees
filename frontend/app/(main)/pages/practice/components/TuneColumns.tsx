import { CellContext, ColumnDef } from "@tanstack/react-table";
import { Tune } from "@/app/(main)/pages/practice/types";
import RecallEvalComboBox from "@/app/(main)/pages/practice/components/RecallEvalComboBox";
import { ArrowUpDown } from "lucide-react";

function sortableHeader(column: any, title: string) {
  console.log("column: ", column);
  return (
    <div
      className="flex items-center"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {title}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </div>
  );
}

export const columns: ColumnDef<Tune>[] = [
  {
    id: "id",
    // header: ({ column }) => sortableHeader(column, "Id"),
    header: "Id",
    cell: (info: CellContext<Tune, unknown>) => {
      return info.row.original.id;
    },
    enableSorting: true,
    enableHiding: true,
    size: 20,
  },
  {
    accessorKey: "title",
    header: ({ column }) => sortableHeader(column, "Title"),
    cell: (info) => {
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
    header: "Review Date",
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
    accessorKey: "note_private",
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
    id: "recallEval",
    header: "Recall Evaluation",
    enableHiding: false,
    cell: RecallEvalComboBox,
  },
];
