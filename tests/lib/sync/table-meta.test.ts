/**
 * Tests for Table Metadata Registry
 *
 * @module tests/lib/sync/table-meta.test
 */

import { describe, expect, it } from "vitest";
import {
  buildRowIdForOutbox,
  COMPOSITE_PK_TABLES,
  getBooleanColumns,
  getConflictTarget,
  getNormalizer,
  getPrimaryKey,
  getUniqueKeys,
  hasCompositePK,
  hasDeletedFlag,
  isRegisteredTable,
  NON_STANDARD_PK_TABLES,
  parseOutboxRowId,
  SYNCABLE_TABLES,
  supportsIncremental,
  TABLE_REGISTRY,
} from "@oosync/shared/table-meta";

describe("TABLE_REGISTRY completeness", () => {
  it("has entries for all SYNCABLE_TABLES", () => {
    for (const tableName of SYNCABLE_TABLES) {
      expect(TABLE_REGISTRY[tableName]).toBeDefined();
    }
  });

  it("SYNCABLE_TABLES contains all registered tables", () => {
    const registeredTables = Object.keys(TABLE_REGISTRY);
    for (const tableName of registeredTables) {
      expect(SYNCABLE_TABLES).toContain(tableName);
    }
  });

  it("has the expected number of tables", () => {
    // Update this if adding/removing tables
    expect(SYNCABLE_TABLES.length).toBe(19);
    expect(Object.keys(TABLE_REGISTRY).length).toBe(19);
  });
});

describe("COMPOSITE_PK_TABLES", () => {
  it("correctly identifies tables with composite PKs", () => {
    for (const tableName of COMPOSITE_PK_TABLES) {
      const meta = TABLE_REGISTRY[tableName];
      expect(Array.isArray(meta.primaryKey)).toBe(true);
    }
  });

  it("includes expected composite key tables", () => {
    expect(COMPOSITE_PK_TABLES).toContain("genre_tune_type");
    expect(COMPOSITE_PK_TABLES).toContain("prefs_spaced_repetition");
    expect(COMPOSITE_PK_TABLES).toContain("table_state");
    expect(COMPOSITE_PK_TABLES).toContain("playlist_tune");
    expect(COMPOSITE_PK_TABLES).toContain("table_transient_data");
  });

  it("has 5 composite key tables", () => {
    expect(COMPOSITE_PK_TABLES.length).toBe(5);
  });
});

describe("NON_STANDARD_PK_TABLES", () => {
  it("correctly maps non-standard PK column names", () => {
    expect(NON_STANDARD_PK_TABLES.playlist).toBe("playlist_id");
    expect(NON_STANDARD_PK_TABLES.user_profile).toBe("supabase_user_id");
    expect(NON_STANDARD_PK_TABLES.prefs_scheduling_options).toBe("user_id");
  });

  it("tables in map have matching registry entries", () => {
    for (const [tableName, pkColumn] of Object.entries(
      NON_STANDARD_PK_TABLES
    )) {
      const meta = TABLE_REGISTRY[tableName];
      expect(meta).toBeDefined();
      // For single-column PKs, check it matches
      if (!Array.isArray(meta.primaryKey)) {
        expect(meta.primaryKey).toBe(pkColumn);
      }
    }
  });
});

describe("getPrimaryKey", () => {
  it("returns string for single-column PK tables", () => {
    expect(getPrimaryKey("tune")).toBe("id");
    expect(getPrimaryKey("playlist")).toBe("playlist_id");
    expect(getPrimaryKey("user_profile")).toBe("supabase_user_id");
  });

  it("returns array for composite PK tables", () => {
    expect(getPrimaryKey("genre_tune_type")).toEqual([
      "genre_id",
      "tune_type_id",
    ]);
    expect(getPrimaryKey("table_transient_data")).toEqual([
      "user_id",
      "tune_id",
      "playlist_id",
    ]);
    expect(getPrimaryKey("table_state")).toEqual([
      "user_id",
      "screen_size",
      "purpose",
      "playlist_id",
    ]);
  });

  it("throws for unknown tables", () => {
    expect(() => getPrimaryKey("nonexistent_table")).toThrow(
      "Unknown table: nonexistent_table"
    );
  });
});

