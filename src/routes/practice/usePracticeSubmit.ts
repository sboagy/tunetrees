import { sql } from "drizzle-orm";
import type { Accessor } from "solid-js";
import { toast } from "solid-sonner";
import type { SqliteDatabase } from "../../lib/db/client-sqlite";
import { addTunesToQueue } from "../../lib/services/practice-queue";
import { commitStagedEvaluations } from "../../lib/services/practice-recording";
import { formatAsWindowStart } from "../../lib/utils/practice-date";

export interface PracticeSubmitProps {
  localDb: Accessor<SqliteDatabase | null>;
  getUserId: () => Promise<string | null>;
  currentRepertoireId: Accessor<string | null>;
  queueDate: Accessor<Date>;
  evaluationsCount: Accessor<number>;
  isStaging: Accessor<boolean>;
  clearEvaluations: () => void;
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
          `Successfully submitted ${result.count} evaluation${result.count !== 1 ? "s" : ""}`,
          {
            duration: 3000,
          }
        );

        props.clearEvaluations();
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
      const added = await addTunesToQueue(db, userId, repertoireId, count);

      if (added.length > 0) {
        toast.success(
          `Added ${added.length} tune${added.length !== 1 ? "s" : ""} to queue`,
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
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      toast.error(`Error adding tunes: ${errorMessage}`, {
        duration: Number.POSITIVE_INFINITY,
      });
      console.error("Error adding tunes to queue:", error);
    }
  };

  const handleQueueReset = async () => {
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
      const todayWindowIso19 = formatAsWindowStart(new Date())
        .replace(" ", "T")
        .substring(0, 19);

      await db.run(sql`
        DELETE FROM daily_practice_queue
        WHERE user_ref = ${userId}
          AND repertoire_ref = ${repertoireId}
          AND substr(replace(window_start_utc, ' ', 'T'), 1, 19) = ${todayWindowIso19}
      `);

      toast.success("Queue reset successfully. It will be regenerated.");
      console.log("✅ Queue reset complete");
      props.incrementPracticeListStagedChanged();
    } catch (error) {
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
