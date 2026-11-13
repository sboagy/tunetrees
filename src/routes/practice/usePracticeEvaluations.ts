import { and, eq } from "drizzle-orm";
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
} from "solid-js";
import { toast } from "solid-sonner";
import type { ITuneOverview } from "../../components/grids/types";
import type { SqliteDatabase } from "../../lib/db/client-sqlite";
import type { GoalRow } from "../../lib/db/queries/user-settings";
import { repertoireTune, tableTransientData } from "../../lib/db/schema";
import {
  clearStagedEvaluation,
  stagePracticeEvaluation,
} from "../../lib/services/practice-staging";

export interface PracticeEvaluationsProps {
  localDb: Accessor<SqliteDatabase | null>;
  getUserId: () => Promise<string | null>;
  currentRepertoireId: Accessor<string | null>;
  practiceListData: Accessor<ITuneOverview[]>;
  filteredPracticeList: Accessor<ITuneOverview[]>;
  goalsMap: Accessor<Map<string, GoalRow>>;
  incrementPracticeListStagedChanged: () => void;
  suppressNextViewRefresh: (
    scope: "repertoire" | "practice" | "catalog",
    count?: number
  ) => void;
}

export interface PracticeEvaluationsState {
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
    setRequests((prev) => new Map(prev).set(key, token));
    const isCurrent = () =>
      !disposed &&
      requests().get(key) === token &&
      props.currentRepertoireId() === repertoireId &&
      props.localDb() === db;
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
    invalidate();
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
      if (typeof recallEval === "string" && recallEval.length > 0) {
        hydrated[String(tune.id)] = recallEval;
      }
    }

    if (Object.keys(hydrated).length > 0) {
      setEvaluations(hydrated);
    }
    setDidHydrateEvaluations(true);
  });

  const isStaging = createMemo(() => requests().size > 0);

  const evaluationsCount = createMemo(() => {
    const stagedTuneIds = new Set<string>();

    for (const tune of props.practiceListData()) {
      if (Number(tune.has_staged) === 1) {
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
    console.log(`Recall evaluation for tune ${tuneId}: ${evaluation}`);

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
        await clearStagedEvaluation(db, userIdValue, tuneId, repertoireId);
        console.log(
          `🗑️  [PracticePage] Cleared staged evaluation for tune ${tuneId}`
        );
      } else {
        const tuneEntry = props
          .practiceListData()
          .find((entry) => entry.id === tuneId);
        // Read the current local goal: the view may not have refreshed after
        // the goal write we just awaited.
        const stored = db
          .select({ goal: repertoireTune.goal })
          .from(repertoireTune)
          .where(
            and(
              eq(repertoireTune.tuneRef, tuneId),
              eq(repertoireTune.repertoireRef, repertoireId)
            )
          )
          .get();
        // A stored null means the goal was cleared; do not revive a stale
        // goal from the overview while its refresh is still pending.
        const tuneGoal = stored
          ? (stored.goal ?? "recall")
          : (tuneEntry?.goal ?? "recall");
        const goalDef = props.goalsMap().get(tuneGoal);
        const technique = goalDef?.defaultTechnique ?? "fsrs";

        await stagePracticeEvaluation(
          db,
          userIdValue,
          repertoireId,
          tuneId,
          evaluation,
          tuneGoal,
          technique,
          request.isCurrent
        );
        if (!request.isCurrent()) return;
        console.log(
          `✅ [PracticePage] Staged preview for tune ${tuneId} (goal=${tuneGoal}, technique=${technique})`
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
      toast.error("Failed to stage evaluation. Please try again.");
    } finally {
      // An older request cannot clear the pending marker of a newer rating.
      request.finish();
    }
  };

  const handleGoalChange = (
    tuneId: string,
    goal: string | null
  ): Promise<void> => {
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
        // SQLite writes are synchronous. Clear the old preview in the same
        // turn, before yielding to persistence or allowing a new evaluation.
        db.update(repertoireTune)
          .set({ goal })
          .where(
            and(
              eq(repertoireTune.tuneRef, tuneId),
              eq(repertoireTune.repertoireRef, repertoireId)
            )
          )
          .run();
        await clearStagedEvaluation(db, userIdValue, tuneId, repertoireId);
        // clearStagedEvaluation persists both local changes immediately.
        if (request.isCurrent()) props.incrementPracticeListStagedChanged();
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
