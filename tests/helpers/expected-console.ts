import { expect } from "vitest";

type Level = "warn" | "error";
type Diagnostic = { level: Level; args: unknown[] };

/** Exact, per-test expectations: missing, extra, or changed diagnostics fail. */
export class ConsoleDiagnostics {
  readonly expected: Diagnostic[] = [];
  readonly actual: Diagnostic[] = [];

  verify() {
    expect(this.actual, "Unexpected or missing console diagnostic").toEqual(
      this.expected
    );
  }
}

export const diagnostics = new ConsoleDiagnostics();
export function resetConsoleDiagnostics() {
  diagnostics.expected.length = 0;
  diagnostics.actual.length = 0;
}

/** Register before the intentional failure; never use this as a suite allowlist. */
export function expectConsole(level: Level, ...args: unknown[]) {
  diagnostics.expected.push({ level, args });
}

/** SQLite logs the rejected statement before throwing the asserted trigger error. */
export function expectSqliteTriggerFailure(statementPrefix: string) {
  expectConsole(
    "warn",
    "sqlite3_step() rc=",
    1811,
    "SQLITE_CONSTRAINT_TRIGGER",
    "SQL =",
    expect.stringMatching(new RegExp(`^${statementPrefix}`))
  );
}
