import { Plus } from "lucide-solid";
import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import { toast } from "solid-sonner";
import { Button } from "@/components/ui/button";
import { GoalEditor } from "@/components/user-settings/GoalEditor";
import { PracticeCalendarSummary } from "@/components/user-settings/PracticeCalendarSummary";
import { useAuth } from "@/lib/auth/AuthContext";
import { getPluginsByCapability } from "@/lib/db/queries/plugins";
import { getBuiltInGoals, getCustomGoalConfig } from "@/lib/goals/builtins";
import { inspectGoalPlugin } from "@/lib/goals/plugin-settings";
import {
  createConfiguredGoal,
  deleteConfiguredGoal,
  type EditableGoalDefinition,
  type GoalSettingsEntry,
  GoalSettingsPersistenceError,
  persistGoalSettings,
  readGoalSettingsCatalog,
  saveGoalSettings,
  type UnavailableGoalSettings,
} from "@/lib/goals/settings";

const schedulerLabels = {
  "builtin:fsrs6": "FSRS-6",
  "builtin:interval-ladder": "Interval ladder",
  plugin: "Custom scheduler",
};

/** Edit per-goal configuration and personal overrides. */
export default function GoalsPage() {
  const {
    user,
    localDb,
    incrementRepertoireListChanged,
    incrementPracticeListStagedChanged,
  } = useAuth();
  const [plugins, setPlugins] = createSignal<{ id: string; name: string }[]>(
    []
  );
  const [pluginsError, setPluginsError] = createSignal("");
  const [goals, setGoals] = createSignal<GoalSettingsEntry[]>([]);
  const [unavailable, setUnavailable] = createSignal<UnavailableGoalSettings[]>(
    []
  );
  const [editing, setEditing] = createSignal<GoalSettingsEntry>();
  const [adding, setAdding] = createSignal<{
    id: string;
    definition: EditableGoalDefinition;
  }>();
  const [deleting, setDeleting] = createSignal<GoalSettingsEntry>();
  const [replacement, setReplacement] = createSignal("");
  const [error, setError] = createSignal("");
  const [canRetryPersistence, setCanRetryPersistence] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  let disposed = false;
  onCleanup(() => {
    disposed = true;
  });
  let pluginOwnerDb: ReturnType<typeof localDb>;
  let pluginOwnerId: string | undefined;
  const loadPlugins = async () => {
    const db = localDb();
    const userId = user()?.id;
    if (pluginOwnerDb !== db || pluginOwnerId !== userId) {
      pluginOwnerDb = db;
      pluginOwnerId = userId;
      setPlugins([]);
      setPluginsError("");
    }
    if (!db || !userId) {
      return;
    }
    const current = () =>
      !disposed && localDb() === db && user()?.id === userId;
    setPluginsError("");
    try {
      const rows = await getPluginsByCapability(db, userId, "scheduleGoal");
      if (current())
        setPlugins(
          rows
            .map(({ id, name }) => ({ id, name }))
            .sort(
              (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
            )
        );
    } catch {
      if (current())
        setPluginsError(
          "Could not load custom schedulers. Retry to refresh the available choices."
        );
    }
  };
  const inspectPlugin = async (id: string) => {
    const db = localDb();
    const userId = user()?.id;
    if (!db || !userId) throw new Error("Settings are not ready");
    const selection = await inspectGoalPlugin(db, userId, id);
    if (disposed || localDb() !== db || user()?.id !== userId)
      throw new Error("The settings session changed. Reopen Goals.");
    return selection;
  };
  const refresh = () => {
    const db = localDb();
    const userId = user()?.id;
    const catalog =
      db && userId
        ? readGoalSettingsCatalog(db, userId)
        : { entries: [], unavailable: [] };
    setGoals(catalog.entries);
    setUnavailable(catalog.unavailable);
    void loadPlugins();
  };
  createEffect(() => {
    // refresh() reads the auth user and database synchronously, tracking both.
    setEditing(undefined);
    setAdding(undefined);
    setDeleting(undefined);
    setError("");
    setCanRetryPersistence(false);
    try {
      refresh();
    } catch (cause) {
      setGoals([]);
      setError(String(cause));
    }
  });
  const perform = async (
    operation: (
      db: NonNullable<ReturnType<typeof localDb>>,
      userId: string,
      isCurrent: () => boolean
    ) => Promise<void>
  ) => {
    const db = localDb();
    const userId = user()?.id;
    if (!db || !userId) throw new Error("Settings are not ready");
    if (busy())
      throw new Error("Please wait for the current settings operation");
    const current = () =>
      !disposed && localDb() === db && user()?.id === userId;
    setBusy(true);
    setError("");
    setCanRetryPersistence(false);
    try {
      await operation(db, userId, current);
      if (!current()) return;
      incrementRepertoireListChanged();
      incrementPracticeListStagedChanged();
      refresh();
      setEditing(undefined);
      setAdding(undefined);
      setDeleting(undefined);
      toast.success("Goal settings saved");
    } catch (cause) {
      if (!current()) return;
      // The SQLite transaction may have committed before disk persistence failed.
      // Reload before editing again; Retry saving to device never repeats a mutation.
      setCanRetryPersistence(cause instanceof GoalSettingsPersistenceError);
      setError(cause instanceof Error ? cause.message : String(cause));
      throw cause;
    } finally {
      if (!disposed) setBusy(false);
    }
  };
  const report = (operation: Promise<void>) => {
    void operation.catch(() => {});
  };
  const reload = () => {
    setEditing(undefined);
    setAdding(undefined);
    setDeleting(undefined);
    try {
      refresh();
      setCanRetryPersistence(false);
      setError("");
    } catch (cause) {
      setError(String(cause));
    }
  };
  return (
    <div
      class="max-w-3xl space-y-5 text-foreground [color-scheme:light] dark:[color-scheme:dark]"
      data-testid="goals-settings"
    >
      <div>
        <h3 class="text-lg font-medium">Goals</h3>
        <p class="text-sm text-muted-foreground">
          Choose what you are working toward. Each goal has its own evaluations,
          scheduler and daily limits. Your settings apply across your
          repertoires. Daily limits apply when a queue is created or refreshed;
          editing them does not replace today’s existing queue.
        </p>
      </div>
      <PracticeCalendarSummary />
      <Show when={pluginsError()}>
        <div role="alert" class="space-y-2 text-sm text-destructive">
          <p>{pluginsError()}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => void loadPlugins()}
          >
            Retry
          </Button>
        </div>
      </Show>
      <Show when={error()}>
        <div role="alert" class="space-y-2 text-sm text-destructive">
          <p>{error()}</p>
          <Button variant="outline" disabled={busy()} onClick={reload}>
            Reload goals
          </Button>
          <Show when={canRetryPersistence()}>
            <Button
              variant="outline"
              disabled={busy()}
              onClick={() =>
                report(
                  perform(async () => {
                    await persistGoalSettings();
                  })
                )
              }
            >
              Retry saving to device
            </Button>
          </Show>
        </div>
      </Show>
      <For each={unavailable()}>
        {(item) => (
          <section
            class="rounded border border-border bg-card text-card-foreground p-4 space-y-2"
            data-testid="goal-unavailable"
          >
            <h4 class="font-medium">{item.row.displayName ?? item.row.name}</h4>
            <p class="text-sm text-muted-foreground">
              This goal needs attention before it can be edited. Legacy goals
              are converted during the coordinated goals upgrade; synchronize
              your devices and complete that upgrade first.
            </p>
            <p class="text-sm text-destructive">{item.message}</p>
          </section>
        )}
      </For>
      <fieldset disabled={busy() || canRetryPersistence()} class="space-y-3">
        <For each={goals()}>
          {(entry) => (
            <section
              class="rounded border border-border bg-card text-card-foreground p-4 space-y-3"
              data-testid={`goal-panel-${entry.row.id}`}
            >
              <div class="flex items-start justify-between gap-3">
                <div>
                  <h4 class="font-medium">
                    {entry.effective.displayName}{" "}
                    <Show when={entry.row.privateFor === null}>
                      <span class="text-xs text-muted-foreground">
                        Built-in
                      </span>
                    </Show>
                  </h4>
                  <p class="text-sm text-muted-foreground">
                    {entry.effective.description}
                  </p>
                  <p class="text-xs text-muted-foreground">
                    {schedulerLabels[entry.effective.config.scheduler.id]} ·
                    Daily {entry.effective.config.daily.minimum}–
                    {entry.effective.config.daily.maximum || "Unlimited"}
                    <Show when={entry.overridden}> · Personalized</Show>
                  </p>
                </div>
                <Button
                  variant="outline"
                  data-testid={`goal-edit-${entry.row.id}`}
                  onClick={() => {
                    setAdding(undefined);
                    setDeleting(undefined);
                    setEditing(entry);
                  }}
                >
                  Edit
                </Button>
              </div>
              <Show when={editing()?.row.id === entry.row.id}>
                <GoalEditor
                  initial={entry.effective}
                  plugins={plugins()}
                  onInspectPlugin={inspectPlugin}
                  onCancel={() => setEditing(undefined)}
                  onSave={(definition, reviewedPlugin) =>
                    perform((db, uid, isCurrent) =>
                      saveGoalSettings(db, uid, entry, definition, {
                        isCurrent,
                        reviewedPlugin,
                      })
                    )
                  }
                />
                <div class="flex flex-wrap gap-2">
                  <Show when={entry.overridden}>
                    <Button
                      variant="outline"
                      data-testid="goal-reset"
                      onClick={() => {
                        if (
                          confirm(
                            `Reset ${entry.effective.displayName} to its defaults?`
                          )
                        )
                          report(
                            perform((db, uid, isCurrent) =>
                              saveGoalSettings(db, uid, entry, entry.defaults, {
                                isCurrent,
                              })
                            )
                          );
                      }}
                    >
                      Reset to defaults
                    </Button>
                  </Show>
                  <Show when={entry.row.privateFor !== null}>
                    <Button
                      variant="destructive-ghost"
                      data-testid="goal-delete"
                      onClick={() => {
                        setDeleting(entry);
                        setReplacement("");
                      }}
                    >
                      Delete goal…
                    </Button>
                  </Show>
                </div>
              </Show>
              <Show when={deleting()?.row.id === entry.row.id}>
                <div class="space-y-2 rounded border border-border p-3">
                  <p class="text-sm">
                    Choose a replacement for tunes assigned to this goal. Due
                    dates and history will be kept. Pending practice and notes
                    must be handled first.
                  </p>
                  <label class="block text-sm">
                    <span>Replacement goal</span>
                    <select
                      class="min-h-11 w-full border border-input rounded bg-background text-foreground p-2"
                      data-testid="goal-replacement"
                      value={replacement()}
                      onChange={(e) => setReplacement(e.currentTarget.value)}
                    >
                      <option value="">Choose a goal</option>
                      <For
                        each={goals().filter(
                          (item) => item.row.id !== entry.row.id
                        )}
                      >
                        {(item) => (
                          <option value={item.row.id}>
                            {item.effective.displayName}
                          </option>
                        )}
                      </For>
                    </select>
                  </label>
                  <Button
                    variant="outline"
                    onClick={() => setDeleting(undefined)}
                  >
                    Cancel deletion
                  </Button>
                  <Button
                    variant="destructive-ghost"
                    data-testid="goal-confirm-delete"
                    disabled={!replacement()}
                    onClick={() => {
                      if (
                        confirm(
                          `Delete ${entry.effective.displayName} and replace its assignments?`
                        )
                      )
                        report(
                          perform((db, uid) =>
                            deleteConfiguredGoal(db, uid, entry, replacement())
                          )
                        );
                    }}
                  >
                    Replace and delete
                  </Button>
                </div>
              </Show>
            </section>
          )}
        </For>
        <Show when={adding()} keyed>
          {(draft) => (
            <section class="rounded border border-border bg-card text-card-foreground p-4 space-y-3">
              <h4 class="font-medium">New goal</h4>
              <GoalEditor
                initial={draft.definition}
                plugins={plugins()}
                onInspectPlugin={inspectPlugin}
                onCancel={() => setAdding(undefined)}
                onSave={(definition, reviewedPlugin) =>
                  perform((db, uid, isCurrent) =>
                    createConfiguredGoal(db, uid, draft.id, definition, {
                      isCurrent,
                      reviewedPlugin,
                    })
                  )
                }
              />
            </section>
          )}
        </Show>
        <Show when={!adding()}>
          <Button
            variant="accent"
            data-testid="goal-add"
            onClick={() => {
              setEditing(undefined);
              setDeleting(undefined);
              const scheduler = getBuiltInGoals()[0].config.scheduler;
              setAdding({
                id: crypto.randomUUID(),
                definition: {
                  displayName: "",
                  description: "",
                  config: getCustomGoalConfig(scheduler),
                },
              });
            }}
          >
            <Plus class="size-4" />
            Add goal
          </Button>
        </Show>
      </fieldset>
    </div>
  );
}
