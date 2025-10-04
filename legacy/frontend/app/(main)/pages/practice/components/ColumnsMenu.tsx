"use client";

import type { CheckedState } from "@radix-ui/react-checkbox";
import type { Table } from "@tanstack/react-table";
import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logVerbose } from "@/lib/logging";
import type { ITuneOverview, TablePurpose } from "../types";
import type { IColumnMeta } from "./TuneColumns";

const ColumnsMenu = ({
  table,
}: {
  user_id: number;
  tablePurpose: TablePurpose;
  playlistId: number;
  table: Table<ITuneOverview>;
  triggerRefresh: () => void;
}) => {
  // Local tick to force a re-render when table visibility changes so checkbox states stay in sync
  const [renderTick, setRenderTick] = useState(0);
  // Control the Radix Dropdown open state so we can deterministically close after a toggle
  const [open, setOpen] = useState(false);

  // (removed isClient usage; we now always render an accessible label with sr-only)

  // Re-render this menu when column visibility changes elsewhere (e.g., from table interceptors)
  useEffect(() => {
    const handler = () => setRenderTick((t) => t + 1);
    if (typeof window !== "undefined") {
      window.addEventListener("tt-visibility-changed", handler);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("tt-visibility-changed", handler);
      }
    };
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
    return (checked: CheckedState) => {
      // Radix passes CheckedState: true | false | "indeterminate". Only true means visible.
      const nextVisible = checked === true;
      logVerbose("toggleVisibility (requested)", checked);
      const column = table.getColumn(columnId);
      if (column) {
        logVerbose("toggleVisibility (before)", column.getIsVisible());
        // Use the column API so TanStack resolves the full visibility state and triggers onColumnVisibilityChange
        column.toggleVisibility(nextVisible);
        logVerbose("LF7: Column visibility updated to:", nextVisible);
        // Immediately bump a tick so the menu reflects the new checked state without waiting for external events
        setRenderTick((t) => t + 1);
        // Close the menu after a selection so subsequent test clicks on the trigger will re-open it reliably
        setOpen(false);
        // Persistence is handled centrally by TunesTable interceptors (onColumnVisibilityChange)
        // which route through the in-memory cache with immediate flush. Avoid direct backend calls
        // or forced refreshes here to prevent double-writes and hydration races.
      } else {
        logVerbose("column not found", columnId);
      }
    };
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="ml-auto relative z-[60]"
          aria-label="Columns"
          title="Columns"
          type="button"
          data-testid="tt-columns-menu-trigger"
        >
          Columns
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="bottom"
        sideOffset={10}
        collisionPadding={8}
        data-render-tick={renderTick}
      >
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
