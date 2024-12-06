"use client";

import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Table, TableState } from "@tanstack/react-table";
import { useEffect, useState } from "react";
import { updateTableStateInDb } from "../settings";
import type { ITuneOverview, TablePurpose } from "../types";
import type { IColumnMeta } from "./TuneColumns";

const ColumnsMenu = ({
  user_id,
  tablePurpose,
  playlistId,
  table,
  triggerRefresh,
}: {
  user_id: number;
  tablePurpose: TablePurpose;
  playlistId: number;
  table: Table<ITuneOverview>;
  triggerRefresh: () => void;
}) => {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // useEffect(() => {
  //   const columns = table.getAllColumns();
  //   for (const column of columns) {
  //     const col = table.getColumn(column.id);
  //     if (col) {
  //       console.log(`Column ${column.id} visibility:`, col.getIsVisible());
  //     }
  //   }
  // }, [table]);

  function handleCheckedChange(columnId: string) {
    return (value: boolean) => {
      console.log("toggleVisibility (requested)", value);
      const column = table.getColumn(columnId);
      if (column) {
        console.log("toggleVisibility (before)", column.getIsVisible());
        column.toggleVisibility(value);
        console.log("LF7: Saving table state on filter change: ", value);
        // (See comment in TunesGridRepertoire.tsx handleGlobalFilterChange)
        const tableState: TableState = table.getState();
        tableState.columnVisibility[columnId] = value;
        void updateTableStateInDb(
          user_id,
          "full",
          tablePurpose,
          playlistId,
          tableState,
        );

        triggerRefresh();
      } else {
        console.log("column not found", columnId);
      }
    };
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="ml-auto">
          {isClient && (window.innerWidth < 768 ? "" : "Columns")}
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {table
          .getAllColumns()
          .filter((column) => column.getCanHide())
          .map((column) => {
            const meta = column.columnDef.meta as IColumnMeta | undefined;

            const headerLabel =
              meta?.headerLabel ||
              // If headerLabel is not available, use the column ID or a default value
              (typeof column.columnDef.header === "string"
                ? column.columnDef.header
                : column.id);

            return (
              <DropdownMenuCheckboxItem
                key={column.id}
                className="capitalize"
                checked={column.getIsVisible()}
                onCheckedChange={handleCheckedChange(column.id)}
              >
                {headerLabel}
              </DropdownMenuCheckboxItem>
            );
          })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ColumnsMenu;
