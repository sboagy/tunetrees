import { and, eq } from "drizzle-orm";
import type { SqliteDatabase } from "../db/client-sqlite";
import {
  dailyPracticeQueue,
  practiceRecord,
  tableTransientData,
} from "../db/schema";
import { normalizePracticeTimestamp } from "../utils/practice-history";
import type { EvaluationChoice } from "./config";
import { readHistoryEvent } from "./practice-history";
import { readGoalRepertoireSnapshot } from "./resolve";

/** One local snapshot for the active queue's controls. Never run schedulers while
 * rendering, and never substitute the tune's latest event for a linked completion. */
export function readPracticeSession(
  db: SqliteDatabase,
  userId: string,
  repertoireId: string,
  windowStart: string
) {
  const snapshot = readGoalRepertoireSnapshot(db, userId, repertoireId);
  const members = new Map(
    snapshot.members.map(({ assignment }) => [assignment.tuneRef, assignment])
  );
  const rows = db
    .select({
      queue: dailyPracticeQueue,
      draft: tableTransientData,
      event: practiceRecord,
    })
    .from(dailyPracticeQueue)
    .leftJoin(
      tableTransientData,
      and(
        eq(tableTransientData.userId, dailyPracticeQueue.userRef),
        eq(tableTransientData.repertoireId, dailyPracticeQueue.repertoireRef),
        eq(tableTransientData.tuneId, dailyPracticeQueue.tuneRef)
      )
    )
    .leftJoin(
      practiceRecord,
      and(
        eq(practiceRecord.id, dailyPracticeQueue.displayedPracticeRecordId),
        eq(practiceRecord.repertoireRef, dailyPracticeQueue.repertoireRef),
        eq(practiceRecord.tuneRef, dailyPracticeQueue.tuneRef)
      )
    )
    .where(
      and(
        eq(dailyPracticeQueue.userRef, userId),
        eq(dailyPracticeQueue.repertoireRef, repertoireId),
        eq(dailyPracticeQueue.active, 1)
      )
    )
    .all();
  const start = normalizePracticeTimestamp(windowStart);
  return new Map(
    rows
      .filter(
        ({ queue }) =>
          normalizePracticeTimestamp(queue.windowStartUtc) === start &&
          members.has(queue.tuneRef)
      )
      .map((row) => {
        const assignment = members.get(row.queue.tuneRef);
        if (!assignment)
          throw new Error(
            "Practice tune is no longer active in this repertoire"
          );
        return [
          row.queue.tuneRef,
          {
            ...row,
            submittedLabel: row.event
              ? readHistoryEvent(row.event, snapshot.goals, userId)
                  .evaluationLabel
              : "Not available",
            definition: snapshot.resolveAssignment(assignment),
          },
        ];
      })
  );
}

export interface PracticeEvaluationModel {
  choices: readonly EvaluationChoice[];
  loadDuePreviews?: () => Promise<Record<string, string>>;
  completed: boolean;
  submittedLabel?: string;
  error?: string;
  pending: boolean;
  unavailable?: boolean;
}
