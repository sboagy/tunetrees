import type { ChartData } from "chart.js";
import type { PracticeRecord } from "@/lib/db/types";
import { FSRS_QUALITY_MAP } from "@/lib/scheduling/fsrs-service";

export interface PracticeHistoryQualityDisplay {
  label: string;
  colorClass: string;
  chartColor: string;
}

export interface PracticeHistorySummary {
  totalSessions: number;
  successRate: number;
  currentStreak: number;
  averageInterval: number;
}

const QUALITY_DISPLAY_BY_VALUE: Record<number, PracticeHistoryQualityDisplay> = {
  [FSRS_QUALITY_MAP.AGAIN]: {
    label: "Again",
    colorClass: "text-red-600 dark:text-red-400",
    chartColor: "hsla(0, 84%, 60%, 0.85)",
  },
  [FSRS_QUALITY_MAP.HARD]: {
    label: "Hard",
    colorClass: "text-orange-600 dark:text-orange-400",
    chartColor: "hsla(25, 95%, 53%, 0.85)",
  },
  [FSRS_QUALITY_MAP.GOOD]: {
    label: "Good",
    colorClass: "text-green-600 dark:text-green-400",
    chartColor: "hsla(142, 71%, 45%, 0.85)",
  },
  [FSRS_QUALITY_MAP.EASY]: {
    label: "Easy",
    colorClass: "text-blue-600 dark:text-blue-400",
    chartColor: "hsla(221, 83%, 53%, 0.85)",
  },
};

const STATE_LABELS: Record<number, string> = {
  0: "New",
  1: "Learning",
  2: "Review",
  3: "Relearning",
};

function getComparableTimestamp(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getShortSessionLabel(record: PracticeRecord, index: number): string {
  const timestamp = getComparableTimestamp(record.practiced);
  if (!timestamp) {
    return `#${index + 1}`;
  }

  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function getOrderedRecords(records: PracticeRecord[]): PracticeRecord[] {
  return [...records].sort(
    (left, right) =>
      getComparableTimestamp(left.practiced) -
      getComparableTimestamp(right.practiced)
  );
}

export function getPracticeHistoryQualityDisplay(
  quality: number | null | undefined
): PracticeHistoryQualityDisplay {
  if (!quality) {
    return {
      label: "—",
      colorClass: "text-muted-foreground",
      chartColor: "hsla(240, 3.8%, 46.1%, 0.45)",
    };
  }

  return (
    QUALITY_DISPLAY_BY_VALUE[quality] ?? {
      label: `Quality ${quality}`,
      colorClass: "text-muted-foreground",
      chartColor: "hsla(240, 3.8%, 46.1%, 0.45)",
    }
  );
}

export function getPracticeHistoryStateLabel(
  state: number | null | undefined
): string {
  if (state == null) {
    return "—";
  }

  return STATE_LABELS[state] ?? "—";
}

export function formatPracticeHistoryDate(
  value: string | null | undefined
): string {
  if (!value) {
    return "—";
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return "—";
  }

  return new Date(timestamp).toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function buildPracticeHistorySummary(
  records: PracticeRecord[]
): PracticeHistorySummary {
  if (records.length === 0) {
    return {
      totalSessions: 0,
      successRate: 0,
      currentStreak: 0,
      averageInterval: 0,
    };
  }

  const orderedRecords = getOrderedRecords(records);
  const successCount = orderedRecords.filter(
    (record) =>
      record.quality === FSRS_QUALITY_MAP.GOOD ||
      record.quality === FSRS_QUALITY_MAP.EASY
  ).length;

  let currentStreak = 0;
  for (let index = orderedRecords.length - 1; index >= 0; index -= 1) {
    const quality = orderedRecords[index].quality;
    if (
      quality === FSRS_QUALITY_MAP.GOOD ||
      quality === FSRS_QUALITY_MAP.EASY
    ) {
      currentStreak += 1;
      continue;
    }

    break;
  }

  const totalInterval = orderedRecords.reduce(
    (sum, record) => sum + (record.interval ?? 0),
    0
  );

  return {
    totalSessions: orderedRecords.length,
    successRate: Math.round((successCount / orderedRecords.length) * 100),
    currentStreak,
    averageInterval:
      Math.round((totalInterval / orderedRecords.length) * 10) / 10,
  };
}

export function buildPracticeHistoryQualityChart(
  records: PracticeRecord[]
): ChartData<"bar"> | null {
  if (records.length === 0) {
    return null;
  }

  const orderedRecords = getOrderedRecords(records);

  return {
    labels: orderedRecords.map((record, index) =>
      getShortSessionLabel(record, index)
    ),
    datasets: [
      {
        label: "FSRS rating",
        data: orderedRecords.map((record) => record.quality ?? 0),
        backgroundColor: orderedRecords.map(
          (record) => getPracticeHistoryQualityDisplay(record.quality).chartColor
        ),
        borderRadius: 4,
      },
    ],
  };
}

export function buildPracticeHistoryStabilityChart(
  records: PracticeRecord[]
): ChartData<"line"> | null {
  const stableRecords = getOrderedRecords(records).filter(
    (record) => record.stability != null
  );

  if (stableRecords.length === 0) {
    return null;
  }

  return {
    labels: stableRecords.map((record, index) =>
      getShortSessionLabel(record, index)
    ),
    datasets: [
      {
        label: "Stability",
        data: stableRecords.map((record) =>
          Number(record.stability?.toFixed(2) ?? 0)
        ),
        fill: true,
        tension: 0.35,
        borderColor: "hsl(221, 83%, 53%)",
        backgroundColor: "hsla(221, 83%, 53%, 0.15)",
        pointBackgroundColor: "hsl(221, 83%, 53%)",
        pointBorderColor: "hsl(221, 83%, 53%)",
        pointRadius: 3,
      },
    ],
  };
}
