import {
  createSqliteWasmDatabase,
  initSqliteWasm,
} from "@oosync/runtime/sqlite-wasm-adapter";
import type { SqliteRawDatabase } from "oosync/runtime/browser-sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ownsActiveSync,
  type SyncCompletionOwner,
} from "../sync/completion-owner";
import { lastSyncTimestampKey } from "../sync/storage-keys";
import {
  canDiscardLocalTable,
  finishUpgradeFullPull,
  getUpgradeFullPullGeneration,
  requireUpgradeFullPull,
  resumeUpgradeFullPull,
  withUpgradeIdentity,
} from "./upgrade-policy";

let db: SqliteRawDatabase;
const userId = "upgrade-user";
const timestampKey = lastSyncTimestampKey(userId);
const markerKey = `TT_UPGRADE_FULL_PULL_${userId}`;
function approve(tableName: string, authenticated = true) {
  return withUpgradeIdentity(userId, authenticated, async () =>
    canDiscardLocalTable({ rawDb: db, userId, tableName })
  );
}
beforeEach(async () => {
  const storage = new Map<string, string>([
    [timestampKey, "2026-11-15T12:00:00Z"],
  ]);
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
  });
  db = createSqliteWasmDatabase(await initSqliteWasm());
  db.run("CREATE TABLE tune (id TEXT); CREATE TABLE draft (id TEXT)");
  db.run(
    "CREATE TRIGGER trg_tune_insert AFTER INSERT ON tune BEGIN SELECT 1; END"
  );
  db.run(
    "CREATE TRIGGER trg_tune_update AFTER UPDATE ON tune BEGIN SELECT 1; END"
  );
  db.run(
    "CREATE TRIGGER trg_tune_delete AFTER DELETE ON tune BEGIN SELECT 1; END"
  );
});
afterEach(() => {
  db.close();
  vi.unstubAllGlobals();
});

describe("upgrade preservation policy", () => {
  it("approves an audited previously tracked table after authenticated sync", async () => {
    expect(await approve("tune")).toBe(true);
  });
  it("protects anonymous data even with old triggers and a download timestamp", async () => {
    expect(await approve("tune", false)).toBe(false);
  });
  it("protects staging rows even with historical tracking triggers", async () => {
    db.run("CREATE TABLE table_transient_data (id TEXT)");
    for (const operation of ["insert", "update", "delete"]) {
      db.run(
        `CREATE TRIGGER trg_table_transient_data_${operation} AFTER ${operation} ON table_transient_data BEGIN SELECT 1; END`
      );
    }
    expect(await approve("table_transient_data")).toBe(false);
  });
  it("keeps approval until overlapping authenticated initialization completes", async () => {
    await withUpgradeIdentity(userId, true, async () => {
      await approve("tune");
      expect(
        canDiscardLocalTable({ rawDb: db, userId, tableName: "tune" })
      ).toBe(true);
    });
  });
  it("does not let anonymous initialization clear authenticated approval", async () => {
    await withUpgradeIdentity(userId, true, async () => {
      await approve("tune", false);
      expect(
        canDiscardLocalTable({ rawDb: db, userId, tableName: "tune" })
      ).toBe(true);
    });
  });
  it("protects pending media uploads", async () => {
    expect(await approve("media_draft_outbox")).toBe(false);
  });
  it("does not automatically approve a newly syncable table", async () => {
    expect(await approve("draft")).toBe(false);
  });
  it("protects an audited table that predates write tracking", async () => {
    db.run("DROP TRIGGER trg_tune_insert");
    expect(await approve("tune")).toBe(false);
  });
  it("requires a previous successful sync", async () => {
    localStorage.removeItem(timestampKey);
    expect(await approve("tune")).toBe(false);
  });
  it("allows regenerated view metadata", async () => {
    expect(await approve("view_column_meta", false)).toBe(true);
  });
  it("does not retain authenticated approval after initialization", async () => {
    await approve("tune");
    expect(canDiscardLocalTable({ rawDb: db, userId, tableName: "tune" })).toBe(
      false
    );
  });
});

