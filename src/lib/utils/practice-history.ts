/** UTC, six-digit fractions match Postgres precision without SQLite date rounding. */
export function normalizePracticeTimestamp(value: string): string {
  const text = value
    .trim()
    .replace(" ", "T")
    .replace(/([+-]\d{2})$/, "$1:00");
  const parts =
    /^(.*T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:?\d{2})?$/i.exec(text);
  if (!parts) throw new Error("Invalid practice timestamp");
  const date = new Date(`${parts[1]}${parts[3] ?? "Z"}`);
  if (!Number.isFinite(date.getTime()))
    throw new Error("Invalid practice timestamp");
  return `${date.toISOString().slice(0, -5)}.${(parts[2] ?? "").padEnd(6, "0")}Z`;
}

function descendingNullable(left: string | null, right: string | null): number {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left > right ? -1 : 1;
}

export type InvalidPracticeTimestampPolicy = "reject" | "as-missing";

function orderTimestamp(
  value: string | null,
  invalid: InvalidPracticeTimestampPolicy
): string | null {
  if (value === null) return null;
  try {
    return normalizePracticeTimestamp(value);
  } catch (error) {
    // Displays retain damaged historical rows; scheduling must reject them.
    if (invalid === "as-missing") return null;
    throw error;
  }
}

/** Canonical order: practiced DESC NULLS LAST, modified DESC NULLS LAST, ID DESC. */
export function orderPracticeHistory<
  T extends {
    id: string;
    practiced: string | null;
    lastModifiedAt: string | null;
  },
>(
  records: readonly T[],
  invalid: InvalidPracticeTimestampPolicy = "reject"
): T[] {
  // Normalize once per row, retaining microseconds and never mutating input/history.
  return records
    .map((row) => ({
      row,
      practiced: orderTimestamp(row.practiced, invalid),
      modified: orderTimestamp(row.lastModifiedAt, invalid),
    }))
    .sort(
      (left, right) =>
        descendingNullable(left.practiced, right.practiced) ||
        descendingNullable(left.modified, right.modified) ||
        descendingNullable(left.row.id, right.row.id)
    )
    .map(({ row }) => row);
}
