import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { initializeViewColumnMeta } from "../../../src/lib/db/init-view-column-meta";

describe("initializeViewColumnMeta", () => {
  it("seeds view_column_meta with practice_list_staged entries", async () => {
    const db = new Database(":memory:");

    db.exec(`
      CREATE TABLE view_column_meta (
        view_name TEXT NOT NULL,
        column_name TEXT NOT NULL,
        description TEXT NOT NULL,
        PRIMARY KEY (view_name, column_name)
      )
    `);

    const drizzleDb = {
      run: async (query: any) => {
        db.exec(String(query));
        return null;
      },
    };

    await initializeViewColumnMeta(drizzleDb as any);

    const row = db
      .prepare(
        "SELECT description FROM view_column_meta WHERE view_name = 'practice_list_staged' AND column_name = 'title'"
      )
      .get() as { description?: string } | undefined;
    const description = row?.description;
    expect(description).toBe("Tune title (uses any user override).");

    db.close();
  });
});
