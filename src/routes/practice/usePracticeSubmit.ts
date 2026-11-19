import { type Accessor, createSignal, onCleanup } from "solid-js";
import { toast } from "solid-sonner";
import type { SqliteDatabase } from "../../lib/db/client-sqlite";
import {
  commitGoalPracticeEvaluations,
  type GoalCommitItem,
  GoalPracticePersistenceError,
  readGoalCommitItems,
} from "../../lib/goals/commit";
import { runGoalQueueCommand } from "../../lib/goals/queue-commands";
import {
  offerGoalQueueSaveRecovery,
  reportGoalQueueNotices,
} from "../../lib/goals/queue-feedback";
import { stageGoalPracticeEvaluation } from "../../lib/goals/staging";
import {
  formatAsWindowStart,
  getPracticeDate,
} from "../../lib/utils/practice-date";

export interface PracticeSubmitProps {
  localDb: Accessor<SqliteDatabase | null>;
  getUserId: () => Promise<string | null>;
  userId: Accessor<string | null>;
  currentRepertoireId: Accessor<string | null>;
  queueDate: Accessor<Date>;
  captureQueueSelection: () => () => boolean;
  evaluationsCount: Accessor<number>;
  isStaging: Accessor<boolean>;
  hasEvaluationErrors: Accessor<boolean>;
  onSubmittingChange: (pending: boolean) => void;
  prepareClearEvaluations: () => () => void;
  incrementPracticeListStagedChanged: () => void;
  syncPracticeScope: () => Promise<void> | void;
}

export interface PracticeSubmitState {
  submitError: Accessor<string>;
  handleSubmitEvaluations: () => Promise<void>;
  handleAddTunes: (count: number) => Promise<void>;
  handleQueueReset: () => Promise<void>;
}

async function refreshStaleEvaluations(
  db: SqliteDatabase,
  userId: string,
  repertoireId: string,
  windowStart: string,
  items: GoalCommitItem[],
  current: () => boolean
) {
  for (const { draft } of items) {
    if (!current()) return;
    // A stale configuration may be recalculated, but a replaced or cleared
    // draft belongs to newer work and must never be resurrected here.
    const latest = readGoalCommitItems(db, {
      userId,
      repertoireId,
      windowStart,
    }).find((item) => item.draft.tuneId === draft.tuneId);
    if (!latest || JSON.stringify(latest.draft) !== JSON.stringify(draft))
      throw new Error(
        "An evaluation changed during Submit. Review the current choices and submit again."
      );
    if (!draft.evaluationId || !draft.practiced)
      throw new Error(
        "Choose the evaluation again to replace an incomplete preview."
      );
    const refreshed = await stageGoalPracticeEvaluation(
      db,
      {
        userId,
        repertoireId,
        tuneId: draft.tuneId,
        evaluationId: draft.evaluationId,
        practiced: new Date(draft.practiced),
      },
      current
    );
    if (refreshed.status !== "staged")
      throw new Error(
        "Practice changed again. Choose the evaluations again before submitting."
      );
  }
}

