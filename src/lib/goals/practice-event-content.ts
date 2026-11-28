import type { PracticeRecord } from "../db/types";
import { normalizePracticeTimestamp } from "../utils/practice-history";
import { canonicalJson } from "./config";

export const normalizePracticeInterval = (days: number) =>
  Math.round(days * 86400000) / 86400000;

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
      // Postgres text transport can round double precision to 15 significant
      // digits (e.g. 25 / 24 days). Compare durations at JS Date's millisecond
      // resolution; timestamps and the rest of the event still match exactly.
      intervalDays: normalizePracticeInterval(row.intervalDays),
    },
    128 * 1024
  );
}
