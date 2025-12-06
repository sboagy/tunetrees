"use client";

import type {
  CellContext,
  Table as TanstackTable,
} from "@tanstack/react-table";
import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  getQualityListForGoalAndTechnique,
  lookupQualityItem,
} from "../quality-lists";
import { updateCurrentTuneInDb } from "../settings";
import type { ITuneOverview, TablePurpose } from "../types";
import { useTune } from "./CurrentTuneContext";
import RecallEvalComboBox from "./RowRecallEvalComboBox";

function getCellContext(
  table: TanstackTable<ITuneOverview>,
  userId: number,
  playlistId: number,
  purpose: TablePurpose,
  tableIndex: number,
): CellContext<ITuneOverview, string> {
  // const row = table.getRow(tableIndex.toString());
  const row = table.getRowModel().rows[tableIndex];
  const cells = row.getAllCells();
  const cell = cells.find((cell) => cell.column.id === "recall_eval");

  if (!cell) {
    throw Error("Cell not found");
  }

  return cell.getContext() as CellContext<ITuneOverview, string>;
}

type Props = {
  table: TanstackTable<ITuneOverview>;
  userId: number;
  playlistId: number;
  purpose: TablePurpose;
  onRecallEvalChange?: (tuneId: number, newValue: string) => void;
};

