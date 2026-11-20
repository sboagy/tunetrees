import { and, eq, sql } from "drizzle-orm";
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  untrack,
} from "solid-js";
import { toast } from "solid-sonner";
import type { ITuneOverview } from "../../components/grids/types";
import type { SqliteDatabase } from "../../lib/db/client-sqlite";
import { repertoireTune, tableTransientData } from "../../lib/db/schema";
import type { PracticeEvaluationModel } from "../../lib/goals/practice-session";
import { readPracticeSession } from "../../lib/goals/practice-session";
import { readGoalRepertoireSnapshot } from "../../lib/goals/resolve";
import {
  clearGoalPracticeEvaluation,
  stageGoalPracticeEvaluation,
} from "../../lib/goals/staging";

export interface PracticeEvaluationsProps {
  localDb: Accessor<SqliteDatabase | null>;
  getUserId: () => Promise<string | null>;
  currentRepertoireId: Accessor<string | null>;
  practiceListData: Accessor<ITuneOverview[]>;
  filteredPracticeList: Accessor<ITuneOverview[]>;
  userId: Accessor<string | null>;
  windowStart: Accessor<string>;
  settingsVersion?: Accessor<unknown>;
  isSubmitting?: Accessor<boolean>;
  incrementPracticeListStagedChanged: () => void;
  suppressNextViewRefresh: (
    scope: "repertoire" | "practice" | "catalog",
    count?: number
  ) => void;
}

export interface PracticeEvaluationsState {
  getEvaluationModel: (tuneId: string) => PracticeEvaluationModel;
  practiceAgain: (tuneId: string) => void;
  retryEvaluation: (tuneId: string) => Promise<void>;
  hasEvaluationErrors: Accessor<boolean>;
  evaluations: Accessor<Record<string, string>>;
  isStaging: Accessor<boolean>;
  evaluationsCount: Accessor<number>;
  handleRecallEvalChange: (tuneId: string, evaluation: string) => Promise<void>;
  handleGoalChange: (tuneId: string, goal: string | null) => Promise<void>;
  prepareClearEvaluations: () => () => void;
}

