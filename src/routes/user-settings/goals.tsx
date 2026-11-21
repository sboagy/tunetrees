import { LoaderCircle, Plus, Save, SquarePen, Trash2 } from "lucide-solid";
import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import {
  AlertDialog,
  AlertDialogCloseButton,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { createDraftExitGuard } from "@/components/ui/createDraftExitGuard";
import {
  GoalEditor,
  type GoalEditorDraft,
} from "@/components/user-settings/GoalEditor";
import { PracticeCalendarSummary } from "@/components/user-settings/PracticeCalendarSummary";
import { useUserSettingsDialog } from "@/contexts/UserSettingsDialogContext";
import { useAuth } from "@/lib/auth/AuthContext";
import { getPluginsByCapability } from "@/lib/db/queries/plugins";
import { getBuiltInGoals, getCustomGoalConfig } from "@/lib/goals/builtins";
import { inspectGoalPlugin } from "@/lib/goals/plugin-settings";
import {
  deleteConfiguredGoal,
  type EditableGoalDefinition,
  type GoalSettingsChange,
  type GoalSettingsEntry,
  GoalSettingsPersistenceError,
  persistGoalSettings,
  readGoalSettingsCatalog,
  saveGoalSettingsBatch,
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
  const settings = useUserSettingsDialog();
  const [editing, setEditing] = createSignal<GoalSettingsEntry>();
  let editorTrigger: HTMLElement | undefined;
  const [editors, setEditors] = createSignal<Record<string, GoalEditorDraft>>(
    {}
  );
  const [resetValues, setResetValues] = createSignal<
    Record<string, EditableGoalDefinition>
  >({});
  const [message, setMessage] = createSignal("");
  const registerEditor = (id: string, editor: GoalEditorDraft) => {
    setEditors((old) => ({ ...old, [id]: editor }));
    onCleanup(() =>
      setEditors((old) => {
        if (old[id] !== editor) return old;
        const next = { ...old };
        delete next[id];
        return next;
      })
    );
  };
  const clearDraft = () => {
    setEditing(undefined);
    setResetValues({});
    setAdding(undefined);
    setDeleting(undefined);
  };
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
    clearDraft();
    setAdding(undefined);
    setDeleting(undefined);
    setError("");
    setMessage("");
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
    setMessage("");
    setCanRetryPersistence(false);
    try {
      await operation(db, userId, current);
      if (!current()) return;
      incrementRepertoireListChanged();
      incrementPracticeListStagedChanged();
      refresh();
      clearDraft();
      setAdding(undefined);
      setDeleting(undefined);
      setMessage("Goal settings saved to this device.");
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
    clearDraft();
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
  const dirty = () =>
    Boolean(adding()) ||
    Object.values(editors()).some((editor) => editor.changed());
  const pending = () => busy() || canRetryPersistence();
  const { requestExit, Confirmation } = createDraftExitGuard({
    dirty,
    pending,
    discard: clearDraft,
    description: "Unsaved changes to this goal will be lost.",
  });
  const save = () => {
    if (busy() || canRetryPersistence()) return;
    const changes: GoalSettingsChange[] = [];
    for (const [id, editor] of Object.entries(editors())) {
      const expected = goals().find((entry) => entry.row.id === id);
      if (expected && !editor.changed()) continue;
      try {
        changes.push({ id, expected, ...editor.validate() });
      } catch {
        queueMicrotask(editor.focusError);
        return;
      }
    }
    if (!changes.length) return;
    report(
      perform((db, uid, isCurrent) =>
        saveGoalSettingsBatch(db, uid, changes, { isCurrent })
      )
    );
  };
  onCleanup(
    settings.registerDraft({
      pending,
      requestExit,
      // Each goal is an independent modal task; the category has no draft footer.
      footer: () => null,
    })
  );
  return (
    <div
      class="max-w-3xl space-y-5 text-foreground [color-scheme:light] dark:[color-scheme:dark]"
      data-testid="goals-settings"
    >
      <div>
        <div class="flex items-center justify-between gap-3">
          <h3 class="text-lg font-semibold">Goals</h3>
          <Button
            variant="accent"
            class="min-h-11 gap-1"
            data-testid="goal-add"
            disabled={pending()}
            onClick={(event) => {
              editorTrigger = event.currentTarget;
              setError("");
              setAdding({
                id: crypto.randomUUID(),
                definition: {
                  displayName: "",
                  description: "",
                  config: getCustomGoalConfig(
                    getBuiltInGoals()[0].config.scheduler
                  ),
                },
              });
            }}
          >
            <Plus class="size-4" aria-hidden="true" /> Add goal
          </Button>
        </div>
        <p class="text-sm text-muted-foreground">
          Choose what you are working toward. Each goal has its own evaluations,
          scheduler and daily limits. Your settings apply across your
          repertoires. Daily limits apply when a queue is created or refreshed;
          editing them does not replace today’s existing queue.
        </p>
      </div>
      <PracticeCalendarSummary />
      <output class="block text-sm text-muted-foreground">{message()}</output>
      <Show when={deleting()} keyed>
        {(entry) => (
          <AlertDialog
            open
            onOpenChange={(open) => {
              if (!open && !busy()) setDeleting(undefined);
            }}
          >
            <AlertDialogContent
              onOpenAutoFocus={(event) => {
                event.preventDefault();
                document.getElementById("goal-cancel-delete")?.focus();
              }}
              onInteractOutside={(event) => event.preventDefault()}
              onEscapeKeyDown={(event) => {
                if (busy()) event.preventDefault();
              }}
            >
              <AlertDialogTitle>
                Delete {entry.effective.displayName}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Choose a replacement for tunes assigned to this goal. Due dates
                and history will be kept. Pending practice and notes must be
                handled first.
              </AlertDialogDescription>
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
                id="goal-cancel-delete"
                class="min-h-11"
                disabled={busy()}
                onClick={() => setDeleting(undefined)}
              >
                Cancel deletion
              </Button>
              <Button
                variant="destructive-ghost"
                data-testid="goal-confirm-delete"
                disabled={!replacement() || busy()}
                onClick={() =>
                  report(
                    perform((db, uid) =>
                      deleteConfiguredGoal(db, uid, entry, replacement())
                    )
                  )
                }
              >
                <Trash2 class="size-4" aria-hidden="true" /> Replace and delete
              </Button>
              <Show when={error()}>
                <p role="alert" class="text-sm text-destructive">
                  {error()}
                </p>
              </Show>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </Show>
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
      <Show when={error() && !editing() && !adding()}>
        <div role="alert" class="space-y-2 text-sm text-destructive">
          <p>{error()}</p>
          <Button
            variant="outline"
            disabled={busy()}
            onClick={() => requestExit(reload)}
          >
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
      <fieldset disabled={pending()} class="min-w-0 space-y-3">
        <For each={goals()}>
          {(entry) => (
            <section
              class="rounded border border-border bg-card text-card-foreground p-4"
              data-testid={`goal-panel-${entry.row.id}`}
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0 break-words">
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
                  <p class="text-sm text-muted-foreground">
                    {schedulerLabels[entry.effective.config.scheduler.id]} ·
                    Daily {entry.effective.config.daily.minimum}–
                    {entry.effective.config.daily.maximum || "Unlimited"}
                    <Show when={entry.overridden}> · Personalized</Show>
                  </p>
                </div>
                <Button
                  variant="outline"
                  class="min-h-11 shrink-0 gap-1"
                  data-testid={`goal-edit-${entry.row.id}`}
                  aria-haspopup="dialog"
                  onClick={(event) => {
                    editorTrigger = event.currentTarget;
                    setError("");
                    setEditing(entry);
                  }}
                >
                  <SquarePen class="size-4" aria-hidden="true" /> Edit
                </Button>
              </div>
            </section>
          )}
        </For>
      </fieldset>
      <AlertDialog
        open={Boolean(editing() || adding())}
        onOpenChange={(open) => {
          if (!open) requestExit(clearDraft);
        }}
      >
        <AlertDialogContent
          class="settings-task-dialog flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 text-foreground [color-scheme:light] dark:[color-scheme:dark]"
          data-testid="goal-editor-dialog"
          onInteractOutside={(event) => event.preventDefault()}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            document
              .querySelector<HTMLElement>(
                '[data-testid="goal-editor-dialog"] [data-testid="goal-name"]'
              )
              ?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            editorTrigger?.focus();
          }}
        >
          <header class="shrink-0 border-b border-border p-4 pr-16">
            <AlertDialogTitle>
              {editing()
                ? `Edit ${editing()!.effective.displayName}`
                : "Add goal"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Changes apply to this goal across your repertoires when saved.
            </AlertDialogDescription>
            <AlertDialogCloseButton
              class="min-h-11 min-w-11"
              disabled={pending()}
              title="Close"
            />
          </header>
          <div class="settings-task-body min-h-0 min-w-0 overflow-y-auto p-4 space-y-4">
            <Show when={editing()} keyed>
              {(entry) => (
                <>
                  <Show
                    when={resetValues()[entry.row.id] ?? entry.effective}
                    keyed
                  >
                    {(initial) => (
                      <GoalEditor
                        disabled={pending()}
                        initial={initial}
                        baseline={entry.effective}
                        plugins={plugins()}
                        onInspectPlugin={inspectPlugin}
                        onRegister={(editor) =>
                          registerEditor(entry.row.id, editor)
                        }
                        onSave={save}
                      />
                    )}
                  </Show>
                  <div class="flex flex-wrap gap-2">
                    <Show when={entry.overridden}>
                      <Button
                        variant="outline"
                        data-testid="goal-reset"
                        disabled={pending()}
                        onClick={() =>
                          setResetValues((old) => ({
                            ...old,
                            [entry.row.id]: structuredClone(entry.defaults),
                          }))
                        }
                      >
                        Reset to defaults
                      </Button>
                    </Show>
                    <Show when={entry.row.privateFor !== null}>
                      <Button
                        variant="destructive-ghost"
                        data-testid="goal-delete"
                        disabled={pending()}
                        onClick={() =>
                          requestExit(() => {
                            clearDraft();
                            setDeleting(entry);
                            setReplacement("");
                          })
                        }
                      >
                        <Trash2 class="size-4" aria-hidden="true" /> Delete
                        goal…
                      </Button>
                    </Show>
                  </div>
                </>
              )}
            </Show>
            <Show when={adding()} keyed>
              {(draft) => (
                <GoalEditor
                  disabled={pending()}
                  initial={draft.definition}
                  plugins={plugins()}
                  onInspectPlugin={inspectPlugin}
                  onRegister={(editor) => registerEditor(draft.id, editor)}
                  onSave={save}
                />
              )}
            </Show>
            <Show when={error()}>
              <div role="alert" class="text-sm text-destructive space-y-2">
                <p>{error()}</p>
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
          </div>
          <footer class="shrink-0 flex flex-col gap-2 border-t border-border bg-background p-4 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              class="min-h-11"
              disabled={pending()}
              onClick={() => requestExit(clearDraft)}
            >
              Cancel
            </Button>
            <Button
              class="min-h-11 min-w-36 gap-1"
              data-testid="goal-save"
              disabled={
                !dirty() ||
                pending() ||
                Object.values(editors()).some((editor) => editor.pending())
              }
              onClick={save}
            >
              <Show
                when={busy()}
                fallback={<Save class="size-4" aria-hidden="true" />}
              >
                <LoaderCircle
                  class="size-4 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              </Show>
              {busy() ? "Saving…" : "Save changes"}
            </Button>
          </footer>
          <Confirmation />
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
