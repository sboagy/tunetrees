import { describe, expect, it } from "vitest";
import { shouldClearConsumedScheduledOverride } from "../../src/lib/services/practice-recording";

describe("shouldClearConsumedScheduledOverride", () => {
  it("clears an unchanged override that already scheduled the current queue row", () => {
    expect(
      shouldClearConsumedScheduledOverride({
        queueScheduledSnapshot: "2026-04-05T15:00:00.000Z",
        currentScheduled: "2026-04-05T15:00:00.000Z",
        queueGeneratedAt: "2026-04-04T12:00:00.000Z",
        repertoireTuneLastModifiedAt: "2026-04-04T12:00:00.000Z",
      })
    ).toBe(true);
  });

  it("preserves an override that was newly created after the queue row was generated", () => {
    expect(
      shouldClearConsumedScheduledOverride({
        queueScheduledSnapshot: null,
        currentScheduled: "2026-04-06T15:00:00.000Z",
        queueGeneratedAt: "2026-04-04T12:00:00.000Z",
        repertoireTuneLastModifiedAt: "2026-04-04T12:30:00.000Z",
      })
    ).toBe(false);
  });

  it("preserves an override that was changed after queue generation even if the value matches the old snapshot", () => {
    expect(
      shouldClearConsumedScheduledOverride({
        queueScheduledSnapshot: "2026-04-05T15:00:00.000Z",
        currentScheduled: "2026-04-05T15:00:00.000Z",
        queueGeneratedAt: "2026-04-04T12:00:00.000Z",
        repertoireTuneLastModifiedAt: "2026-04-04T12:30:00.000Z",
      })
    ).toBe(false);
  });

  it("preserves an override when the current value differs from the queue snapshot", () => {
    expect(
      shouldClearConsumedScheduledOverride({
        queueScheduledSnapshot: "2026-04-05T15:00:00.000Z",
        currentScheduled: "2026-04-06T15:00:00.000Z",
        queueGeneratedAt: "2026-04-04T12:00:00.000Z",
        repertoireTuneLastModifiedAt: "2026-04-04T12:30:00.000Z",
      })
    ).toBe(false);
  });
});
