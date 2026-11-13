import { describe, expect, it } from "vitest";
import type { NextReviewSchedule } from "../../../src/lib/db/types";
import { normalizeScheduleOutput } from "../../../src/lib/plugins/scheduling";

const fallback: NextReviewSchedule = {
  nextDue: new Date("2026-01-22T12:00:00Z"),
  last_review: new Date("2026-01-20T12:00:00Z"),
  interval: 2,
  state: 2,
  stability: 3,
  difficulty: 4,
  elapsed_days: 1,
  scheduled_days: 2,
  reps: 3,
  lapses: 0,
};
describe("scheduler result contract", () => {
  it("preserves an intentional no-override result", () => {
    expect(normalizeScheduleOutput(null, fallback)).toBeNull();
  });
  it.each([undefined, 0, false, "schedule", []])(
    "reports an invalid output %j",
    (output) => {
      expect(() => normalizeScheduleOutput(output, fallback)).toThrow(
        "schedule object or null"
      );
    }
  );
  it("preserves partial schedule defaults and aliases", () => {
    expect(
      normalizeScheduleOutput(
        { interval: 4, next_due: "2026-01-24T12:00:00Z", scheduled_days: 4 },
        fallback
      )
    ).toEqual({
      ...fallback,
      interval: 4,
      nextDue: new Date("2026-01-24T12:00:00Z"),
      scheduled_days: 4,
    });
  });
});
