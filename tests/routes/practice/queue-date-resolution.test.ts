/**
 * Tests for practice queue date resolution from DB window_start_utc.
 *
 * Regression coverage for the timezone bug where parseStoredDate() appended "Z"
 * to DB-stored "YYYY-MM-DD HH:MM:SS" strings, treating them as UTC midnight.
 * In any timezone behind UTC (EST, PST, etc.), UTC midnight is the previous local
 * calendar day — causing a spurious date rollover banner to appear.
 *
 * The fix: extract the YYYY-MM-DD portion and construct a local-noon Date, which
 * always matches the intended local calendar day regardless of timezone offset.
 */

import { describe, expect, it } from "vitest";

// Mirrors the private `toLocalDateString` helper in usePracticeQueueDate.ts.
// Must stay in sync if that function changes.
function toLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * THE FIX: extract YYYY-MM-DD from a DB window_start_utc value and construct
 * a local-noon Date. Mirrors Step 2 in usePracticeQueueDate.ts.
 */
function resolveWindowDateFixed(windowStartUtc: string): Date {
  const datePart = windowStartUtc.substring(0, 10); // "YYYY-MM-DD"
  return new Date(`${datePart}T12:00:00`); // local noon, no "Z"
}

/**
 * THE BUG (pre-fix): append "Z" to turn the DB string into UTC midnight.
 * In UTC-negative timezones, this rolls the local calendar date back by one day.
 */
function resolveWindowDateOld(windowStartUtc: string): Date {
  const normalized = windowStartUtc.trim().replace(" ", "T");
  const withZ = /(?:Z|[+-]\d{2}:\d{2})$/.test(normalized)
    ? normalized
    : `${normalized}Z`;
  return new Date(withZ); // UTC midnight interpretation
}

describe("practice queue date resolution from DB window_start_utc", () => {
  // Representative DB values covering the midnight edge case and the
  // T-separator variant (both are produced by getLatestActiveQueueWindow).
  const DB_CASES: Array<{ raw: string; expectedDate: string }> = [
    { raw: "2026-03-07 00:00:00", expectedDate: "2026-03-07" },
    { raw: "2026-03-07T00:00:00", expectedDate: "2026-03-07" },
    { raw: "2025-12-31 00:00:00", expectedDate: "2025-12-31" }, // year boundary
    { raw: "2025-01-01 00:00:00", expectedDate: "2025-01-01" }, // year boundary reverse
    { raw: "2025-07-20 00:00:00", expectedDate: "2025-07-20" }, // STANDARD_TEST_DATE calendar date
  ];

  describe("fixed resolution (local noon)", () => {
    it.each(
      DB_CASES
    )("resolves '$raw' to local date $expectedDate regardless of timezone", ({
      raw,
      expectedDate,
    }) => {
      const resolved = resolveWindowDateFixed(raw);
      // Use local calendar methods — this must match the DB date in ANY timezone.
      expect(toLocalDateString(resolved)).toBe(expectedDate);
    });

    it("returns a local noon time (avoids DST edge)", () => {
      const resolved = resolveWindowDateFixed("2026-03-07 00:00:00");
      expect(resolved.getHours()).toBe(12);
      expect(resolved.getMinutes()).toBe(0);
      expect(resolved.getSeconds()).toBe(0);
    });
  });

  describe("old resolution (UTC midnight — the bug)", () => {
    it("produces UTC midnight, which is the previous local day in UTC-negative zones", () => {
      const resolved = resolveWindowDateOld("2026-03-07 00:00:00");
      // Confirm it is exactly UTC midnight — the problematic interpretation.
      expect(resolved.toISOString()).toBe("2026-03-07T00:00:00.000Z");
    });

    it("gives wrong local date when the test machine is behind UTC", () => {
      const resolved = resolveWindowDateOld("2026-03-07 00:00:00");
      // getTimezoneOffset() > 0 means UTC-offset (EST = +300, PST = +480).
      // In those zones, UTC midnight IS the previous local day.
      // This is the exact condition that caused the production banner regression.
      if (resolved.getTimezoneOffset() > 0) {
        // Bug reproduced: local date is one day behind the DB date.
        expect(toLocalDateString(resolved)).not.toBe("2026-03-07");
      } else {
        // In UTC or UTC+ timezones the bug does not manifest — this matches why
        // CI (UTC) never caught it and why STANDARD_TEST_DATE 14:00 UTC masked it.
        expect(toLocalDateString(resolved)).toBe("2026-03-07");
      }
    });

    it("STANDARD_TEST_DATE UTC-noon is unaffected (explains why E2E did not catch the bug)", () => {
      // E2E tests use STANDARD_TEST_DATE = "2025-07-20T14:00:00.000Z".
      // The DB window_start_utc stored for that date is "2025-07-20 00:00:00".
      // At UTC-5 (EST): "2025-07-20T00:00:00Z" = July 19, 7 PM local.
      // BUT the queue date the E2E asserts comes from localStorage (toISOString()),
      // not from the DB path — so the misparse never triggered in E2E assertions.
      //
      // This test documents the gap, not a correctness guarantee.
      const resolved = resolveWindowDateOld("2025-07-20 00:00:00");
      expect(resolved.toISOString()).toBe("2025-07-20T00:00:00.000Z");
      // In UTC (CI), local date = "2025-07-20" — no misparse, bug invisible.
      // In EST, local date = "2025-07-19" — banner would fire, but E2E didn't check this path.
    });
  });

  describe("fix vs old: direct comparison", () => {
    it("fixed version always returns the same local calendar date as the DB string", () => {
      const windowStartUtc = "2026-03-07 00:00:00";
      const expectedDate = "2026-03-07";

      const fixed = resolveWindowDateFixed(windowStartUtc);
      expect(toLocalDateString(fixed)).toBe(expectedDate);
    });

    it("fixed version matches getPracticeDate() convention (local noon)", () => {
      // getPracticeDate() returns today at local noon. The fix mirrors this convention
      // so that toLocalDateString(queueDate()) === toLocalDateString(getPracticeDate())
      // when the DB queue is from today, preventing a false rollover banner.
      const todayDatePart = toLocalDateString(new Date()); // "YYYY-MM-DD" today local
      const simulatedDbValue = `${todayDatePart} 00:00:00`;

      const resolved = resolveWindowDateFixed(simulatedDbValue);

      // Both should produce the same local calendar date
      const today = new Date();
      today.setHours(12, 0, 0, 0);
      expect(toLocalDateString(resolved)).toBe(toLocalDateString(today));
    });
  });
});
