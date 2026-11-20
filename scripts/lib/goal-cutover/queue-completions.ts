import { normalizePracticeTimestamp } from "../../../src/lib/utils/practice-history";
import {
  type GoalReferenceSource,
  hasNewEventMetadata,
} from "./reference-backfill";

export interface QueueCompletionSource {
  ownerId: string | null;
  row: {
    id: string;
    user_ref: string;
    repertoire_ref: string;
    tune_ref: string;
    active: boolean | number;
    generated_at: string;
    completed_at: string | null;
    displayed_practice_record_id: string | null;
    [key: string]: unknown;
  };
}

function timestamp(value: unknown): string {
  if (typeof value !== "string")
    throw new Error("Missing completion evidence timestamp");
  return normalizePracticeTimestamp(value);
}

/** Goal attribution may change in this same cutover; all other event evidence must match. */
function eventEvidence(source: GoalReferenceSource) {
  return { ...source, goalId: null, row: { ...source.row, goal_id: null } };
}

/** Recover an imported window; this is an inference, not a submission ID. */
function importedWindowCandidate(
  queue: QueueCompletionSource,
  history: readonly GoalReferenceSource[]
) {
  const marker = "data-migration-2025-10-05";
  if (queue.row.device_id !== marker) return undefined;
  const start = timestamp(queue.row.window_start_utc);
  const end = timestamp(queue.row.window_end_utc);
  if (end <= start) throw new Error("Invalid queue window");
  // Include all events when checking uniqueness: a second event of another
  // format or provenance must not be hidden to manufacture a unique match.
  const candidates = history.filter((event) => {
    const practiced = timestamp(event.row.practiced);
    return practiced >= start && practiced < end;
  });
  if (candidates.length !== 1) return undefined;
  const event = candidates[0];
  if (event.row.device_id !== marker || hasNewEventMetadata(event))
    return undefined;
  return event;
}

function matchingEvent(
  queue: QueueCompletionSource,
  history: readonly GoalReferenceSource[]
) {
  const row = queue.row;
  if (queue.ownerId !== row.user_ref)
    throw new Error("Queue repertoire ownership is unavailable");
  const completed = timestamp(row.completed_at);
  const generated = timestamp(row.generated_at);
  if (completed < generated)
    throw new Error("Completion predates queue generation");
  const ownedHistory = history.filter(
    (event) =>
      event.kind === "history" &&
      event.ownerId === queue.ownerId &&
      event.row.repertoire_ref === row.repertoire_ref &&
      event.row.tune_ref === row.tune_ref
  );
  const candidates = ownedHistory.filter(
    (event) => timestamp(event.row.last_modified_at) === completed
  );
  if (candidates.length === 0) {
    const recovered = importedWindowCandidate(queue, ownedHistory);
    if (recovered) return recovered;
  }
  if (candidates.length !== 1)
    throw new Error("No unique event matches the completion timestamp");
  const event = candidates[0];
  if (hasNewEventMetadata(event))
    throw new Error("Completion evidence is not a legacy event");
  const practiced = timestamp(event.row.practiced);
  if (practiced < generated || practiced > completed)
    throw new Error("Practice time is outside the queue lifetime");
  return event;
}

/** Prefer exact submission evidence; permit unique-in-window import recovery. */
export function prepareQueueCompletions(
  queues: readonly QueueCompletionSource[],
  history: readonly GoalReferenceSource[]
) {
  const updates: Array<{
    expected: QueueCompletionSource;
    event: GoalReferenceSource;
  }> = [];
  const unresolved: Array<{ id: string; reason: string }> = [];
  for (const queue of queues) {
    if (
      !queue.row.active ||
      queue.row.completed_at === null ||
      queue.row.displayed_practice_record_id !== null
    )
      continue;
    try {
      const event = matchingEvent(queue, history);
      updates.push({
        expected: structuredClone(queue),
        event: structuredClone(eventEvidence(event)),
      });
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      unresolved.push({ id: queue.row.id, reason: error.message });
    }
  }
  return { updates, unresolved };
}
