import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import { ChevronDown } from "lucide-solid";
import { createSignal, Show } from "solid-js";
import type { PracticeEvaluationModel } from "../../lib/goals/practice-session";
import { Button } from "../ui/button";
import {
  type EvaluationDisplayInput,
  getSubmittedEvaluationDisplay,
} from "./evaluation-display";
import {
  createEvaluationMenuPositioning,
  evaluationMenuClass,
  evaluationMenuItemClass,
} from "./evaluation-menu";
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
  const [localOpen, setLocalOpen] = createSignal(false);
  let firstAction: HTMLDivElement | undefined;
  const menuPosition = createEvaluationMenuPositioning(
    () => props.open ?? localOpen(),
    () => firstAction
  );
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
          onOpenChange={(open) => {
            setLocalOpen(open);
            props.onOpenChange?.(open);
          }}
          fitViewport
          overflowPadding={16}
          placement="bottom-start"
          getAnchorRect={menuPosition.anchor}
          flip={false}
          overlap
          gutter={0}
        >
          <DropdownMenu.Trigger
            data-testid={`practice-again-${props.tuneId}`}
            disabled={props.model?.pending || !props.onPracticeAgain}
            class="inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-left text-sm font-medium hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            onPointerDown={menuPosition.onTriggerPointerDown}
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
            <ChevronDown class="size-4 shrink-0" aria-hidden="true" />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              ref={menuPosition.setContent}
              data-testid={`submitted-eval-menu-${props.tuneId}`}
              class={evaluationMenuClass}
              oncapture:pointerdown={menuPosition.onContentPointerDown}
              oncapture:pointerup={menuPosition.onContentPointerUp}
            >
              <DropdownMenu.Item
                ref={firstAction}
                class={evaluationMenuItemClass}
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
