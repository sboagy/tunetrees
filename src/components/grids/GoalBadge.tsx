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
import { goalIdentityColors } from "@/lib/goal-colors";
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

// ── Component ────────────────────────────────────────────────────────────────

export const GoalBadge: Component<GoalBadgeProps> = (props) => {
  const { openUserSettings } = useUserSettingsDialog();

  const goalKey = () => props.value || "recall";
  const selected = () =>
    props.goals?.().find((goal) => goal.name === goalKey());
  const displayName = () =>
    selected()?.displayName ??
    (goalKey().startsWith("custom:") ? "Custom goal" : goalKey());
  const badgeClass = () =>
    `inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-sm ${goalIdentityColors(goalKey())}`;

  // Read-only variant
  const Pill = () => (
    <span class={badgeClass()} title={selected()?.description ?? undefined}>
      {displayName()}
    </span>
  );

  // Editable variant: pill + tiny chevron, wrapped in DropdownMenu
  return (
    <Show when={props.onGoalChange} fallback={<Pill />}>
      <DropdownMenu>
        <DropdownMenu.Trigger
          title={selected()?.description ?? undefined}
          class={`${badgeClass()} min-h-11 max-w-full cursor-pointer hover:brightness-95 dark:hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
          onClick={(event) => event.stopPropagation()}
        >
          <span class="min-w-0 break-words">{displayName()}</span>
          <ChevronDown class="size-4 shrink-0" aria-hidden="true" />
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content class="z-50 min-w-40 max-w-[calc(100vw-1rem)] max-h-[min(32rem,80dvh)] overflow-y-auto rounded-md border border-border bg-popover text-popover-foreground p-1 shadow-md">
            {/* Goal items */}
            <DropdownMenu.RadioGroup
              value={goalKey()}
              onChange={(value) => props.onGoalChange?.(value)}
              aria-label="Practice Goal"
            >
              <For each={props.goals?.() ?? []}>
                {(goal) => (
                  <DropdownMenu.RadioItem
                    closeOnSelect
                    value={goal.name}
                    data-testid={`goal-option-${goal.name}`}
                    class="relative flex min-h-11 cursor-pointer select-none items-center rounded-sm py-2 pl-7 pr-3 text-sm hover:bg-accent data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground outline-none"
                  >
                    {/* Checkmark for current goal */}
                    <Show when={goal.name === goalKey()}>
                      <span class="absolute left-2 top-1/2 -translate-y-1/2">
                        <Check class="size-4" aria-hidden="true" />
                      </span>
                    </Show>
                    <span
                      aria-hidden="true"
                      class={`mr-2 inline-block size-2 shrink-0 rounded-full ${goalIdentityColors(goal.name)}`}
                    />
                    <span class="min-w-0 break-words">
                      {goal.displayName ?? goal.name}
                      <Show when={goal.description}>
                        <span class="block max-w-xs text-sm text-muted-foreground break-words">
                          {goal.description}
                        </span>
                      </Show>
                    </span>
                  </DropdownMenu.RadioItem>
                )}
              </For>
            </DropdownMenu.RadioGroup>

            {/* Separator + Edit Goals action */}
            <DropdownMenu.Separator class="my-1 -mx-1 h-px bg-border" />
            <DropdownMenu.Item
              class="flex min-h-11 cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm text-muted-foreground hover:bg-accent data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground outline-none gap-1.5"
              onSelect={() => openUserSettings("goals")}
            >
              <Settings2 class="size-4" aria-hidden="true" />
              Edit Goals…
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu>
    </Show>
  );
};
