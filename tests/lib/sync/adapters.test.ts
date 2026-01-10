/**
 * Tests for Per-Table Sync Adapters
 *
 * @module tests/lib/sync/adapters.test
 */

import { SYNCABLE_TABLES } from "@sync-schema/table-meta";
import { beforeEach, describe, expect, it } from "vitest";
import {
  batchToLocal,
  batchToRemote,
  clearAdapterCache,
  createAdapter,
  getAdapter,
  getRegisteredTables,
  hasAdapter,
} from "../../../oosync/src/sync/adapters";
import { ensureSyncRuntimeConfigured } from "../../../src/lib/sync/runtime-config";

ensureSyncRuntimeConfigured();

beforeEach(() => {
  clearAdapterCache();
});

describe("createAdapter", () => {
  it("creates adapter for tune table", () => {
    const adapter = createAdapter("tune");
    expect(adapter.tableName).toBe("tune");
    expect(adapter.primaryKey).toBe("id");
    expect(adapter.conflictKeys).toBeNull();
    expect(adapter.booleanColumns).toContain("deleted");
  });

  it("creates adapter for practice_record table", () => {
    const adapter = createAdapter("practice_record");
    expect(adapter.primaryKey).toBe("id");
    expect(adapter.conflictKeys).toEqual([
      "tune_ref",
      "playlist_ref",
      "practiced",
    ]);
  });

  it("creates adapter for playlist (non-standard PK)", () => {
    const adapter = createAdapter("playlist");
    expect(adapter.primaryKey).toBe("playlist_id");
  });

  it("creates adapter for table_transient_data (composite PK)", () => {
    const adapter = createAdapter("table_transient_data");
    // Keep ordering consistent with the generated table metadata.
    expect(adapter.primaryKey).toEqual(["tune_id", "user_id", "playlist_id"]);
  });

  it("throws for unregistered table", () => {
    expect(() => createAdapter("nonexistent_table" as any)).toThrow(
      "No metadata registered for table: nonexistent_table"
    );
  });
});

describe("getAdapter (cached)", () => {
  it("returns same adapter instance on repeated calls", () => {
    const adapter1 = getAdapter("tune");
    const adapter2 = getAdapter("tune");
    expect(adapter1).toBe(adapter2);
  });

  it("returns different adapters for different tables", () => {
    const tuneAdapter = getAdapter("tune");
    const playlistAdapter = getAdapter("playlist");
    expect(tuneAdapter).not.toBe(playlistAdapter);
  });
});

describe("hasAdapter", () => {
  it("returns true for registered tables", () => {
    expect(hasAdapter("tune")).toBe(true);
    expect(hasAdapter("playlist")).toBe(true);
    expect(hasAdapter("daily_practice_queue")).toBe(true);
  });

  it("returns false for unregistered tables", () => {
    expect(hasAdapter("nonexistent")).toBe(false);
    expect(hasAdapter("sync_queue")).toBe(false);
  });
});

describe("getRegisteredTables", () => {
  it("returns all syncable table names", () => {
    const tables = getRegisteredTables();
    expect(tables.length).toBe(SYNCABLE_TABLES.length);
    for (const table of SYNCABLE_TABLES) {
      expect(tables).toContain(table);
    }
  });
});

