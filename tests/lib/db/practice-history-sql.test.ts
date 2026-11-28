import { drizzle } from "drizzle-orm/sql-js";
import {
  createSqliteWasmDatabase,
  initSqliteWasm,
} from "oosync/runtime/sqlite-wasm-adapter";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  assertValidPracticeHistory,
  latestPracticeRecordIdsForRepertoire,
  latestPracticeRecordsSql,
  practiceHistoryOrderSql,
  practiceTimestampSql,
} from "../../../src/lib/db/practice-history-sql";
import {
  normalizePracticeTimestamp,
  orderPracticeHistory,
} from "../../../src/lib/utils/practice-history";
import {
  expectedHistoryIds,
  historyOrderFixtures,
} from "../../fixtures/practice-history-order";

let db: ReturnType<typeof createSqliteWasmDatabase>;
beforeEach(async () => {
  db = createSqliteWasmDatabase(await initSqliteWasm());
  db.exec(
    "CREATE TABLE practice_record (id TEXT, practiced TEXT, last_modified_at TEXT, tune_ref TEXT, repertoire_ref TEXT)"
  );
  for (const row of historyOrderFixtures) {
    db.run("INSERT INTO practice_record VALUES (?, ?, ?, 'tune', 'rep')", [
      row.id,
      row.practiced,
      row.lastModifiedAt,
    ]);
  }
});
afterEach(() => db.close());

describe("canonical SQLite practice ordering", () => {
  it("matches JavaScript ordering across offsets, microseconds, NULLs and ties", () => {
    expect(
      orderPracticeHistory(historyOrderFixtures).map((row) => row.id)
    ).toEqual(expectedHistoryIds);
    expect(
      db
        .exec(
          `SELECT pr.id FROM practice_record pr ORDER BY ${practiceHistoryOrderSql()}`
        )[0]
        .values.flat()
    ).toEqual(expectedHistoryIds);
  });
  it("normalizes each timestamp without millisecond rounding", () => {
    const rows = db.exec(
      `SELECT pr.id, ${practiceTimestampSql("pr.practiced")} FROM practice_record pr ORDER BY pr.id`
    )[0].values;
    expect(rows).toEqual(
      historyOrderFixtures.map((row) => [
        row.id,
        row.practiced === null
          ? null
          : normalizePracticeTimestamp(row.practiced),
      ])
    );
  });
  it("applies limits after canonical ordering", () => {
    expect(
      db
        .exec(
          `SELECT pr.id FROM practice_record pr ORDER BY ${practiceHistoryOrderSql()} LIMIT 3`
        )[0]
        .values.flat()
    ).toEqual(["a", "b", "e"]);
  });
  it("selects the latest event independently for each tune and repertoire", () => {
    db.run(
      "INSERT INTO practice_record VALUES ('other', '2027-01-01T00:00:00Z', NULL, 'tune', 'other-rep')"
    );
    expect(
      db
        .exec(`SELECT id FROM (${latestPracticeRecordsSql}) ORDER BY id`)[0]
        .values.flat()
    ).toEqual(["a", "other"]);
  });
  it("scopes ranked analysis records to the requested repertoire", () => {
    db.run(
      "INSERT INTO practice_record VALUES ('other', '2027-01-01T00:00:00Z', NULL, 'tune', 'other-rep')"
    );
    const orm = drizzle(db as never);
    expect(orm.all(latestPracticeRecordIdsForRepertoire("rep"))).toEqual([
      { id: "a" },
    ]);
  });
  it.each(["practiced", "last_modified_at"])(
    "rejects damaged %s before scheduling",
    (column) => {
      db.run(`UPDATE practice_record SET ${column} = 'broken' WHERE id = 'a'`);
      expect(() =>
        assertValidPracticeHistory(drizzle(db as never), "rep")
      ).toThrow("Invalid practice timestamp in event a");
      expect(() =>
        assertValidPracticeHistory(drizzle(db as never), "other-rep")
      ).not.toThrow();
    }
  );
  it.each([
    "not-a-date",
    "2026-11-16",
    "2026-11-16T12:00:00.Z",
    "2026-11-16T12:00:00.1234567Z",
  ])("treats malformed display timestamp %s as missing", (value) => {
    db.run(
      "INSERT INTO practice_record VALUES ('invalid', ?, NULL, 'tune', 'rep')",
      [value]
    );
    expect(
      db.exec(
        `SELECT ${practiceTimestampSql("pr.practiced")} FROM practice_record pr WHERE id='invalid'`
      )[0].values
    ).toEqual([[null]]);
  });
});
