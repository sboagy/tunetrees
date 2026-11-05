import { formatAsWindowStart, getPracticeDate } from "./practice-date";

export const QUEUE_DATE_STORAGE_KEY = "TT_PRACTICE_QUEUE_DATE";
export const QUEUE_DATE_MANUAL_FLAG_KEY = "TT_PRACTICE_QUEUE_DATE_MANUAL";

/**
 * Parse a queue date string from localStorage into a Date, or null if invalid.
 *
 * For values without an explicit timezone we do NOT force UTC — instead we
 * extract the YYYY-MM-DD portion and construct a Date at local noon, matching
 * getPracticeDate() convention and avoiding cross-timezone day shifts.
 */
export function parseStoredDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Case 1: plain date "YYYY-MM-DD" → local noon.
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnlyMatch) {
    const localNoon = new Date(
      Number(dateOnlyMatch[1]),
      Number(dateOnlyMatch[2]) - 1,
      Number(dateOnlyMatch[3]),
      12,
      0,
      0,
      0
    );
    return Number.isNaN(localNoon.getTime()) ? null : localNoon;
  }

  // Case 2: unzoned datetime "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DDTHH:MM:SS" —
  // only the date part is relevant; use local noon.
  const dateTimeNoZoneMatch =
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(trimmed);
  if (dateTimeNoZoneMatch) {
    const localNoon = new Date(
      Number(dateTimeNoZoneMatch[1]),
      Number(dateTimeNoZoneMatch[2]) - 1,
      Number(dateTimeNoZoneMatch[3]),
      12,
      0,
      0,
      0
    );
    return Number.isNaN(localNoon.getTime()) ? null : localNoon;
  }

  // Case 3: explicit zone (e.g. toISOString() output) or other format —
  // let the Date constructor handle it.
  const normalized = trimmed.includes("T")
    ? trimmed
    : trimmed.replace(" ", "T");
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** A saved selection is only a preference; callers must verify queue rows exist. */
export function getPreferredQueueWindowStart(): string | null {
  if (
    typeof localStorage === "undefined" ||
    localStorage.getItem(QUEUE_DATE_MANUAL_FLAG_KEY) !== "true"
  )
    return null;
  const date = parseStoredDate(localStorage.getItem(QUEUE_DATE_STORAGE_KEY));
  // Practice clears a manual lock to today and resolves the latest queue instead.
  if (!date || date.toDateString() === getPracticeDate().toDateString())
    return null;
  return formatAsWindowStart(date);
}
