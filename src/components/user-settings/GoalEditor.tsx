import {
  createSignal,
  createUniqueId,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { Button } from "@/components/ui/button";
import { getBuiltInGoals, getCustomGoalConfig } from "@/lib/goals/builtins";
import {
  type EvaluationAction,
  type GoalConfig,
  type GoalScheduler,
  LADDER_ACTION_LABELS,
  resolveGoalDefinition,
} from "@/lib/goals/config";
import {
  type GoalPluginSelection,
  validateGoalPluginChoices,
} from "@/lib/goals/plugin-settings";
import type { EditableGoalDefinition } from "@/lib/goals/settings";
import {
  EvaluationChoicesEditor,
  GoalDetailsRequiredError,
} from "./EvaluationChoicesEditor";

const inputClass =
  "w-full min-h-11 rounded-md border border-input bg-background text-foreground px-3 py-2 text-sm";
const ladderActions = ["reset", "back", "stay", "advance"] as const;

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
      <span class="text-sm text-muted-foreground">
        Comma-separated numbers.
      </span>
    </label>
  );
}

function SchedulerFields(props: {
  scheduler: GoalScheduler;
  onChange: (scheduler: GoalScheduler) => void;
}) {
  const helpId = createUniqueId();
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
              label="Interval Ladder (days)"
              values={ladder()!.intervalsDays}
              onChange={(intervalsDays) =>
                props.onChange({
                  id: "builtin:interval-ladder",
                  version: 1,
                  intervalsDays,
                })
              }
            />
            <p class="text-sm text-muted-foreground">
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
            <summary
              class="cursor-pointer min-h-11"
              data-testid="goal-fsrs-advanced"
            >
              Advanced FSRS Settings
            </summary>
            <div class="space-y-3">
              <NumberField
                name="retention"
                label="Desired Retention (0–1)"
                min={0.01}
                max={0.99}
                step="0.01"
                value={fsrs()!.retention}
                onInput={(retention) => updateFsrs({ retention })}
              />
              <NumberField
                name="maximum-interval"
                label="Maximum Interval (days)"
                min={1}
                value={fsrs()!.maximumIntervalDays}
                onInput={(maximumIntervalDays) =>
                  updateFsrs({ maximumIntervalDays })
                }
              />
              <NumberList
                name="weights"
                label="FSRS-6 Weights"
                values={fsrs()!.weights}
                onChange={(weights) => updateFsrs({ weights })}
              />
              <label class="flex min-h-11 items-center gap-2">
                <input
                  type="checkbox"
                  data-testid="goal-allow-same-day-reviews"
                  aria-describedby={helpId}
                  checked={fsrs()!.allowSameDayReviews ?? false}
                  onChange={(e) =>
                    updateFsrs({ allowSameDayReviews: e.currentTarget.checked })
                  }
                />
                <span>Allow Reviews Later the Same Day</span>
              </label>
              <p id={helpId} class="text-sm text-muted-foreground">
                Keep FSRS’s short intervals. Additional same-day practice uses
                Practice Again; tunes do not automatically re-enter today’s
                queue. When off, the next review is scheduled no earlier than
                tomorrow.
              </p>
              <NumberList
                name="learning-steps"
                label="Learning Steps (minutes; empty for none)"
                values={fsrs()!.learningStepsMinutes}
                onChange={(learningStepsMinutes) =>
                  updateFsrs({ learningStepsMinutes })
                }
              />
              <NumberList
                name="relearning-steps"
                label="Relearning Steps (minutes; empty for none)"
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
                <span>Vary Intervals Slightly (fuzz)</span>
              </label>
            </div>
          </details>
        )}
      </Show>
    </>
  );
}

/** The goal dialog owns its draft; choice saves update its saved baseline separately. */
export interface GoalEditorDraft {
  changed: () => boolean;
  pending: () => boolean;
  error: () => string;
  validate: () => {
    definition: EditableGoalDefinition;
    reviewedPlugin?: GoalPluginSelection;
  };
  focusError: () => void;
}