describe("toLocal transformation", () => {
  it("converts snake_case keys to camelCase", () => {
    const adapter = getAdapter("tune");
    const remote = {
      id: "tune-1",
      private_for: "user-1",
      first_practice: "2025-01-01",
      last_modified_at: "2025-01-15T10:00:00Z",
    };

    const local = adapter.toLocal(remote);

    expect(local).toHaveProperty("id", "tune-1");
    expect(local).toHaveProperty("privateFor", "user-1");
    expect(local).toHaveProperty("firstPractice", "2025-01-01");
    expect(local).toHaveProperty("lastModifiedAt", "2025-01-15T10:00:00Z");
  });

  it("converts Postgres booleans to SQLite integers", () => {
    const adapter = getAdapter("tune");
    const remote = {
      id: "tune-1",
      title: "Test Tune",
      deleted: true,
    };

    const local = adapter.toLocal(remote);

    expect(local.deleted).toBe(1);
  });

  it("converts false to 0", () => {
    const adapter = getAdapter("tune");
    const remote = {
      id: "tune-1",
      deleted: false,
    };

    const local = adapter.toLocal(remote);

    expect(local.deleted).toBe(0);
  });

  it("handles multiple boolean columns", () => {
    const adapter = getAdapter("note");
    const remote = {
      id: "note-1",
      public: true,
      favorite: false,
      deleted: true,
    };

    const local = adapter.toLocal(remote);

    expect(local.public).toBe(1);
    expect(local.favorite).toBe(0);
    expect(local.deleted).toBe(1);
  });

  it("handles daily_practice_queue with active boolean", () => {
    const adapter = getAdapter("daily_practice_queue");
    const remote = {
      id: "queue-1",
      active: true,
      window_start_utc: "2025-11-30T00:00:00Z",
    };

    const local = adapter.toLocal(remote);

    expect(local.active).toBe(1);
    expect(local.windowStartUtc).toBe("2025-11-30T00:00:00Z");
  });
});

describe("toRemote transformation", () => {
  it("converts camelCase keys to snake_case", () => {
    const adapter = getAdapter("tune");
    const local = {
      id: "tune-1",
      privateFor: "user-1",
      firstPractice: "2025-01-01",
      lastModifiedAt: "2025-01-15T10:00:00Z",
    };

    const remote = adapter.toRemote(local);

    expect(remote).toHaveProperty("id", "tune-1");
    expect(remote).toHaveProperty("private_for", "user-1");
    expect(remote).toHaveProperty("first_practice", "2025-01-01");
    expect(remote).toHaveProperty("last_modified_at", "2025-01-15T10:00:00Z");
  });

  it("converts SQLite integers to Postgres booleans", () => {
    const adapter = getAdapter("tune");
    const local = {
      id: "tune-1",
      title: "Test Tune",
      deleted: 1,
    };

    const remote = adapter.toRemote(local);

    expect(remote.deleted).toBe(true);
  });

  it("converts 0 to false", () => {
    const adapter = getAdapter("tune");
    const local = {
      id: "tune-1",
      deleted: 0,
    };

    const remote = adapter.toRemote(local);

    expect(remote.deleted).toBe(false);
  });

  it("handles multiple boolean columns", () => {
    const adapter = getAdapter("note");
    const local = {
      id: "note-1",
      public: 1,
      favorite: 0,
      deleted: 1,
    };

    const remote = adapter.toRemote(local);

    expect(remote.public).toBe(true);
    expect(remote.favorite).toBe(false);
    expect(remote.deleted).toBe(true);
  });
});

describe("daily_practice_queue normalization", () => {
  it("normalizes datetime fields (space to T)", () => {
    const adapter = getAdapter("daily_practice_queue");
    const local = {
      id: "queue-1",
      windowStartUtc: "2025-11-30 00:00:00",
      windowEndUtc: "2025-12-01 00:00:00",
      generatedAt: "2025-11-30 08:00:00",
      completedAt: null,
      active: 1,
    };

    const remote = adapter.toRemote(local);

    expect(remote.window_start_utc).toBe("2025-11-30T00:00:00Z");
    expect(remote.window_end_utc).toBe("2025-12-01T00:00:00Z");
    expect(remote.generated_at).toBe("2025-11-30T08:00:00Z");
    expect(remote.completed_at).toBeNull();
    expect(remote.active).toBe(true);
  });

  it("preserves already-normalized datetime fields", () => {
    const adapter = getAdapter("daily_practice_queue");
    const local = {
      id: "queue-1",
      windowStartUtc: "2025-11-30T00:00:00",
      active: 1,
    };

    const remote = adapter.toRemote(local);

    expect(remote.window_start_utc).toBe("2025-11-30T00:00:00Z");
  });
});

