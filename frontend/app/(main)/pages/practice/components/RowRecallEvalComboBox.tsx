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
import { Check, ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import {
  createOrUpdateTableTransientData,
  deleteTableTransientData,
} from "../settings";
import type {
  ITuneOverview,
  TablePurpose,
  TunesGridColumnGeneralType,
} from "../types";
import { getColorForEvaluation } from "./TunesGrid";

// #     Quality: The quality of recalling the answer from a scale of 0 to 5.
// #         5: perfect response.
// #         4: correct response after a hesitation.
// #         3: correct response recalled with serious difficulty.
// #         2: incorrect response; where the correct one seemed easy to recall.
// #         1: incorrect response; the correct one remembered.
// #         0: complete blackout.

const qualityList = [
  {
    value: "(Not Set)",
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

type RecallEvalComboBoxProps = {
  info: CellContext<ITuneOverview, TunesGridColumnGeneralType>;
  userId: number;
  playlistId: number;
  purpose: TablePurpose;
  onRecallEvalChange?: (tuneId: number, newValue: string) => void;
};

export function RecallEvalComboBox(props: RecallEvalComboBoxProps) {
  const { info, userId, playlistId, purpose, onRecallEvalChange } = props;

  const [isOpen, setIsOpen] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState<string | null>(
    info.row.original.recall_eval ?? null,
  );

  const saveData = async (changed_value: string) => {
    try {
      // In the following, id may be omitted in the case of a new tune,
      // but I don't think it's ever undefined in this case?
      // But, keep an eye on it.
      if (changed_value) {
        console.log(
          "===> RowRecallEvalComboBox.tsx:103 ~ saveData - changed_value",
          changed_value,
        );
        await createOrUpdateTableTransientData(
          userId,
          info.row.original.id ?? 0,
          playlistId,
          purpose,
          null,
          null,
          changed_value,
        );
        console.log(
          `LF17 State saved: ${changed_value} for ${info.row.original.id}`,
        );
      } else {
        console.log(
          "===> RowRecallEvalComboBox.tsx:121 ~ saveData calling deleteTableTransientData",
        );
        await deleteTableTransientData(
          userId,
          info.row.original.id ?? 0,
          playlistId,
          purpose,
        );
        console.log(`LF17 State deleted for ${info.row.original.id}`);
      }
    } catch (error) {
      console.error("LF17 Failed to save state:", error);
    }
  };

  const forceClose = () => {
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`w-[9em] sm:w-[18em] h-[2em] justify-between whitespace-nowrap overflow-hidden text-ellipsis  ${getColorForEvaluation(
            selectedQuality ?? null,
            true,
          )}`}
          style={{
            textAlign: "left",
          }}
          onClick={(event) => {
            event.stopPropagation(); // Prevents the click from reaching the TableRow
            setIsOpen((prev) => !prev);
          }}
        >
          <div className="flex justify-between items-center">
            <span className="truncate ml-[1em]">
              {selectedQuality
                ? qualityList.find((q) => q.value === selectedQuality)?.label2
                : "Recall Quality..."}
            </span>
            <ChevronDownIcon className="w-5 h-5 text-gray-500" />
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end">
        <Command>
          <CommandList className="max-h-none">
            <CommandEmpty>Recall Eval...</CommandEmpty>
            <CommandGroup>
              {qualityList.map((qualityFeedbackItem) => (
                <CommandItem
                  className="flex items-left"
                  key={qualityFeedbackItem.value}
                  value={qualityFeedbackItem.value}
                  onSelect={(currentValue) => {
                    console.log(
                      "===> RowRecallEvalComboBox.tsx:171 ~ onSelect - currentValue: ",
                      currentValue,
                    );

                    const newValue =
                      currentValue === info.row.original.recall_eval
                        ? ""
                        : currentValue === qualityList[0].label2
                          ? ""
                          : currentValue;

                    console.log(
                      "===> RowRecallEvalComboBox.tsx:183 ~ onSelect - newValue: ",
                      newValue,
                    );
                    setSelectedQuality(newValue);
                    info.row.original.recall_eval = newValue;
                    if (onRecallEvalChange) {
                      onRecallEvalChange(info.row.original.id ?? -1, newValue); // Call the callback
                    }

                    const selectedRowModels =
                      info.table.getSelectedRowModel().rowsById;
                    for (const rowId in selectedRowModels) {
                      const rowModel = selectedRowModels[rowId];
                      rowModel.toggleSelected(false);
                    }

                    const tableState = info.table.getState();
                    info.table.setState(tableState);

                    console.log(
                      `===> RowRecallEvalComboBox.tsx:206 ~ calling saveDate(${newValue})`,
                    );
                    void saveData(newValue);
                    forceClose();
                  }}
                >
                  {info.row.original.recall_eval ===
                    qualityFeedbackItem.value && (
                    <Check className="absolute left-0 mr-2 h-4 w-4 opacity-100" />
                  )}
                  <span className="ml-6">
                    {qualityFeedbackItem.label2.trim()}
                  </span>
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
