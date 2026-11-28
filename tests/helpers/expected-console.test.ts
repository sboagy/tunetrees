import { describe, expect, it } from "vitest";
import {
  ConsoleDiagnostics,
  diagnostics,
  expectConsole,
} from "./expected-console";

describe("unit-test console diagnostics", () => {
  it("accepts an Error instance matching the expected message", () => {
    expectConsole(
      "error",
      expect.objectContaining({ message: "persist failed" })
    );
    console.error(new Error("persist failed"));
    expect(() => diagnostics.verify()).not.toThrow();
  });
  it("rejects an Error instance with a different message", () => {
    const ledger = new ConsoleDiagnostics();
    ledger.expected.push({
      level: "error",
      args: [expect.objectContaining({ message: "persist failed" })],
    });
    ledger.actual.push({ level: "error", args: [new Error("unexpected")] });
    expect(() => ledger.verify()).toThrow();
  });
  it("accepts an explicitly expected diagnostic through the installed guard", () => {
    expectConsole("warn", "expected warning", { id: "fixture" });
    console.warn("expected warning", { id: "fixture" });
    expect(() => diagnostics.verify()).not.toThrow();
  });
  it.each(["warn", "error"] as const)(
    "rejects unexpected %s calls",
    (level) => {
      const ledger = new ConsoleDiagnostics();
      ledger.actual.push({ level, args: ["unexpected"] });
      expect(() => ledger.verify()).toThrow(
        "Unexpected or missing console diagnostic"
      );
    }
  );
  it("rejects a missing expected diagnostic", () => {
    const ledger = new ConsoleDiagnostics();
    ledger.expected.push({ level: "warn", args: ["expected"] });
    expect(() => ledger.verify()).toThrow();
  });
  it("rejects additional calls even when the message matches", () => {
    const ledger = new ConsoleDiagnostics();
    const entry = { level: "error" as const, args: ["expected"] };
    ledger.expected.push(entry);
    ledger.actual.push(entry, entry);
    expect(() => ledger.verify()).toThrow();
  });
  it("rejects changed diagnostic arguments", () => {
    const ledger = new ConsoleDiagnostics();
    ledger.expected.push({ level: "error", args: ["expected"] });
    ledger.actual.push({ level: "error", args: ["different"] });
    expect(() => ledger.verify()).toThrow();
  });
});
