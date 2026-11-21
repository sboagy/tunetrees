import { toast } from "solid-sonner";
import type { SqliteDatabase } from "../db/client-sqlite";
import type { GoalQueueResult } from "./queue";
import { hasPendingGoalQueueSave, retryGoalQueueSave } from "./queue-commands";

/** Explain allocation exceptions without emitting a toast for each tune. */
export function reportGoalQueueNotices(result: GoalQueueResult) {
  const messages = [...new Set(result.notices.map((notice) => notice.message))];
  if (messages.length) toast.warning(messages.join(" "), { duration: 10000 });
  const missing = result.shortfalls.reduce(
    (sum, entry) => sum + entry.missing,
    0
  );
  if (missing > 0)
    toast.info(
      `Daily goal minimums could not be filled: ${missing} more eligible tune${missing === 1 ? " is" : "s are"} needed.`,
      { duration: 8000 }
    );
}

/** Keep a save-only recovery available even when the original action/date is gone. */
export function offerGoalQueueSaveRecovery(
  db: SqliteDatabase,
  userId: string,
  isCurrent: () => boolean,
  onRecovered: (
    saved: Awaited<ReturnType<typeof retryGoalQueueSave>>
  ) => unknown
) {
  if (!hasPendingGoalQueueSave(db, userId)) return;
  toast.error("Queue changes are not yet saved to this device.", {
    id: "goal-queue-save-recovery",
    duration: Number.POSITIVE_INFINITY,
    action: {
      label: "Retry saving",
      onClick: () => {
        void retryGoalQueueSave(db, userId, isCurrent)
          .then(async (saved) => {
            if (!isCurrent()) return;
            toast.success("Queue changes saved.");
            await onRecovered(saved);
          })
          .catch((error: unknown) => {
            if (!isCurrent()) return;
            toast.error(
              error instanceof Error ? error.message : "Queue save failed"
            );
            offerGoalQueueSaveRecovery(db, userId, isCurrent, onRecovered);
          });
      },
    },
  });
}