describe("durable upgrade download recovery", () => {
  it("does not persist a stale pull after a new database requires recovery", async () => {
    requireUpgradeFullPull(userId);
    const oldGeneration = getUpgradeFullPullGeneration(userId);
    requireUpgradeFullPull(userId);
    const persist = vi.fn(async () => {});
    await finishUpgradeFullPull(userId, persist, oldGeneration, () => true);
    expect(persist).not.toHaveBeenCalled();
  });
  it("does not remove a new database's marker on stale pull completion", async () => {
    requireUpgradeFullPull(userId);
    const oldGeneration = getUpgradeFullPullGeneration(userId);
    requireUpgradeFullPull(userId);
    const newGeneration = getUpgradeFullPullGeneration(userId);
    await finishUpgradeFullPull(
      userId,
      async () => {},
      oldGeneration,
      () => true
    );
    expect(getUpgradeFullPullGeneration(userId)).toBe(newGeneration);
  });
  it("does not finish a marker created after an unmarked pull started", async () => {
    requireUpgradeFullPull(userId);
    const persist = vi.fn(async () => {});
    await finishUpgradeFullPull(userId, persist, null, () => true);
    expect(persist).not.toHaveBeenCalled();
  });
  it("clears the old cursor before the new sync engine starts", () => {
    requireUpgradeFullPull(userId);
    expect(localStorage.getItem(timestampKey)).toBeNull();
    expect(localStorage.getItem(markerKey)).toBeTruthy();
  });
  it("repeats the full pull after a crash between watermark and database persistence", () => {
    requireUpgradeFullPull(userId);
    localStorage.setItem(timestampKey, "new-but-not-persisted");
    resumeUpgradeFullPull(userId);
    expect(localStorage.getItem(timestampKey)).toBeNull();
  });
  it("keeps recovery pending when persistence fails", async () => {
    requireUpgradeFullPull(userId);
    await expect(
      finishUpgradeFullPull(
        userId,
        async () => {
          throw new Error("disk full");
        },
        getUpgradeFullPullGeneration(userId),
        () => true
      )
    ).rejects.toThrow("disk full");
    expect(localStorage.getItem(markerKey)).toBeTruthy();
  });
  it("keeps the marker while persistence is in progress", async () => {
    requireUpgradeFullPull(userId);
    let release = () => {};
    const pending = finishUpgradeFullPull(
      userId,
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
      getUpgradeFullPullGeneration(userId),
      () => true
    );
    expect(localStorage.getItem(markerKey)).toBeTruthy();
    release();
    await pending;
  });
  it("removes the marker after persistence completes", async () => {
    requireUpgradeFullPull(userId);
    await finishUpgradeFullPull(
      userId,
      async () => {},
      getUpgradeFullPullGeneration(userId),
      () => true
    );
    expect(localStorage.getItem(markerKey)).toBeNull();
  });
  it("does not reset the cursor when resumed after completion", async () => {
    requireUpgradeFullPull(userId);
    localStorage.setItem(timestampKey, "download-complete");
    await finishUpgradeFullPull(
      userId,
      async () => {},
      getUpgradeFullPullGeneration(userId),
      () => true
    );
    resumeUpgradeFullPull(userId);
    expect(localStorage.getItem(timestampKey)).toBe("download-complete");
  });
  it("preserves a new requirement raised during persistence", async () => {
    requireUpgradeFullPull(userId);
    let release = () => {};
    const pending = finishUpgradeFullPull(
      userId,
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
      getUpgradeFullPullGeneration(userId),
      () => true
    );
    requireUpgradeFullPull(userId);
    const newGeneration = localStorage.getItem(markerKey);
    release();
    await pending;
    expect(localStorage.getItem(markerKey)).toBe(newGeneration);
  });
});

describe("sync completion ownership", () => {
  const owner: SyncCompletionOwner = { userId, database: {}, service: {} };
  it.each([
    ["account switch", { ...owner, userId: "other-user" }],
    ["database replacement", { ...owner, database: {} }],
    ["service replacement", { ...owner, service: {} }],
    ["service teardown", { ...owner, service: null }],
  ])(
    "preserves recovery after %s with an unchanged marker",
    async (_name, active) => {
      requireUpgradeFullPull(userId);
      const generation = getUpgradeFullPullGeneration(userId);
      const persist = vi.fn(async () => {});
      await finishUpgradeFullPull(userId, persist, generation, () =>
        ownsActiveSync(owner, active)
      );
      expect(persist).not.toHaveBeenCalled();
      expect(getUpgradeFullPullGeneration(userId)).toBe(generation);
    }
  );

  it("keeps recovery pending when ownership changes during persistence", async () => {
    requireUpgradeFullPull(userId);
    const generation = getUpgradeFullPullGeneration(userId);
    let active = owner;
    let release = () => {};
    const pending = finishUpgradeFullPull(
      userId,
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
      generation,
      () => ownsActiveSync(owner, active)
    );
    active = { ...owner, service: {} };
    release();
    await pending;
    expect(getUpgradeFullPullGeneration(userId)).toBe(generation);
  });

  it("finishes recovery for the active user, database and service", async () => {
    requireUpgradeFullPull(userId);
    const persist = vi.fn(async () => {});
    await finishUpgradeFullPull(
      userId,
      persist,
      getUpgradeFullPullGeneration(userId),
      () => ownsActiveSync(owner, owner)
    );
    expect(persist).toHaveBeenCalledOnce();
    expect(getUpgradeFullPullGeneration(userId)).toBeNull();
  });
});
