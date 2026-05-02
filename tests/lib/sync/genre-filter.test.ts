import type { Database } from "sql.js";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createSyncPushQueueTable,
  createSyncTriggerControlTable,
} from "@/lib/db/install-triggers";
import {
  repairPendingMediaAssetSyncStateInSqlite,
  repairPendingProgramSyncStateInSqlite,
} from "@/lib/sync/genre-filter";
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

    db.run(`
      CREATE TABLE user_group (
        id TEXT PRIMARY KEY NOT NULL,
        deleted INTEGER NOT NULL DEFAULT 0
      )
    `);

    db.run(`
      CREATE TABLE program (
        id TEXT PRIMARY KEY NOT NULL,
        group_ref TEXT NOT NULL,
        deleted INTEGER NOT NULL DEFAULT 0
      )
    `);

    db.run(`
      CREATE TABLE program_item (
        id TEXT PRIMARY KEY NOT NULL,
        program_ref TEXT NOT NULL,
        tune_set_ref TEXT,
        deleted INTEGER NOT NULL DEFAULT 0
      )
    `);

    db.run(`
      CREATE TABLE tune_set (
        id TEXT PRIMARY KEY NOT NULL,
        group_ref TEXT,
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

describe("repairPendingProgramSyncStateInSqlite", () => {
  beforeEach(async () => {
    if (!SQL) {
      SQL = await getTestSqlJs();
    }

    db = new SQL.Database();
    createSyncTriggerControlTable(db);
    createSyncPushQueueTable(db);

    db.run(`
      CREATE TABLE user_group (
        id TEXT PRIMARY KEY NOT NULL,
        deleted INTEGER NOT NULL DEFAULT 0
      )
    `);

    db.run(`
      CREATE TABLE program (
        id TEXT PRIMARY KEY NOT NULL,
        group_ref TEXT NOT NULL,
        deleted INTEGER NOT NULL DEFAULT 0
      )
    `);

    db.run(`
      CREATE TABLE program_item (
        id TEXT PRIMARY KEY NOT NULL,
        program_ref TEXT NOT NULL,
        tune_set_ref TEXT,
        deleted INTEGER NOT NULL DEFAULT 0
      )
    `);

    db.run(`
      CREATE TABLE tune_set (
        id TEXT PRIMARY KEY NOT NULL,
        group_ref TEXT,
        deleted INTEGER NOT NULL DEFAULT 0
      )
    `);
  });

  it("requeues the owning group beside a pending program row", () => {
    db.run(`
      INSERT INTO user_group (id, deleted) VALUES ('group-1', 0);
      INSERT INTO program (id, group_ref, deleted) VALUES ('program-1', 'group-1', 0);
      INSERT INTO sync_push_queue (
        id, table_name, row_id, operation, status, changed_at, attempts
      ) VALUES (
        'queue-program-1', 'program', 'program-1', 'UPDATE', 'pending', '2026-05-02T10:00:00.000Z', 0
      );
    `);

    const result = repairPendingProgramSyncStateInSqlite(db);

    expect(result).toEqual({
      requeuedProgramCount: 0,
      requeuedTuneSetCount: 0,
      requeuedGroupCount: 1,
    });
    expect(
      db.exec(`
        SELECT table_name, row_id, changed_at
        FROM sync_push_queue
        WHERE table_name = 'user_group'
      `)[0]?.values ?? []
    ).toEqual([["user_group", "group-1", "2026-05-02T10:00:00.000Z"]]);
  });

  it("pulls parent program and group into the same batch for pending program items", () => {
    db.run(`
      INSERT INTO user_group (id, deleted) VALUES ('group-2', 0);
      INSERT INTO user_group (id, deleted) VALUES ('group-3', 0);
      INSERT INTO program (id, group_ref, deleted) VALUES ('program-2', 'group-2', 0);
      INSERT INTO tune_set (id, group_ref, deleted) VALUES ('set-2', 'group-3', 0);
      INSERT INTO program_item (id, program_ref, tune_set_ref, deleted) VALUES ('item-2', 'program-2', 'set-2', 0);
      INSERT INTO sync_push_queue (
        id, table_name, row_id, operation, status, changed_at, attempts
      ) VALUES
        ('queue-item-2', 'program_item', 'item-2', 'UPDATE', 'pending', '2026-05-02T09:00:00.000Z', 0),
        ('queue-program-2-late', 'program', 'program-2', 'UPDATE', 'pending', '2026-05-02T12:00:00.000Z', 0),
        ('queue-set-2-late', 'tune_set', 'set-2', 'UPDATE', 'failed', '2026-05-02T12:00:00.500Z', 1),
        ('queue-group-2-failed', 'user_group', 'group-2', 'UPDATE', 'failed', '2026-05-02T12:00:01.000Z', 2),
        ('queue-group-3-late', 'user_group', 'group-3', 'UPDATE', 'pending', '2026-05-02T13:00:00.000Z', 0);
    `);

    const result = repairPendingProgramSyncStateInSqlite(db);

    expect(result).toEqual({
      requeuedProgramCount: 1,
      requeuedTuneSetCount: 1,
      requeuedGroupCount: 2,
    });
    expect(
      db.exec(`
        SELECT table_name, row_id, status, changed_at
        FROM sync_push_queue
        WHERE table_name IN ('program', 'tune_set', 'user_group')
        ORDER BY table_name ASC, row_id ASC
      `)[0]?.values ?? []
    ).toEqual([
      ["program", "program-2", "pending", "2026-05-02T09:00:00.000Z"],
      ["tune_set", "set-2", "pending", "2026-05-02T09:00:00.000Z"],
      ["user_group", "group-2", "pending", "2026-05-02T09:00:00.000Z"],
      ["user_group", "group-3", "pending", "2026-05-02T09:00:00.000Z"],
    ]);
  });
});
