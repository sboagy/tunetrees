import { Plus, SquarePen } from "lucide-solid";
import { type Component, For, Show } from "solid-js";
import type {
  RhythmPatternCandidate,
  RhythmPatternCandidateScope,
} from "@/lib/services/rhythm-service/RhythmService";
import { Button } from "../ui/button";

export interface RhythmPatternPickerProps {
  value: string | null;
  candidates: RhythmPatternCandidate[];
  canManageCustomPatterns: boolean;
  editablePatternId: string | null;
  isLoading: boolean;
  isCustomPatternBusy: boolean;
  onChange: (nextPatternId: string | null) => void;
  onCreateCustom: () => void;
  onEditCustom: () => void;
}

function getPatternScopeLabel(scope: RhythmPatternCandidateScope): string {
  switch (scope) {
    case "user_tune":
      return "Your tune override";
    case "tune_default":
      return "Tune override";
    case "user_default":
      return "Your default";
    case "system_default":
      return "System default";
    default:
      return "Shared pattern";
  }
}

function getPatternOptionLabel(candidate: RhythmPatternCandidate): string {
  const descriptors = [getPatternScopeLabel(candidate.scope)];
  if (candidate.patternType === "full_track") {
    descriptors.push("Full track");
  }
  if (candidate.hasPremiumAudio) {
    descriptors.push("Premium loop");
  }

  return `${candidate.name} (${descriptors.join(" - ")})`;
}

export const RhythmPatternPicker: Component<RhythmPatternPickerProps> = (
  props
) => {
  const hasMultipleCandidates = () => props.candidates.length > 1;

  return (
    <div class="flex flex-wrap items-center gap-2 md:gap-3">
      <Show when={hasMultipleCandidates()}>
        <label class="flex min-w-[18rem] flex-1 items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
          <span class="shrink-0 font-medium text-slate-900 dark:text-slate-100">
            Pattern:
          </span>
          <select
            value={props.value ?? ""}
            onChange={(event) => {
              props.onChange(event.currentTarget.value.trim() || null);
            }}
            class="min-h-11 w-full max-w-[20rem] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:disabled:bg-slate-900"
            data-testid="rhythm-player-pattern-select"
            disabled={props.isLoading}
          >
            <For each={props.candidates}>
              {(candidate) => (
                <option value={candidate.id}>
                  {getPatternOptionLabel(candidate)}
                </option>
              )}
            </For>
          </select>
        </label>
      </Show>

      <Show when={props.canManageCustomPatterns}>
        <Button
          type="button"
          onClick={props.onCreateCustom}
          disabled={props.isCustomPatternBusy}
          variant="accent"
          class="min-h-11 rounded-full px-4"
          data-testid="rhythm-player-custom-pattern-open-button"
        >
          <Plus class="h-4 w-4" />
          New Custom Pattern
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={props.onEditCustom}
          disabled={!props.editablePatternId || props.isCustomPatternBusy}
          class="min-h-11 rounded-full px-4"
          data-testid="rhythm-player-custom-pattern-edit-button"
        >
          <SquarePen class="h-4 w-4" />
          Edit selected custom
        </Button>
      </Show>
    </div>
  );
};
