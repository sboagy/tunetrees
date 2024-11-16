import type { Table as TanstackTable } from "@tanstack/react-table";
import { useEffect, useRef } from "react";
import type { TablePurpose, Tune } from "../types";

/**
 * Custom hook to calculate and set the page size for a table based on the available container height.
 * It dynamically adjusts the page size whenever the window is resized.
 *
 * @remarks
 * This hook uses the `useEffect` hook to set up an event listener for window resize events.
 * It also uses a debounce function to limit the rate at which the resize handler is called.
 * The page size is calculated based on the height of various elements in the DOM and the average row height of the table.
 */
export const useCalculatePageSize = (
  table: TanstackTable<Tune>,
  tablePurpose: TablePurpose,
) => {
  const tableContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const calculatePageSize = (newHeight?: number) => {
      if (tableContainerRef.current) {
        const windowHeight = newHeight ?? window.innerHeight;
        // const mainContentHeight =
        //   document.querySelector("#main-content")?.clientHeight || 0;
        const headerHeight =
          document.querySelector("header")?.clientHeight || 0;
        const footerHeight =
          document.querySelector("footer")?.clientHeight || 0;

        // const mainContentHeight =
        //   newHeight ??
        //   (document.querySelector("#main-content")?.clientHeight || 0);
        const ttTabsHeight =
          document.querySelector("#tt-tabs")?.clientHeight || 0;
        const ttTunesGridHeader =
          document.querySelector("#tt-tunes-grid-header")?.clientHeight || 0;
        const ttTunesGridFooter =
          document.querySelector("#tt-tunes-grid-footer")?.clientHeight || 0;

        const ttToolbarSelector =
          tablePurpose === "practice"
            ? "#tt-scheduled-tunes-header"
            : "#tt-repertoire-tunes-header";

        const ttGridToolbarHeight =
          document.querySelector(ttToolbarSelector)?.clientHeight || 0;

        const containerHeight =
          windowHeight -
          headerHeight -
          footerHeight -
          ttTabsHeight -
          ttTunesGridHeader -
          ttGridToolbarHeight -
          ttTunesGridFooter -
          20;

        const rows = tableContainerRef.current.querySelectorAll("tr");
        let totalRowHeight = 0;
        for (const row of rows) {
          totalRowHeight += row.clientHeight;
        }
        const averageRowHeight = totalRowHeight / rows.length;

        let calculatedPageSize = Math.floor(containerHeight / averageRowHeight);
        if (calculatedPageSize * averageRowHeight > containerHeight) {
          calculatedPageSize -= 1;
        }
        const existingPagination = table.getState().pagination;
        table.setPagination({
          ...existingPagination,
          pageSize: calculatedPageSize,
        });

        // Force the table to recalculate its rows
        table.getRowModel();
      }
    };

    calculatePageSize();

    const debounce = (func: (event: UIEvent) => void, wait: number) => {
      let timeout: ReturnType<typeof setTimeout>;
      return (event: UIEvent): void => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(event), wait);
      };
    };

    const handleResize = debounce((event: UIEvent) => {
      const newHeight = (event.target as Window).innerHeight;
      calculatePageSize(newHeight);
    }, 200);

    if (typeof window !== "undefined") {
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
    return () => console.log("window is undefined");
  }, [table, tablePurpose]);

  return tableContainerRef;
};
