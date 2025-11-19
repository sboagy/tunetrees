/**
 * Clock Control Utilities for Time-Sensitive E2E Tests
 *
 * Provides helpers for controlling browser time using Playwright's clock API.
 * Used for testing scheduling algorithms, date-dependent UI, and multi-day scenarios.
 *
 * @see https://playwright.dev/docs/clock
 */

import type { BrowserContext, Page } from "@playwright/test";
import log from "loglevel";

log.setLevel("info");

/**
 * Set a stable, frozen date/time in the browser context
 *
 * @param context - Playwright BrowserContext
 * @param date - Date object or ISO string to freeze time at
 *
 * @example
 * ```typescript
 * await setStableDate(context, '2025-07-20T14:00:00.000Z');
 * // All Date() calls in browser will return this exact time
 * ```
 */
export async function setStableDate(
  context: BrowserContext,
  date: Date | string
): Promise<void> {
  const timestamp = typeof date === "string" ? new Date(date) : date;

  log.debug(`⏰ Setting stable date: ${timestamp.toISOString()}`);

  await context.clock.install({
    time: timestamp,
  });
}

/**
 * Advance clock by a specified number of days
 *
 * @param context - Playwright BrowserContext
 * @param days - Number of days to advance (can be negative to go backward)
 * @param baseDate - Optional base date to advance from (defaults to current frozen time)
 * @returns New date after advancement
 *
 * @example
 * ```typescript
 * await setStableDate(context, '2025-07-20T14:00:00Z');
 * const nextDay = await advanceDays(context, 1); // Now 2025-07-21T14:00:00Z
 * ```
 */
export async function advanceDays(
  context: BrowserContext,
  days: number,
  baseDate?: Date
): Promise<Date> {
  let newDate: Date;

  if (baseDate) {
    newDate = new Date(baseDate);
    newDate.setDate(newDate.getDate() + days);
  } else {
    // If no base date, get current frozen time and advance from there
    // Note: This requires the page to be available for evaluation
    throw new Error(
      "advanceDays requires baseDate parameter - pass the current frozen date"
    );
  }

  log.debug(
    `⏰ Advancing ${days} days to: ${newDate.toISOString()} (from ${baseDate?.toISOString() || "current"})`
  );

  await context.clock.install({
    time: newDate,
  });

  return newDate;
}

/**
 * Advance clock by a specified number of hours
 *
 * @param context - Playwright BrowserContext
 * @param hours - Number of hours to advance
 * @param baseDate - Base date to advance from
 * @returns New date after advancement
 */
export async function advanceHours(
  context: BrowserContext,
  hours: number,
  baseDate: Date
): Promise<Date> {
  const newDate = new Date(baseDate);
  newDate.setHours(newDate.getHours() + hours);

  log.debug(
    `⏰ Advancing ${hours} hours to: ${newDate.toISOString()} (from ${baseDate.toISOString()})`
  );

  await context.clock.install({
    time: newDate,
  });

  return newDate;
}

/**
 * Get the current date/time from the browser's perspective
 *
 * @param page - Playwright Page
 * @returns Current Date object as seen by browser code
 *
 * @example
 * ```typescript
 * await setStableDate(context, '2025-07-20T14:00:00Z');
 * const browserDate = await getCurrentDate(page);
 * console.log(browserDate.toISOString()); // "2025-07-20T14:00:00.000Z"
 * ```
 */
export async function getCurrentDate(page: Page): Promise<Date> {
  const isoString = await page.evaluate(() => new Date().toISOString());
  return new Date(isoString);
}

/**
 * Verify that the browser clock is actually frozen at expected time
 *
 * @param page - Playwright Page
 * @param expectedDate - Expected frozen date
 * @param toleranceMs - Tolerance in milliseconds (default: 1000ms)
 *
 * @throws Error if browser time doesn't match expected time
 */
export async function verifyClockFrozen(
  page: Page,
  expectedDate: Date,
  toleranceMs = 1000
): Promise<void> {
  const browserDate = await getCurrentDate(page);
  const diff = Math.abs(browserDate.getTime() - expectedDate.getTime());

  if (diff > toleranceMs) {
    throw new Error(
      `Clock verification failed: expected ${expectedDate.toISOString()}, ` +
        `got ${browserDate.toISOString()} (diff: ${diff}ms)`
    );
  }

  log.debug(
    `✅ Clock verified at ${browserDate.toISOString()} (tolerance: ${toleranceMs}ms)`
  );
}

/**
 * Standard test date for scheduling tests (stable, deterministic starting point)
 */
export const STANDARD_TEST_DATE = "2025-07-20T14:00:00.000Z";

/**
 * Helper to create a test date offset from standard date
 *
 * @param daysOffset - Number of days to offset from STANDARD_TEST_DATE
 * @returns Date object
 *
 * @example
 * ```typescript
 * const tomorrow = getTestDate(1); // 2025-07-21T14:00:00Z
 * const yesterday = getTestDate(-1); // 2025-07-19T14:00:00Z
 * ```
 */
export function getTestDate(daysOffset = 0): Date {
  const baseDate = new Date(STANDARD_TEST_DATE);
  baseDate.setDate(baseDate.getDate() + daysOffset);
  return baseDate;
}

/**
 * Multi-day scenario helper: advances through multiple days with callback
 *
 * @param context - Playwright BrowserContext
 * @param startDate - Starting date for scenario
 * @param dayCount - Number of days to simulate
 * @param onEachDay - Callback function executed for each day (receives current date, day index)
 *
 * @example
 * ```typescript
 * await simulateMultiDayScenario(
 *   context,
 *   new Date('2025-07-20T14:00:00Z'),
 *   7,
 *   async (currentDate, dayIndex) => {
 *     console.log(`Day ${dayIndex}: ${currentDate.toISOString()}`);
 *     // Practice tunes for this day
 *     await practiceTunes(page);
 *   }
 * );
 * ```
 */
export async function simulateMultiDayScenario(
  context: BrowserContext,
  startDate: Date,
  dayCount: number,
  onEachDay: (currentDate: Date, dayIndex: number) => Promise<void>
): Promise<void> {
  let currentDate = new Date(startDate);

  for (let day = 0; day < dayCount; day++) {
    log.debug(`📅 Day ${day + 1}/${dayCount}: ${currentDate.toISOString()}`);

    await context.clock.install({ time: currentDate });
    await onEachDay(currentDate, day);

    // Advance to next day (same time tomorrow)
    currentDate = new Date(currentDate);
    currentDate.setDate(currentDate.getDate() + 1);
  }
}
