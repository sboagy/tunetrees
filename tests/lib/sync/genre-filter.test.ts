import type { Database } from "sql.js";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createSyncPushQueueTable,
  createSyncTriggerControlTable,
} from "@/lib/db/install-triggers";
import { repairPendingMediaAssetSyncStateInSqlite } from "@/lib/sync/genre-filter";
import { getTestSqlJs } from "../db/sqljs-test-utils";

let db: Database;
let SQL: Awaited<ReturnType<typeof getTestSqlJs>>;

function firstColumn(query: string): string[] {
  const result = db.exec(query);
  return (result[0]?.values ?? [])
    .map((row) => row[0])
    .filter((value): value is string => typeof value === "string");
}

function scalar(query: string): number {
  const result = db.exec(query);
  const value = result[0]?.values?.[0]?.[0];
  return typeof value === "number" ? value : Number(value ?? 0);
}

describe("repairPendingMediaAssetSyncStateInSqlite", () => {
  beforeEach(async () => {
    if (!SQL) {
      SQL = await getTestSqlJs();
    }

    db = new SQL.Database();
    createSyncTriggerControlTable(db);
    createSyncPushQueueTable(db);

    db.run(`
      CREATE TABLE reference (
        id TEXT PRIMARY KEY NOT NULL,
        deleted INTEGER NOT NULL DEFAULT 0
      )
    `);

    db.run(`
      CREATE TABLE media_asset (
        id TEXT PRIMARY KEY NOT NULL,
        reference_ref TEXT NOT NULL,
        deleted INTEGER NOT NULL DEFAULT 0
      )
    `);
  });

  it("requeues the parent reference for pending media assets", () => {
    db.run(`
      INSERT INTO reference (id, deleted) VALUES ('ref-1', 0);
      INSERT INTO media_asset (id, reference_ref, deleted) VALUES ('asset-1', 'ref-1', 0);
      INSERT INTO sync_push_queue (
        id, table_name, row_id, operation, status, changed_at, attempts
      ) VALUES (
        'queue-asset-1', 'media_asset', 'asset-1', 'INSERT', 'pending', '2026-04-25T00:00:00.000Z', 0
      );
    `);

    const result = repairPendingMediaAssetSyncStateInSqlite(db);

    expect(result).toEqual({
      requeuedReferenceCount: 1,
      prunedMediaAssetCount: 0,
      clearedMediaAssetOutboxCount: 0,
    });
    expect(
      firstColumn(
        "SELECT row_id FROM sync_push_queue WHERE table_name = 'reference' AND status = 'pending'"
      )
    ).toEqual(["ref-1"]);
    expect(
      scalar(
        "SELECT COUNT(*) FROM sync_push_queue WHERE table_name = 'media_asset' AND row_id = 'asset-1'"
      )
    ).toBe(1);
  });

  it("prunes pending media assets whose parent reference no longer exists locally", () => {
    db.run(`
      INSERT INTO media_asset (id, reference_ref, deleted) VALUES ('asset-orphan', 'ref-missing', 0);
      INSERT INTO sync_push_queue (
        id, table_name, row_id, operation, status, changed_at, attempts
      ) VALUES
        ('queue-asset-orphan-1', 'media_asset', 'asset-orphan', 'INSERT', 'pending', '2026-04-25T00:00:00.000Z', 0),
        ('queue-asset-orphan-2', 'media_asset', 'asset-orphan', 'UPDATE', 'failed', '2026-04-25T00:00:01.000Z', 1);
    `);

    const result = repairPendingMediaAssetSyncStateInSqlite(db);

    expect(result).toEqual({
      requeuedReferenceCount: 0,
      prunedMediaAssetCount: 1,
      clearedMediaAssetOutboxCount: 2,
    });
    expect(
      scalar("SELECT COUNT(*) FROM media_asset WHERE id = 'asset-orphan'")
    ).toBe(0);
    expect(
      scalar(
        "SELECT COUNT(*) FROM sync_push_queue WHERE table_name = 'media_asset' AND row_id = 'asset-orphan'"
      )
    ).toBe(0);
  });
});
