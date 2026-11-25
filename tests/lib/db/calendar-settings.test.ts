import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { expect, it } from "vitest";
import type { SqliteDatabase } from "../../../src/lib/db/client-sqlite";
import {
  getSchedulingOptions,
  updateSchedulingOptions,
} from "../../../src/lib/db/queries/user-settings";
import { applyMigrations } from "../../../src/lib/services/test-schema-loader";

it("clears optional calendar values while preserving omitted preferences", async () => {
  const sqlite = new Database(":memory:");
  try {
    const connection = drizzle(sqlite);
    applyMigrations(connection);
    const db = connection as unknown as SqliteDatabase;
    const userId = "calendar-owner";
    sqlite
      .prepare("INSERT INTO user_profile (id, last_modified_at) VALUES (?, ?)")
      .run(userId, "2026-11-24T12:00:00.000Z");
    await updateSchedulingOptions(db, {
      userId,
      daysPerWeek: 4,
      weeklyRules: '{"monday":true}',
      exceptions: "[]",
    });
    await updateSchedulingOptions(db, { userId, daysPerWeek: 5 });
    expect(await getSchedulingOptions(db, userId)).toMatchObject({
      daysPerWeek: 5,
      weeklyRules: '{"monday":true}',
      exceptions: "[]",
    });
    await updateSchedulingOptions(db, {
      userId,
      daysPerWeek: null,
      weeklyRules: null,
      exceptions: null,
    });
    expect(await getSchedulingOptions(db, userId)).toMatchObject({
      daysPerWeek: null,
      weeklyRules: null,
      exceptions: null,
    });
  } finally {
    sqlite.close();
  }
});
