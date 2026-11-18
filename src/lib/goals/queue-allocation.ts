import { normalizePracticeTimestamp } from "../utils/practice-history";
import type { SchedulingWindows } from "../utils/scheduling-windows";
import type { DailyGoalSettings } from "./config";

export type QueueSelectionReason =
  | "due_today"
  | "recent_overdue"
  | "old_overdue"
  | "unscheduled_topup"
  | "future_topup"
  | "manual";
export interface GoalQueueCandidate {
  tuneId: string;
  goalId: string;
  daily: DailyGoalSettings;
  scheduled: string | null;
  latestDue: string | null;
  notices: string[];
}
export interface ClassifiedGoalCandidate extends GoalQueueCandidate {
  due: string | null;
  reason: Exclude<QueueSelectionReason, "manual">;
}
export interface RetainedGoalAllocation {
  tuneId: string;
  goalId: string;
}
const priority = {
  due_today: 0,
  recent_overdue: 1,
  old_overdue: 2,
  unscheduled_topup: 3,
  future_topup: 4,
};
const bucket = {
  due_today: 1,
  recent_overdue: 2,
  old_overdue: 4,
  unscheduled_topup: 3,
  future_topup: 1,
  manual: 1,
};
export function queueBucketForReason(reason: QueueSelectionReason): number {
  return bucket[reason];
}

/** Explicit schedule wins; absent schedule falls back only to the latest event. */
export function classifyGoalCandidate(
  candidate: GoalQueueCandidate,
  windows: SchedulingWindows
): ClassifiedGoalCandidate {
  const raw = candidate.scheduled ?? candidate.latestDue;
  const due = raw === null ? null : normalizePracticeTimestamp(raw);
  const start = normalizePracticeTimestamp(windows.startTs);
  const end = normalizePracticeTimestamp(windows.endTs);
  const floor = normalizePracticeTimestamp(
    new Date(
      windows.startOfDayUtc.getTime() -
        candidate.daily.delinquencyDays * 86400000
    ).toISOString()
  );
  let reason: ClassifiedGoalCandidate["reason"] = "unscheduled_topup";
  if (due !== null) {
    if (due >= end) reason = "future_topup";
    else if (due >= start) reason = "due_today";
    else reason = due >= floor ? "recent_overdue" : "old_overdue";
  }
  return { ...candidate, due, reason };
}

/** Oldest first within due/overdue categories; nearest first for future top-ups. */
export function orderGoalCandidates(
  candidates: readonly ClassifiedGoalCandidate[]
): ClassifiedGoalCandidate[] {
  return [...candidates].sort(
    (a, b) =>
      priority[a.reason] - priority[b.reason] ||
      compare(a.due ?? "", b.due ?? "") ||
      compare(a.goalId, b.goalId) ||
      compare(a.tuneId, b.tuneId)
  );
}
function compare(a: string, b: string) {
  return a < b ? -1 : Number(a > b);
}

/** Pure daily allocation. Retained manual/completed/staged rows count against budgets. */
export function allocateGoalQueue(
  candidates: readonly ClassifiedGoalCandidate[],
  retained: readonly RetainedGoalAllocation[],
  excluded: ReadonlySet<string> = new Set()
) {
  const counts = new Map<string, number>();
  const seen = new Set(excluded);
  const counted = new Set<string>();
  for (const row of retained) {
    if (counted.has(row.tuneId)) continue;
    counted.add(row.tuneId);
    counts.set(row.goalId, (counts.get(row.goalId) ?? 0) + 1);
    seen.add(row.tuneId);
  }
  const selected: ClassifiedGoalCandidate[] = [];
  const settings = new Map<string, DailyGoalSettings>();
  for (const row of orderGoalCandidates(candidates)) {
    settings.set(row.goalId, row.daily);
    if (seen.has(row.tuneId)) continue;
    const count = counts.get(row.goalId) ?? 0;
    const due = priority[row.reason] < 3;
    const limit = due ? row.daily.maximum || Infinity : row.daily.minimum;
    if (
      count >= limit ||
      (row.reason === "unscheduled_topup" && !row.daily.autoNew)
    )
      continue;
    selected.push(row);
    counts.set(row.goalId, count + 1);
    seen.add(row.tuneId);
  }
  const shortfalls = [...settings].flatMap(([goalId, daily]) => {
    const missing = Math.max(0, daily.minimum - (counts.get(goalId) ?? 0));
    return missing ? [{ goalId, missing }] : [];
  });
  return { selected, counts, shortfalls };
}
