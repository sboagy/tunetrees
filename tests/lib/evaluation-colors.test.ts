import { describe, expect, it } from "vitest";
import {
  evaluationChoiceColor,
  recordedEvaluationColor,
} from "../../src/lib/goals/evaluation-colors";

describe("shared evaluation colors", () => {
  it("preserves the recorded FSRS outcome even after a goal change", () => {
    expect(recordedEvaluationColor("fsrs", 3)).toContain("text-green-700");
  });
  it("gives ladder reset the same color as Again", () => {
    expect(recordedEvaluationColor("reset", null)).toBe(
      recordedEvaluationColor("fsrs", 1)
    );
  });
  it("does not invent an outcome for unknown historical actions", () => {
    expect(recordedEvaluationColor(null, null)).toBe("text-foreground");
  });
  it("uses the middle palette color for the third of five custom actions", () => {
    expect(
      evaluationChoiceColor(
        {
          id: "a",
          label: "Middle",
          description: "",
          action: { kind: "plugin", actionId: "middle" },
        },
        2,
        5
      )
    ).toContain("text-yellow-800");
  });
});
