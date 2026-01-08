/**
 * Tests for Casing Utilities
 *
 * @module tests/lib/sync/casing.test
 */

import { describe, expect, it } from "vitest";
import {
  COMMON_KEYS_CAMEL_TO_SNAKE,
  COMMON_KEYS_SNAKE_TO_CAMEL,
  camelizeKeys,
  camelizeKeysFast,
  snakifyKeys,
  snakifyKeysFast,
  toCamelCase,
  toSnakeCase,
} from "../../../oosync/src/sync/casing";

describe("toCamelCase", () => {
  it("converts simple snake_case to camelCase", () => {
    expect(toCamelCase("user_ref")).toBe("userRef");
    expect(toCamelCase("last_modified_at")).toBe("lastModifiedAt");
    expect(toCamelCase("tune_id")).toBe("tuneId");
  });

  it("handles single word (no underscores)", () => {
    expect(toCamelCase("id")).toBe("id");
    expect(toCamelCase("title")).toBe("title");
    expect(toCamelCase("deleted")).toBe("deleted");
  });

  it("handles multiple consecutive underscores gracefully", () => {
    // Edge case: multiple underscores become single capital
    expect(toCamelCase("some__field")).toBe("some_Field");
  });

  it("handles trailing underscore", () => {
    expect(toCamelCase("field_")).toBe("field_");
  });

  it("handles leading underscore (converts _x to X)", () => {
    // Note: leading underscore followed by letter becomes uppercase
    // This is fine since our schema doesn't use leading underscores
    expect(toCamelCase("_field")).toBe("Field");
  });
});

describe("toSnakeCase", () => {
  it("converts simple camelCase to snake_case", () => {
    expect(toSnakeCase("userRef")).toBe("user_ref");
    expect(toSnakeCase("lastModifiedAt")).toBe("last_modified_at");
    expect(toSnakeCase("tuneId")).toBe("tune_id");
  });

  it("handles single word (no capitals)", () => {
    expect(toSnakeCase("id")).toBe("id");
    expect(toSnakeCase("title")).toBe("title");
    expect(toSnakeCase("deleted")).toBe("deleted");
  });

  it("handles consecutive capitals", () => {
    // Each capital gets its own underscore
    expect(toSnakeCase("userID")).toBe("user_i_d");
  });

  it("handles leading capital", () => {
    expect(toSnakeCase("UserRef")).toBe("_user_ref");
  });
});

describe("camelizeKeys", () => {
  it("converts all keys from snake_case to camelCase", () => {
    const input = {
      user_ref: "123",
      last_modified_at: "2025-01-01",
      tune_id: "456",
    };
    const expected = {
      userRef: "123",
      lastModifiedAt: "2025-01-01",
      tuneId: "456",
    };
    expect(camelizeKeys(input)).toEqual(expected);
  });

  it("preserves values unchanged", () => {
    const input = {
      user_ref: 123,
      is_active: true,
      data: null,
      nested: { inner_key: "value" }, // Note: nested objects are NOT converted
    };
    const result = camelizeKeys(input);
    expect(result.userRef).toBe(123);
    expect(result.isActive).toBe(true);
    expect(result.data).toBe(null);
    expect(result.nested).toEqual({ inner_key: "value" }); // Nested stays as-is
  });

  it("handles empty object", () => {
    expect(camelizeKeys({})).toEqual({});
  });

  it("handles object with mixed key styles", () => {
    const input = {
      snake_case: 1,
      alreadyCamel: 2,
      simple: 3,
    };
    const result = camelizeKeys(input);
    expect(result.snakeCase).toBe(1);
    expect(result.alreadyCamel).toBe(2);
    expect(result.simple).toBe(3);
  });
});

describe("snakifyKeys", () => {
  it("converts all keys from camelCase to snake_case", () => {
    const input = {
      userRef: "123",
      lastModifiedAt: "2025-01-01",
      tuneId: "456",
    };
    const expected = {
      user_ref: "123",
      last_modified_at: "2025-01-01",
      tune_id: "456",
    };
    expect(snakifyKeys(input)).toEqual(expected);
  });

  it("preserves values unchanged", () => {
    const input = {
      userRef: 123,
      isActive: true,
      data: null,
    };
    const result = snakifyKeys(input);
    expect(result.user_ref).toBe(123);
    expect(result.is_active).toBe(true);
    expect(result.data).toBe(null);
  });

  it("handles empty object", () => {
    expect(snakifyKeys({})).toEqual({});
  });
});

