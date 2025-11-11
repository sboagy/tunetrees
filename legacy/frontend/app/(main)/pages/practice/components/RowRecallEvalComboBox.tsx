import type { CellContext } from "@tanstack/react-table";
import { Check, ChevronDownIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { logVerbose } from "@/lib/logging";
// Staging now uses scheduling-aware practice feedback path (stage=true) so
// we intentionally stop using the generic transient settings helpers that
// only persisted recall_eval. This ensures algorithm-derived fields (quality,
// interval, etc.) are populated in table_transient_data and surfaced via the
// practice_list_staged view.
import {
  clearStagedPracticeFeedback,
  stagePracticeFeedback,
} from "../commands";
import {
  getColorForEvaluation,
  getQualityListForGoalAndTechnique,
} from "../quality-lists";
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
  readOnly?: boolean;
};

export function RecallEvalComboBox(props: RecallEvalComboBoxProps) {
  const [isMounted, setIsMounted] = useState(false);
  const { info, playlistId, onRecallEvalChange, readOnly } = props;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isDisabled = !!readOnly || (!!onRecallEvalChange && !isMounted);

  // const [isOpen, setIsOpen] = useState(false);
  const { openPopoverId, setOpenPopoverId } = useRowRecallEvalPopoverContext();
  const isOpen = openPopoverId === info.row.original.id;

  const popoverRef = useRef<HTMLDivElement>(null);
  const [selectedQuality, setSelectedQuality] = useState<string | null>(
    info.row.original.recall_eval ?? null,
  );

  // Directly control open state for predictability in tests and headless
  const setOpenDirect = useCallback(
    (open: boolean) => {
      setOpenPopoverId(open ? (info.row.original.id ?? null) : null);
    },
    [info.row.original.id, setOpenPopoverId],
  );

  // Get appropriate quality list based on goal and technique
  const qualityList = getQualityListForGoalAndTechnique(
    info.row.original.goal,
    info.row.original.latest_technique,
  );

  const saveData = async (changed_value: string) => {
    if (!changed_value) {
      // Attempt backend clear if available; ignore failure (local state already cleared).
      void clearStagedPracticeFeedback(playlistId, info.row.original.id ?? 0);
      return;
    }
    try {
      // Map recall_eval selection directly to feedback string expected by
      // stagePracticeFeedback. (Values already aligned: 0-5 quality labels.)
      // Retrieve or derive sitdown date. We prefer a data attribute on body
      // (set by parent container). Fallback: now UTC.
      let sitdownDate: Date | null = null;
      const attr = document.body.getAttribute("data-sitdown-iso");
      if (attr) {
        const d = new Date(attr);
        if (!Number.isNaN(d.getTime())) sitdownDate = d;
      }
      if (!sitdownDate) sitdownDate = new Date();

      const success = await stagePracticeFeedback(
        playlistId,
        info.row.original.id ?? 0,
        changed_value,
        sitdownDate,
        info.row.original.goal ?? null,
      );
      if (!success) {
        throw new Error("stagePracticeFeedback returned false");
      }
      logVerbose(
        `Staged practice feedback '${changed_value}' for tune ${info.row.original.id}`,
      );
    } catch (error) {
      console.error("RecallEval staging failure:", error);
      alert("Failed to stage practice feedback. Please retry.");
    }
  };

  // Avoid blur-driven close; let Radix onOpenChange manage lifecycle
  const handleBlur = () => {};

  return (
    <Popover
      open={readOnly ? false : isOpen}
      onOpenChange={readOnly ? undefined : setOpenDirect}
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
          // Do not toggle here; Popover will call onOpenChange for us
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
        // Prevent auto-focus bounce on open which can trigger immediate blur close
        onOpenAutoFocus={(e) => e.preventDefault()}
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
                    logVerbose(
                      "===> RowRecallEvalComboBox.tsx:171 ~ onSelect - currentValue: ",
                      currentValue,
                    );

                    const newValue =
                      currentValue === info.row.original.recall_eval
                        ? ""
                        : currentValue === qualityList[0].label2
                          ? ""
                          : currentValue;

                    logVerbose(
                      "===> RowRecallEvalComboBox.tsx:183 ~ onSelect - newValue: ",
                      newValue,
                    );

                    // Close popover immediately to prevent bouncing
                    setOpenPopoverId(null);

                    // Update state optimistically
                    setSelectedQuality(newValue);
                    info.row.original.recall_eval = newValue;

                    logVerbose(
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
