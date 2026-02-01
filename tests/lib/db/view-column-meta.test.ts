import initSqlJs from "sql.js";
import { describe, expect, it } from "vitest";
import { initializeViewColumnMeta } from "../../../src/lib/db/init-view-column-meta";

describe("initializeViewColumnMeta", () => {
  it("seeds view_column_meta with practice_list_staged entries", async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();

    db.run(`
      CREATE TABLE view_column_meta (
        view_name TEXT NOT NULL,
        column_name TEXT NOT NULL,
        description TEXT NOT NULL,
        PRIMARY KEY (view_name, column_name)
      )
    `);

    const drizzleDb = {
      run: async (query: any) => {
        db.run(String(query));
        return null;
      },
    };

    await initializeViewColumnMeta(drizzleDb as any);

    const result = db.exec(
      "SELECT description FROM view_column_meta WHERE view_name = 'practice_list_staged' AND column_name = 'title'"
    );
    const description = result[0]?.values?.[0]?.[0];
    expect(description).toBe("Tune title (uses any user override).");
  });
});
