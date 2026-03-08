/**
 * Scheduling window helpers for practice queue generation and queries.
 *
 * These utilities are intentionally pure so both the query layer and the
 * queue service can share the same windowing logic without coupling.
 */

export interface SchedulingWindows {
  startOfDayUtc: Date;
  endOfDayUtc: Date;
  windowFloorUtc: Date;
  startTs: string;
  endTs: string;
  windowFloorTs: string;
  tzOffsetMinutes: number | null;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const addDays = (date: Date, days: number): Date =>
  new Date(date.getTime() + days * MS_PER_DAY);

export function computeSchedulingWindows(
  reviewSitdownDate: Date,
  acceptableDelinquencyWindow: number,
  localTzOffsetMinutes: number | null
): SchedulingWindows {
  const sitdownUtc = new Date(reviewSitdownDate.toISOString());

  let startOfDayUtc: Date;

  if (localTzOffsetMinutes !== null) {
    const offsetMs = localTzOffsetMinutes * 60 * 1000;
    const localDt = new Date(sitdownUtc.getTime() + offsetMs);

    const localStart = new Date(
      Date.UTC(
        localDt.getUTCFullYear(),
        localDt.getUTCMonth(),
        localDt.getUTCDate(),
        0,
        0,
        0,
        0
      )
    );

    startOfDayUtc = new Date(localStart.getTime() - offsetMs);
  } else {
    startOfDayUtc = new Date(sitdownUtc);
    startOfDayUtc.setUTCHours(0, 0, 0, 0);
  }

  const endOfDayUtc = addDays(startOfDayUtc, 1);
  const windowFloorUtc = addDays(startOfDayUtc, -acceptableDelinquencyWindow);

  const formatTs = (dt: Date): string =>
    dt.toISOString().replace("T", " ").substring(0, 19);

  return {
    startOfDayUtc,
    endOfDayUtc,
    windowFloorUtc,
    startTs: formatTs(startOfDayUtc),
    endTs: formatTs(endOfDayUtc),
    windowFloorTs: formatTs(windowFloorUtc),
    tzOffsetMinutes: localTzOffsetMinutes,
  };
}

export function classifyQueueBucket(
  coalescedRaw: string | null | undefined,
  windows: SchedulingWindows
): number {
  if (!coalescedRaw) {
    return 1;
  }

  const raw = coalescedRaw.trim();
  const norm = raw.replace("T", " ");
  const norm19 = norm.length >= 19 ? norm.substring(0, 19) : norm;

  let dt: Date | null = null;

  try {
    const match = norm19.match(
      /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/
    );
    if (match) {
      const [, year, month, day, hour, minute, second] = match;
      dt = new Date(
        Date.UTC(
          parseInt(year, 10),
          parseInt(month, 10) - 1,
          parseInt(day, 10),
          parseInt(hour, 10),
          parseInt(minute, 10),
          parseInt(second, 10)
        )
      );
    }
  } catch {
    dt = null;
  }

  if (!dt) {
    try {
      dt = new Date(raw);
      if (Number.isNaN(dt.getTime())) {
        dt = null;
      }
    } catch {
      dt = null;
    }
  }

  if (!dt || Number.isNaN(dt.getTime())) {
    return 1;
  }

  const dtUtc = new Date(dt.toISOString());

  if (dtUtc >= windows.startOfDayUtc && dtUtc < windows.endOfDayUtc) {
    return 1;
  }

  if (dtUtc >= windows.windowFloorUtc && dtUtc < windows.startOfDayUtc) {
    return 2;
  }

  return 4;
}
