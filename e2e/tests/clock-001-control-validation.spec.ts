import { expect } from "@playwright/test";
import {
  advanceDays,
  getCurrentDate,
  getTestDate,
  setStableDate,
  STANDARD_TEST_DATE,
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

test.describe("CLOCK-001: Clock Control Validation", () => {
  test("should set stable date in browser", async ({ context, page }) => {
    // Navigate to app
    await page.goto("http://localhost:5173/");

    // Set stable date
    const testDate = new Date(STANDARD_TEST_DATE);
    await setStableDate(context, testDate);

    // Verify browser sees frozen time
    await verifyClockFrozen(page, testDate, 1000);

    // Get date from browser
    const browserDate = await getCurrentDate(page);
    expect(browserDate.toISOString()).toBe(testDate.toISOString());
  });

  test("should advance time by days", async ({ context, page }) => {
    await page.goto("http://localhost:5173/");

    // Start at stable date
    const day1 = getTestDate(0); // 2025-07-20
    await setStableDate(context, day1);
    await verifyClockFrozen(page, day1);

    // Advance 1 day
    const day2 = await advanceDays(context, 1, day1);
    await verifyClockFrozen(page, day2);
    expect(day2.toISOString()).toBe("2025-07-21T14:00:00.000Z");

    // Advance 7 more days
    const day9 = await advanceDays(context, 7, day2);
    await verifyClockFrozen(page, day9);
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
    await verifyClockFrozen(page, testDate);

    // Reload page
    await page.reload();

    // Date should still be frozen
    await verifyClockFrozen(page, testDate, 2000); // Allow slight drift after reload
  });

  test("should allow time arithmetic", async ({ context, page }) => {
    await page.goto("http://localhost:5173/");

    // Test getTestDate helper
    const baseDate = getTestDate(0); // 2025-07-20T14:00:00Z
    const tomorrow = getTestDate(1); // 2025-07-21T14:00:00Z
    const yesterday = getTestDate(-1); // 2025-07-19T14:00:00Z

    expect(tomorrow.getTime() - baseDate.getTime()).toBe(24 * 60 * 60 * 1000);
    expect(baseDate.getTime() - yesterday.getTime()).toBe(
      24 * 60 * 60 * 1000
    );

    // Set each date in browser and verify
    await setStableDate(context, baseDate);
    await verifyClockFrozen(page, baseDate);

    await setStableDate(context, tomorrow);
    await verifyClockFrozen(page, tomorrow);

    await setStableDate(context, yesterday);
    await verifyClockFrozen(page, yesterday);
  });

  test("should freeze time preventing drift", async ({ context, page }) => {
    await page.goto("http://localhost:5173/");

    // Set stable date
    const testDate = getTestDate(0);
    await setStableDate(context, testDate);

    // Wait 5 seconds
    await page.waitForTimeout(5000);

    // Time should NOT have advanced
    const browserDate = await getCurrentDate(page);
    const diff = Math.abs(browserDate.getTime() - testDate.getTime());
    expect(diff).toBeLessThan(100); // Allow <100ms tolerance
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
      await verifyClockFrozen(page, date);
    }

    // Verify all dates were distinct
    const uniqueDates = new Set(dates.map((d) => d.toISOString()));
    expect(uniqueDates.size).toBe(5);
  });

  test("should work with ISO string dates", async ({ context, page }) => {
    await page.goto("http://localhost:5173/");

    // Set date using ISO string
    await setStableDate(context, "2025-12-25T12:00:00.000Z");

    const browserDate = await getCurrentDate(page);
    expect(browserDate.toISOString()).toBe("2025-12-25T12:00:00.000Z");
  });

  test("should work with Date objects", async ({ context, page }) => {
    await page.goto("http://localhost:5173/");

    // Set date using Date object
    const customDate = new Date("2026-01-01T00:00:00.000Z");
    await setStableDate(context, customDate);

    const browserDate = await getCurrentDate(page);
    expect(browserDate.toISOString()).toBe(customDate.toISOString());
  });
});