export function usePracticeEvaluations(
  props: PracticeEvaluationsProps
): PracticeEvaluationsState {
  const [requests, setRequests] = createSignal(new Map<string, symbol>());
  const goalChanges = new Map<string, Promise<void>>();
  const revisions = new Map<string, symbol>();
  const [repeating, setRepeating] = createSignal(new Set<string>());
  const [errors, setErrors] = createSignal<Record<string, string>>({});
  const attempted = new Map<string, string>();
  const [revision, setRevision] = createSignal(0);
  const session = createMemo<{
    rows: ReturnType<typeof readPracticeSession>;
    error: string;
  }>(() => {
    props.practiceListData();
    props.settingsVersion?.();
    revision();
    const db = props.localDb(),
      userId = props.userId(),
      repertoireId = props.currentRepertoireId();
    if (!db || !userId || !repertoireId)
      return { rows: new Map(), error: "Practice data is not ready" };
    try {
      return {
        rows: readPracticeSession(
          db,
          userId,
          repertoireId,
          props.windowStart()
        ),
        error: "",
      };
    } catch (error) {
      return {
        rows: new Map(),
        error:
          error instanceof Error
            ? error.message
            : "Cannot load evaluation choices",
      };
    }
  });
  let disposed = false;
  const invalidate = () => {
    setRequests(new Map());
    goalChanges.clear();
    revisions.clear();
  };
  onCleanup(() => {
    disposed = true;
    invalidate();
  });

  // Ownership begins before user lookup or scheduling can yield. Evaluation
  // and goal operations have separate keys: a new rating waits for its goal
  // write, but must not cancel that write. A new goal invalidates older ratings.
  const beginRequest = (key: string) => {
    const token = Symbol(key);
    revisions.set(key.slice(key.indexOf(":") + 1), token);
    const repertoireId = props.currentRepertoireId();
    const db = props.localDb();
    const userId = props.userId();
    const windowStart = props.windowStart();
    setRequests((prev) => new Map(prev).set(key, token));
    const isCurrent = () =>
      !disposed &&
      requests().get(key) === token &&
      props.currentRepertoireId() === repertoireId &&
      props.localDb() === db &&
      props.userId() === userId &&
      props.windowStart() === windowStart;
    const finish = () => {
      if (requests().get(key) !== token) return;
      setRequests((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
    };
    return { isCurrent, finish };
  };
  const [evaluations, setEvaluations] = createSignal<Record<string, string>>(
    {}
  );
  const [didHydrateEvaluations, setDidHydrateEvaluations] = createSignal(false);

  // A failed request falls back to what is actually staged. A snapshot of the
  // UI taken when the request began is not safe to restore: it may hold
  // another request's optimistic rating that was never written.
  const restoreStagedEvaluation = (
    db: SqliteDatabase | null,
    userId: string | null,
    repertoireId: string | null,
    tuneId: string
  ) => {
    // undefined means the staged row could not be read.
    let staged: string | undefined;
    try {
      if (db && userId && repertoireId) {
        const row = db
          .select({ recallEval: tableTransientData.recallEval })
          .from(tableTransientData)
          .where(
            and(
              eq(tableTransientData.userId, userId),
              eq(tableTransientData.tuneId, tuneId),
              eq(tableTransientData.repertoireId, repertoireId)
            )
          )
          .get();
        // No staged rating is recorded as a cleared one, which also overrides
        // a practice list that has not refreshed yet.
        staged = row?.recallEval ?? "";
      }
    } catch {
      // Leave staged unknown; the override is dropped below.
    }
    setEvaluations((prev) => {
      const next = { ...prev };
      // Without a readable row, defer to the practice list's staged data.
      if (staged === undefined) delete next[tuneId];
      else next[tuneId] = staged;
      return next;
    });
  };

  createEffect(() => {
    props.currentRepertoireId();
    props.localDb();
    props.userId();
    props.windowStart();
    invalidate();
    setRepeating(new Set<string>());
    setErrors({});
    attempted.clear();
    setDidHydrateEvaluations(false);
    setEvaluations({});
  });

  createEffect(() => {
    if (didHydrateEvaluations()) return;

    const list = props.filteredPracticeList();
    if (!list || list.length === 0) return;

    const hydrated: Record<string, string> = {};
    for (const tune of list) {
      const recallEval = tune.recall_eval;
      if (
        Number(tune.has_staged) === 1 &&
        typeof recallEval === "string" &&
        recallEval.length > 0
      ) {
        hydrated[String(tune.id)] = recallEval;
      }
    }

    if (Object.keys(hydrated).length > 0) {
      setEvaluations((prev) => ({ ...hydrated, ...prev }));
    }
    setDidHydrateEvaluations(true);
  });

  const isStaging = createMemo(() => requests().size > 0);

  const evaluationsCount = createMemo(() => {
    const stagedTuneIds = new Set<string>();

    for (const tune of props.practiceListData()) {
      if (Number(tune.has_staged) === 1 && tune.recall_eval) {
        stagedTuneIds.add(String(tune.id));
      }
    }

    for (const [tuneId, evaluation] of Object.entries(evaluations())) {
      if (evaluation) {
        stagedTuneIds.add(tuneId);
      } else {
        stagedTuneIds.delete(tuneId);
      }
    }

    return stagedTuneIds.size;
  });

  const handleRecallEvalChange = async (tuneId: string, evaluation: string) => {
    if (props.isSubmitting?.()) return;
    const row = untrack(() => session().rows.get(tuneId));
    if (
      evaluation &&
      row?.queue.completedAt &&
      !repeating().has(tuneId) &&
      !row.draft?.evaluationId
    )
      return;
    attempted.set(tuneId, evaluation);
    setErrors((prev) => {
      const next = { ...prev };
      delete next[tuneId];
      return next;
    });

    setEvaluations({
      ...evaluations(),
      [tuneId]: evaluation,
    });

    const request = beginRequest(`evaluation:${tuneId}`);
    const db = props.localDb();
    const repertoireId = props.currentRepertoireId();
    // Capture the goal task now: it may finish and leave the map while user
    // lookup is pending. Its failure must still prevent this rating from staging.
    const goalChange = goalChanges.get(tuneId);
    let userIdValue: string | null = null;
    try {
      // Resolve the user first so a failed goal write can reconcile the actual
      // staged row instead of falling back to a stale practice-list snapshot.
      userIdValue = await props.getUserId();
      if (!request.isCurrent()) return;
      // A rating uses the new goal only after its old preview has been cleared.
      await goalChange;
      if (!request.isCurrent()) return;
      if (!db || !repertoireId || !userIdValue)
        throw new Error("Practice data is not ready");
      if (evaluation === "") {
        await clearGoalPracticeEvaluation(
          db,
          { userId: userIdValue, tuneId, repertoireId },
          request.isCurrent
        );
        if (request.isCurrent())
          setRepeating((prev) => {
            const next = new Set(prev);
            next.delete(tuneId);
            return next;
          });
        console.log(
          `🗑️  [PracticePage] Cleared staged evaluation for tune ${tuneId}`
        );
      } else {
        const result = await stageGoalPracticeEvaluation(
          db,
          {
            userId: userIdValue,
            repertoireId,
            tuneId,
            evaluationId: evaluation,
            practiced: new Date(),
          },
          request.isCurrent
        );
        if (!request.isCurrent()) return;
        if (result.status !== "staged")
          throw new Error(
            "Practice inputs changed. Choose the evaluation again to review a fresh result."
          );
      }

      if (request.isCurrent()) props.incrementPracticeListStagedChanged();
    } catch (error) {
      if (!request.isCurrent()) return;
      console.error(
        `❌ [PracticePage] Failed to ${evaluation === "" ? "clear" : "stage"} evaluation for ${tuneId}:`,
        error
      );
      restoreStagedEvaluation(db, userIdValue, repertoireId, tuneId);
      props.incrementPracticeListStagedChanged();
      setErrors((prev) => ({
        ...prev,
        [tuneId]:
          error instanceof Error
            ? error.message
            : "Failed to stage evaluation. Retry.",
      }));
    } finally {
      // An older request cannot clear the pending marker of a newer rating.
      request.finish();
      if (!disposed) setRevision((value) => value + 1);
    }
  };

  const handleGoalChange = (
    tuneId: string,
    goal: string | null
  ): Promise<void> => {
    if (props.isSubmitting?.()) return Promise.resolve();
    const request = beginRequest(`goal:${tuneId}`);
    const db = props.localDb();
    const repertoireId = props.currentRepertoireId();
    // Cancel a pending schedule immediately, before waiting for user lookup.
    setRequests((prev) => {
      const next = new Map(prev);
      next.delete(`evaluation:${tuneId}`);
      return next;
    });
    setEvaluations((prev) => {
      const next = { ...prev };
      delete next[tuneId];
      return next;
    });

    const task = (async () => {
      let userIdValue: string | null = null;
      try {
        userIdValue = await props.getUserId();
        if (!request.isCurrent()) return;
        if (!db || !repertoireId || !userIdValue)
          throw new Error("Practice data is not ready");
        props.suppressNextViewRefresh("repertoire");
        const snapshot = readGoalRepertoireSnapshot(
          db,
          userIdValue,
          repertoireId
        );
        const definition = snapshot.resolveAssignment({ goalId: null, goal });
        if (
          !snapshot.members.some(
            ({ assignment }) => assignment.tuneRef === tuneId
          )
        )
          throw new Error("Tune is not active in this repertoire");
        db.update(repertoireTune)
          .set({
            goal: definition.goalKey,
            goalId: definition.goalId,
            lastModifiedAt: new Date().toISOString(),
            syncVersion: sql.raw(`${repertoireTune.syncVersion.name} + 1`),
          })
          .where(
            and(
              eq(repertoireTune.repertoireRef, repertoireId),
              eq(repertoireTune.tuneRef, tuneId)
            )
          )
          .run();
        await clearGoalPracticeEvaluation(
          db,
          { userId: userIdValue, tuneId, repertoireId },
          request.isCurrent
        );
        if (request.isCurrent()) {
          if (!requests().has(`evaluation:${tuneId}`)) {
            attempted.delete(tuneId);
            setErrors((prev) => {
              const next = { ...prev };
              delete next[tuneId];
              return next;
            });
          }
          props.incrementPracticeListStagedChanged();
        }
      } catch (error) {
        if (!request.isCurrent()) return;
        // Do not roll back a newer rating selected while this goal was saving.
        if (!requests().has(`evaluation:${tuneId}`)) {
          restoreStagedEvaluation(db, userIdValue, repertoireId, tuneId);
        }
        props.incrementPracticeListStagedChanged();
        console.error(
          `[PracticePage] Failed to update goal for ${tuneId}:`,
          error
        );
        toast.error("Failed to update goal. Please try again.");
        throw error;
      } finally {
        request.finish();
        if (!disposed) setRevision((value) => value + 1);
      }
    })();
    goalChanges.set(tuneId, task);
    // Observe failures for the UI event caller while preserving the rejected
    // task for a rating already waiting on it. Neither path leaks a rejection.
    return task
      .catch(() => {})
      .finally(() => {
        if (goalChanges.get(tuneId) === task) goalChanges.delete(tuneId);
      });
  };

  return {
    getEvaluationModel: (tuneId) => {
      const state = session();
      const row = state.rows.get(tuneId);
      const submittedLabel = row?.submittedLabel ?? "Not available";
      const override = evaluations()[tuneId];
      const hasDraft =
        override === undefined ? !!row?.draft?.evaluationId : !!override;
      return {
        choices: row?.definition.config.evaluations ?? [],
        completed:
          !!row?.queue.completedAt && !repeating().has(tuneId) && !hasDraft,
        submittedLabel,
        pending:
          requests().has(`evaluation:${tuneId}`) ||
          requests().has(`goal:${tuneId}`) ||
          !!props.isSubmitting?.(),
        error: errors()[tuneId] || state.error || undefined,
        unavailable: !row,
      };
    },
    practiceAgain: (tuneId) => {
      if (
        props.isSubmitting?.() ||
        !session().rows.get(tuneId)?.queue.completedAt
      )
        return;
      setRepeating((prev) => new Set(prev).add(tuneId));
      setEvaluations((prev) => ({ ...prev, [tuneId]: "" }));
    },
    retryEvaluation: (tuneId) =>
      handleRecallEvalChange(tuneId, attempted.get(tuneId) ?? ""),
    hasEvaluationErrors: () => Object.keys(errors()).length > 0,
    evaluations,
    isStaging,
    evaluationsCount,
    handleRecallEvalChange,
    handleGoalChange,
    prepareClearEvaluations: () => {
      const snapshot = new Map(revisions);
      const repertoireId = props.currentRepertoireId();
      const db = props.localDb();
      return () => {
        if (
          disposed ||
          props.currentRepertoireId() !== repertoireId ||
          props.localDb() !== db
        )
          return;
        // Submission owns only the captured revisions. Later edits, including
        // the same rating selected again, retain their requests and overrides.
        setRepeating(new Set<string>());
        setRevision((value) => value + 1);
        setEvaluations((prev) => {
          const next = { ...prev };
          for (const tuneId of Object.keys(next)) {
            if (revisions.get(tuneId) === snapshot.get(tuneId))
              delete next[tuneId];
          }
          return next;
        });
      };
    },
  };
}
