import { afterAll, beforeEach, onTestFinished } from "vitest";
import {
  diagnostics,
  resetConsoleDiagnostics,
} from "./helpers/expected-console";

// Keep stable callbacks: SQLite retains its logger when the module initializes.
// Do not throw inside logging; doing so would change application error handling.
const warn: typeof console.warn = (...args) => {
  diagnostics.actual.push({ level: "warn", args });
};
const error: typeof console.error = (...args) => {
  diagnostics.actual.push({ level: "error", args });
};
console.warn = warn;
console.error = error;
beforeEach(() => {
  // Also catch diagnostics emitted during module setup or between tests.
  diagnostics.verify();
  resetConsoleDiagnostics();
  console.warn = warn;
  console.error = error;
  onTestFinished(() => {
    try {
      diagnostics.verify();
      if (diagnostics.expected.length > 0) {
        console.info(
          `Verified ${diagnostics.expected.length} expected warning/error diagnostic(s).`
        );
      }
    } finally {
      resetConsoleDiagnostics();
    }
  });
});

afterAll(() => diagnostics.verify());
