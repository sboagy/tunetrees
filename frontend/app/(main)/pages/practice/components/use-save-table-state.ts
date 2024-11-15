import { useEffect } from "react";
import type { TableState, Table as TanstackTable } from "@tanstack/react-table";
import { createOrUpdateTableState } from "../settings";
import type { TablePurpose, Tune } from "../types";

/**
 * Custom hook to save the state of a table when the user navigates away from the page.
 *
 * This hook sets up event listeners for `beforeunload` and `visibilitychange` events to ensure
 * that the table state is saved when the user closes the browser tab, switches to another application,
 * or navigates away from the current page. It also ensures that the state is saved when the component
 * is unmounted, such as when switching tabs within the application.
 */
export const useSaveTableState = (
  table: TanstackTable<Tune>,
  userId: number,
  tablePurpose: TablePurpose,
  currentTune: number | null,
) => {
  useEffect(() => {
    const saveTableStateAsync = (eventString: string) => {
      console.debug(
        `TunesGrid: calling createOrUpdateTableState in ${eventString} for tablePurpose: ${tablePurpose}`,
      );
      const tableState: TableState = table.getState();
      void createOrUpdateTableState(
        userId,
        "full",
        tablePurpose,
        tableState,
        currentTune,
      );
    };

    const handleBeforeUnload = () => {
      saveTableStateAsync("BeforeUnloadEvent");
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        saveTableStateAsync("VisibilityChangeEvent");
      }
    };

    if (typeof window !== "undefined") {
      // Global Event Handlers: The beforeunload and visibilitychange event handlers are
      // set up to handle global events such as closing the browser tab or switching
      // to another application.
      console.debug(
        "TunesGrid: adding beforeunload and visibilitychange event listeners for tablePurpose: ",
        tablePurpose,
      );
      window.addEventListener("beforeunload", handleBeforeUnload);
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      if (typeof window !== "undefined") {
        console.debug(
          "TunesGrid: removing handleBeforeUnload for tablePurpose: ",
          tablePurpose,
        );
        window.removeEventListener("beforeunload", handleBeforeUnload);
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange,
        );
      }

      // Component Cleanup: The component's cleanup function in the useEffect hook ensures
      // that the state is saved when the component is unmounted, which happens when
      // switching tabs within the app.
      saveTableStateAsync("cleanup");
    };
  }, [table, userId, tablePurpose, currentTune]);
};
