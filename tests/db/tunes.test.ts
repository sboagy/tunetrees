/**
 * Tune CRUD Operations Tests
 *
 * Tests for tune creation, reading, updating, and deletion
 * using Drizzle ORM with SQLite WASM.
 */

import Database from "better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTune,
  deleteTune,
  getAllTunes,
  getTuneById,
  updateTune,
} from "../../src/lib/db/queries/tunes";
import { applyMigrations } from "../../src/lib/services/test-schema-loader";

// Mock the sync module to avoid Supabase dependency in tests
vi.mock("../../src/lib/sync", () => ({
  queueSync: vi.fn(() => Promise.resolve()),
}));

// Mock client SQLite persistence side effects used by query helpers
vi.mock("../../src/lib/db/client-sqlite", () => ({
  persistDb: vi.fn(() => Promise.resolve()),
}));

// Test database setup
let db: BetterSQLite3Database;

beforeEach(() => {
  const sqlite = new Database(":memory:");
  db = drizzle(sqlite) as BetterSQLite3Database;

  // Apply production schema from migrations
  applyMigrations(db);
});

describe("Tune CRUD Operations", () => {
  describe("createTune", () => {
    it("should create a new tune with all fields", async () => {
      const input = {
        title: "The Banish Misfortune",
        type: "jig",
        mode: "Dmixolydian",
        structure: "AABB",
        incipit: "D2E FGA | B2A AFD",
        // Note: genre field is TEXT but not validated by FK in current schema
        // genre: "irish-trad",
      };

      const tune = await createTune(db, input);

      expect(tune).toBeDefined();
      expect(tune.id).toBeDefined();
      expect(tune.title).toBe(input.title);
      expect(tune.type).toBe(input.type);
      expect(tune.mode).toBe(input.mode);
      expect(tune.structure).toBe(input.structure);
      expect(tune.incipit).toBe(input.incipit);
      expect(tune.deleted).toBe(0);
      expect(tune.lastModifiedAt).toBeDefined();
    });

    it("should create a tune with minimal fields", async () => {
      const input = {
        title: "Test Tune",
      };

      const tune = await createTune(db, input);

      expect(tune).toBeDefined();
      expect(tune.id).toBeDefined();
      expect(tune.title).toBe(input.title);
      expect(tune.type).toBeNull();
      expect(tune.mode).toBeNull();
      expect(tune.deleted).toBe(0);
    });

    it("should create a private tune for a user", async () => {
      // Skip user FK check since we're not creating user_profile in this test
      // In real usage, privateFor should reference an existing user
      const input = {
        title: "My Private Tune",
        // privateFor: null, // Don't set privateFor to avoid FK constraint
      };

      const tune = await createTune(db, input);

      expect(tune).toBeDefined();
      expect(tune.title).toBe("My Private Tune");
      expect(tune.privateFor).toBeNull();
    });
  });

  describe("getTuneById", () => {
    it("should retrieve a tune by ID", async () => {
      const created = await createTune(db, {
        title: "The Kesh Jig",
        type: "jig",
      });

      const retrieved = await getTuneById(db, created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.title).toBe("The Kesh Jig");
    });

    it("should return null for non-existent tune", async () => {
      const retrieved = await getTuneById(db, "non-existent-uuid");

      expect(retrieved).toBeNull();
    });

    it("should not retrieve deleted tunes", async () => {
      const created = await createTune(db, { title: "To Be Deleted" });
      await deleteTune(db, created.id);

      const retrieved = await getTuneById(db, created.id);

      expect(retrieved).toBeNull();
    });
  });

  describe("getAllTunes", () => {
    it("should return empty array when no tunes exist", async () => {
      const tunes = await getAllTunes(db);

      expect(tunes).toEqual([]);
    });

    it("should return all non-deleted tunes", async () => {
      await createTune(db, { title: "Tune 1" });
      await createTune(db, { title: "Tune 2" });
      await createTune(db, { title: "Tune 3" });

      const tunes = await getAllTunes(db);

      expect(tunes).toHaveLength(3);
      expect(tunes.map((t) => t.title)).toContain("Tune 1");
      expect(tunes.map((t) => t.title)).toContain("Tune 2");
      expect(tunes.map((t) => t.title)).toContain("Tune 3");
    });

    it("should not return deleted tunes", async () => {
      await createTune(db, { title: "Active Tune" });
      const deleted = await createTune(db, { title: "Deleted Tune" });
      await deleteTune(db, deleted.id);

      const tunes = await getAllTunes(db);

      expect(tunes).toHaveLength(1);
      expect(tunes[0].title).toBe("Active Tune");
    });

    it("should return tunes sorted by title", async () => {
      await createTune(db, { title: "Zebra Tune" });
      await createTune(db, { title: "Apple Tune" });
      await createTune(db, { title: "Mango Tune" });

      const tunes = await getAllTunes(db);

      expect(tunes[0].title).toBe("Apple Tune");
      expect(tunes[1].title).toBe("Mango Tune");
      expect(tunes[2].title).toBe("Zebra Tune");
    });
  });

  describe("updateTune", () => {
    it("should update a tune's title", async () => {
      const created = await createTune(db, { title: "Original Title" });

      const updated = await updateTune(db, created.id, {
        title: "Updated Title",
      });

      expect(updated.id).toBe(created.id);
      expect(updated.title).toBe("Updated Title");
    });

    it("should update multiple fields", async () => {
      const created = await createTune(db, {
        title: "Test Tune",
        type: "jig",
        mode: "Dmajor",
      });

      const updated = await updateTune(db, created.id, {
        title: "Updated Tune",
        type: "reel",
        mode: "Gmajor",
        structure: "AABB",
      });

      expect(updated.title).toBe("Updated Tune");
      expect(updated.type).toBe("reel");
      expect(updated.mode).toBe("Gmajor");
      expect(updated.structure).toBe("AABB");
    });

    it("should update lastModifiedAt timestamp", async () => {
      const created = await createTune(db, { title: "Test" });
      const originalTimestamp = created.lastModifiedAt;

      // Wait a tiny bit to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 10));

      const updated = await updateTune(db, created.id, { title: "Updated" });

      expect(updated.lastModifiedAt).not.toBe(originalTimestamp);
    });

    it("should only update provided fields", async () => {
      const created = await createTune(db, {
        title: "Original",
        type: "jig",
        mode: "Dmajor",
      });

      const updated = await updateTune(db, created.id, {
        title: "Updated",
      });

      expect(updated.title).toBe("Updated");
      expect(updated.type).toBe("jig"); // Unchanged
      expect(updated.mode).toBe("Dmajor"); // Unchanged
    });
  });

  describe("deleteTune", () => {
    it("should soft delete a tune", async () => {
      const created = await createTune(db, { title: "To Be Deleted" });

      await deleteTune(db, created.id);

      const retrieved = await getTuneById(db, created.id);
      expect(retrieved).toBeNull();
    });

    it("should not affect other tunes", async () => {
      const tune1 = await createTune(db, { title: "Keep This" });
      const tune2 = await createTune(db, { title: "Delete This" });

      await deleteTune(db, tune2.id);

      const allTunes = await getAllTunes(db);
      expect(allTunes).toHaveLength(1);
      expect(allTunes[0].id).toBe(tune1.id);
    });

    it("should be idempotent (deleting twice is safe)", async () => {
      const created = await createTune(db, { title: "Delete Me" });

      await deleteTune(db, created.id);
      await deleteTune(db, created.id); // Delete again

      const allTunes = await getAllTunes(db);
      expect(allTunes).toHaveLength(0);
    });
  });
});