export function usePracticeSubmit(
  props: PracticeSubmitProps
): PracticeSubmitState {
  const [submitError, setSubmitError] = createSignal("");
  let pending = false;
  let disposed = false;
  let retry:
    | {
        db: SqliteDatabase;
        userId: string;
        repertoireId: string;
        windowStart: string;
        items: GoalCommitItem[];
      }
    | undefined;
  onCleanup(() => {
    disposed = true;
  });
  const handleSubmitEvaluations = async () => {
    if (pending) return;
    if (props.isStaging() || props.hasEvaluationErrors()) {
      setSubmitError(
        "Resolve pending or failed evaluations before submitting."
      );
      return;
    }
    const db = props.localDb(),
      repertoireId = props.currentRepertoireId(),
      userId = props.userId();
    if (!db || !repertoireId || !userId) {
      setSubmitError("Practice data is not ready.");
      return;
    }
    const selected = props.captureQueueSelection();
    const windowStart = formatAsWindowStart(props.queueDate());
    const current = () =>
      !disposed &&
      props.localDb() === db &&
      props.userId() === userId &&
      props.currentRepertoireId() === repertoireId &&
      selected();
    pending = true;
    props.onSubmittingChange(true);
    setSubmitError("");
    const clearSubmitted = props.prepareClearEvaluations();
    let attemptedItems: GoalCommitItem[] = [];
    try {
      const captured = readGoalCommitItems(db, {
        userId,
        repertoireId,
        windowStart,
      });
      const previous =
        retry?.db === db &&
        retry.userId === userId &&
        retry.repertoireId === repertoireId &&
        retry.windowStart === windowStart
          ? retry.items
          : [];
      const items = captured.length ? captured : previous;
      if (!items.length) {
        setSubmitError("No evaluations to submit.");
        return;
      }
      attemptedItems = items;
      retry = undefined;
      const result = await commitGoalPracticeEvaluations(
        db,
        { userId, repertoireId, items },
        current
      );
      if (!current()) return;
      if (result.status === "superseded") {
        retry = undefined;
        return;
      }
      if (result.status === "stale") {
        await refreshStaleEvaluations(
          db,
          userId,
          repertoireId,
          windowStart,
          items,
          current
        );
        if (!current()) return;
        retry = undefined;
        props.incrementPracticeListStagedChanged();
        setSubmitError(
          "Scheduling inputs changed. Updated results are shown in the queue; review them, then Submit again."
        );
        return;
      }
      retry = undefined;
      clearSubmitted();
      props.incrementPracticeListStagedChanged();
      toast.success(
        `Successfully submitted ${result.eventIds.length} evaluation${result.eventIds.length === 1 ? "" : "s"}`
      );
      void Promise.resolve()
        .then(() => props.syncPracticeScope())
        .catch((error) => console.error("Practice sync failed", error));
    } catch (error) {
      if (error instanceof GoalPracticePersistenceError)
        retry = {
          db,
          userId,
          repertoireId,
          windowStart,
          items: attemptedItems,
        };
      if (current()) {
        // Refresh even when a later calculation/save fails: earlier drafts in
        // the batch may already contain new previews that need user review.
        props.incrementPracticeListStagedChanged();
        setSubmitError(
          error instanceof Error
            ? error.message
            : "Could not submit practice. Retry."
        );
      }
    } finally {
      pending = false;
      if (!disposed) props.onSubmittingChange(false);
    }
  };

  const handleAddTunes = async (count: number) => {
    const isCurrent = props.captureQueueSelection();
    const practiceDate = new Date(props.queueDate());
    if (
      formatAsWindowStart(practiceDate) > formatAsWindowStart(getPracticeDate())
    ) {
      toast.warning(
        "Future queues are previews. Choose today or an earlier queue to add tunes."
      );
      return;
    }
    const db = props.localDb();
    const repertoireId = props.currentRepertoireId();

    if (!db || !repertoireId) {
      console.error("Missing required data for add tunes");
      toast.error("Cannot add tunes: Missing database or repertoire data");
      return;
    }

    const userId = await props.getUserId();
    if (!userId) {
      console.error("Could not determine user ID");
      toast.error("Cannot add tunes: User not found");
      return;
    }

    console.log(
      `Adding ${count} tunes to practice queue for repertoire ${repertoireId}`
    );

    try {
      const result = await runGoalQueueCommand(
        db,
        { userId, repertoireId, practiceDate },
        {
          kind: "add-more",
          count,
          windowStart: formatAsWindowStart(practiceDate),
        },
        isCurrent
      );
      if (!isCurrent()) return;
      reportGoalQueueNotices(result);
      const added = result.addedTuneIds;

      if (added.length > 0) {
        toast.success(
          `Added ${added.length} tune${added.length === 1 ? "" : "s"} to queue`,
          {
            duration: 3000,
          }
        );
        props.incrementPracticeListStagedChanged();
        console.log(`✅ Added ${added.length} tunes to queue`);
      } else {
        toast.warning("No additional tunes available to add");
        console.log("⚠️ No tunes added - backlog may be empty");
      }
    } catch (error) {
      offerGoalQueueSaveRecovery(
        db,
        userId,
        () => props.localDb() === db && props.userId() === userId,
        () => {
          if (isCurrent()) props.incrementPracticeListStagedChanged();
        }
      );
      if (!isCurrent()) return;
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      toast.error(`Error adding tunes: ${errorMessage}`, {
        duration: Number.POSITIVE_INFINITY,
      });
      console.error("Error adding tunes to queue:", error);
    }
  };

  const handleQueueReset = async () => {
    const isCurrent = props.captureQueueSelection();
    const practiceDate = getPracticeDate();
    const db = props.localDb();
    const repertoireId = props.currentRepertoireId();

    if (!db || !repertoireId) {
      console.error("Missing required data for queue reset");
      toast.error("Cannot reset queue: Missing database or repertoire data");
      return;
    }

    const userId = await props.getUserId();
    if (!userId) {
      console.error("Could not determine user ID");
      toast.error("Cannot reset queue: User not found");
      return;
    }

    console.log(`Resetting active queue for repertoire ${repertoireId}`);

    try {
      const result = await runGoalQueueCommand(
        db,
        { userId, repertoireId, practiceDate },
        { kind: "refresh" },
        isCurrent
      );
      if (!isCurrent()) return;
      reportGoalQueueNotices(result);
      toast.success(
        "Queue refreshed. Completed practice and drafts were preserved."
      );
      console.log("✅ Queue reset complete");
      props.incrementPracticeListStagedChanged();
    } catch (error) {
      offerGoalQueueSaveRecovery(
        db,
        userId,
        () => props.localDb() === db && props.userId() === userId,
        () => {
          if (isCurrent()) props.incrementPracticeListStagedChanged();
        }
      );
      if (!isCurrent()) return;
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      toast.error(`Error resetting queue: ${errorMessage}`, {
        duration: Number.POSITIVE_INFINITY,
      });
      console.error("Error resetting queue:", error);
    }
  };

  return {
    submitError,
    handleSubmitEvaluations,
    handleAddTunes,
    handleQueueReset,
  };
}
