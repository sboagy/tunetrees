import type { TableState, Table as TanstackTable } from "@tanstack/react-table";
import { useEffect } from "react";
import { createOrUpdateTableState } from "../settings";
import type { ITuneOverview, TablePurpose } from "../types";
import { useTune } from "./CurrentTuneContext";
import { tableStateCacheService } from "./table-state-cache";

/**
 * Custom hook to save the state of a table when the user navigates away from the page.
 *
 * This hook sets up event listeners for `beforeunload` and `visibilitychange` events to ensure
 * that the table state is saved when the user closes the browser tab, switches to another application,
 * or navigates away from the current page. It also ensures that the state is saved when the component
 * is unmounted, such as when switching tabs within the application.
 */
export const useSaveTableState = (
  table: TanstackTable<ITuneOverview>,
  userId: number,
  tablePurpose: TablePurpose,
  playlistId: number,
) => {
  const { currentTune } = useTune();
  useEffect(() => {
    const saveTableStateAsync = (eventString: string) => {
      console.debug(
        `LF6 useSaveTableState: calling immediate flush in ${eventString} for tablePurpose: ${tablePurpose}, currentTune=${currentTune}`,
      );
      const tableState: TableState = table.getState();
      console.log("===> use-save-table-state.ts:29 ~ ");
      // Use immediate flush for critical events
      void tableStateCacheService.flushImmediate(
        userId,
        tablePurpose,
        playlistId,
        tableState,
      );
    };

    const handleBeforeUnload = () => {
      console.log(
        "LF6 useSaveTableState handleBeforeUnload for tablePurpose: ",
        tablePurpose,
      );
      saveTableStateAsync("BeforeUnloadEvent");
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        console.log(
          "LF6 useSaveTableState handleVisibilityChange for tablePurpose: ",
          tablePurpose,
        );
        saveTableStateAsync("VisibilityChangeEvent");
      }
    };

    if (typeof window !== "undefined") {
      // Global Event Handlers: The beforeunload and visibilitychange event handlers are
      // set up to handle global events such as closing the browser tab or switching
      // to another application.
      console.debug(
        "LF6 TunesGrid: adding beforeunload and visibilitychange event listeners for tablePurpose: ",
        tablePurpose,
      );
      window.addEventListener("beforeunload", handleBeforeUnload);
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      if (typeof window !== "undefined") {
        console.debug(
          "LF6 TunesGrid: removing handleBeforeUnload for tablePurpose: ",
          tablePurpose,
        );
        window.removeEventListener("beforeunload", handleBeforeUnload);
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange,
        );
      }

      // Component Cleanup: Ensure any cached changes are flushed when component unmounts
      console.debug(
        "LF6 useSaveTableState cleanup for tablePurpose: ",
        tablePurpose,
      );
      // Flush any pending changes immediately on cleanup
      void tableStateCacheService.flushImmediate(
        userId,
        tablePurpose,
        playlistId,
        table.getState(),
      );
    };
  }, [table, userId, tablePurpose, playlistId, currentTune]);
};
