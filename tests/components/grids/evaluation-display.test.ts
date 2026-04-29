import { describe, expect, it } from "vitest";
import {
  getRecallEvalDisplay,
  getSubmittedEvaluationDisplay,
} from "../../../src/components/grids/evaluation-display";

describe("evaluation-display helpers", () => {
  it("maps fsrs completed quality values", () => {
    expect(
      getSubmittedEvaluationDisplay({
        latestQuality: 3,
        latestTechnique: "fsrs",
        recallEval: "again",
      })
    ).toEqual({
      label: "Good",
      colorClass: "text-green-600 dark:text-green-400",
    });
  });

  it("maps sm2 completed quality values", () => {
    expect(
      getSubmittedEvaluationDisplay({
        latestQuality: 5,
        latestTechnique: "sm2",
      })
    ).toEqual({
      label: "Perfect response",
      colorClass: "text-blue-600 dark:text-blue-400",
    });
  });

  it("falls back to recall-eval labels when quality is unavailable", () => {
    expect(
      getSubmittedEvaluationDisplay({
        latestQuality: null,
        latestTechnique: null,
        recallEval: "hard",
      })
    ).toEqual({
      label: "Hard",
      colorClass: "text-orange-600 dark:text-orange-400",
    });
  });

  it("returns the default unset display when no evaluation data exists", () => {
    expect(
      getSubmittedEvaluationDisplay({
        latestQuality: null,
        latestTechnique: null,
        recallEval: null,
      })
    ).toEqual({
      label: "(Not Set)",
      colorClass: "text-gray-600 dark:text-gray-400",
    });
  });

  it("returns null for empty recall-eval values", () => {
    expect(getRecallEvalDisplay("")).toBeNull();
  });
});
