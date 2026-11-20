/**
 * Practice History Route
 *
 * Displays practice records for a tune in a read-only history table with
 * goal-aware analytics and an optional manual backfill form.
 *
 * @module routes/tunes/[id]/practice-history
 */

import {
  useBeforeLeave,
  useLocation,
  useNavigate,
  useParams,
} from "@solidjs/router";
import { eq, isNull, or } from "drizzle-orm";
import { LoaderCircle, Plus, Save } from "lucide-solid";
import {
  type Component,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  Match,
  onCleanup,
  Show,
  Switch,
} from "solid-js";
import { toast } from "solid-sonner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createDraftExitGuard } from "@/components/ui/createDraftExitGuard";
import { useAuth } from "@/lib/auth/AuthContext";
import { useCurrentRepertoire } from "@/lib/context/CurrentRepertoireContext";
import {
  deletePracticeRecord,
  getPracticeRecordsForTune,
} from "@/lib/db/queries/practice-records";
import { getTuneForUserById } from "@/lib/db/queries/tunes";
import { goal } from "@/lib/db/schema";
import type { EvaluationChoice } from "@/lib/goals/config";
import {
  ManualPracticePersistenceError,
  type ManualPracticeReceipt,
  ManualPracticeRemovedError,
  manualGoalConfigurationKey,
  prepareManualPractice,
  saveManualPractice,
} from "@/lib/goals/manual-practice";
import { buildHistoryEvents } from "@/lib/goals/practice-history";
import { readGoalPracticeContext } from "@/lib/goals/resolve";
import { readGoalSettingsCatalog } from "@/lib/goals/settings";
import { HistoryEventsTable } from "./HistoryEventsTable";

interface DraftPracticeRecord {
  scope: string;
  practiced: string;
  goalId: string;
  evaluationId: string;
}

/** Component-lifetime form state is isolated by database and history scope. */
function createEntryForm() {
  const [draftRecord, setDraftRecord] =
    createSignal<DraftPracticeRecord | null>(null);
  const [pendingSave, setPendingSave] =
    createSignal<ManualPracticeReceipt | null>(null);
  const [isSavingDraft, setIsSavingDraft] = createSignal(false);
  const [mutationError, setMutationError] = createSignal<string | null>(null);
  return {
    draftRecord,
    setDraftRecord,
    pendingSave,
    setPendingSave,
    isSavingDraft,
    setIsSavingDraft,
    mutationError,
    setMutationError,
  };
}

function defaultEvaluationId(choices: readonly EvaluationChoice[]) {
  return (
    choices.find(
      (choice) => choice.action.kind === "fsrs" && choice.action.rating === 3
    )?.id ?? ""
  );
}

/**
 * Practice History Page Component
 *
 * Shows recorded evaluations and scheduler-specific details across goals.
 */