describe("getUniqueKeys", () => {
  it("returns null for tables without unique constraints", () => {
    expect(getUniqueKeys("tune")).toBeNull();
    expect(getUniqueKeys("playlist")).toBeNull();
    expect(getUniqueKeys("genre")).toBeNull();
  });

  it("returns unique key columns for tables with constraints", () => {
    expect(getUniqueKeys("practice_record")).toEqual([
      "tune_ref",
      "playlist_ref",
      "practiced",
    ]);
    expect(getUniqueKeys("daily_practice_queue")).toEqual([
      "user_ref",
      "playlist_ref",
      "window_start_utc",
      "tune_ref",
    ]);
    expect(getUniqueKeys("tag")).toEqual(["user_ref", "tune_ref", "tag_text"]);
  });

  it("throws for unknown tables", () => {
    expect(() => getUniqueKeys("nonexistent_table")).toThrow();
  });
});

describe("getConflictTarget", () => {
  it("returns uniqueKeys when available", () => {
    expect(getConflictTarget("practice_record")).toEqual([
      "tune_ref",
      "playlist_ref",
      "practiced",
    ]);
  });

  it("falls back to primaryKey when no uniqueKeys", () => {
    expect(getConflictTarget("tune")).toEqual(["id"]);
    expect(getConflictTarget("playlist")).toEqual(["playlist_id"]);
  });

  it("handles composite PK fallback", () => {
    // genre_tune_type has composite PK that is also its unique key
    expect(getConflictTarget("genre_tune_type")).toEqual([
      "genre_id",
      "tune_type_id",
    ]);
  });
});

describe("supportsIncremental", () => {
  it("returns true for tables with last_modified_at", () => {
    expect(supportsIncremental("tune")).toBe(true);
    expect(supportsIncremental("playlist")).toBe(true);
    expect(supportsIncremental("practice_record")).toBe(true);
    expect(supportsIncremental("daily_practice_queue")).toBe(true);
  });

  it("returns false for reference tables without timestamps", () => {
    expect(supportsIncremental("genre")).toBe(false);
    expect(supportsIncremental("tune_type")).toBe(false);
    expect(supportsIncremental("genre_tune_type")).toBe(false);
  });

  it("returns false for unknown tables", () => {
    expect(supportsIncremental("nonexistent")).toBe(false);
  });
});

describe("hasDeletedFlag", () => {
  it("returns true for tables with soft delete", () => {
    expect(hasDeletedFlag("tune")).toBe(true);
    expect(hasDeletedFlag("playlist")).toBe(true);
    expect(hasDeletedFlag("note")).toBe(true);
    expect(hasDeletedFlag("reference")).toBe(true);
    expect(hasDeletedFlag("user_profile")).toBe(true);
  });

  it("returns false for tables without soft delete", () => {
    expect(hasDeletedFlag("practice_record")).toBe(false);
    expect(hasDeletedFlag("daily_practice_queue")).toBe(false);
    expect(hasDeletedFlag("genre")).toBe(false);
    expect(hasDeletedFlag("tag")).toBe(false);
  });
});

describe("getBooleanColumns", () => {
  it("returns empty array for tables without booleans", () => {
    expect(getBooleanColumns("genre")).toEqual([]);
    expect(getBooleanColumns("practice_record")).toEqual([]);
  });

  it("returns boolean columns for applicable tables", () => {
    expect(getBooleanColumns("tune")).toEqual(["deleted"]);
    expect(getBooleanColumns("daily_practice_queue")).toEqual(["active"]);
    expect(getBooleanColumns("note")).toEqual([
      "public",
      "favorite",
      "deleted",
    ]);
    expect(getBooleanColumns("tab_group_main_state")).toEqual([
      "practice_show_submitted",
      "practice_mode_flashcard",
    ]);
  });
});

describe("getNormalizer", () => {
  it("returns undefined for tables without normalization", () => {
    expect(getNormalizer("tune")).toBeUndefined();
    expect(getNormalizer("playlist")).toBeUndefined();
    expect(getNormalizer("genre")).toBeUndefined();
  });

  it("returns normalizer function for daily_practice_queue", () => {
    const normalizer = getNormalizer("daily_practice_queue");
    expect(normalizer).toBeDefined();
    expect(typeof normalizer).toBe("function");
  });

  it("daily_practice_queue normalizer converts space to T in datetime fields", () => {
    const normalizer = getNormalizer("daily_practice_queue")!;
    const input = {
      id: "123",
      window_start_utc: "2025-11-30 00:00:00",
      window_end_utc: "2025-12-01 00:00:00",
      generated_at: "2025-11-30 08:00:00",
      completed_at: null,
      other_field: "unchanged",
    };
    const output = normalizer(input);
    expect(output.window_start_utc).toBe("2025-11-30T00:00:00Z");
    expect(output.window_end_utc).toBe("2025-12-01T00:00:00Z");
    expect(output.generated_at).toBe("2025-11-30T08:00:00Z");
    expect(output.completed_at).toBeNull(); // null unchanged
    expect(output.other_field).toBe("unchanged");
  });
});

