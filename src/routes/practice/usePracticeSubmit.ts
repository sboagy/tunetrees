import type { Accessor } from "solid-js";
import { toast } from "solid-sonner";
import type { SqliteDatabase } from "../../lib/db/client-sqlite";
import { runGoalQueueCommand } from "../../lib/goals/queue-commands";
import {
  offerGoalQueueSaveRecovery,
  reportGoalQueueNotices,
} from "../../lib/goals/queue-feedback";
import { commitStagedEvaluations } from "../../lib/services/practice-recording";
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
  prepareClearEvaluations: () => () => void;
  incrementPracticeListStagedChanged: () => void;
  syncPracticeScope: () => Promise<void> | void;
}

export interface PracticeSubmitState {
  handleSubmitEvaluations: () => Promise<void>;
  handleAddTunes: (count: number) => Promise<void>;
  handleQueueReset: () => Promise<void>;
}

export function usePracticeSubmit(
  props: PracticeSubmitProps
): PracticeSubmitState {
  const handleSubmitEvaluations = async () => {
    const db = props.localDb();
    const repertoireId = props.currentRepertoireId();

    if (!db || !repertoireId) {
      console.error("Missing required data for submit");
      toast.error("Cannot submit: Missing database or repertoire data");
      return;
    }

    const userId = await props.getUserId();
    if (!userId) {
      console.error("Could not determine user ID");
      toast.error("Cannot submit: User not found");
      return;
    }

    if (props.isStaging()) {
      toast.warning("Please wait for evaluations to finish staging.");
      return;
    }

    const count = props.evaluationsCount();
    if (count === 0) {
      toast.warning("No evaluations to submit");
      return;
    }

    console.log(
      `Submitting ${count} staged evaluations for repertoire ${repertoireId}`
    );

    const clearSubmittedEvaluations = props.prepareClearEvaluations();
    try {
      const windowStartUtc = formatAsWindowStart(props.queueDate());
      const result = await commitStagedEvaluations(
        db,
        userId,
        repertoireId,
        windowStartUtc
      );

      if (result.success) {
        toast.success(
          `Successfully submitted ${result.count} evaluation${result.count === 1 ? "" : "s"}`,
          {
            duration: 3000,
          }
        );

        clearSubmittedEvaluations();
        props.incrementPracticeListStagedChanged();

        console.log(
          `✅ Submit complete: ${result.count} evaluations committed`
        );

        void props.syncPracticeScope();
      } else {
        toast.error(
          `Failed to submit evaluations: ${result.error || "Unknown error"}`,
          {
            duration: Number.POSITIVE_INFINITY,
          }
        );
        console.error("Submit failed:", result.error);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      toast.error(`Error during submit: ${errorMessage}`, {
        duration: Number.POSITIVE_INFINITY,
      });
      console.error("Error submitting evaluations:", error);
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
    handleSubmitEvaluations,
    handleAddTunes,
    handleQueueReset,
  };
}
