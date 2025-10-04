/**
 * Multiple quality list configurations for different practice goals and techniques
 *
 * FSRS uses a 4-value system: "Again", "Hard", "Good", "Easy"
 * SM2 uses a 6-value system: 0-5 scale
 */

/**
 * Represents a review feedback item with value and labels.
 */
interface IQualityItem {
  value: string;
  label: string;
  label2: string;
  int_value: number;
  color_style: string;
}

// SM2 Quality List (6-value system) - for recall goal with SM2 technique
export const qualityListSM2: IQualityItem[] = [
  {
    value: "(Not Set)",
    label: "(Not Set)",
    label2: "(Not Set)",
    int_value: -1,
    color_style: "bg-slate-95 dark:bg-slate-800",
  },
  {
    value: "blackout",
    label: "Blackout (no recall, even with hint)",
    label2: "0: complete blackout",
    int_value: 0,
    color_style: "bg-red-100 dark:bg-red-900",
  },
  {
    value: "failed",
    label: "Failed (but remembered after hint)",
    label2: "1: incorrect response; the correct one remembered",
    int_value: 1,
    color_style: "bg-orange-100 dark:bg-orange-900",
  },
  {
    value: "barely",
    label: "Barely Remembered Some (perhaps A part but not B part)",
    label2:
      "2: incorrect response; where the correct one seemed easy to recall",
    int_value: 2,
    color_style: "bg-yellow-100 dark:bg-yellow-900",
  },
  {
    value: "struggled",
    label: "Remembered with Some Mistakes (and needed verification)",
    label2: "3: correct response recalled with serious difficulty",
    int_value: 3,
    color_style: "bg-blue-100 dark:bg-blue-900",
  },
  {
    value: "trivial",
    label: "Not Bad (but maybe not session ready)",
    label2: "4: correct response after a hesitation",
    int_value: 4,
    color_style: "bg-purple-100 dark:bg-purple-900",
  },
  {
    value: "perfect",
    label: "Good (could perform solo or lead in session)",
    label2: "5: perfect response",
    int_value: 5,
    color_style: "bg-green-100 dark:bg-green-900",
  },
];

// FSRS Quality List (4-value system) - for recall goal with FSRS technique
export const qualityListFSRS: IQualityItem[] = [
  {
    value: "(Not Set)",
    label: "(Not Set)",
    label2: "(Not Set)",
    int_value: -1,
    color_style: "bg-slate-95 dark:bg-slate-800",
  },
  {
    value: "again",
    label: "Again (need to repeat soon)",
    label2: "Again: need to practice again soon",
    int_value: 0,
    color_style: "bg-red-100 dark:bg-red-900",
  },
  {
    value: "hard",
    label: "Hard (difficult but manageable)",
    label2: "Hard: difficult recall with effort",
    int_value: 1,
    color_style: "bg-orange-100 dark:bg-orange-900",
  },
  {
    value: "good",
    label: "Good (satisfactory recall)",
    label2: "Good: satisfactory recall performance",
    int_value: 2,
    color_style: "bg-blue-100 dark:bg-blue-900",
  },
  {
    value: "easy",
    label: "Easy (effortless recall)",
    label2: "Easy: effortless and confident recall",
    int_value: 3,
    color_style: "bg-green-100 dark:bg-green-900",
  },
];

// Initial Learn Quality List (4-value system) - focused on learning progression
export const qualityListInitialLearn: IQualityItem[] = [
  {
    value: "(Not Set)",
    label: "(Not Set)",
    label2: "(Not Set)",
    int_value: -1,
    color_style: "bg-slate-95 dark:bg-slate-800",
  },
  {
    value: "again",
    label: "Again (need more work)",
    label2: "Again: requires more practice",
    int_value: 0,
    color_style: "bg-red-100 dark:bg-red-900",
  },
  {
    value: "hard",
    label: "Hard (making progress)",
    label2: "Hard: learning with effort",
    int_value: 1,
    color_style: "bg-orange-100 dark:bg-orange-900",
  },
  {
    value: "good",
    label: "Good (getting it)",
    label2: "Good: solid learning progress",
    int_value: 2,
    color_style: "bg-blue-100 dark:bg-blue-900",
  },
  {
    value: "easy",
    label: "Easy (learned well)",
    label2: "Easy: well learned for this level",
    int_value: 3,
    color_style: "bg-green-100 dark:bg-green-900",
  },
];