describe("round-trip conversion", () => {
  it("camelizeKeys -> snakifyKeys returns equivalent object", () => {
    const original = {
      user_ref: "123",
      last_modified_at: "2025-01-01",
      tune_id: "456",
      id: "abc",
    };
    const camelized = camelizeKeys(original);
    const backToSnake = snakifyKeys(camelized);
    expect(backToSnake).toEqual(original);
  });

  it("snakifyKeys -> camelizeKeys returns equivalent object", () => {
    const original = {
      userRef: "123",
      lastModifiedAt: "2025-01-01",
      tuneId: "456",
      id: "abc",
    };
    const snakified = snakifyKeys(original);
    const backToCamel = camelizeKeys(snakified);
    expect(backToCamel).toEqual(original);
  });
});

describe("COMMON_KEYS maps", () => {
  it("snake_to_camel map has inverse relationship with camel_to_snake", () => {
    for (const [snake, camel] of Object.entries(COMMON_KEYS_SNAKE_TO_CAMEL)) {
      expect(COMMON_KEYS_CAMEL_TO_SNAKE[camel]).toBe(snake);
    }
  });

  it("covers common sync fields", () => {
    const requiredSnakeKeys = [
      "id",
      "user_ref",
      "tune_ref",
      "playlist_ref",
      "last_modified_at",
      "sync_version",
      "deleted",
    ];
    for (const key of requiredSnakeKeys) {
      expect(COMMON_KEYS_SNAKE_TO_CAMEL[key]).toBeDefined();
    }
  });
});

describe("camelizeKeysFast", () => {
  it("produces same result as camelizeKeys for known keys", () => {
    const input = {
      user_ref: "123",
      last_modified_at: "2025-01-01",
      tune_id: "456",
    };
    expect(camelizeKeysFast(input)).toEqual(camelizeKeys(input));
  });

  it("falls back to regex for unknown keys", () => {
    const input = {
      some_custom_field: "value",
      another_unknown_key: 123,
    };
    expect(camelizeKeysFast(input)).toEqual(camelizeKeys(input));
  });
});

describe("snakifyKeysFast", () => {
  it("produces same result as snakifyKeys for known keys", () => {
    const input = {
      userRef: "123",
      lastModifiedAt: "2025-01-01",
      tuneId: "456",
    };
    expect(snakifyKeysFast(input)).toEqual(snakifyKeys(input));
  });

  it("falls back to regex for unknown keys", () => {
    const input = {
      someCustomField: "value",
      anotherUnknownKey: 123,
    };
    expect(snakifyKeysFast(input)).toEqual(snakifyKeys(input));
  });
});

describe("real-world sync scenarios", () => {
  it("transforms a tune record from Supabase format to local format", () => {
    const supabaseRecord = {
      id: "tune-123",
      private_for: null,
      title: "The Kesh",
      type: "jig",
      last_modified_at: "2025-11-30T10:00:00Z",
      sync_version: 1,
      deleted: false,
    };

    const localRecord = camelizeKeys(supabaseRecord);

    expect(localRecord).toEqual({
      id: "tune-123",
      privateFor: null,
      title: "The Kesh",
      type: "jig",
      lastModifiedAt: "2025-11-30T10:00:00Z",
      syncVersion: 1,
      deleted: false,
    });
  });

  it("transforms a practice_record from local format to Supabase format", () => {
    const localRecord = {
      id: "pr-123",
      tuneRef: "tune-456",
      playlistRef: "playlist-789",
      practiced: "2025-11-30",
      recallEval: 4,
      lastModifiedAt: "2025-11-30T10:00:00Z",
    };

    const supabaseRecord = snakifyKeys(localRecord);

    expect(supabaseRecord).toEqual({
      id: "pr-123",
      tune_ref: "tune-456",
      playlist_ref: "playlist-789",
      practiced: "2025-11-30",
      recall_eval: 4,
      last_modified_at: "2025-11-30T10:00:00Z",
    });
  });

  it("transforms daily_practice_queue with all its fields", () => {
    const supabaseRecord = {
      id: "dpq-123",
      user_ref: "user-456",
      playlist_ref: "playlist-789",
      window_start_utc: "2025-11-30T00:00:00",
      window_end_utc: "2025-12-01T00:00:00",
      tune_ref: "tune-abc",
      bucket: 1,
      order_index: 5,
      snapshot_coalesced_ts: "2025-11-30T00:00:00",
      generated_at: "2025-11-30T08:00:00",
      completed_at: null,
      active: true,
      sync_version: 1,
      last_modified_at: "2025-11-30T08:00:00Z",
    };

    const localRecord = camelizeKeys(supabaseRecord);

    expect(localRecord.windowStartUtc).toBe("2025-11-30T00:00:00");
    expect(localRecord.windowEndUtc).toBe("2025-12-01T00:00:00");
    expect(localRecord.orderIndex).toBe(5);
    expect(localRecord.snapshotCoalescedTs).toBe("2025-11-30T00:00:00");
    expect(localRecord.completedAt).toBe(null);
    expect(localRecord.active).toBe(true);
  });
});
