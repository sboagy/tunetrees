export interface EvaluationDisplayInput {
  latestQuality?: number | null;
  latestTechnique?: string | null;
  recallEval?: string | null;
}

export interface EvaluationDisplay {
  label: string;
  colorClass: string;
}

const DEFAULT_EVALUATION_DISPLAY: EvaluationDisplay = {
  label: "(Not Set)",
  colorClass: "text-gray-600 dark:text-gray-400",
};

const RECALL_EVAL_LABELS: Record<string, string> = {
  again: "Again",
  hard: "Hard",
  good: "Good",
  easy: "Easy",
};

const RECALL_EVAL_COLORS: Record<string, string> = {
  again: "text-red-600 dark:text-red-400",
  hard: "text-orange-600 dark:text-orange-400",
  good: "text-green-600 dark:text-green-400",
  easy: "text-blue-600 dark:text-blue-400",
};

const SM2_LABELS: Record<number, string> = {
  0: "Complete blackout",
  1: "Incorrect response",
  2: "Incorrect (easy to recall)",
  3: "Correct (serious difficulty)",
  4: "Correct (hesitation)",
  5: "Perfect response",
};

const SM2_COLORS: Record<number, string> = {
  0: "text-red-600 dark:text-red-400",
  1: "text-red-600 dark:text-red-400",
  2: "text-orange-600 dark:text-orange-400",
  3: "text-yellow-600 dark:text-yellow-400",
  4: "text-green-600 dark:text-green-400",
  5: "text-blue-600 dark:text-blue-400",
};

const FSRS_QUALITY_LABELS: Record<number, string> = {
  1: "Again",
  2: "Hard",
  3: "Good",
  4: "Easy",
};

const FSRS_QUALITY_COLORS: Record<number, string> = {
  1: "text-red-600 dark:text-red-400",
  2: "text-orange-600 dark:text-orange-400",
  3: "text-green-600 dark:text-green-400",
  4: "text-blue-600 dark:text-blue-400",
};

export function getRecallEvalDisplay(
  recallEval: string | null | undefined
): EvaluationDisplay | null {
  if (!recallEval) return null;

  return {
    label: RECALL_EVAL_LABELS[recallEval] ?? recallEval,
    colorClass:
      RECALL_EVAL_COLORS[recallEval] ?? DEFAULT_EVALUATION_DISPLAY.colorClass,
  };
}

export function getSubmittedEvaluationDisplay(
  input: EvaluationDisplayInput
): EvaluationDisplay {
  if (input.latestQuality != null) {
    if (input.latestTechnique === "sm2") {
      return {
        label:
          SM2_LABELS[input.latestQuality] ?? `Quality ${input.latestQuality}`,
        colorClass:
          SM2_COLORS[input.latestQuality] ??
          DEFAULT_EVALUATION_DISPLAY.colorClass,
      };
    }

    return {
      label:
        FSRS_QUALITY_LABELS[input.latestQuality] ??
        `Quality ${input.latestQuality}`,
      colorClass:
        FSRS_QUALITY_COLORS[input.latestQuality] ??
        DEFAULT_EVALUATION_DISPLAY.colorClass,
    };
  }

  return getRecallEvalDisplay(input.recallEval) ?? DEFAULT_EVALUATION_DISPLAY;
}
