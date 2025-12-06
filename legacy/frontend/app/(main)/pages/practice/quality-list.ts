/**
 * Practice review evaluation configurations
 *
 * The intention is this will evolve to be adaptable to different space
 * repitiion review systems.
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

export const qualityList: IQualityItem[] = [
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

export function lookupQualityItem(
  search: string | number,
): IQualityItem | undefined {
  const qualityItem = qualityList.find(
    (item) => item.value === search || item.int_value === search,
  );
  return qualityItem;
}

export const getColorForEvaluation = (
  review_status: string | null,
  isTrigger = false,
): string => {
  const defaultColor = isTrigger ? "bg-slate-95 dark:bg-slate-800" : "";
  if (!review_status) {
    return defaultColor;
  }
  const qualityItem = lookupQualityItem(review_status);
  if (!qualityItem) {
    return defaultColor;
  }
  return qualityItem.color_style;
};
