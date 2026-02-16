/**
 * AI Tool Executor Tests
 *
 * Tests for AI assistant tool execution logic
 */

import Database from "better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeToolCall } from "../../../src/lib/ai/tool-executor";
import type { ToolCall } from "../../../src/lib/ai/types";
import { applyMigrations } from "../../../src/lib/services/test-schema-loader";

// Mock the sync module to avoid Supabase dependency in tests
vi.mock("../../../src/lib/sync", () => ({
  queueSync: vi.fn(() => Promise.resolve()),
}));

// Mock the persistDb function to avoid IndexedDB dependency in tests
vi.mock("../../../src/lib/db/client-sqlite", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/lib/db/client-sqlite")>();
  return {
    ...actual,
    persistDb: vi.fn(() => Promise.resolve()),
  };
});

// Test database setup
let db: BetterSQLite3Database;
const TEST_USER_ID = "test-user-123";
const TEST_PLAYLIST_ID = "test-playlist-123";

beforeEach(() => {
  const sqlite = new Database(":memory:");
  db = drizzle(sqlite) as BetterSQLite3Database;

  // Apply production schema from migrations
  applyMigrations(db);
});

describe("AI Tool Executor", () => {
  describe("filter_tunes", () => {
    it("should apply type filter", async () => {
      const setSelectedTypes = vi.fn();

      const toolCall: ToolCall = {
        tool: "filter_tunes",
        args: { type: "Reel" },
      };

      const result = await executeToolCall(toolCall, {
        localDb: db,
        userId: TEST_USER_ID,
        setSelectedTypes,
      });

      expect(result.success).toBe(true);
      expect(setSelectedTypes).toHaveBeenCalledWith(["Reel"]);
      expect(result.message).toContain("Type: Reel");
    });

    it("should apply mode filter", async () => {
      const setSelectedModes = vi.fn();

      const toolCall: ToolCall = {
        tool: "filter_tunes",
        args: { mode: "D Major" },
      };

      const result = await executeToolCall(toolCall, {
        localDb: db,
        userId: TEST_USER_ID,
        setSelectedModes,
      });

      expect(result.success).toBe(true);
      expect(setSelectedModes).toHaveBeenCalledWith(["D Major"]);
      expect(result.message).toContain("Mode: D Major");
    });

    it("should apply genre filter", async () => {
      const setSelectedGenres = vi.fn();

      const toolCall: ToolCall = {
        tool: "filter_tunes",
        args: { genre: "Irish" },
      };

      const result = await executeToolCall(toolCall, {
        localDb: db,
        userId: TEST_USER_ID,
        setSelectedGenres,
      });

      expect(result.success).toBe(true);
      expect(setSelectedGenres).toHaveBeenCalledWith(["Irish"]);
      expect(result.message).toContain("Genre: Irish");
    });

    it("should return success with no filters applied", async () => {
      const toolCall: ToolCall = {
        tool: "filter_tunes",
        args: {},
      };

      const result = await executeToolCall(toolCall, {
        localDb: db,
        userId: TEST_USER_ID,
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain("No filters applied");
    });
  });

  describe("log_practice", () => {
    it("should return error when tune not found", async () => {
      const toolCall: ToolCall = {
        tool: "log_practice",
        args: { tune_title: "Nonexistent Tune" },
      };

      const result = await executeToolCall(toolCall, {
        localDb: db,
        userId: TEST_USER_ID,
        currentPlaylistId: TEST_PLAYLIST_ID,
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("not found");
    });
  });

  describe("add_note", () => {
    it("should return error when tune not found", async () => {
      const toolCall: ToolCall = {
        tool: "add_note",
        args: {
          tune_title: "Nonexistent Tune",
          note_content: "Test note",
        },
      };

      const result = await executeToolCall(toolCall, {
        localDb: db,
        userId: TEST_USER_ID,
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("not found");
    });
  });

  describe("get_tune_details", () => {
    it("should return error when tune not found", async () => {
      const toolCall: ToolCall = {
        tool: "get_tune_details",
        args: { tune_title: "Nonexistent Tune" },
      };

      const result = await executeToolCall(toolCall, {
        localDb: db,
        userId: TEST_USER_ID,
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("not found");
    });
  });

  describe("unknown tool", () => {
    it("should return error for unknown tool", async () => {
      const toolCall: ToolCall = {
        tool: "unknown_tool",
        args: {},
      };

      const result = await executeToolCall(toolCall, {
        localDb: db,
        userId: TEST_USER_ID,
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("Unknown tool");
    });
  });
});
