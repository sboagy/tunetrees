"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

import type {
  CellContext,
  Table as TanstackTable,
} from "@tanstack/react-table";
import type { TablePurpose, Tune } from "../types";
import RecallEvalComboBox from "./RowRecallEvalComboBox";

function getCellContext(
  table: TanstackTable<Tune>,
  userId: number,
  playlistId: number,
  purpose: TablePurpose,
  tableIndex: number,
): CellContext<Tune, string> {
  const row = table.getRow(tableIndex.toString());
  const cells = row.getAllCells();
  const cell = cells.find((cell) => cell.column.id === "recall_eval");

  if (!cell) {
    throw Error("Cell not found");
  }

  return cell.getContext() as CellContext<Tune, string>;
}

type Props = {
  table: TanstackTable<Tune>;
  userId: number;
  playlistId: number;
  purpose: TablePurpose;
  onRecallEvalChange?: (tuneId: number, newValue: string) => void;
};

export default function FlashcardPanel(props: Props) {
  const table = props.table;

  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>({
    title: true,
    type: true,
    practiced: true,
    external_ref: true,
    recall_eval: true,
  });

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
          />
          <Button
            onClick={onNext}
            disabled={Number(tableIndex) >= table.getRowCount() - 1}
          >
            Next
          </Button>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">
              Show Fields <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="grid gap-4">
              {Object.keys(table.getRow(tableIndex.toString()).original).map(
                (field) => (
                  <div key={field} className="flex items-center space-x-2">
                    <Switch
                      id={`show-${field}`}
                      checked={visibleFields[field] || false}
                      onCheckedChange={() => toggleField(field)}
                    />
                    <Label htmlFor={`show-${field}`}>{field}</Label>
                  </div>
                ),
              )}
            </div>
          </PopoverContent>
        </Popover>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          {Object.entries(table.getRow(tableIndex.toString()).original).map(
            ([key, value]) =>
              visibleFields[key] && (
                <div key={key} className="flex flex-col space-y-1.5">
                  <Label htmlFor={key}>{key}</Label>
                  <div id={key} className="bg-muted p-2 rounded-md">
                    {value !== null ? value.toString() : "N/A"}
                  </div>
                </div>
              ),
          )}
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
