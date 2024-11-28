"use client";

import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Table } from "@tanstack/react-table";
import { useEffect, useState } from "react";
import type { TuneOverview } from "../types";

const ColumnsMenu = ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  user_id,
  table,
  triggerRefresh,
}: {
  user_id: number;
  table: Table<TuneOverview>;
  triggerRefresh: () => void;
}) => {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    const columns = table.getAllColumns();
    for (const column of columns) {
      const col = table.getColumn(column.id);
      if (col) {
        console.log(`Column ${column.id} visibility:`, col.getIsVisible());
      }
    }
  }, [table]);

  function handleCheckedChange(columnId: string) {
    return (value: boolean) => {
      console.log("toggleVisibility (requested)", value);
      const column = table.getColumn(columnId);
      if (column) {
        console.log("toggleVisibility (before)", column.getIsVisible());
        column.toggleVisibility(value);
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
            return (
              <DropdownMenuCheckboxItem
                key={column.id}
                className="capitalize"
                checked={column.getIsVisible()}
                onCheckedChange={handleCheckedChange(column.id)}
              >
                {column.id}
              </DropdownMenuCheckboxItem>
            );
          })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ColumnsMenu;
