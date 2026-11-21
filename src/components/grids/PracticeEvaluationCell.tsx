import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import { ChevronDown } from "lucide-solid";
import { Show } from "solid-js";
import type { PracticeEvaluationModel } from "../../lib/goals/practice-session";
import { Button } from "../ui/button";
import {
  type EvaluationDisplayInput,
  getSubmittedEvaluationDisplay,
} from "./evaluation-display";
import { RecallEvalComboBox } from "./RecallEvalComboBox";

/** Shared grid/list/flashcard control. Keeps the existing picker; the completed
 * label's menu explicitly starts another event (design rules C3/E5/R2). */
export function PracticeEvaluationCell(props: {
  tuneId: string;
  value: string;
  model?: PracticeEvaluationModel;
  legacy: EvaluationDisplayInput;
  completed: boolean;
  onChange: (value: string) => void;
  onPracticeAgain?: () => void;
  onRetry?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const completed = () => props.model?.completed ?? props.completed;
  const submitted = () => getSubmittedEvaluationDisplay(props.legacy);
  return (
    <div class="w-full">
      <Show
        when={completed()}
        fallback={
          <RecallEvalComboBox
            tuneId={props.tuneId}
            value={props.value}
            choices={props.model?.choices ?? []}
            loadDuePreviews={props.model?.loadDuePreviews}
            disabled={props.model?.pending || props.model?.unavailable}
            onChange={props.onChange}
            open={props.open}
            onOpenChange={props.onOpenChange}
          />
        }
      >
        <DropdownMenu
          modal={false}
          open={props.open}
          onOpenChange={props.onOpenChange}
        >
          <DropdownMenu.Trigger
            data-testid={`practice-again-${props.tuneId}`}
            disabled={props.model?.pending || !props.onPracticeAgain}
            class="inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-sm font-medium hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            onClick={(event) => event.stopPropagation()}
          >
            <span
              class={
                props.model?.submittedLabel
                  ? (props.model.submittedColor ?? "text-foreground")
                  : submitted().colorClass
              }
            >
              {props.model?.submittedLabel ?? submitted().label}
            </span>
            <ChevronDown class="size-4" aria-hidden="true" />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content class="z-50 rounded-md border border-border bg-popover text-popover-foreground p-1 shadow-lg">
              <DropdownMenu.Item
                class="min-h-11 px-3 py-2 text-sm cursor-pointer data-[highlighted]:bg-accent"
                data-testid="practice-again-action"
                onSelect={props.onPracticeAgain}
              >
                Practice again
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu>
      </Show>
      <Show when={props.model?.error}>
        <div role="alert" class="text-sm text-destructive">
          <span>{props.model?.error}</span>
          <Show when={props.onRetry}>
            <Button
              type="button"
              variant="outline"
              disabled={props.model?.pending}
              onClick={props.onRetry}
            >
              Retry
            </Button>
          </Show>
        </div>
      </Show>
    </div>
  );
}
