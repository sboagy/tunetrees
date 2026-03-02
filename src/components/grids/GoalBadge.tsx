/**
 * GoalBadge
 *
 * Displays the goal for a tune as a colored pill.
 * When `onGoalChange` is provided the pill becomes a dropdown trigger, allowing
 * the user to switch the goal or navigate to "Edit Goals…" in settings.
 */
import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import { Check, ChevronDown, Settings2 } from "lucide-solid";
import { type Component, For, Show } from "solid-js";
import { useUserSettingsDialog } from "@/contexts/UserSettingsDialogContext";
import type { IGoalOption } from "./types";

export type { IGoalOption };

interface GoalBadgeProps {
  /** Current goal name (e.g. "recall") */
  value: string;
  /** Available goals; only used in editable mode */
  goals?: () => IGoalOption[];
  /** When provided the badge becomes an interactive dropdown */
  onGoalChange?: (newGoal: string) => void;
}

// ── Stable pastel color from name hash ──────────────────────────────────────

const NAMED_COLORS: Record<string, string> = {
  recall: "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200",
  notes:
    "bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200",
  technique:
    "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200",
  backup:
    "bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200",
  initial_learn:
    "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200",
  fluency: "bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200",
  session_ready: "bg-sky-100 dark:bg-sky-900 text-sky-800 dark:text-sky-200",
  performance_polish:
    "bg-rose-100 dark:bg-rose-900 text-rose-800 dark:text-rose-200",
};

// Simple deterministic hash → one of a discrete set of pastel palettes
const PASTEL_PALETTES = [
  "bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200",
  "bg-pink-100 dark:bg-pink-900 text-pink-800 dark:text-pink-200",
  "bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200",
  "bg-lime-100 dark:bg-lime-900 text-lime-800 dark:text-lime-200",
  "bg-cyan-100 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-200",
  "bg-violet-100 dark:bg-violet-900 text-violet-800 dark:text-violet-200",
];

function nameHash(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (Math.imul(31, h) + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function colorForGoal(name: string): string {
  return (
    NAMED_COLORS[name] ??
    PASTEL_PALETTES[nameHash(name) % PASTEL_PALETTES.length]
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export const GoalBadge: Component<GoalBadgeProps> = (props) => {
  const { openUserSettings } = useUserSettingsDialog();

  const displayName = () => props.value || "recall";
  const badgeClass = () =>
    `inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-xs ${colorForGoal(displayName())}`;

  // Read-only variant
  const Pill = () => <span class={badgeClass()}>{displayName()}</span>;

  // Editable variant: pill + tiny chevron, wrapped in DropdownMenu
  return (
    <Show when={props.onGoalChange} fallback={<Pill />}>
      <DropdownMenu>
        <DropdownMenu.Trigger
          class={`${badgeClass()} cursor-pointer hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`}
        >
          {displayName()}
          <ChevronDown class="w-3 h-3 ml-0.5 opacity-60" />
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content class="z-50 min-w-[10rem] overflow-hidden rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-1 shadow-md">
            {/* Goal items */}
            <For each={props.goals?.() ?? []}>
              {(goal) => (
                <DropdownMenu.Item
                  class="relative flex cursor-pointer select-none items-center rounded-sm py-1 pl-7 pr-3 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 outline-none"
                  onSelect={() => props.onGoalChange!(goal.name)}
                >
                  {/* Checkmark for current goal */}
                  <Show when={goal.name === displayName()}>
                    <span class="absolute left-2 top-1/2 -translate-y-1/2">
                      <Check class="w-3 h-3" />
                    </span>
                  </Show>
                  <span
                    class={`mr-2 inline-block w-2 h-2 rounded-full ${colorForGoal(goal.name).split(" ")[0]}`}
                  />
                  {goal.name}
                </DropdownMenu.Item>
              )}
            </For>

            {/* Separator + Edit Goals action */}
            <DropdownMenu.Separator class="my-1 -mx-1 h-px bg-gray-200 dark:bg-gray-700" />
            <DropdownMenu.Item
              class="flex cursor-pointer select-none items-center rounded-sm px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 outline-none gap-1.5"
              onSelect={() => openUserSettings("goals")}
            >
              <Settings2 class="w-3 h-3" />
              Edit Goals…
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu>
    </Show>
  );
};