describe("round-trip transformations", () => {
  it("tune: remote → local → remote preserves data", () => {
    const adapter = getAdapter("tune");
    const original = {
      id: "tune-1",
      private_for: "user-1",
      title: "Banish Misfortune",
      type: "jig",
      mode: "Dmix",
      deleted: false,
      last_modified_at: "2025-01-15T10:00:00Z",
    };

    const local = adapter.toLocal(original);
    const roundTripped = adapter.toRemote(local);

    expect(roundTripped.id).toBe(original.id);
    expect(roundTripped.private_for).toBe(original.private_for);
    expect(roundTripped.title).toBe(original.title);
    expect(roundTripped.type).toBe(original.type);
    expect(roundTripped.mode).toBe(original.mode);
    expect(roundTripped.deleted).toBe(original.deleted);
    expect(roundTripped.last_modified_at).toBe(original.last_modified_at);
  });

  it("practice_record: local → remote → local preserves data", () => {
    const adapter = getAdapter("practice_record");
    const original = {
      id: "pr-1",
      tuneRef: "tune-1",
      playlistRef: "playlist-1",
      practiced: "2025-01-15T10:00:00Z",
      quality: 4,
      lastModifiedAt: "2025-01-15T10:00:00Z",
    };

    const remote = adapter.toRemote(original);
    const roundTripped = adapter.toLocal(remote);

    expect(roundTripped.id).toBe(original.id);
    expect(roundTripped.tuneRef).toBe(original.tuneRef);
    expect(roundTripped.playlistRef).toBe(original.playlistRef);
    expect(roundTripped.practiced).toBe(original.practiced);
    expect(roundTripped.quality).toBe(original.quality);
  });

  it("note: boolean round-trip preserves values", () => {
    const adapter = getAdapter("note");
    const original = {
      id: "note-1",
      public: true,
      favorite: false,
      deleted: true,
    };

    const local = adapter.toLocal(original);
    expect(local.public).toBe(1);
    expect(local.favorite).toBe(0);
    expect(local.deleted).toBe(1);

    const roundTripped = adapter.toRemote(local);
    expect(roundTripped.public).toBe(true);
    expect(roundTripped.favorite).toBe(false);
    expect(roundTripped.deleted).toBe(true);
  });
});

describe("batchToLocal", () => {
  it("transforms multiple rows", () => {
    const rows = [
      { id: "tune-1", title: "Tune 1", deleted: false },
      { id: "tune-2", title: "Tune 2", deleted: true },
    ];

    const local = batchToLocal("tune", rows);

    expect(local).toHaveLength(2);
    expect(local[0].deleted).toBe(0);
    expect(local[1].deleted).toBe(1);
  });

  it("handles empty array", () => {
    const local = batchToLocal("tune", []);
    expect(local).toHaveLength(0);
  });
});

describe("batchToRemote", () => {
  it("transforms multiple rows", () => {
    const rows = [
      { id: "tune-1", title: "Tune 1", deleted: 0 },
      { id: "tune-2", title: "Tune 2", deleted: 1 },
    ];

    const remote = batchToRemote("tune", rows);

    expect(remote).toHaveLength(2);
    expect(remote[0].deleted).toBe(false);
    expect(remote[1].deleted).toBe(true);
  });
});

describe("all syncable tables have adapters", () => {
  const cases = SYNCABLE_TABLES.map((tableName) => [tableName] as const);

  it.each(cases)("can create adapter for %s", (tableName) => {
    const adapter = createAdapter(tableName);
    expect(adapter.tableName).toBe(tableName);
    expect(adapter.primaryKey).toBeDefined();
  });
});

describe("adapter metadata correctness", () => {
  it("genre_tune_type has composite PK and conflict keys", () => {
    const adapter = getAdapter("genre_tune_type");
    expect(adapter.primaryKey).toEqual(["genre_id", "tune_type_id"]);
    // Composite PK tables often use PK as conflict target
    expect(adapter.conflictKeys).toEqual(["genre_id", "tune_type_id"]);
  });

  it("table_state has 4-column composite PK", () => {
    const adapter = getAdapter("table_state");
    expect(adapter.primaryKey).toEqual([
      "user_id",
      "screen_size",
      "purpose",
      "playlist_id",
    ]);
  });

  it("tab_group_main_state has boolean columns", () => {
    const adapter = getAdapter("tab_group_main_state");
    // In the current schema these fields are stored as integers (0/1) rather than booleans,
    // so the generated metadata does not classify them as boolean columns.
    expect(adapter.booleanColumns).toEqual([]);
  });
});
