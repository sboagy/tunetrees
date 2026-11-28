import type { EvaluationChoice } from "./config";

// Shared outcome colors; identity colors for goals live in goal-colors.ts.
const colors = [
  "text-red-700 dark:text-red-400",
  "text-orange-700 dark:text-orange-400",
  "text-green-700 dark:text-green-400",
  "text-blue-700 dark:text-blue-400",
] as const;
const ladderActions = ["reset", "back", "stay", "advance"];

export function recordedEvaluationColor(
  action: string | null,
  rating: number | null
): string {
  const index =
    rating === null ? ladderActions.indexOf(action ?? "") : rating - 1;
  return colors[index] ?? "text-foreground";
}

export function evaluationChoiceColor(
  choice: EvaluationChoice,
  index: number,
  count: number
): string {
  if (choice.action.kind !== "plugin") {
    return recordedEvaluationColor(
      choice.action.kind,
      choice.action.kind === "fsrs" ? choice.action.rating : null
    );
  }
  // Custom actions have no built-in outcome semantics. Use their declared order.
  const palette =
    count === 5
      ? [
          colors[0],
          colors[1],
          "text-yellow-800 dark:text-yellow-300",
          colors[2],
          colors[3],
        ]
      : colors;
  return palette[index] ?? "text-foreground";
}