export default function FlashcardPanel(props: Props) {
  const table = props.table;
  const [isClient, setIsClient] = useState(false);
  useEffect(() => setIsClient(true), []);
  const { setCurrentTune, setCurrentTablePurpose } = useTune();
  // Derive columns from the TanStack table so labels match grid headers
  const leafColumns = useMemo(
    () => table.getAllLeafColumns().filter((c) => c.id !== "select"),
    [table],
  );
  const getHeaderLabel = (colId: string): string => {
    const col = leafColumns.find((c) => c.id === colId);
    // Prefer meta.headerLabel set in grid column defs
    const metaLabel = (col?.columnDef as { meta?: { headerLabel?: string } })
      ?.meta?.headerLabel;
    if (metaLabel) return metaLabel;
    // Fall back to static string header, otherwise the id
    const header = col?.columnDef.header;
    if (typeof header === "string" && header.length > 0) {
      return header;
    }
    return colId;
  };
  // Default visibility aligned to prior behavior but keyed by column ids
  const defaultVisible = useMemo(() => {
    const defaults = new Set([
      "title",
      "type",
      "latest_practiced",
      "external_ref",
      "recall_eval",
    ]);
    return leafColumns.reduce<Record<string, boolean>>((acc, c) => {
      acc[c.id] = defaults.has(c.id);
      return acc;
    }, {});
  }, [leafColumns]);
  const [visibleFields, setVisibleFields] =
    useState<Record<string, boolean>>(defaultVisible);

  const [tableIndex, setTableIndex] = useState<number>(0);

  const onPrevious = () => {
    setTableIndex((prevIndex) => Math.max(prevIndex - 1, 0));
  };

  const onNext = () => {
    setTableIndex((prevIndex) =>
      Math.min(prevIndex + 1, table.getRowCount() - 1),
    );
  };

  const toggleField = (field: string) => {
    setVisibleFields((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  // Keep side panel (current tune) synchronized with flashcard selection
  useEffect(() => {
    const row = table.getRowModel().rows[tableIndex];
    const tuneId = row?.original?.id;
    if (!tuneId) return;
    setCurrentTune(tuneId);
    setCurrentTablePurpose(props.purpose);
    void updateCurrentTuneInDb(
      props.userId,
      "full",
      props.purpose,
      props.playlistId,
      tuneId,
    );
    // Optionally scroll the grid to this tune if helper is present
    try {
      (
        window as unknown as {
          scrollToTuneById?: (id: number) => void;
        }
      ).scrollToTuneById?.(tuneId);
    } catch {
      // ignore
    }
  }, [
    table,
    tableIndex,
    setCurrentTune,
    setCurrentTablePurpose,
    props.userId,
    props.playlistId,
    props.purpose,
  ]);

  if (table.getRowCount() === 0) {
    return (
      <Card className="w-full max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>No tunes to review</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Tune Flashcard</CardTitle>
        <div className="flex justify-between items-center">
          <Button onClick={onPrevious} disabled={Number(tableIndex) <= 0}>
            Previous
          </Button>
          {(() => {
            const rowOriginal = table.getRowModel().rows[tableIndex]?.original;
            const completed = Boolean(rowOriginal?.completed_at);
            const qualityList = getQualityListForGoalAndTechnique(
              rowOriginal?.goal,
              rowOriginal?.latest_technique,
            );
            // Derive display label similar to grid cell logic
            let label = "(Not Set)";
            const stored = rowOriginal?.recall_eval;
            if (stored) {
              label =
                qualityList.find((q) => q.value === stored)?.label2 ?? stored;
            } else {
              const latestQuality = rowOriginal?.latest_quality;
              const latestEasiness = rowOriginal?.latest_easiness;
              if (latestQuality !== null && latestQuality !== undefined) {
                const found = lookupQualityItem(latestQuality, qualityList);
                if (found) label = found.label2;
              } else if (
                latestEasiness !== null &&
                latestEasiness !== undefined
              ) {
                const rounded = Math.round(latestEasiness);
                const found = lookupQualityItem(rounded, qualityList);
                if (found) label = found.label2;
              }
            }

            if (completed) {
              return (
                <div
                  className="truncate"
                  title={label}
                  data-testid={`tt-recal-eval-static-${rowOriginal?.id}`}
                >
                  {label}
                </div>
              );
            }
            return (
              <RecallEvalComboBox
                key={tableIndex}
                info={getCellContext(
                  props.table,
                  props.userId,
                  props.playlistId,
                  props.purpose,
                  tableIndex,
                )}
                userId={props.userId}
                playlistId={props.playlistId}
                purpose={props.purpose}
                onRecallEvalChange={props.onRecallEvalChange}
                readOnly={false}
              />
            );
          })()}
          <Button
            onClick={onNext}
            disabled={Number(tableIndex) >= table.getRowCount() - 1}
          >
            Next
          </Button>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="ml-auto">
              {isClient && (window.innerWidth < 768 ? "" : "Columns")}
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {leafColumns
              .filter((col) => col.getCanHide?.() ?? true)
              .map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  className="capitalize"
                  checked={Boolean(visibleFields[col.id])}
                  onCheckedChange={() => toggleField(col.id)}
                  data-testid={`flashcard-toggle-${col.id}`}
                >
                  {getHeaderLabel(col.id)}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          {leafColumns.map((col) => {
            if (!visibleFields[col.id]) return null;
            const row = table.getRowModel().rows[tableIndex];
            const original = row?.original as ITuneOverview | undefined;
            const fromGetter = row?.getValue ? row.getValue(col.id) : undefined;
            const key = col.id as keyof ITuneOverview;
            const fromOriginal = original ? original[key] : undefined;
            const raw = fromGetter !== undefined ? fromGetter : fromOriginal;
            let display: string;
            if (raw === null || raw === undefined) {
              display = "N/A";
            } else if (
              typeof raw === "string" ||
              typeof raw === "number" ||
              typeof raw === "boolean"
            ) {
              display = String(raw);
            } else {
              try {
                display = JSON.stringify(raw);
              } catch {
                display = "[unserializable]";
              }
            }
            return (
              <div key={col.id} className="flex flex-col space-y-1.5">
                <Label htmlFor={col.id}>{getHeaderLabel(col.id)}</Label>
                <div id={col.id} className="bg-muted p-2 rounded-md">
                  {display}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <div className="flex items-center justify-end space-x-2 py-4">
          <div className="flex-1 text-sm text-muted-foreground">
            Showing review index {tableIndex} out of{" "}
            {table.getFilteredRowModel().rows.length - 1} scheduled.
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
