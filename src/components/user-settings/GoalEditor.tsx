import { Plus, Save } from "lucide-solid";
import { createSignal, For, Index, Show } from "solid-js";
import { Button } from "@/components/ui/button";
import { getBuiltInGoals, getCustomGoalConfig } from "@/lib/goals/builtins";
import {
  type EvaluationAction,
  type GoalConfig,
  type GoalScheduler,
  resolveGoalDefinition,
} from "@/lib/goals/config";
import type { EditableGoalDefinition } from "@/lib/goals/settings";

const inputClass =
  "w-full min-h-11 rounded-md border border-input bg-background text-foreground px-3 py-2 text-sm";
const ladderActions = ["reset", "back", "stay", "advance"] as const;
const actionLabels = {
  reset: "Restart at the first interval",
  back: "Move back one interval",
  stay: "Repeat the current interval",
  advance: "Advance one interval (repeat the last at the end)",
};

function NumberField(props: {
  label: string;
  name: string;
  value: number;
  onInput: (value: number) => void;
  min?: number;
  max?: number;
  step?: string;
}) {
  return (
    <label class="block space-y-1 text-sm">
      <span>{props.label}</span>
      <input
        class={inputClass}
        data-testid={`goal-${props.name}`}
        type="number"
        required
        min={props.min ?? 0}
        max={props.max}
        step={props.step ?? "1"}
        value={props.value}
        onInput={(e) => props.onInput(e.currentTarget.valueAsNumber)}
      />
    </label>
  );
}

function NumberList(props: {
  label: string;
  name: string;
  values: number[];
  onChange: (values: number[]) => void;
}) {
  // Keep partial text local; the shared config validator checks the parsed numbers on Save.
  const [text, setText] = createSignal(props.values.join(", "));
  return (
    <label class="block space-y-1 text-sm">
      <span>{props.label}</span>
      <input
        class={inputClass}
        data-testid={`goal-${props.name}`}
        value={text()}
        onInput={(e) => {
          const value = e.currentTarget.value;
          setText(value);
          props.onChange(
            value.trim()
              ? value
                  .split(",")
                  .map((part) => (part.trim() ? Number(part) : Number.NaN))
              : []
          );
        }}
      />
      <span class="text-xs text-muted-foreground">
        Comma-separated numbers.
      </span>
    </label>
  );
}

function SchedulerFields(props: {
  scheduler: GoalScheduler;
  onChange: (scheduler: GoalScheduler) => void;
}) {
  const ladder = () => {
    const s = props.scheduler;
    return s.id === "builtin:interval-ladder" ? s : undefined;
  };
  const fsrs = () => {
    const s = props.scheduler;
    return s.id === "builtin:fsrs6" ? s : undefined;
  };
  const updateFsrs = (
    values: Partial<Extract<GoalScheduler, { id: "builtin:fsrs6" }>>
  ) => {
    const current = fsrs();
    if (current) props.onChange({ ...current, ...values });
  };
  return (
    <>
      <Show when={ladder()}>
        {(_ladder) => (
          <>
            <NumberList
              name="intervals"
              label="Interval ladder (days)"
              values={ladder()!.intervalsDays}
              onChange={(intervalsDays) =>
                props.onChange({
                  id: "builtin:interval-ladder",
                  version: 1,
                  intervalsDays,
                })
              }
            />
            <p class="text-xs text-muted-foreground">
              Use increasing positive intervals. Fractions of a day are
              supported. The last step repeats; extra same-day practice is
              manual.
            </p>
          </>
        )}
      </Show>
      <Show when={fsrs()}>
        {(_fsrs) => (
          <details class="rounded border border-border p-3">
            <summary class="cursor-pointer min-h-11">
              Advanced FSRS settings
            </summary>
            <div class="space-y-3">
              <NumberField
                name="retention"
                label="Desired retention (0–1)"
                min={0.01}
                max={0.99}
                step="0.01"
                value={fsrs()!.retention}
                onInput={(retention) => updateFsrs({ retention })}
              />
              <NumberField
                name="maximum-interval"
                label="Maximum interval (days)"
                min={1}
                value={fsrs()!.maximumIntervalDays}
                onInput={(maximumIntervalDays) =>
                  updateFsrs({ maximumIntervalDays })
                }
              />
              <NumberList
                name="weights"
                label="FSRS-6 weights"
                values={fsrs()!.weights}
                onChange={(weights) => updateFsrs({ weights })}
              />
              <NumberList
                name="learning-steps"
                label="Learning steps (minutes; empty for none)"
                values={fsrs()!.learningStepsMinutes}
                onChange={(learningStepsMinutes) =>
                  updateFsrs({ learningStepsMinutes })
                }
              />
              <NumberList
                name="relearning-steps"
                label="Relearning steps (minutes; empty for none)"
                values={fsrs()!.relearningStepsMinutes}
                onChange={(relearningStepsMinutes) =>
                  updateFsrs({ relearningStepsMinutes })
                }
              />
              <label class="flex min-h-11 items-center gap-2">
                <input
                  type="checkbox"
                  data-testid="goal-fuzz"
                  checked={fsrs()!.fuzz}
                  onChange={(e) =>
                    updateFsrs({ fuzz: e.currentTarget.checked })
                  }
                />
                <span>Vary intervals slightly (fuzz)</span>
              </label>
            </div>
          </details>
        )}
      </Show>
    </>
  );
}

