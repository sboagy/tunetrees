import type { PracticeRecord } from "../db/types";
import { orderPracticeHistory } from "../utils/practice-history";
import { SCHEDULER_STATE_BYTES } from "./config";
import { type DecodedPracticeState, readPracticeState } from "./practice-state";
import { type GoalIdentity, resolveGoalReference } from "./references";

/** Read-only presentation of submitted events. Never consult current evaluations
 * or choose scheduling predecessors here. Episodes are assigned before filtering,
 * so hiding intervening goals cannot imply continuous scheduler state. */
export interface HistoricalGoal extends GoalIdentity {
  displayName: string | null;
}

export interface HistoryEvent {
  record: PracticeRecord;
  goalKey: string;
  goalLabel: string;
  evaluationLabel: string;
  description: string;
  action: string | null;
  rating: number | null;
  intervalDays: number | null;
  state: DecodedPracticeState;
  episode: number;
  legacy: boolean;
  notices: string[];
}

interface Snapshot {
  goalLabel: string;
  choiceLabel: string;
  choiceDescription: string;
  action: Record<string, unknown>;
}

function readSnapshot(text: string | null): Snapshot | null {
  if (text === null) return null;
  if (new TextEncoder().encode(text).length > SCHEDULER_STATE_BYTES)
    throw new Error("Historical evaluation snapshot is too large");
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Historical evaluation snapshot is invalid");
  const row = value as Record<string, unknown>;
  if (
    row.version !== 1 ||
    typeof row.goalLabel !== "string" ||
    typeof row.choiceLabel !== "string" ||
    typeof row.choiceDescription !== "string" ||
    !row.action ||
    typeof row.action !== "object" ||
    Array.isArray(row.action)
  )
    throw new Error("Historical evaluation snapshot is unsupported");
  return {
    goalLabel: row.goalLabel,
    choiceLabel: row.choiceLabel,
    choiceDescription: row.choiceDescription,
    action: row.action as Record<string, unknown>,
  };
}

function validRating(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 4
    ? value
    : null;
}

function finiteInterval(value: number | null): number | null {
  return value !== null && Number.isFinite(value) && value >= 0 ? value : null;
}

function normalizeEvent(
  record: PracticeRecord,
  goals: readonly HistoricalGoal[],
  userId: string
): HistoryEvent {
  const notices: string[] = [];
  let resolved: HistoricalGoal | null = null;
  try {
    resolved = resolveGoalReference(goals, userId, record, true);
  } catch {
    notices.push("Legacy goal identity is ambiguous");
  }
  const goalId = record.goalId ?? resolved?.id ?? null;
  const legacy = record.schedulerId === null;
  let state: DecodedPracticeState;
  try {
    state = readPracticeState(record, resolved?.id ?? null);
  } catch {
    state = {
      kind: "unavailable",
      goalId,
      reason: "Recorded scheduler details are invalid or unsupported",
    };
  }
  if (state.kind === "unavailable") notices.push(state.reason);
  let snapshot: Snapshot | null = null;
  try {
    snapshot = readSnapshot(record.evaluationSnapshot);
  } catch {
    notices.push("Recorded evaluation details are unavailable");
  }
  // New-format events never borrow ratings or intervals from compatibility columns.
  let rating: number | null = null;
  if (state.kind === "fsrs6") {
    if (legacy) rating = validRating(record.quality);
    else if (snapshot?.action.kind === "fsrs")
      rating = validRating(snapshot.action.rating);
  }
  const legacyLabel =
    rating === null ? null : ["Again", "Hard", "Good", "Easy"][rating - 1];
  const action =
    typeof snapshot?.action.kind === "string" ? snapshot.action.kind : null;
  return {
    record,
    goalKey:
      goalId === null ? `legacy:${record.goal ?? "unknown"}` : `goal:${goalId}`,
    goalLabel:
      snapshot?.goalLabel ||
      resolved?.displayName ||
      record.goal ||
      "Unknown goal",
    evaluationLabel:
      snapshot?.choiceLabel ||
      record.evaluationId ||
      legacyLabel ||
      "Not available",
    description: snapshot?.choiceDescription ?? "",
    action,
    rating,
    intervalDays: finiteInterval(
      legacy ? record.interval : record.intervalDays
    ),
    state,
    episode: 0,
    legacy,
    notices,
  };
}

function continuesEpisode(
  previous: HistoryEvent,
  current: HistoryEvent
): boolean {
  if (previous.goalKey !== current.goalKey) return false;
  const before = previous.state;
  const after = current.state;
  if (before.kind === "fsrs6" && after.kind === "fsrs6")
    return after.state.reps > before.state.reps;
  if (before.kind === "ladder" && after.kind === "ladder")
    return before.state.ladderHash === after.state.ladderHash;
  if (before.kind === "plugin" && after.kind === "plugin")
    return (
      before.state.pluginId === after.state.pluginId &&
      before.state.stateVersion === after.state.stateVersion &&
      before.state.scriptHash === after.state.scriptHash
    );
  return false;
}

export function buildHistoryEvents(
  records: readonly PracticeRecord[],
  goals: readonly HistoricalGoal[],
  userId: string
): HistoryEvent[] {
  const events = orderPracticeHistory(records, "as-missing")
    .reverse()
    .map((record) => normalizeEvent(record, goals, userId));
  let episode = 0;
  for (let index = 0; index < events.length; index++) {
    if (index === 0 || !continuesEpisode(events[index - 1], events[index]))
      episode++;
    events[index].episode = episode;
  }
  return events.reverse();
}

/** Metrics describe exactly the supplied visible events. Unknown intervals are
 * omitted, not zero-filled. Success/streak is meaningful only for FSRS ratings. */
export function summarizeHistoryEvents(events: readonly HistoryEvent[]) {
  const intervals = events.flatMap((event) =>
    event.intervalDays === null ? [] : [event.intervalDays]
  );
  const comparable =
    events.length > 0 && events.every((event) => event.rating !== null);
  let streak = 0;
  if (comparable) {
    for (const event of events) {
      if (event.episode !== events[0].episode || (event.rating ?? 0) < 3) break;
      streak++;
    }
  }
  return {
    totalSessions: events.length,
    averageInterval: intervals.length
      ? intervals.reduce((sum, value) => sum + value, 0) / intervals.length
      : null,
    successRate: comparable
      ? Math.round(
          (events.filter((event) => (event.rating ?? 0) >= 3).length /
            events.length) *
            100
        )
      : null,
    currentStreak: comparable ? streak : null,
  };
}

/** Each series contains only its own points. Grouping remains linear even when
 * every other event changes goal; separate datasets prevent lines across resets. */
export function historyStabilitySeries(events: readonly HistoryEvent[]) {
  const chronological = [...events].reverse();
  const series = new Map<
    number,
    { episode: number; points: { x: number; y: number }[] }
  >();
  chronological.forEach((event, index) => {
    if (event.state.kind !== "fsrs6") return;
    let group = series.get(event.episode);
    if (!group) {
      group = { episode: event.episode, points: [] };
      series.set(event.episode, group);
    }
    group.points.push({ x: index, y: event.state.state.stability });
  });
  return {
    records: chronological.map((event) => event.record),
    series: [...series.values()],
  };
}
