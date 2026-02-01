/**
 * Debug logging utilities for worker.
 * Logs are only emitted when WORKER_DEBUG env var is set to "true".
 */

// Global debug state - will be set by setDebugEnabled()
let debugEnabled = false;

/**
 * Initialize debug logging based on environment variable.
 * Must be called from the fetch handler with the env binding.
 */
export const setDebugEnabled = (env: { WORKER_DEBUG?: string }) => {
  debugEnabled = env.WORKER_DEBUG === "true";
};

export const debug = {
  log: (...args: unknown[]) => {
    if (debugEnabled) {
      console.log(...args);
    }
  },
  warn: (...args: unknown[]) => {
    // Always show warnings
    console.warn(...args);
  },
  error: (...args: unknown[]) => {
    // Always show errors
    console.error(...args);
  },
};
