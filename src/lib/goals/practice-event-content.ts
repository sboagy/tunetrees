import type { PracticeRecord } from "../db/types";
import { normalizePracticeTimestamp } from "../utils/practice-history";
import { canonicalJson } from "./config";

/** Compare authoritative event meaning; transport metadata and typed projections are not state. */
export function practiceEventContent(
  row: Pick<
    PracticeRecord,
    | "goalId"
    | "goal"
    | "evaluationId"
    | "evaluationSnapshot"
    | "schedulerId"
    | "schedulerVersion"
    | "schedulerState"
    | "practiced"
    | "due"
    | "intervalDays"
  >
) {
  if (
    !row.goalId ||
    !row.evaluationId ||
    !row.evaluationSnapshot ||
    !row.schedulerId ||
    !row.schedulerVersion ||
    !row.schedulerState ||
    !row.practiced ||
    !row.due ||
    row.intervalDays === null
  )
    throw new Error(
      "Legacy or incomplete preview must be recalculated and reviewed"
    );
  return canonicalJson(
    {
      goalId: row.goalId,
      goal: row.goal,
      evaluationId: row.evaluationId,
      evaluationSnapshot: JSON.parse(row.evaluationSnapshot),
      schedulerId: row.schedulerId,
      schedulerVersion: row.schedulerVersion,
      schedulerState: JSON.parse(row.schedulerState),
      practiced: normalizePracticeTimestamp(row.practiced),
      due: normalizePracticeTimestamp(row.due),
      intervalDays: row.intervalDays,
    },
    128 * 1024
  );
}