const PracticeHistoryPage: Component = () => {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { localDb, userIdInt } = useAuth();
  const { currentRepertoireId } = useCurrentRepertoire();

  const [deletingIds, setDeletingIds] = createSignal<Set<string>>(new Set());
  const scopeKey = () => `${userIdInt()}:${currentRepertoireId()}:${params.id}`;
  const [deleteTarget, setDeleteTarget] = createSignal<{
    id: string;
    scope: string;
    db: ReturnType<typeof localDb>;
  } | null>(null);
  const [historyGoal, setHistoryGoal] = createSignal("");
  const forms = new WeakMap<
    NonNullable<ReturnType<typeof localDb>>,
    Map<string, ReturnType<typeof createEntryForm>>
  >();
  const unavailableForm = createEntryForm();
  const form = createMemo(() => {
    const db = localDb();
    const scope = scopeKey();
    if (!db) return unavailableForm;
    let scopes = forms.get(db);
    if (!scopes) {
      scopes = new Map();
      forms.set(db, scopes);
    }
    let entry = scopes.get(scope);
    if (!entry) {
      entry = createEntryForm();
      scopes.set(scope, entry);
    }
    return entry;
  });
  const draftRecord = () => form().draftRecord();
  const pendingSave = () => form().pendingSave();
  const isSavingDraft = () => form().isSavingDraft();
  const mutationError = () => form().mutationError();
  let mounted = true;
  onCleanup(() => {
    mounted = false;
  });
  createEffect(() => {
    const scope = `${userIdInt()}:${currentRepertoireId()}:${params.id}`;
    if (scope) {
      setHistoryGoal("");
      setDeleteTarget(null);
    }
  });
  const [goalCatalog, { refetch: refetchCatalog }] = createResource(
    () =>
      localDb() && userIdInt() ? { db: localDb()!, uid: userIdInt()! } : null,
    ({ db, uid }) => readGoalSettingsCatalog(db, uid)
  );
  const catalogEntries = () =>
    goalCatalog.error ? [] : (goalCatalog()?.entries ?? []);
  const selectedDefinition = createMemo(() =>
    catalogEntries().find((entry) => entry.row.id === draftRecord()?.goalId)
  );
  const returnPath = createMemo(() => {
    const state = location.state as { from?: string } | undefined;
    return state?.from || `/tunes/${params.id}`;
  });

  const [tune] = createResource(
    () => {
      const db = localDb();
      const tuneId = params.id;
      const uid = userIdInt();
      return db && tuneId && uid ? { db, tuneId, uid } : null;
    },
    async (resource) => {
      if (!resource) return null;
      return await getTuneForUserById(
        resource.db,
        resource.tuneId,
        resource.uid
      );
    }
  );

  const [practiceRecords, { refetch }] = createResource(
    () => {
      const db = localDb();
      const tuneId = params.id;
      const repertoireId = currentRepertoireId();
      return db && tuneId && repertoireId ? { db, tuneId, repertoireId } : null;
    },
    async (resource) => {
      if (!resource) return [];
      return await getPracticeRecordsForTune(
        resource.db,
        resource.tuneId,
        resource.repertoireId
      );
    }
  );

  const [historicalGoals, { refetch: refetchGoals }] = createResource(
    () =>
      localDb() && userIdInt() ? { db: localDb()!, uid: userIdInt()! } : null,
    (input) =>
      input.db
        .select()
        .from(goal)
        .where(or(isNull(goal.privateFor), eq(goal.privateFor, input.uid)))
        .all()
  );
  const events = createMemo(() =>
    buildHistoryEvents(
      practiceRecords.error ? [] : (practiceRecords() ?? []),
      historicalGoals.error ? [] : (historicalGoals() ?? []),
      userIdInt() ?? ""
    )
  );

  createEffect(() => {
    if (
      practiceRecords.loading ||
      historicalGoals.loading ||
      practiceRecords.error ||
      historicalGoals.error
    )
      return;
    const key = historyGoal();
    if (key && !events().some((event) => event.goalKey === key))
      setHistoryGoal("");
  });

  const canAddRecord = createMemo(() => {
    return (
      !!localDb() &&
      !!currentRepertoireId() &&
      !!params.id &&
      !!userIdInt() &&
      !practiceRecords.loading &&
      !goalCatalog.loading &&
      !goalCatalog.error &&
      !draftRecord()
    );
  });

  const createDefaultDraftRecord = (): DraftPracticeRecord => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");

    const db = localDb();
    const uid = userIdInt();
    const rep = currentRepertoireId();
    const tuneId = params.id;
    if (!db || !uid || !rep || !tuneId)
      throw new Error("Practice history is unavailable");
    let goalId = historyGoal().startsWith("goal:")
      ? historyGoal().slice(5)
      : "";
    if (!historyGoal()) {
      try {
        goalId = readGoalPracticeContext(db, uid, rep, tuneId).goalId;
      } catch {
        /* An unavailable assignment must not prevent choosing another goal. */
      }
    }
    if (!catalogEntries().some((entry) => entry.row.id === goalId)) goalId = "";
    const choices =
      catalogEntries().find((entry) => entry.row.id === goalId)?.effective
        .config.evaluations ?? [];
    return {
      scope: `${uid}:${rep}:${tuneId}`,
      goalId,
      evaluationId: defaultEvaluationId(choices),
      practiced: `${year}-${month}-${day}T${hours}:${minutes}`,
    };
  };

  const parseDateTimeLocalToIso = (value: string): string | null => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString();
  };

  const handleBack = () => {
    navigate(returnPath());
  };

  const handleStartAdd = async () => {
    const entryForm = form();
    entryForm.setMutationError(null);
    try {
      await refetchCatalog();
      if (!mounted || form() !== entryForm) return;
      entryForm.setDraftRecord(createDefaultDraftRecord());
    } catch (error) {
      if (!mounted || form() !== entryForm) return;
      entryForm.setMutationError(
        error instanceof Error ? error.message : "Unable to open entry form"
      );
    }
  };

  const discardDraft = () => {
    form().setMutationError(null);
    form().setDraftRecord(null);
    form().setPendingSave(null);
  };

  const { requestExit, Confirmation } = createDraftExitGuard({
    dirty: () => Boolean(draftRecord()),
    pending: () => isSavingDraft() || Boolean(pendingSave()),
    discard: discardDraft,
    description: "Your unfinished practice entry will be lost.",
  });
  const handleCancelDraft = () => requestExit(discardDraft);
  useBeforeLeave((event) => {
    if (!draftRecord() && !isSavingDraft() && !pendingSave()) return;
    event.preventDefault();
    requestExit(() => event.retry(true));
  });

  const handleSaveDraft = async () => {
    const entryForm = form();
    const db = localDb();
    const repertoireId = currentRepertoireId();
    const tuneId = params.id;
    const uid = userIdInt();
    const draft = draftRecord();
    const practicedIso = parseDateTimeLocalToIso(draft?.practiced ?? "");

    if (!db || !repertoireId || !tuneId || !uid || !draft) {
      return;
    }

    if (draft.scope !== `${uid}:${repertoireId}:${tuneId}`) {
      entryForm.setMutationError(
        "History context changed. Cancel and reopen the form."
      );
      return;
    }
    if (isSavingDraft()) return;
    if (!practicedIso) {
      entryForm.setMutationError(
        "Enter a valid practice date and time before saving."
      );
      return;
    }

    entryForm.setMutationError(null);
    entryForm.setIsSavingDraft(true);

    const current = () =>
      mounted &&
      form() === entryForm &&
      localDb() === db &&
      userIdInt() === uid &&
      currentRepertoireId() === repertoireId &&
      params.id === tuneId;

    try {
      const receipt =
        pendingSave() ??
        (await prepareManualPractice(db, {
          userId: uid,
          repertoireId,
          tuneId,
          goalId: draft.goalId,
          evaluationId: draft.evaluationId,
          expectedConfiguration: selectedDefinition()
            ? manualGoalConfigurationKey(selectedDefinition()!.effective)
            : "unavailable",
          practiced: new Date(practicedIso),
        }));
      try {
        await saveManualPractice(db, receipt, current);
      } catch (error) {
        if (error instanceof ManualPracticePersistenceError)
          entryForm.setPendingSave(receipt);
        throw error;
      }
      entryForm.setPendingSave(null);
      entryForm.setDraftRecord(null);
      if (!current()) return;
      toast.success("Practice entry saved to this device");
      await refetch();
    } catch (error) {
      if (error instanceof ManualPracticeRemovedError) {
        entryForm.setPendingSave(null);
        entryForm.setDraftRecord(null);
      }
      if (!current()) return;
      entryForm.setMutationError(
        error instanceof Error
          ? error.message
          : "Failed to save practice history entry."
      );
    } finally {
      entryForm.setIsSavingDraft(false);
    }
  };

  const handleDelete = async (recordId: string) => {
    const db = localDb();
    if (!db) {
      return;
    }

    form().setMutationError(null);
    setDeletingIds((current) => new Set(current).add(recordId));

    try {
      await deletePracticeRecord(db, recordId);
      await refetch();
    } catch (error) {
      form().setMutationError(
        error instanceof Error
          ? error.message
          : "Failed to delete practice history entry."
      );
    } finally {
      setDeletingIds((current) => {
        const next = new Set(current);
        next.delete(recordId);
        return next;
      });
    }
  };

  return (
    <div
      class="h-full overflow-y-auto bg-background text-foreground"
      data-testid="practice-history-container"
    >
      <Confirmation />
      <div class="w-full max-w-6xl px-4 py-4">
        <Card class="shadow-lg">
          <CardHeader class="border-b border-gray-200 dark:border-gray-700">
            <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle class="text-lg font-semibold text-gray-900 dark:text-white">
                  Practice History
                  <Show when={tune()}>
                    <span class="font-normal text-gray-500 dark:text-gray-400">
                      {" "}
                      — {tune()!.title}
                    </span>
                  </Show>
                </CardTitle>
                <CardDescription>
                  Submitted practice across this tune’s goals in the current
                  repertoire.
                </CardDescription>
              </div>

              <div class="order-first flex flex-wrap items-center gap-2 self-end lg:order-none lg:self-auto">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleBack}
                  disabled={isSavingDraft() || !!pendingSave()}
                  data-testid="practice-history-cancel-button"
                >
                  <span>Cancel</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleStartAdd}
                  disabled={!canAddRecord()}
                  data-testid="practice-history-add-button"
                >
                  <Plus class="h-4 w-4" />
                  <span>Add</span>
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent class="space-y-6 p-4 sm:p-6">
            <Show
              when={
                practiceRecords.error ||
                historicalGoals.error ||
                goalCatalog.error
              }
            >
              <div role="alert" class="text-destructive">
                Practice history could not be loaded.{" "}
                <Button
                  variant="outline"
                  onClick={async () => {
                    // Each resource owns its error state; let every retry finish.
                    await Promise.allSettled([
                      refetch(),
                      refetchGoals(),
                      refetchCatalog(),
                    ]);
                  }}
                >
                  Retry
                </Button>
              </div>
            </Show>
            <Show when={mutationError()}>
              <div
                class="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300"
                role="alert"
              >
                {mutationError()}
              </div>
            </Show>

            <Show when={pendingSave()}>
              <p role="alert" class="text-sm text-destructive">
                This entry is in memory but still needs saving to this device.
                Retry Save; it will not create another entry.
              </p>
            </Show>
            <Show when={draftRecord()}>
              {(draft) => (
                <Card
                  class="border-dashed"
                  data-testid="practice-history-add-form"
                >
                  <CardHeader class="space-y-3 pb-3">
                    <header class="flex justify-between items-center w-full mb-4">
                      <div class="flex flex-1 justify-start">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleCancelDraft}
                          disabled={isSavingDraft() || !!pendingSave()}
                          data-testid="practice-history-discard-button"
                        >
                          Cancel
                        </Button>
                      </div>
                      <div class="flex min-w-0 flex-1 justify-center px-3">
                        <CardTitle class="text-center text-base font-semibold">
                          Add Practice Entry
                        </CardTitle>
                      </div>
                      <div class="flex flex-1 justify-end">
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleSaveDraft}
                          disabled={isSavingDraft() || !draft().evaluationId}
                          aria-busy={isSavingDraft()}
                          data-testid="practice-history-save-button"
                        >
                          <Show
                            when={isSavingDraft()}
                            fallback={<Save class="h-4 w-4" />}
                          >
                            <LoaderCircle
                              class="h-4 w-4 animate-spin motion-reduce:animate-none"
                              aria-hidden="true"
                            />
                          </Show>
                          <span>{isSavingDraft() ? "Saving…" : "Save"}</span>
                        </Button>
                      </div>
                    </header>
                    <CardDescription>
                      Uses the selected goal’s current settings. Older entries
                      leave later records and the current schedule unchanged. A
                      new latest entry updates the next due date. Future
                      practice dates are not allowed.
                    </CardDescription>
                  </CardHeader>
                  <CardContent class="space-y-4">
                    <div class="grid gap-4 md:grid-cols-2">
                      <label class="grid gap-1.5 text-sm">
                        <span>Goal</span>
                        <select
                          data-testid="practice-history-entry-goal"
                          class="min-h-11 rounded-md border border-input bg-background px-3 text-foreground"
                          disabled={isSavingDraft() || !!pendingSave()}
                          value={draft().goalId}
                          onChange={(event) => {
                            const goalId = event.currentTarget.value;
                            const entry = catalogEntries().find(
                              (item) => item.row.id === goalId
                            );
                            form().setDraftRecord({
                              ...draft(),
                              goalId,
                              evaluationId: defaultEvaluationId(
                                entry?.effective.config.evaluations ?? []
                              ),
                            });
                          }}
                        >
                          <option value="" disabled>
                            Choose a goal
                          </option>
                          <Show when={draft().goalId && !selectedDefinition()}>
                            <option value={draft().goalId} disabled>
                              Selected goal is unavailable — choose another
                            </option>
                          </Show>
                          <For each={catalogEntries()}>
                            {(entry) => (
                              <option value={entry.row.id}>
                                {entry.effective.displayName}
                              </option>
                            )}
                          </For>
                        </select>
                      </label>
                      <label class="grid gap-1.5 text-sm">
                        <span class="font-medium text-foreground">
                          Date Practiced
                        </span>
                        <input
                          type="datetime-local"
                          disabled={isSavingDraft() || !!pendingSave()}
                          value={draft().practiced}
                          onInput={(event) =>
                            form().setDraftRecord((current) =>
                              current
                                ? {
                                    ...current,
                                    practiced: event.currentTarget.value,
                                  }
                                : current
                            )
                          }
                          class="h-9 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                          data-testid="practice-history-practiced-input"
                        />
                      </label>

                      <label class="grid gap-1.5 text-sm">
                        <span class="font-medium text-foreground">
                          Evaluation
                        </span>
                        <select
                          value={draft().evaluationId}
                          disabled={isSavingDraft() || !!pendingSave()}
                          onChange={(event) =>
                            form().setDraftRecord({
                              ...draft(),
                              evaluationId: event.currentTarget.value,
                            })
                          }
                          class="min-h-11 rounded-md border border-input bg-background px-3 text-foreground"
                          data-testid="practice-history-quality-select"
                        >
                          <option value="" disabled>
                            Choose an evaluation
                          </option>
                          <For
                            each={
                              selectedDefinition()?.effective.config.evaluations
                            }
                          >
                            {(choice) => (
                              <option value={choice.id}>
                                {choice.label} — {choice.description}
                              </option>
                            )}
                          </For>
                        </select>
                      </label>
                    </div>
                  </CardContent>
                </Card>
              )}
            </Show>

            <Show
              when={
                !practiceRecords.loading &&
                !historicalGoals.loading &&
                !practiceRecords.error &&
                !historicalGoals.error
              }
              fallback={
                <Show when={practiceRecords.loading || historicalGoals.loading}>
                  <div class="py-8 text-center">
                    <div class="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
                    <p class="mt-4 text-gray-600 dark:text-gray-400">
                      Loading practice history...
                    </p>
                  </div>
                </Show>
              }
            >
              <Switch>
                <Match
                  when={
                    (practiceRecords()?.length ?? 0) === 0 && !draftRecord()
                  }
                >
                  <div class="py-8 text-center text-gray-500 dark:text-gray-400">
                    <p>No practice records found for this tune.</p>
                    <p class="mt-2 text-sm">
                      Use &quot;Add&quot; to backfill a prior session if needed.
                    </p>
                  </div>
                </Match>

                <Match when={(practiceRecords()?.length ?? 0) > 0}>
                  <HistoryEventsTable
                    goalKey={historyGoal()}
                    onGoalChange={setHistoryGoal}
                    events={events()}
                    deletingIds={deletingIds()}
                    onDelete={(id) =>
                      setDeleteTarget({ id, scope: scopeKey(), db: localDb() })
                    }
                  />
                </Match>
              </Switch>
            </Show>
          </CardContent>
        </Card>
        <AlertDialog
          open={deleteTarget() !== null}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete practice entry?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes the selected entry from local history for this
                tune. It does not undo the tune’s schedule or restore its
                practice queue. Deletion synchronization is not yet supported; a
                full download may restore this entry.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive-ghost"
                onClick={async () => {
                  const target = deleteTarget();
                  setDeleteTarget(null);
                  if (target?.scope === scopeKey() && target.db === localDb())
                    await handleDelete(target.id);
                }}
              >
                Delete entry
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default PracticeHistoryPage;
