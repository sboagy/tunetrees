import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("sync-core table-specific hack guard", () => {
  it("does not special-case practice_record in SyncEngine apply logic", () => {
    const enginePath = resolve(process.cwd(), "src/lib/sync/engine.ts");
    const text = readFileSync(enginePath, "utf-8");

    expect(text).not.toContain('change.table === "practice_record"');
    expect(text).not.toContain(
      "practice_record has two distinct uniqueness constraints"
    );
    expect(text).not.toContain("backfillPracticeRecordOutbox");
  });
});