describe("isRegisteredTable", () => {
  it("returns true for registered tables", () => {
    expect(isRegisteredTable("tune")).toBe(true);
    expect(isRegisteredTable("playlist")).toBe(true);
    expect(isRegisteredTable("daily_practice_queue")).toBe(true);
  });

  it("returns false for unregistered tables", () => {
    expect(isRegisteredTable("nonexistent")).toBe(false);
    expect(isRegisteredTable("sync_queue")).toBe(false); // Internal table
  });
});

describe("hasCompositePK", () => {
  it("returns true for composite PK tables", () => {
    expect(hasCompositePK("genre_tune_type")).toBe(true);
    expect(hasCompositePK("table_transient_data")).toBe(true);
    expect(hasCompositePK("table_state")).toBe(true);
  });

  it("returns false for single-column PK tables", () => {
    expect(hasCompositePK("tune")).toBe(false);
    expect(hasCompositePK("playlist")).toBe(false);
    expect(hasCompositePK("note")).toBe(false);
  });
});

describe("buildRowIdForOutbox", () => {
  it("returns simple string for single-column PK", () => {
    const rowId = buildRowIdForOutbox("tune", { id: "abc-123" });
    expect(rowId).toBe("abc-123");
  });

  it("returns JSON string for composite PK", () => {
    const rowId = buildRowIdForOutbox("table_transient_data", {
      user_id: "user-1",
      tune_id: "tune-2",
      playlist_id: "playlist-3",
      other_field: "ignored",
    });
    const parsed = JSON.parse(rowId);
    expect(parsed).toEqual({
      user_id: "user-1",
      tune_id: "tune-2",
      playlist_id: "playlist-3",
    });
  });

  it("handles playlist with non-standard PK name", () => {
    const rowId = buildRowIdForOutbox("playlist", { playlist_id: "pl-123" });
    expect(rowId).toBe("pl-123");
  });
});

describe("parseOutboxRowId", () => {
  it("returns string directly for single-column PK", () => {
    const result = parseOutboxRowId("tune", "abc-123");
    expect(result).toBe("abc-123");
  });

  it("parses JSON for composite PK", () => {
    const json = JSON.stringify({
      user_id: "user-1",
      tune_id: "tune-2",
      playlist_id: "playlist-3",
    });
    const result = parseOutboxRowId("table_transient_data", json);
    expect(result).toEqual({
      user_id: "user-1",
      tune_id: "tune-2",
      playlist_id: "playlist-3",
    });
  });

  it("throws for invalid JSON on composite PK table", () => {
    expect(() =>
      parseOutboxRowId("table_transient_data", "not-json")
    ).toThrow();
  });
});

describe("specific table metadata correctness", () => {
  it("practice_record has correct metadata", () => {
    const meta = TABLE_REGISTRY.practice_record;
    expect(meta.primaryKey).toBe("id");
    expect(meta.uniqueKeys).toEqual(["tune_ref", "playlist_ref", "practiced"]);
    expect(meta.timestamps).toContain("practiced");
    expect(meta.timestamps).toContain("last_modified_at");
    expect(meta.supportsIncremental).toBe(true);
  });

  it("daily_practice_queue has correct metadata", () => {
    const meta = TABLE_REGISTRY.daily_practice_queue;
    expect(meta.primaryKey).toBe("id");
    expect(meta.uniqueKeys).toEqual([
      "user_ref",
      "playlist_ref",
      "window_start_utc",
      "tune_ref",
    ]);
    expect(meta.booleanColumns).toContain("active");
    expect(meta.normalize).toBeDefined();
  });

  it("playlist_tune has correct composite PK", () => {
    const meta = TABLE_REGISTRY.playlist_tune;
    expect(meta.primaryKey).toEqual(["playlist_ref", "tune_ref"]);
    expect(meta.uniqueKeys).toEqual(["playlist_ref", "tune_ref"]);
  });

  it("user_profile uses supabase_user_id as PK", () => {
    const meta = TABLE_REGISTRY.user_profile;
    expect(meta.primaryKey).toBe("supabase_user_id");
  });
});