export function GoalEditor(props: {
  disabled?: boolean;
  initial: EditableGoalDefinition;
  baseline?: EditableGoalDefinition;
  plugins?: { id: string; name: string }[];
  onInspectPlugin?: (id: string) => Promise<GoalPluginSelection>;
  onRegister: (draft: GoalEditorDraft) => void;
  onSave: () => void;
  isNew?: boolean;
  onSaveChoices?: (
    definition: EditableGoalDefinition,
    reviewedPlugin?: GoalPluginSelection
  ) => Promise<EditableGoalDefinition>;
}) {
  const [definition, setDefinition] = createSignal(
    structuredClone(props.initial)
  );
  const [savedBaseline, setSavedBaseline] = createSignal(
    props.baseline ?? props.initial
  );
  const [choicePending, setChoicePending] = createSignal(false);
  const [choiceDraftDirty, setChoiceDraftDirty] = createSignal(false);
  const [choiceDraftPending, setChoiceDraftPending] = createSignal(false);
  const [error, setError] = createSignal("");
  const helpId = createUniqueId();
  let form!: HTMLFormElement;
  let errorElement!: HTMLParagraphElement;
  const config = () => definition().config;
  const changeConfig = (patch: Partial<GoalConfig>) =>
    setDefinition((old) => ({ ...old, config: { ...old.config, ...patch } }));
  const changeDaily = (patch: Partial<GoalConfig["daily"]>) =>
    changeConfig({ daily: { ...config().daily, ...patch } });
  const schedulerValue = () => {
    const scheduler = config().scheduler;
    return scheduler.id === "plugin"
      ? `plugin:${scheduler.pluginId}`
      : scheduler.id;
  };
  const [selectedScheduler, setSelectedScheduler] = createSignal(
    schedulerValue()
  );
  const [pluginSelection, setPluginSelection] =
    createSignal<GoalPluginSelection>();
  const [pluginPending, setPluginPending] = createSignal(false);
  const [pluginError, setPluginError] = createSignal("");
  let pluginRequest = 0;
  onCleanup(() => {
    pluginRequest++;
  });

  const loadPlugin = async (id: string, replaceChoices: boolean) => {
    const request = ++pluginRequest;
    setPluginPending(true);
    setPluginError("");
    setPluginSelection(undefined);
    try {
      if (!props.onInspectPlugin)
        throw new Error(
          "Scheduling plugins are not available. Reopen Goals and retry."
        );
      const selection = await props.onInspectPlugin(id);
      if (request !== pluginRequest) return;
      setPluginSelection(selection);
      if (replaceChoices) {
        changeConfig({
          scheduler: { id: "plugin", version: 1, pluginId: id, options: {} },
          evaluations: selection.manifest.actions.map((action) => ({
            id: crypto.randomUUID(),
            label: action.label,
            description: action.description,
            action: { kind: "plugin", actionId: action.id },
          })),
        });
      }
    } catch (cause) {
      if (request === pluginRequest)
        setPluginError(
          cause instanceof Error
            ? cause.message
            : "Could not load scheduling actions. Retry or choose another scheduler."
        );
    } finally {
      if (request === pluginRequest) setPluginPending(false);
    }
  };
  onMount(() => {
    const scheduler = config().scheduler;
    if (scheduler.id === "plugin") void loadPlugin(scheduler.pluginId, false);
  });
  const changeScheduler = (id: string) => {
    setSelectedScheduler(id);
    setError("");
    if (id.startsWith("plugin:")) {
      void loadPlugin(id.slice(7), id !== schedulerValue());
      return;
    }
    pluginRequest++;
    setPluginPending(false);
    setPluginError("");
    setPluginSelection(undefined);
    const source = getBuiltInGoals().find(
      (item) => item.config.scheduler.id === id
    );
    if (!source || id === config().scheduler.id) return;
    const next = getCustomGoalConfig(source.config.scheduler);
    changeConfig({ scheduler: next.scheduler, evaluations: next.evaluations });
  };
  const choiceValue = (action: EvaluationAction) => {
    if (action.kind === "fsrs") return String(action.rating);
    return action.kind === "plugin" ? action.actionId : action.kind;
  };
  const pluginActions = () => pluginSelection()?.manifest.actions ?? [];
  const evaluationActions = () => {
    if (config().scheduler.id === "plugin")
      return pluginActions().map((action) => ({
        ...action,
        value: action.id,
        action: { kind: "plugin" as const, actionId: action.id },
      }));
    if (config().scheduler.id === "builtin:fsrs6")
      return ([1, 2, 3, 4] as const).map((rating, i) => ({
        value: String(rating),
        label: [
          "Again — failed recall",
          "Hard — difficult recall",
          "Good — successful recall",
          "Easy — effortless recall",
        ][i],
        action: { kind: "fsrs" as const, rating },
      }));
    return ladderActions.map((kind) => ({
      value: kind,
      label: LADDER_ACTION_LABELS[kind],
      action: { kind },
    }));
  };
  const newAction = (): EvaluationAction => {
    if (config().scheduler.id === "builtin:fsrs6")
      return { kind: "fsrs", rating: 3 };
    if (config().scheduler.id === "plugin")
      return { kind: "plugin", actionId: pluginActions()[0]?.id ?? "" };
    return { kind: "stay" };
  };
  const validate = () => {
    setError("");
    try {
      if (
        pluginPending() ||
        selectedScheduler() !== schedulerValue() ||
        pluginError()
      )
        throw new Error("Load the selected scheduler's actions before saving.");
      if (!form.checkValidity())
        throw new Error("Check the highlighted fields in this goal.");
      const valid = resolveGoalDefinition(definition());
      if (valid.config.scheduler.id === "plugin") {
        const selection = pluginSelection();
        if (!selection)
          throw new Error("Load scheduling actions before saving.");
        validateGoalPluginChoices(valid.config, selection);
      }
      return { definition: valid, reviewedPlugin: pluginSelection() };
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      throw cause;
    }
  };
  props.onRegister({
    changed: () =>
      choiceDraftDirty() ||
      JSON.stringify(definition()) !== JSON.stringify(savedBaseline()) ||
      selectedScheduler() !== schedulerValue(),
    pending: () => pluginPending() || choicePending() || choiceDraftPending(),
    error,
    validate,
    focusError: () => {
      const invalid = form.querySelector<HTMLElement>(
        "input:invalid, select:invalid, textarea:invalid"
      );
      (invalid ?? errorElement)?.focus();
    },
  });
  return (
    <form
      ref={form}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        props.onSave();
      }}
      class="space-y-4 text-foreground [color-scheme:light] dark:[color-scheme:dark]"
      data-testid="goal-editor"
    >
      <fieldset disabled={props.disabled} class="min-w-0 space-y-4">
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
          <span>Intent of This Goal (optional)</span>
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
            label="Minimum Reviews per Day"
            value={config().daily.minimum}
            onInput={(minimum) => changeDaily({ minimum })}
          />
          <div class="space-y-1">
            <Show
              when={config().daily.maximum !== 0}
              fallback={
                <p class="text-sm">Maximum Reviews per Day: Unlimited</p>
              }
            >
              <NumberField
                name="maximum"
                label="Maximum Reviews per Day"
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
        <p class="text-sm text-muted-foreground">
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
          <span>Include Unscheduled Tunes When Filling the Minimum</span>
        </label>
        <NumberField
          name="delinquency"
          label="Recent Overdue Window (days)"
          value={config().daily.delinquencyDays}
          onInput={(delinquencyDays) => changeDaily({ delinquencyDays })}
        />
        <p class="text-sm text-muted-foreground">
          Prioritize recently overdue tunes before older overdue work. This does
          not change your evaluation or apply a penalty.
        </p>
        <label class="block space-y-1 text-sm">
          <span>Scheduler</span>
          <select
            class={inputClass}
            data-testid="goal-scheduler"
            value={selectedScheduler()}
            aria-describedby={helpId}
            onChange={(e) => changeScheduler(e.currentTarget.value)}
          >
            <option value="builtin:fsrs6">FSRS-6 (memory recall)</option>
            <option value="builtin:interval-ladder">Interval Ladder</option>
            <Show
              when={
                selectedScheduler().startsWith("plugin:") &&
                !(props.plugins ?? []).some(
                  (plugin) => `plugin:${plugin.id}` === selectedScheduler()
                )
              }
            >
              <option value={selectedScheduler()} selected>
                Selected plugin (unavailable)
              </option>
            </Show>
            <For each={props.plugins ?? []}>
              {(plugin) => (
                <option
                  value={`plugin:${plugin.id}`}
                  selected={selectedScheduler() === `plugin:${plugin.id}`}
                >
                  {plugin.name} (custom scheduler)
                </option>
              )}
            </For>
          </select>
        </label>
        <p id={helpId} class="text-sm text-muted-foreground">
          Changing scheduler replaces the evaluation choices below with
          compatible defaults. Changes take effect when you save.
        </p>
        <Show when={pluginPending()}>
          <output class="block text-sm text-muted-foreground">
            Loading scheduling actions… Save is unavailable until they are
            ready.
          </output>
        </Show>
        <Show when={pluginError()}>
          <div role="alert" class="space-y-2 text-sm text-destructive">
            <p>{pluginError()}</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => changeScheduler(selectedScheduler())}
            >
              Retry
            </Button>
          </div>
        </Show>
        <Show
          when={
            selectedScheduler().startsWith("plugin:") &&
            !pluginPending() &&
            !pluginError()
          }
        >
          <div class="space-y-2 text-sm text-muted-foreground">
            <p>
              Choose one of this scheduler’s named effects for each evaluation.
              Your labels and explanations remain editable.
            </p>
            <Button
              type="button"
              variant="outline"
              data-testid="goal-plugin-reload"
              onClick={() => changeScheduler(selectedScheduler())}
            >
              Reload scheduling actions
            </Button>
          </div>
        </Show>
        <Show when={config().scheduler.id} keyed>
          {(_schedulerId) => (
            <SchedulerFields
              scheduler={config().scheduler}
              onChange={(scheduler) => changeConfig({ scheduler })}
            />
          )}
        </Show>
        <EvaluationChoicesEditor
          onDraftStateChange={(dirty, pending) => {
            setChoiceDraftDirty(dirty);
            setChoiceDraftPending(pending);
          }}
          choices={config().evaluations}
          actionValue={choiceValue}
          newAction={newAction}
          isNew={props.isNew ?? false}
          schedulerChanged={
            JSON.stringify(config().scheduler) !==
            JSON.stringify(savedBaseline().config.scheduler)
          }
          disabled={Boolean(
            props.disabled ||
              pluginPending() ||
              choicePending() ||
              pluginError()
          )}
          actions={evaluationActions()}
          onSave={async (evaluations) => {
            const base = props.isNew ? definition() : savedBaseline();
            const candidate = {
              ...base,
              config: {
                ...base.config,
                scheduler: config().scheduler,
                evaluations,
              },
            };
            // Validate before writing. New-goal recovery keeps the edited choice in the draft.
            let valid: EditableGoalDefinition;
            try {
              valid = resolveGoalDefinition(candidate);
            } catch (cause) {
              if (props.isNew)
                throw new GoalDetailsRequiredError(
                  cause instanceof Error
                    ? cause.message
                    : "Complete the required goal fields before saving this choice."
                );
              throw cause;
            }
            if (selectedScheduler() !== schedulerValue())
              throw new Error(
                "Load the selected scheduler's actions before saving."
              );
            if (valid.config.scheduler.id === "plugin") {
              const selection = pluginSelection();
              if (!selection)
                throw new Error("Load scheduling actions before saving.");
              validateGoalPluginChoices(valid.config, selection);
            }
            if (!props.onSaveChoices)
              throw new Error("Choice saving is unavailable.");
            setChoicePending(true);
            try {
              const saved = await props.onSaveChoices(valid, pluginSelection());
              setSavedBaseline(saved);
              changeConfig({
                evaluations: saved.config.evaluations,
                scheduler: saved.config.scheduler,
              });
            } finally {
              setChoicePending(false);
            }
          }}
          onCompleteDetails={(evaluations) => {
            changeConfig({ evaluations });
            setError(
              "Complete the required goal details, then save the goal or reopen the choice and save it."
            );
            // Focus after the choice dialog's restoration has finished.
            requestAnimationFrame(() => {
              const invalid = form.querySelector<HTMLElement>(
                "input:invalid, select:invalid, textarea:invalid"
              );
              (
                invalid ??
                form.querySelector<HTMLElement>('[data-testid="goal-name"]')
              )?.focus();
            });
          }}
        />
        <Show when={error()}>
          <p
            ref={errorElement}
            role="alert"
            tabIndex={-1}
            class="text-sm text-destructive"
          >
            {error()}
          </p>
        </Show>
      </fieldset>
    </form>
  );
}
