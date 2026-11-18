import { describe, expect, it } from "vitest";
import {
  prepareQueueCompletions,
  type QueueCompletionSource,
} from "../../../scripts/lib/goal-cutover/queue-completions";
import type { GoalReferenceSource } from "../../../scripts/lib/goal-cutover/reference-backfill";

const queue: QueueCompletionSource = {
  ownerId: "owner",
  row: {
    id: "queue",
    user_ref: "owner",
    repertoire_ref: "rep",
    tune_ref: "tune",
    active: true,
    generated_at: "2020-01-01 00:00:00",
    completed_at: "2020-01-03T10:00:00.123456Z",
    displayed_practice_record_id: null,
    allocation_goal_id: null,
    selection_reason: null,
  },
};
const event: GoalReferenceSource = {
  kind: "history",
  key: "event",
  ownerId: "owner",
  goal: "recall",
  goalId: null,
  schedulerId: null,
  row: {
    id: "event",
    repertoire_ref: "rep",
    tune_ref: "tune",
    goal_id: null,
    practiced: "2020-01-02T09:00:00Z",
    last_modified_at: "2020-01-03 10:00:00.123456",
  },
};

describe("legacy queue completion evidence", () => {
  it("links one exact submission match despite delayed submission without changing input", () => {
    const before = structuredClone({ queue, event });
    const result = prepareQueueCompletions([queue], [event]);
    expect(result.updates[0].event.key).toBe("event");
    expect(result.updates[0].expected).toEqual(before.queue);
    expect({ queue, event }).toEqual(before);
  });

  it("does not choose between two matching events", () => {
    const second = {
      ...event,
      key: "second",
      row: { ...event.row, id: "second" },
    };
    expect(prepareQueueCompletions([queue], [event, second]).updates).toEqual(
      []
    );
  });

  it.each([
    { ownerId: "another" },
    { row: { ...event.row, repertoire_ref: "other" } },
    { row: { ...event.row, tune_ref: "other" } },
    { row: { ...event.row, last_modified_at: "2020-01-03T10:00:00.123457Z" } },
    { row: { ...event.row, last_modified_at: "invalid" } },
    { row: { ...event.row, practiced: null } },
    { row: { ...event.row, practiced: "2019-12-31T23:59:59Z" } },
    { row: { ...event.row, practiced: "2020-01-04T00:00:00Z" } },
    { row: { ...event.row, scheduler_version: 0 } },
  ])(
    "leaves unavailable or inconsistent event evidence unlinked: %j",
    (override) => {
      const result = prepareQueueCompletions(
        [queue],
        [{ ...event, ...override }]
      );
      expect(result.updates).toEqual([]);
      expect(result.unresolved).toHaveLength(1);
    }
  );

  it("refuses a queue whose user does not own the repertoire", () => {
    expect(
      prepareQueueCompletions([{ ...queue, ownerId: "other" }], [event]).updates
    ).toEqual([]);
  });

  it.each([
    { active: false },
    { completed_at: null },
    { displayed_practice_record_id: "existing" },
  ])(
    "preserves inactive, unfinished and already linked queues: %j",
    (override) => {
      expect(
        prepareQueueCompletions(
          [{ ...queue, row: { ...queue.row, ...override } }],
          [event]
        )
      ).toEqual({ updates: [], unresolved: [] });
    }
  );

  it("ignores only goal-ID attribution changes when checking event evidence", () => {
    const first = prepareQueueCompletions([queue], [event]);
    const attributed = {
      ...event,
      goalId: "goal",
      row: { ...event.row, goal_id: "goal" },
    };
    expect(prepareQueueCompletions([queue], [attributed])).toEqual(first);
  });
});
