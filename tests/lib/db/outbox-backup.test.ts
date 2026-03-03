import type { Database } from "sql.js";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createOutboxBackup,
  type IOutboxBackup,
  replayOutboxBackup,
} from "../../../src/lib/db/outbox-backup";
import { getTestSqlJs } from "./sqljs-test-utils";

let db: Database;
let SQL: Awaited<ReturnType<typeof getTestSqlJs>>;

beforeEach(async () => {
  if (!SQL) {
    SQL = await getTestSqlJs();
  }
  db = new SQL.Database();

  db.run(`
    CREATE TABLE sync_push_queue (
      id TEXT PRIMARY KEY NOT NULL,
      table_name TEXT NOT NULL,
      row_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      changed_at TEXT NOT NULL,
      synced_at TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT
    )
  `);

  db.run(`
    CREATE TABLE tune (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT,
      last_modified_at TEXT
    )
  `);
});

describe("outbox-backup", () => {
  it("createOutboxBackup snapshots row data for non-delete", () => {
    db.run(
      `INSERT INTO tune (id, title, last_modified_at) VALUES ('t1', 'Old Title', '2025-01-01T00:00:00.000Z')`
    );

    db.run(`
      INSERT INTO sync_push_queue (id, table_name, row_id, operation, status, changed_at)
      VALUES ('q1', 'tune', 't1', 'UPDATE', 'pending', '2025-01-02T00:00:00.000Z')
    `);

    const backup = createOutboxBackup(db);
    expect(backup.version).toBe(1);
    expect(backup.items).toHaveLength(1);
    expect(backup.items[0]?.tableName).toBe("tune");
    expect(backup.items[0]?.rowId).toBe("t1");
    expect(backup.items[0]?.rowData?.id).toBe("t1");
    expect(backup.items[0]?.rowData?.title).toBe("Old Title");
  });

  it("replayOutboxBackup upserts a row", () => {
    const backup: IOutboxBackup = {
      version: 1,
      createdAt: new Date().toISOString(),
      items: [
        {
          tableName: "tune",
          rowId: "t2",
          operation: "UPDATE",
          changedAt: "2025-01-02T00:00:00.000Z",
          rowData: {
            id: "t2",
            title: "New Title",
            last_modified_at: "2025-01-02T00:00:00.000Z",
          },
        },
      ],
    };

    const result = replayOutboxBackup(db, backup);
    expect(result.errors).toHaveLength(0);
    expect(result.applied).toBe(1);

    const rows = db.exec(`SELECT id, title FROM tune WHERE id = 't2'`);
    expect(rows[0]?.values?.[0]).toEqual(["t2", "New Title"]);
  });

  it("replayOutboxBackup deletes a row for delete operations", () => {
    db.run(
      `INSERT INTO tune (id, title, last_modified_at) VALUES ('t3', 'To Delete', '2025-01-01T00:00:00.000Z')`
    );

    const backup: IOutboxBackup = {
      version: 1,
      createdAt: new Date().toISOString(),
      items: [
        {
          tableName: "tune",
          rowId: "t3",
          operation: "DELETE",
          changedAt: "2025-01-02T00:00:00.000Z",
        },
      ],
    };

    const result = replayOutboxBackup(db, backup);
    expect(result.errors).toHaveLength(0);
    expect(result.applied).toBe(1);

    const rows = db.exec(`SELECT COUNT(*) FROM tune WHERE id = 't3'`);
    expect(Number(rows[0]?.values?.[0]?.[0] ?? 0)).toBe(0);
  });
});
