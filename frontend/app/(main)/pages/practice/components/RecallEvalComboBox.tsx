import { Check, ChevronsUpDown } from "lucide-react";
// RecallEvalRadioGroup.tsx
import React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import type { CellContext } from "@tanstack/react-table";

import type { TablePurpose, Tune } from "../types";
import { getColorForEvaluation } from "./TunesGrid";
import { createOrUpdateTableTransientData } from "../settings";

// #     Quality: The quality of recalling the answer from a scale of 0 to 5.
// #         5: perfect response.
// #         4: correct response after a hesitation.
// #         3: correct response recalled with serious difficulty.
// #         2: incorrect response; where the correct one seemed easy to recall.
// #         1: incorrect response; the correct one remembered.
// #         0: complete blackout.

const qualityList = [
  {
    value: "",
    label: "(Not Set)",
    label2: "(Not Set)",
    int_value: -1,
  },
  {
    value: "blackout",
    label: "Blackout (no recall, even with hint)",
    label2: "0: complete blackout",
    int_value: 0,
  },
  {
    value: "failed",
    label: "Failed (but remembered after hint)",
    label2: "1: incorrect response; the correct one remembered",
    int_value: 1,
  },
  {
    value: "barely",
    label: "Barely Remembered Some (perhaps A part but not B part)",
    label2:
      "2: incorrect response; where the correct one seemed easy to recall",
    int_value: 2,
  },
  {
    value: "struggled",
    label: "Remembered with Some Mistakes (and needed verification)",
    label2: "3: correct response recalled with serious difficulty",
    int_value: 3,
  },
  {
    value: "trivial",
    label: "Not Bad (but maybe not session ready)",
    label2: "4: correct response after a hesitation",
    int_value: 4,
  },
  {
    value: "perfect",
    label: "Good (could perform solo or lead in session)",
    label2: "5: perfect response",
    int_value: 5,
  },
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function RecallEvalComboBox(
  info: CellContext<Tune, string>,
  userId: number,
  playlistId: number,
  purpose: TablePurpose,
) {
  const saveData = async (changed_value: string) => {
    try {
      if (changed_value === "") {
        return;
      }
      await createOrUpdateTableTransientData(
        userId,
        info.row.original.id,
        playlistId,
        purpose,
        info.row.original.notes_private ?? null,
        info.row.original.notes_public ?? null,
        changed_value,
      );
      console.log("State saved:", changed_value);
    } catch (error) {
      console.error("Failed to save state:", error);
    }
    console.log("State saved:", changed_value);
  };

  // This simply isn't working.  I'm not sure why after a few hours of trying.
  // const [recallEvalValue, setRecallEvalValue] = React.useState<string>("");
  const [isOpen, setIsOpen] = React.useState(false);
  // const [, updateState] = React.useState({});
  // const [isUpdated, setIsUpdated] = React.useState(false);

  const forceClose = () => {
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          className={`w-[18em] h-[2em] justify-between text-ellipsis truncate:overflow-ellipsis ${getColorForEvaluation(info.row.original.recall_eval ?? null)}`}
          style={{
            textAlign: "left",
          }}
        >
          {/* This span is the only way I could get the overflow with ellipsis to work in  */
          /* the button.  Per suggestion from Stack Overflow. */}
          <span
            style={{
              width: "18em",
              overflow: "hidden",
              whiteSpace: "nowrap",
              display: "block",
              textAlign: "left",
              textWrap: "nowrap",
              textOverflow: "ellipsis",
            }}
          >
            {info.row.original.recall_eval
              ? qualityList.find(
                  (qualityList) =>
                    qualityList.value === info.row.original.recall_eval,
                )?.label2
              : "Recall Quality..."}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end">
        <Command>
          {/* <CommandInput placeholder="Recall Eval..." /> */}
          <CommandList>
            <CommandEmpty>Recall Eval...</CommandEmpty>
            <CommandGroup>
              {qualityList.slice(1).map((qualityList) => (
                <CommandItem
                  key={qualityList.value}
                  value={qualityList.value}
                  onSelect={(currentValue) => {
                    console.log(
                      "value, currentValue: ",
                      info.row.original.recall_eval,
                      currentValue,
                    );
                    const newValue =
                      currentValue === info.row.original.recall_eval
                        ? ""
                        : currentValue;
                    // setRecallEvalValue(newValue);

                    // setIsUpdated(!isUpdated);

                    info.row.original.recall_eval = newValue;

                    // This toggleSelected forces the row to re-render, maybe there's a better way?
                    // info.row.renderValue("recall_eval");
                    forceClose();

                    const selectedRowModels =
                      info.table.getSelectedRowModel().rowsById;
                    console.log("selectedRowModels: ", selectedRowModels);

                    for (const rowId in selectedRowModels) {
                      const rowModel = selectedRowModels[rowId];
                      rowModel.toggleSelected(false);
                    }

                    // for (let i = 0; i < nrows; i++) {
                    //   const cell = info.table.getSelectedRowModel(i));
                    //   cell.row.toggleSelected(false);
                    // }

                    // This will just update the button, but not the row.
                    // Leaving it here for reference, and also, maybe we shouldn't
                    // change the color of the entire row based on the recall_eval?
                    // updateState({});

                    // const original_selection_state = info.row.getIsSelected();
                    // info.row.toggleSelected(!original_selection_state);

                    const table_state = info.table.getState();
                    info.table.setState(table_state);

                    saveData(newValue);

                    // info.row.toggleSelected(original_selection_state);

                    // This toggleSelected hack forces the whole row to re-render.
                    // Maybe there's a better way?
                    // const original_selection_state = info.row.getIsSelected();
                    // info.row.toggleSelected();
                    // info.row.toggleSelected(original_selection_state);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      info.row.original.recall_eval === qualityList.value
                        ? "opacity-100"
                        : "opacity-0",
                    )}
                  />
                  {qualityList.label2}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
export default RecallEvalComboBox;