// Fluency Quality List (4-value system) - focused on smooth performance
export const qualityListFluency: IQualityItem[] = [
  {
    value: "(Not Set)",
    label: "(Not Set)",
    label2: "(Not Set)",
    int_value: -1,
    color_style: "bg-slate-95 dark:bg-slate-800",
  },
  {
    value: "again",
    label: "Again (choppy, needs work)",
    label2: "Again: choppy or hesitant performance",
    int_value: 0,
    color_style: "bg-red-100 dark:bg-red-900",
  },
  {
    value: "hard",
    label: "Hard (some hesitation)",
    label2: "Hard: some hesitation in flow",
    int_value: 1,
    color_style: "bg-orange-100 dark:bg-orange-900",
  },
  {
    value: "good",
    label: "Good (mostly smooth)",
    label2: "Good: mostly smooth performance",
    int_value: 2,
    color_style: "bg-blue-100 dark:bg-blue-900",
  },
  {
    value: "easy",
    label: "Easy (very fluent)",
    label2: "Easy: very fluent and smooth",
    int_value: 3,
    color_style: "bg-green-100 dark:bg-green-900",
  },
];

// Session Ready Quality List (4-value system) - focused on performance readiness
export const qualityListSessionReady: IQualityItem[] = [
  {
    value: "(Not Set)",
    label: "(Not Set)",
    label2: "(Not Set)",
    int_value: -1,
    color_style: "bg-slate-95 dark:bg-slate-800",
  },
  {
    value: "again",
    label: "Again (not ready)",
    label2: "Again: not ready for session play",
    int_value: 0,
    color_style: "bg-red-100 dark:bg-red-900",
  },
  {
    value: "hard",
    label: "Hard (might manage)",
    label2: "Hard: might manage in supportive session",
    int_value: 1,
    color_style: "bg-orange-100 dark:bg-orange-900",
  },
  {
    value: "good",
    label: "Good (session ready)",
    label2: "Good: ready for session participation",
    int_value: 2,
    color_style: "bg-blue-100 dark:bg-blue-900",
  },
  {
    value: "easy",
    label: "Easy (can lead)",
    label2: "Easy: confident enough to lead",
    int_value: 3,
    color_style: "bg-green-100 dark:bg-green-900",
  },
];

// Performance Polish Quality List (4-value system) - focused on refinement
export const qualityListPerformancePolish: IQualityItem[] = [
  {
    value: "(Not Set)",
    label: "(Not Set)",
    label2: "(Not Set)",
    int_value: -1,
    color_style: "bg-slate-95 dark:bg-slate-800",
  },
  {
    value: "again",
    label: "Again (needs polish)",
    label2: "Again: needs significant polish work",
    int_value: 0,
    color_style: "bg-red-100 dark:bg-red-900",
  },
  {
    value: "hard",
    label: "Hard (some refinement needed)",
    label2: "Hard: some refinement still needed",
    int_value: 1,
    color_style: "bg-orange-100 dark:bg-orange-900",
  },
  {
    value: "good",
    label: "Good (well polished)",
    label2: "Good: well polished performance",
    int_value: 2,
    color_style: "bg-blue-100 dark:bg-blue-900",
  },
  {
    value: "easy",
    label: "Easy (performance ready)",
    label2: "Easy: performance ready quality",
    int_value: 3,
    color_style: "bg-green-100 dark:bg-green-900",
  },
];

/**
 * Get appropriate quality list based on goal and technique
 */
export function getQualityListForGoalAndTechnique(
  goal?: string | null,
  technique?: string | null,
): IQualityItem[] {
  // Default to recall goal if not specified
  const goalToUse = goal || "recall";

  // For recall goal, use technique to determine quality list
  if (goalToUse === "recall") {
    // Default to FSRS if technique not specified
    if (technique === "sm2") {
      return qualityListSM2;
    }
    return qualityListFSRS; // Default for recall
  }

  // For non-recall goals, use 4-value FSRS-style lists
  switch (goalToUse) {
    case "initial_learn":
      return qualityListInitialLearn;
    case "fluency":
      return qualityListFluency;
    case "session_ready":
      return qualityListSessionReady;
    case "performance_polish":
      return qualityListPerformancePolish;
    default:
      return qualityListFSRS; // Fallback
  }
}

/**
 * Get quality item by search value from any quality list
 */
export function lookupQualityItem(
  search: string | number,
  qualityList: IQualityItem[],
): IQualityItem | undefined {
  return qualityList.find(
    (item) => item.value === search || item.int_value === search,
  );
}

/**
 * Get color styling for evaluation from any quality list
 */
export function getColorForEvaluation(
  review_status: string | null,
  qualityList: IQualityItem[],
  isTrigger = false,
): string {
  const defaultColor = isTrigger ? "bg-slate-95 dark:bg-slate-800" : "";
  if (!review_status) {
    return defaultColor;
  }
  const qualityItem = lookupQualityItem(review_status, qualityList);
  if (!qualityItem) {
    return defaultColor;
  }
  return qualityItem.color_style;
}

// Re-export the original quality list for backward compatibility
export const qualityList = qualityListSM2;
