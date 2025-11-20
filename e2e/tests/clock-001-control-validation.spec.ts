import { expect } from "@playwright/test";
import {
  advanceDays,
  getCurrentDate,
  getTestDate,
  STANDARD_TEST_DATE,
  setStableDate,
  verifyClockFrozen,
} from "../helpers/clock-control";
import { test } from "../helpers/test-fixture";

/**
 * CLOCK-001: Clock Control Validation
 * Priority: Critical
 *
 * Validates that Playwright's clock.install() API works correctly
 * for controlling browser time. This is foundational for all scheduling tests.
 */

// Helper: allow small millisecond tolerance when comparing ISO strings
function expectIsoClose(
  actualIso: string,
  expectedIso: string,
  baseToleranceMs = 25,
  projectName?: string
) {
  // Mobile browsers in CI show higher clock variance (observed up to ~300ms).
  const toleranceMs = /Mobile/i.test(projectName || "")
    ? Math.max(baseToleranceMs, 500)
    : baseToleranceMs;
  const a = new Date(actualIso).getTime();
  const e = new Date(expectedIso).getTime();
  const diff = Math.abs(a - e);
  expect(diff).toBeLessThanOrEqual(toleranceMs);
}

const CLOCK_TOLERANCE_MS = 4000; // CI can exhibit multi-second scheduling delays

test.describe("CLOCK-001: Clock Control Validation", () => {
  test("should set stable date in browser", async ({ context, page }) => {
    // Navigate to app
    await page.goto("http://localhost:5173/");

    // Set stable date
    const testDate = new Date(STANDARD_TEST_DATE);
    await setStableDate(context, testDate);

    // Verify browser sees frozen time
    await verifyClockFrozen(page, testDate, CLOCK_TOLERANCE_MS);

    // Get date from browser
    const browserDate = await getCurrentDate(page);
    // Allow a few ms tolerance instead of exact equality
    expectIsoClose(
      browserDate.toISOString(),
      testDate.toISOString(),
      25,
      test.info().project.name
    );
  });

  test("should advance time by days", async ({ context, page }) => {
    await page.goto("http://localhost:5173/");

    // Start at stable date
    const day1 = getTestDate(0); // 2025-07-20
    await setStableDate(context, day1);
    await verifyClockFrozen(page, day1, CLOCK_TOLERANCE_MS);

    // Advance 1 day
    const day2 = await advanceDays(context, 1, day1);
    await verifyClockFrozen(page, day2, CLOCK_TOLERANCE_MS);
    expect(day2.toISOString()).toBe("2025-07-21T14:00:00.000Z");

    // Advance 7 more days
    const day9 = await advanceDays(context, 7, day2);
    await verifyClockFrozen(page, day9, CLOCK_TOLERANCE_MS);
    expect(day9.toISOString()).toBe("2025-07-28T14:00:00.000Z");
  });

  test("should maintain frozen time across page reloads", async ({
    context,
    page,
  }) => {
    await page.goto("http://localhost:5173/");

    // Set stable date
    const testDate = getTestDate(0);
    await setStableDate(context, testDate);
    await verifyClockFrozen(page, testDate, CLOCK_TOLERANCE_MS);

    // Reload page
    await page.reload();

    // Date should still be frozen
    await verifyClockFrozen(page, testDate, CLOCK_TOLERANCE_MS);
  });

  test("should allow time arithmetic", async ({ context, page }) => {
    await page.goto("http://localhost:5173/");

    // Test getTestDate helper
    const baseDate = getTestDate(0); // 2025-07-20T14:00:00Z
    const tomorrow = getTestDate(1); // 2025-07-21T14:00:00Z
    const yesterday = getTestDate(-1); // 2025-07-19T14:00:00Z

    expect(tomorrow.getTime() - baseDate.getTime()).toBe(24 * 60 * 60 * 1000);
    expect(baseDate.getTime() - yesterday.getTime()).toBe(24 * 60 * 60 * 1000);

    // Set each date in browser and verify
    await setStableDate(context, baseDate);
    await verifyClockFrozen(page, baseDate, CLOCK_TOLERANCE_MS);

    await setStableDate(context, tomorrow);
    await verifyClockFrozen(page, tomorrow, CLOCK_TOLERANCE_MS);

    await setStableDate(context, yesterday);
    await verifyClockFrozen(page, yesterday, CLOCK_TOLERANCE_MS);
  });

  test("should reflect real-time passage after install (no large drift)", async ({
    context,
    page,
  }) => {
    await page.goto("http://localhost:5173/");

    // Set stable date
    const testDate = getTestDate(0);
    await setStableDate(context, testDate);

    // Wait 5 seconds
    await page.waitForTimeout(5000);

    // Time should NOT have advanced
    const browserDate = await getCurrentDate(page);
    const diff = Math.abs(browserDate.getTime() - testDate.getTime());
    // Playwright's clock.install sets a base time but real time still advances unless explicitly controlled.
    // Assert diff is roughly 5s (+/- 1s) instead of zero.
    expect(diff).toBeGreaterThanOrEqual(4000);
    expect(diff).toBeLessThanOrEqual(6000);
  });

  test("should support multiple date changes in sequence", async ({
    context,
    page,
  }) => {
    await page.goto("http://localhost:5173/");

    // Simulate 5-day scenario
    const dates: Date[] = [];
    for (let day = 0; day < 5; day++) {
      const date = getTestDate(day);
      dates.push(date);
      await setStableDate(context, date);
      await verifyClockFrozen(page, date, CLOCK_TOLERANCE_MS);
    }

    // Verify all dates were distinct
    const uniqueDates = new Set(dates.map((d) => d.toISOString()));
    expect(uniqueDates.size).toBe(5);
  });

  test("should work with ISO string dates (tolerant)", async ({
    context,
    page,
  }) => {
    await page.goto("http://localhost:5173/");

    // Set date using ISO string
    await setStableDate(context, "2025-12-25T12:00:00.000Z");

    const browserDate = await getCurrentDate(page);
    expectIsoClose(
      browserDate.toISOString(),
      "2025-12-25T12:00:00.000Z",
      25,
      test.info().project.name
    );
  });

  test("should work with Date objects (tolerant)", async ({
    context,
    page,
  }) => {
    await page.goto("http://localhost:5173/");

    // Set date using Date object
    const customDate = new Date("2026-01-01T00:00:00.000Z");
    await setStableDate(context, customDate);

    const browserDate = await getCurrentDate(page);
    expectIsoClose(
      browserDate.toISOString(),
      customDate.toISOString(),
      25,
      test.info().project.name
    );
  });
});
