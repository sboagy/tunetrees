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
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getColorForEvaluation,
  getQualityListForGoalAndTechnique,
} from "../quality-lists";
import {
  createOrUpdateTableTransientData,
  deleteTableTransientData,
} from "../settings";
import type {
  ITuneOverview,
  TablePurpose,
  TunesGridColumnGeneralType,
} from "../types";
import { useRowRecallEvalPopoverContext } from "./RowRecallEvalPopoverContext";

// #     Quality: The quality of recalling the answer from a scale of 0 to 5.
// #         5: perfect response.
// #         4: correct response after a hesitation.
// #         3: correct response recalled with serious difficulty.
// #         2: incorrect response; where the correct one seemed easy to recall.
// #         1: incorrect response; the correct one remembered.
// #         0: complete blackout.

type RecallEvalComboBoxProps = {
  info: CellContext<ITuneOverview, TunesGridColumnGeneralType>;
  userId: number;
  playlistId: number;
  purpose: TablePurpose;
  onRecallEvalChange?: (tuneId: number, newValue: string) => void;
};

export function RecallEvalComboBox(props: RecallEvalComboBoxProps) {
  const [isMounted, setIsMounted] = useState(false);
  const { info, userId, playlistId, purpose, onRecallEvalChange } = props;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isDisabled = onRecallEvalChange && !isMounted;

  // const [isOpen, setIsOpen] = useState(false);
  const { openPopoverId, setOpenPopoverId } = useRowRecallEvalPopoverContext();
  const isOpen = openPopoverId === info.row.original.id;

  const popoverRef = useRef<HTMLDivElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [selectedQuality, setSelectedQuality] = useState<string | null>(
    info.row.original.recall_eval ?? null,
  );

  // Debounced popover state change to prevent bouncing
  const debouncedSetPopoverId = useCallback(
    (id: number | null) => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      debounceTimeoutRef.current = setTimeout(() => {
        setOpenPopoverId(id);
        debounceTimeoutRef.current = null;
      }, 50); // 50ms debounce to prevent rapid state changes
    },
    [setOpenPopoverId],
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  // Get appropriate quality list based on goal and technique
  const qualityList = getQualityListForGoalAndTechnique(
    info.row.original.goal,
    info.row.original.latest_technique,
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
      alert("Failed to save state. Please try again.");
    }
  };

  const handleBlur = (event: React.FocusEvent<HTMLButtonElement>) => {
    if (popoverRef.current === null) {
      return;
    }
    if (!popoverRef.current.contains(event.relatedTarget as Node)) {
      // Use debounced function to prevent rapid state changes
      debouncedSetPopoverId(null);
    }
  };

  return (
    <Popover
      open={isOpen}
      onOpenChange={(open) =>
        debouncedSetPopoverId(open ? (info.row.original.id ?? null) : null)
      }
      data-testid="tt-recal-eval-popover"
    >
      <PopoverTrigger
        asChild
        className={`w-[9em] sm:w-[18em] h-[2em] justify-between whitespace-nowrap overflow-hidden text-ellipsis  ${getColorForEvaluation(
          selectedQuality ?? null,
          qualityList,
          true,
        )}`}
        style={{
          textAlign: "left",
        }}
        onClick={(event) => {
          event.stopPropagation(); // Prevents the click from reaching the TableRow
          // Use debounced function to prevent rapid state changes
          debouncedSetPopoverId(isOpen ? null : (info.row.original.id ?? null));
        }}
        onBlur={handleBlur}
        disabled={isDisabled}
        data-testid="tt-recal-eval-popover-trigger"
      >
        <div className="flex justify-between items-center">
          <span className="truncate ml-[1em]">
            {selectedQuality
              ? qualityList.find((q) => q.value === selectedQuality)?.label2
              : "Recall Quality..."}
          </span>
          <ChevronDownIcon className="w-5 h-5 text-gray-500" />
        </div>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        data-testid="tt-recal-eval-popover-content"
        ref={popoverRef}
      >
        <Command>
          <CommandList className="max-h-none">
            <CommandEmpty>Recall Eval...</CommandEmpty>
            <CommandGroup data-testid="tt-recal-eval-group-menu">
              {qualityList.map((qualityFeedbackItem) => (
                <CommandItem
                  className="flex items-left"
                  key={qualityFeedbackItem.value}
                  data-testid={`tt-recal-eval-${qualityFeedbackItem.value}`}
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

                    // Close popover immediately to prevent bouncing
                    setOpenPopoverId(null);

                    // Update state optimistically
                    setSelectedQuality(newValue);
                    info.row.original.recall_eval = newValue;

                    console.log(
                      `===> RowRecallEvalComboBox.tsx:206 ~ calling saveDate(${newValue})`,
                    );

                    // Save data with minimal state updates to prevent bouncing
                    saveData(newValue)
                      .then(() => {
                        if (onRecallEvalChange) {
                          onRecallEvalChange(
                            info.row.original.id ?? -1,
                            newValue,
                          );
                        }
                        // Removed table state refresh that was causing bouncing
                      })
                      .catch((error) => {
                        console.error(
                          "===> RowRecallEvalComboBox.tsx:216 ~ error",
                          error,
                        );
                        // Revert optimistic update on error
                        setSelectedQuality(
                          info.row.original.recall_eval ?? null,
                        );
                      });
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