export function GoalEditor(props: {
  initial: EditableGoalDefinition;
  onSave: (definition: EditableGoalDefinition) => Promise<void>;
  onCancel: () => void;
}) {
  const [definition, setDefinition] = createSignal(
    structuredClone(props.initial)
  );
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  const config = () => definition().config;
  const changeConfig = (patch: Partial<GoalConfig>) =>
    setDefinition((old) => ({ ...old, config: { ...old.config, ...patch } }));
  const changeDaily = (patch: Partial<GoalConfig["daily"]>) =>
    changeConfig({ daily: { ...config().daily, ...patch } });
  const changeChoice = (
    index: number,
    patch: Partial<GoalConfig["evaluations"][number]>
  ) =>
    changeConfig({
      evaluations: config().evaluations.map((choice, i) =>
        i === index ? { ...choice, ...patch } : choice
      ),
    });
  const changeScheduler = (id: string) => {
    const source = getBuiltInGoals().find(
      (item) => item.config.scheduler.id === id
    );
    if (!source || id === config().scheduler.id) return;
    const next = getCustomGoalConfig(source.config.scheduler);
    changeConfig({ scheduler: next.scheduler, evaluations: next.evaluations });
  };
  const submit = async (event: Event) => {
    event.preventDefault();
    if (busy()) return;
    setError("");
    setBusy(true);
    try {
      await props.onSave(resolveGoalDefinition(definition()));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      onSubmit={submit}
      class="space-y-4 text-foreground [color-scheme:light] dark:[color-scheme:dark]"
      data-testid="goal-editor"
    >
      <fieldset disabled={busy()} class="space-y-4">
        <label class="block space-y-1 text-sm">
          <span>Name</span>
          <input
            class={inputClass}
            data-testid="goal-name"
            required
            value={definition().displayName}
            onInput={(e) =>
              setDefinition({
                ...definition(),
                displayName: e.currentTarget.value,
              })
            }
          />
        </label>
        <label class="block space-y-1 text-sm">
          <span>Intent of this goal</span>
          <textarea
            class={inputClass}
            data-testid="goal-description"
            value={definition().description}
            onInput={(e) =>
              setDefinition({
                ...definition(),
                description: e.currentTarget.value,
              })
            }
          />
        </label>
        <div class="grid gap-3 sm:grid-cols-2">
          <NumberField
            name="minimum"
            label="Minimum reviews per day"
            value={config().daily.minimum}
            onInput={(minimum) => changeDaily({ minimum })}
          />
          <div class="space-y-1">
            <Show
              when={config().daily.maximum !== 0}
              fallback={
                <p class="text-sm">Maximum reviews per day: Unlimited</p>
              }
            >
              <NumberField
                name="maximum"
                label="Maximum reviews per day"
                min={1}
                value={config().daily.maximum}
                onInput={(maximum) => changeDaily({ maximum })}
              />
            </Show>
            <label class="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                data-testid="goal-unlimited"
                checked={config().daily.maximum === 0}
                onChange={(e) =>
                  changeDaily({
                    maximum: e.currentTarget.checked
                      ? 0
                      : Math.max(
                          1,
                          config().daily.minimum,
                          props.initial.config.daily.maximum
                        ),
                  })
                }
              />
              <span>Unlimited</span>
            </label>
          </div>
        </div>
        <p class="text-xs text-muted-foreground">
          Limits apply separately in each repertoire. Due and overdue tunes come
          first. To reach the minimum, add unscheduled tunes, then the nearest
          future reviews. Minimum zero means no automatic top-up.
        </p>
        <label class="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            data-testid="goal-auto-new"
            checked={config().daily.autoNew}
            onChange={(e) => changeDaily({ autoNew: e.currentTarget.checked })}
          />
          <span>Include unscheduled tunes when filling the minimum</span>
        </label>
        <NumberField
          name="delinquency"
          label="Recent overdue window (days)"
          value={config().daily.delinquencyDays}
          onInput={(delinquencyDays) => changeDaily({ delinquencyDays })}
        />
        <p class="text-xs text-muted-foreground">
          Prioritize recently overdue tunes before older overdue work. This does
          not change your evaluation or apply a penalty.
        </p>
        <label class="block space-y-1 text-sm">
          <span>Scheduler</span>
          <select
            class={inputClass}
            data-testid="goal-scheduler"
            value={config().scheduler.id}
            onChange={(e) => changeScheduler(e.currentTarget.value)}
          >
            <option value="builtin:fsrs6">FSRS-6 (memory recall)</option>
            <option value="builtin:interval-ladder">Interval ladder</option>
          </select>
        </label>
        <p class="text-xs text-muted-foreground">
          Changing scheduler replaces the evaluation choices below with
          compatible defaults. Changes take effect when you save.
        </p>
        <Show when={config().scheduler.id} keyed>
          {(_schedulerId) => (
            <SchedulerFields
              scheduler={config().scheduler}
              onChange={(scheduler) => changeConfig({ scheduler })}
            />
          )}
        </Show>
        <fieldset class="space-y-3">
          <legend class="font-medium">Evaluation choices</legend>
          <Index each={config().evaluations}>
            {(choice, index) => (
              <div
                class="space-y-2 rounded border border-border p-3"
                data-testid="goal-choice"
              >
                <label class="block text-sm">
                  <span>Label</span>
                  <input
                    class={inputClass}
                    data-testid={`goal-choice-label-${index}`}
                    required
                    value={choice().label}
                    onInput={(e) =>
                      changeChoice(index, { label: e.currentTarget.value })
                    }
                  />
                </label>
                <label class="block text-sm">
                  <span>Explanation</span>
                  <input
                    class={inputClass}
                    data-testid={`goal-choice-description-${index}`}
                    value={choice().description}
                    onInput={(e) =>
                      changeChoice(index, {
                        description: e.currentTarget.value,
                      })
                    }
                  />
                </label>
                <label class="block text-sm">
                  <span>Scheduling effect</span>
                  <select
                    class={inputClass}
                    data-testid={`goal-choice-action-${index}`}
                    value={
                      choice().action.kind === "fsrs"
                        ? String(
                            (
                              choice().action as Extract<
                                EvaluationAction,
                                { kind: "fsrs" }
                              >
                            ).rating
                          )
                        : choice().action.kind
                    }
                    onChange={(e) => {
                      const value = e.currentTarget.value;
                      const action: EvaluationAction =
                        config().scheduler.id === "builtin:fsrs6"
                          ? {
                              kind: "fsrs",
                              rating: Number(value) as 1 | 2 | 3 | 4,
                            }
                          : {
                              kind:
                                ladderActions.find((item) => item === value) ??
                                "stay",
                            };
                      changeChoice(index, { action });
                    }}
                  >
                    <Show
                      when={config().scheduler.id === "builtin:fsrs6"}
                      fallback={
                        <For each={ladderActions}>
                          {(action) => (
                            <option value={action}>
                              {actionLabels[action]}
                            </option>
                          )}
                        </For>
                      }
                    >
                      <option value="1">Again — failed recall</option>
                      <option value="2">Hard — difficult recall</option>
                      <option value="3">Good — successful recall</option>
                      <option value="4">Easy — effortless recall</option>
                    </Show>
                  </select>
                </label>
                <Button
                  variant="destructive-ghost"
                  type="button"
                  data-testid={`goal-choice-remove-${index}`}
                  disabled={config().evaluations.length === 1}
                  onClick={() =>
                    changeConfig({
                      evaluations: config().evaluations.filter(
                        (_, i) => i !== index
                      ),
                    })
                  }
                >
                  Remove choice
                </Button>
              </div>
            )}
          </Index>
          <Button
            variant="accent"
            type="button"
            data-testid="goal-choice-add"
            onClick={() =>
              changeConfig({
                evaluations: [
                  ...config().evaluations,
                  {
                    id: crypto.randomUUID(),
                    label: "New choice",
                    description: "",
                    action:
                      config().scheduler.id === "builtin:fsrs6"
                        ? { kind: "fsrs", rating: 3 }
                        : { kind: "stay" },
                  },
                ],
              })
            }
          >
            <Plus class="size-4" />
            Add choice
          </Button>
        </fieldset>
        <Show when={error()}>
          <p role="alert" class="text-sm text-destructive">
            {error()}
          </p>
        </Show>
        <div class="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={props.onCancel}>
            Cancel
          </Button>
          <Button type="submit" data-testid="goal-save">
            <Save class="size-4" />
            {busy() ? "Saving…" : "Save goal"}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
