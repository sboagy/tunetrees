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

  // Shapes observed in the staging rehearsal, expressed without personal IDs.
  it.each([
    [
      "Carraroe",
      "2026-11-17T21:03:22Z",
      "2026-11-23T17:00:00Z",
      "2026-11-24T00:40:18Z",
    ],
    [
      "Woman",
      "2026-11-17T21:03:36Z",
      "2026-11-22T17:00:00Z",
      "2026-11-17T20:53:45Z",
    ],
    [
      "Blackbird",
      "2026-11-17T21:03:50Z",
      "2026-11-22T17:00:00Z",
      "2026-11-17T20:25:13Z",
    ],
    [
      "Tolka",
      "2026-11-18T01:31:26Z",
      "2026-11-19T17:00:00Z",
      "2026-11-19T21:24:54Z",
    ],
    [
      "Rolling",
      "2026-11-22T23:08:02Z",
      "2026-11-22T17:00:00Z",
      "2026-11-23T02:39:58Z",
    ],
  ])(
    "recovers %s despite noon completion and independent practice time",
    (_name, generated, completed, practiced) => {
      const source = {
        ...queue,
        row: { ...queue.row, generated_at: generated, completed_at: completed },
      };
      const candidate = {
        ...event,
        row: { ...event.row, practiced, last_modified_at: completed },
      };
      const result = prepareQueueCompletions([source], [candidate]);
      expect(result.unresolved).toEqual([]);
      expect(result.updates).toHaveLength(1);
      expect(result.updates[0].event).toEqual(candidate);
    }
  );

  it("does not disambiguate a shared noon stamp using practice order", () => {
    const completed = "2026-11-22T17:00:00Z";
    const source = {
      ...queue,
      row: {
        ...queue.row,
        generated_at: "2026-11-22T23:08:02Z",
        completed_at: completed,
      },
    };
    const first = {
      ...event,
      row: {
        ...event.row,
        practiced: "2026-11-22T18:00:00Z",
        last_modified_at: completed,
      },
    };
    const second = {
      ...first,
      key: "second",
      row: { ...first.row, id: "second", practiced: "2026-11-23T02:39:58Z" },
    };
    const result = prepareQueueCompletions([source], [first, second]);
    expect(result.updates).toEqual([]);
    expect(result.unresolved).toHaveLength(1);
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
    { row: { ...event.row, practiced: "invalid" } },
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

describe("imported queue window recovery", () => {
  const importedQueue = {
    ...queue,
    row: {
      ...queue.row,
      device_id: "data-migration-2025-10-05",
      window_start_utc: "2020-01-03T00:00:00Z",
      window_end_utc: "2020-01-04T00:00:00Z",
    },
  };
  const importedEvent = {
    ...event,
    row: {
      ...event.row,
      device_id: "data-migration-2025-10-05",
      practiced: "2020-01-03T15:00:00Z",
      last_modified_at: "2020-02-01T00:00:00Z",
    },
  };

  it("recovers one in-window event without requiring practiced to equal completion", () => {
    const result = prepareQueueCompletions([importedQueue], [importedEvent]);
    expect(result.updates.map((entry) => entry.event.key)).toEqual(["event"]);
    expect(result.updates[0].event.row.practiced).toBe(
      importedEvent.row.practiced
    );
  });

  it("recovers an older window independently of a newer unfinished queue", () => {
    const newer = {
      ...importedQueue,
      row: {
        ...importedQueue.row,
        id: "newer",
        completed_at: null,
        window_start_utc: "2020-01-04T00:00:00Z",
      },
    };
    expect(
      prepareQueueCompletions(
        [importedQueue, newer],
        [importedEvent]
      ).updates.map((entry) => entry.event.key)
    ).toEqual(["event"]);
  });

  it("uses the in-window event even when later practice exists", () => {
    const later = {
      ...importedEvent,
      key: "later",
      row: {
        ...importedEvent.row,
        id: "later",
        practiced: "2020-01-05T15:00:00Z",
      },
    };
    expect(
      prepareQueueCompletions(
        [importedQueue],
        [later, importedEvent]
      ).updates.map((entry) => entry.event.key)
    ).toEqual(["event"]);
  });

  it("does not hide a second event with different provenance", () => {
    const second = {
      ...importedEvent,
      key: "second",
      row: { ...importedEvent.row, id: "second", device_id: "another" },
    };
    expect(
      prepareQueueCompletions([importedQueue], [importedEvent, second]).updates
    ).toEqual([]);
  });

  it.each([
    { practiced: "2020-01-04T00:00:00Z" },
    { practiced: "2020-01-02T23:59:59Z" },
    { device_id: "another" },
    { scheduler_id: "builtin:fsrs6" },
    { repertoire_ref: "other" },
    { tune_ref: "other" },
  ])("rejects unavailable or ineligible window evidence: %j", (override) => {
    expect(
      prepareQueueCompletions(
        [importedQueue],
        [
          {
            ...importedEvent,
            row: { ...importedEvent.row, ...override },
          },
        ]
      ).updates
    ).toEqual([]);
  });
});
