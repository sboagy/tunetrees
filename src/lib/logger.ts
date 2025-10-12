/**
 * Centralized Logger Configuration
 *
 * Uses loglevel library for consistent, configurable logging across the app.
 *
 * Log Levels:
 * - trace: Very detailed technical information
 * - debug: Diagnostic information (default in development)
 * - info: Informational messages about app state
 * - warn: Warning messages for potential issues
 * - error: Error messages for failures
 * - silent: No logging
 *
 * @module lib/logger
 */

import log from "loglevel";

// Set default log level based on environment
const defaultLevel =
  import.meta.env.VITE_LOG_LEVEL || (import.meta.env.DEV ? "info" : "warn");
log.setLevel(defaultLevel as log.LogLevelDesc);

// Expose logger to window object for console access in development
if (import.meta.env.DEV) {
  (window as any).log = log;
}

// You can override in browser console with:
// log.setLevel('debug') - to see all debug messages
// log.setLevel('trace') - to see everything
// log.setLevel('warn') - to quiet things down

export { log };
