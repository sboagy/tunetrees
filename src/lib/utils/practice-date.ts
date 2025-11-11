/**
 * Practice Date Service
 *
 * Centralized handling of practice date logic with support for:
 * - URL-based date override for testing
 * - Midnight rollover detection
 * - Consistent date handling across the app
 *
 * @module lib/utils/practice-date
 */

/**
 * Get the effective practice date
 *
 * In production: returns current date
 * In test mode: checks URL param ?practiceDate=YYYY-MM-DD
 *
 * @returns Date object representing the current practice date
 *
 * @example
 * ```typescript
 * // Production: returns new Date()
 * const date = getPracticeDate();
 *
 * // Test: /practice?practiceDate=2025-08-16
 * const date = getPracticeDate(); // Returns Aug 16, 2025
 * ```
 */
export function getPracticeDate(): Date {
  // Check for URL override (testing mode only in development/test)
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const testDate = params.get("practiceDate");

    if (testDate) {
      const parsed = new Date(testDate);
      if (!Number.isNaN(parsed.getTime())) {
        // Set to noon to avoid timezone issues
        parsed.setHours(12, 0, 0, 0);
        console.log(
          `🧪 [PracticeDate] Using URL override: ${testDate} (${parsed.toISOString()})`
        );
        return parsed;
      }
      console.warn(
        `⚠️ [PracticeDate] Invalid practiceDate URL param: ${testDate}`
      );
    }
  }

  // Production: current date at noon
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  return now;
}

/**
 * Format date as window start timestamp
 *
 * Returns ISO 8601 format without timezone/milliseconds for consistency
 * with SQLite WASM's date handling. Format: "YYYY-MM-DDTHH:MM:SS"
 *
 * NOTE: SQLite TEXT columns store dates as-is. We use ISO format (with T)
 * because SQLite WASM prefers this format and converts space-separated
 * formats to ISO internally, causing query mismatches.
 *
 * @param date - Date to format
 * @returns ISO timestamp string (e.g., "2025-11-10T00:00:00")
 *
 * @example
 * ```typescript
 * const date = new Date('2025-11-05T12:00:00');
 * const formatted = formatAsWindowStart(date);
 * // Returns: "2025-11-05T00:00:00"
 * ```
 */
export function formatAsWindowStart(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}T00:00:00`;
}

/**
 * Check if practice date has changed since last check
 *
 * Used for midnight rollover detection. Compares current practice date
 * against a stored reference date.
 *
 * @param referenceDate - Previous practice date to compare against
 * @returns True if the practice date has changed
 *
 * @example
 * ```typescript
 * const lastDate = new Date('2025-11-05');
 * // ... time passes, now it's Nov 6 ...
 * if (hasPracticeDateChanged(lastDate)) {
 *   showRefreshBanner();
 * }
 * ```
 */
export function hasPracticeDateChanged(referenceDate: Date): boolean {
  const current = getPracticeDate();

  // Compare dates at midnight (ignore time)
  const currentDay = new Date(current);
  currentDay.setHours(0, 0, 0, 0);

  const refDay = new Date(referenceDate);
  refDay.setHours(0, 0, 0, 0);

  return currentDay.getTime() !== refDay.getTime();
}

/**
 * Get practice date from URL or return null
 *
 * Useful for checking if we're in test mode
 *
 * @returns Test date string or null if not in test mode
 */
export function getTestDateFromUrl(): string | null {
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    return params.get("practiceDate");
  }
  return null;
}

/**
 * Check if we're in test mode (URL override is active)
 *
 * @returns True if practiceDate URL param is present and valid
 */
export function isTestMode(): boolean {
  return getTestDateFromUrl() !== null;
}
