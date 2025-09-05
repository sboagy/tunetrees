/**
 * @jest-environment jsdom
 */

import { tableStateCacheService } from "../table-state-cache";
import type { TablePurpose } from "../../types";
import * as settings from "../../settings";

// Mock the settings module
jest.mock("../../settings", () => ({
  updateTableStateInDb: jest.fn(),
}));

const mockUpdateTableStateInDb = settings.updateTableStateInDb as jest.MockedFunction<
  typeof settings.updateTableStateInDb
>;

describe("TableStateCacheService", () => {
  const mockUserId = 1;
  const mockPlaylistId = 123;
  const mockTablePurpose: TablePurpose = "practice";
  const mockTableState = {
    sorting: [{ id: "title", desc: false }],
    columnVisibility: { title: true },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    tableStateCacheService.clear();
    mockUpdateTableStateInDb.mockResolvedValue(200);
  });

  afterEach(() => {
    tableStateCacheService.clear();
  });

  describe("cacheUpdate", () => {
    it("should cache state updates without immediately calling the backend", () => {
      tableStateCacheService.cacheUpdate(
        mockUserId,
        mockTablePurpose,
        mockPlaylistId,
        mockTableState
      );

      const stats = tableStateCacheService.getStats();
      expect(stats.totalEntries).toBe(1);
      expect(stats.dirtyEntries).toBe(1);
      expect(mockUpdateTableStateInDb).not.toHaveBeenCalled();
    });

    it("should merge multiple updates to the same entry", () => {
      tableStateCacheService.cacheUpdate(
        mockUserId,
        mockTablePurpose,
        mockPlaylistId,
        { sorting: [{ id: "title", desc: false }] }
      );

      tableStateCacheService.cacheUpdate(
        mockUserId,
        mockTablePurpose,
        mockPlaylistId,
        { columnVisibility: { title: true } }
      );

      const stats = tableStateCacheService.getStats();
      expect(stats.totalEntries).toBe(1); // Should merge into single entry
      expect(stats.dirtyEntries).toBe(1);
    });

    it("should handle different table purposes separately", () => {
      tableStateCacheService.cacheUpdate(
        mockUserId,
        "practice",
        mockPlaylistId,
        mockTableState
      );

      tableStateCacheService.cacheUpdate(
        mockUserId,
        "repertoire",
        mockPlaylistId,
        mockTableState
      );

      const stats = tableStateCacheService.getStats();
      expect(stats.totalEntries).toBe(2);
      expect(stats.dirtyEntries).toBe(2);
    });

    it("should ignore invalid parameters", () => {
      tableStateCacheService.cacheUpdate(
        0, // invalid userId
        mockTablePurpose,
        mockPlaylistId,
        mockTableState
      );

      tableStateCacheService.cacheUpdate(
        mockUserId,
        mockTablePurpose,
        0, // invalid playlistId
        mockTableState
      );

      const stats = tableStateCacheService.getStats();
      expect(stats.totalEntries).toBe(0);
      expect(stats.dirtyEntries).toBe(0);
    });
  });

  describe("flushImmediate", () => {
    it("should immediately update the backend", async () => {
      const result = await tableStateCacheService.flushImmediate(
        mockUserId,
        mockTablePurpose,
        mockPlaylistId,
        mockTableState
      );

      expect(result).toBe(200);
      expect(mockUpdateTableStateInDb).toHaveBeenCalledWith(
        mockUserId,
        "full",
        mockTablePurpose,
        mockPlaylistId,
        mockTableState
      );
    });

    it("should merge cached state with override", async () => {
      // First cache some state
      tableStateCacheService.cacheUpdate(
        mockUserId,
        mockTablePurpose,
        mockPlaylistId,
        { sorting: [{ id: "title", desc: false }] }
      );

      // Then flush with override
      const override = { columnVisibility: { title: true } };
      await tableStateCacheService.flushImmediate(
        mockUserId,
        mockTablePurpose,
        mockPlaylistId,
        override
      );

      expect(mockUpdateTableStateInDb).toHaveBeenCalledWith(
        mockUserId,
        "full",
        mockTablePurpose,
        mockPlaylistId,
        expect.objectContaining({
          sorting: [{ id: "title", desc: false }],
          columnVisibility: { title: true },
        })
      );
    });

    it("should mark cached entry as clean after successful flush", async () => {
      tableStateCacheService.cacheUpdate(
        mockUserId,
        mockTablePurpose,
        mockPlaylistId,
        mockTableState
      );

      let stats = tableStateCacheService.getStats();
      expect(stats.dirtyEntries).toBe(1);

      await tableStateCacheService.flushImmediate(
        mockUserId,
        mockTablePurpose,
        mockPlaylistId
      );

      stats = tableStateCacheService.getStats();
      expect(stats.dirtyEntries).toBe(0);
    });

    it("should handle backend errors gracefully", async () => {
      mockUpdateTableStateInDb.mockResolvedValue(500);

      const result = await tableStateCacheService.flushImmediate(
        mockUserId,
        mockTablePurpose,
        mockPlaylistId,
        mockTableState
      );

      expect(result).toBe(500);
    });
  });

  describe("getStats", () => {
    it("should return accurate statistics", () => {
      let stats = tableStateCacheService.getStats();
      expect(stats.totalEntries).toBe(0);
      expect(stats.dirtyEntries).toBe(0);

      tableStateCacheService.cacheUpdate(
        mockUserId,
        mockTablePurpose,
        mockPlaylistId,
        mockTableState
      );

      stats = tableStateCacheService.getStats();
      expect(stats.totalEntries).toBe(1);
      expect(stats.dirtyEntries).toBe(1);
    });
  });

  describe("clear", () => {
    it("should clear all cached entries", () => {
      tableStateCacheService.cacheUpdate(
        mockUserId,
        mockTablePurpose,
        mockPlaylistId,
        mockTableState
      );

      let stats = tableStateCacheService.getStats();
      expect(stats.totalEntries).toBe(1);

      tableStateCacheService.clear();

      stats = tableStateCacheService.getStats();
      expect(stats.totalEntries).toBe(0);
      expect(stats.dirtyEntries).toBe(0);
    });
  });
});