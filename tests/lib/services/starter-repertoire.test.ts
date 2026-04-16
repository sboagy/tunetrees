/**
 * Tests for starter repertoire service functions
 *
 * Covers:
 * - getCatalogTuneIdsByFilter (genre and origin filters)
 * - createStarterRepertoire (template application, null genreDefault)
 * - populateStarterRepertoireFromCatalog (empty catalog, successful population)
 */

import Database from "better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCatalogTuneIdsByFilter } from "../../../src/lib/db/queries/tunes";
import {
  ITRAD_STARTER_TEMPLATE,
  RS500_STARTER_TEMPLATE,
} from "../../../src/lib/db/starter-repertoire-templates";
import { generateOrGetPracticeQueue } from "../../../src/lib/services/practice-queue";
import {
  createStarterRepertoire,
  populateStarterRepertoireFromCatalog,
} from "../../../src/lib/services/repertoire-service";
import {
  applyMigrations,
  createPracticeListStagedView,
} from "../../../src/lib/services/test-schema-loader";

const TEST_PRACTICE_DATE = vi.hoisted(
  () => new Date("2024-01-15T12:00:00.000Z")
);

// Suppress sync/persist side effects
vi.mock("../../../src/lib/db/client-sqlite", () => ({
  persistDb: vi.fn(() => Promise.resolve()),
}));
vi.mock("../../../src/lib/sync", () => ({
  queueSync: vi.fn(() => Promise.resolve()),
}));
vi.mock("../../../src/lib/utils/practice-date", () => ({
  getPracticeDate: vi.fn(() => TEST_PRACTICE_DATE),
}));

// A deterministic UUID-format string used as the test user's Supabase auth ID.
// The format mirrors what Supabase Auth assigns so FK constraints on
// user_profile.id pass without needing to call real auth APIs.
const TEST_USER_ID = "00000000-0000-0000-0000-000000000001";

let db: BetterSQLite3Database;
let sqlite: InstanceType<typeof Database>;

/**
 * Insert a minimal user_profile so repertoire FK constraints pass.
 */
function seedUser() {
  sqlite
    .prepare(
      "INSERT OR IGNORE INTO user_profile (id, deleted, sync_version, last_modified_at, device_id) VALUES (?, 0, 1, ?, ?)"
    )
    .run(TEST_USER_ID, new Date().toISOString(), "test");
}

/**
 * Insert a genre row so tune.genre FK constraint passes.
 */
function seedGenre(id: string, name?: string) {
  sqlite
    .prepare("INSERT OR IGNORE INTO genre (id, name) VALUES (?, ?)")
    .run(id, name ?? id);
}

/**
 * Insert a catalog tune (private_for = NULL) with the given genre/origin.
 */
function insertCatalogTune(
  id: string,
  opts: { genre?: string | null; primaryOrigin?: string } = {}
) {
  const genre = opts.genre !== undefined ? opts.genre : null;
  const origin = opts.primaryOrigin ?? "irishtune.info";
  // Seed the genre row first if provided (FK constraint is enabled in test DB)
  if (genre !== null) {
    seedGenre(genre);
  }
  sqlite
    .prepare(
      `INSERT INTO tune (id, title, genre, primary_origin, private_for, deleted, sync_version, last_modified_at, device_id)
       VALUES (?, ?, ?, ?, NULL, 0, 1, ?, 'test')`
    )
    .run(id, `Tune ${id}`, genre, origin, new Date().toISOString());
}

beforeEach(() => {
  sqlite = new Database(":memory:");
  db = drizzle(sqlite) as BetterSQLite3Database;
  applyMigrations(db);
  createPracticeListStagedView(db);
  seedUser();
});

// ---------------------------------------------------------------------------
// getCatalogTuneIdsByFilter
// ---------------------------------------------------------------------------

describe("getCatalogTuneIdsByFilter", () => {
  it("returns IDs matching the given genre", async () => {
    insertCatalogTune("tune-itrad-1", { genre: "ITRAD" });
    insertCatalogTune("tune-itrad-2", { genre: "ITRAD" });
    insertCatalogTune("tune-rock-1", { genre: "Rock" });

    const ids = await getCatalogTuneIdsByFilter(db, "genre", "ITRAD");

    expect(ids).toHaveLength(2);
    expect(ids).toContain("tune-itrad-1");
    expect(ids).toContain("tune-itrad-2");
    expect(ids).not.toContain("tune-rock-1");
  });

  it("returns IDs matching the given primary_origin", async () => {
    insertCatalogTune("tune-rs-1", {
      primaryOrigin: "rolling_stone_top_500_v1",
      genre: "Rock",
    });
    insertCatalogTune("tune-rs-2", {
      primaryOrigin: "rolling_stone_top_500_v1",
      genre: "Pop",
    });
    insertCatalogTune("tune-other-1", {
      primaryOrigin: "irishtune.info",
      genre: "ITRAD",
    });

    const ids = await getCatalogTuneIdsByFilter(
      db,
      "origin",
      "rolling_stone_top_500_v1"
    );

    expect(ids).toHaveLength(2);
    expect(ids).toContain("tune-rs-1");
    expect(ids).toContain("tune-rs-2");
    expect(ids).not.toContain("tune-other-1");
  });

  it("excludes deleted tunes", async () => {
    insertCatalogTune("tune-active", { genre: "ITRAD" });
    // Insert a deleted catalog tune directly (ITRAD genre already seeded above)
    sqlite
      .prepare(
        `INSERT INTO tune (id, title, genre, primary_origin, private_for, deleted, sync_version, last_modified_at, device_id)
         VALUES ('tune-deleted', 'Deleted', 'ITRAD', 'irishtune.info', NULL, 1, 1, ?, 'test')`
      )
      .run(new Date().toISOString());

    const ids = await getCatalogTuneIdsByFilter(db, "genre", "ITRAD");

    expect(ids).toContain("tune-active");
    expect(ids).not.toContain("tune-deleted");
  });

  it("excludes private (user) tunes", async () => {
    insertCatalogTune("tune-public", { genre: "ITRAD" });
    // Insert a private tune
    sqlite
      .prepare(
        `INSERT INTO tune (id, title, genre, primary_origin, private_for, deleted, sync_version, last_modified_at, device_id)
         VALUES ('tune-private', 'Private', 'ITRAD', 'irishtune.info', ?, 0, 1, ?, 'test')`
      )
      .run(TEST_USER_ID, new Date().toISOString());

    const ids = await getCatalogTuneIdsByFilter(db, "genre", "ITRAD");

    expect(ids).toContain("tune-public");
    expect(ids).not.toContain("tune-private");
  });

  it("returns empty array when no matching tunes exist", async () => {
    const ids = await getCatalogTuneIdsByFilter(db, "genre", "NONEXISTENT");

    expect(ids).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// createStarterRepertoire
// ---------------------------------------------------------------------------

describe("createStarterRepertoire", () => {
  it("creates a repertoire from the ITRAD template with correct metadata", async () => {
    // Seed ITRAD genre so the FK on repertoire.genre_default passes
    seedGenre("ITRAD");
    const rep = await createStarterRepertoire(
      db,
      TEST_USER_ID,
      ITRAD_STARTER_TEMPLATE
    );

    expect(rep.repertoireId).toBeDefined();
    expect(rep.name).toBe(ITRAD_STARTER_TEMPLATE.name);
    expect(rep.genreDefault).toBe("ITRAD");
    expect(rep.srAlgType).toBe("fsrs");
    expect(rep.userRef).toBe(TEST_USER_ID);
    expect(rep.deleted).toBe(0);
  });

  it("creates a repertoire from the RS500 template with null genreDefault", async () => {
    const rep = await createStarterRepertoire(
      db,
      TEST_USER_ID,
      RS500_STARTER_TEMPLATE
    );

    expect(rep.repertoireId).toBeDefined();
    expect(rep.name).toBe(RS500_STARTER_TEMPLATE.name);
    expect(rep.genreDefault).toBeNull(); // RS500 has no single genre
    expect(rep.srAlgType).toBe("fsrs");
  });

  it("creates a repertoire with no tunes (tune population is deferred)", async () => {
    seedGenre("ITRAD");
    const rep = await createStarterRepertoire(
      db,
      TEST_USER_ID,
      ITRAD_STARTER_TEMPLATE
    );

    // No tunes should exist yet — population is deferred to after catalog sync
    const row = sqlite
      .prepare(
        "SELECT COUNT(*) as cnt FROM repertoire_tune WHERE repertoire_ref = ?"
      )
      .get(rep.repertoireId) as { cnt: number };

    expect(row.cnt).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// populateStarterRepertoireFromCatalog
// ---------------------------------------------------------------------------

describe("populateStarterRepertoireFromCatalog", () => {
  it("returns (0 added, 0 skipped) when no matching catalog tunes exist", async () => {
    seedGenre("ITRAD");
    const rep = await createStarterRepertoire(
      db,
      TEST_USER_ID,
      ITRAD_STARTER_TEMPLATE
    );

    // Catalog is empty — no ITRAD tunes yet
    const result = await populateStarterRepertoireFromCatalog(
      db,
      TEST_USER_ID,
      rep.repertoireId,
      ITRAD_STARTER_TEMPLATE
    );

    expect(result.added).toBe(0);
    expect(result.skipped).toBe(0);
  });

  it("adds all matching catalog tunes to the repertoire", async () => {
    // Seed ITRAD genre before creating the repertoire (FK on genre_default)
    seedGenre("ITRAD");
    const rep = await createStarterRepertoire(
      db,
      TEST_USER_ID,
      ITRAD_STARTER_TEMPLATE
    );

    // Seed two ITRAD catalog tunes and one non-ITRAD tune
    insertCatalogTune("tune-itrad-1", { genre: "ITRAD" });
    insertCatalogTune("tune-itrad-2", { genre: "ITRAD" });
    insertCatalogTune("tune-rock-1", { genre: "Rock" }); // should not be added

    const result = await populateStarterRepertoireFromCatalog(
      db,
      TEST_USER_ID,
      rep.repertoireId,
      ITRAD_STARTER_TEMPLATE
    );

    expect(result.added).toBe(2);
    expect(result.skipped).toBe(0);

    const row = sqlite
      .prepare(
        "SELECT COUNT(*) as cnt FROM repertoire_tune WHERE repertoire_ref = ? AND deleted = 0"
      )
      .get(rep.repertoireId) as { cnt: number };
    expect(row.cnt).toBe(2);
  });

  it("schedules starter tunes onto the current practice day so they enter today's queue", async () => {
    seedGenre("ITRAD");
    const rep = await createStarterRepertoire(
      db,
      TEST_USER_ID,
      ITRAD_STARTER_TEMPLATE
    );

    insertCatalogTune("tune-itrad-1", { genre: "ITRAD" });
    insertCatalogTune("tune-itrad-2", { genre: "ITRAD" });

    const result = await populateStarterRepertoireFromCatalog(
      db,
      TEST_USER_ID,
      rep.repertoireId,
      ITRAD_STARTER_TEMPLATE
    );

    expect(result.added).toBe(2);

    const scheduledRows = sqlite
      .prepare(
        "SELECT scheduled FROM repertoire_tune WHERE repertoire_ref = ? AND deleted = 0 ORDER BY tune_ref"
      )
      .all(rep.repertoireId) as Array<{ scheduled: string | null }>;

    expect(scheduledRows).toHaveLength(2);
    expect(scheduledRows.every((row) => row.scheduled !== null)).toBe(true);
    expect(
      scheduledRows.every(
        (row) => row.scheduled === TEST_PRACTICE_DATE.toISOString()
      )
    ).toBe(true);

    const queue = await generateOrGetPracticeQueue(
      db,
      TEST_USER_ID,
      rep.repertoireId,
      TEST_PRACTICE_DATE,
      null,
      "per_day",
      true
    );

    expect(queue.length).toBeGreaterThan(0);
  });

  it("uses origin filter for the RS500 template", async () => {
    const rep = await createStarterRepertoire(
      db,
      TEST_USER_ID,
      RS500_STARTER_TEMPLATE
    );

    insertCatalogTune("rs-1", {
      primaryOrigin: "rolling_stone_top_500_v1",
      genre: "Rock",
    });
    insertCatalogTune("rs-2", {
      primaryOrigin: "rolling_stone_top_500_v1",
      genre: "Pop",
    });
    insertCatalogTune("itrad-1", {
      primaryOrigin: "irishtune.info",
      genre: "ITRAD",
    });

    const result = await populateStarterRepertoireFromCatalog(
      db,
      TEST_USER_ID,
      rep.repertoireId,
      RS500_STARTER_TEMPLATE
    );

    expect(result.added).toBe(2);
    expect(result.skipped).toBe(0);
  });

  it("skips tunes already in the repertoire", async () => {
    // Seed ITRAD genre before creating the repertoire (FK on genre_default)
    seedGenre("ITRAD");
    const rep = await createStarterRepertoire(
      db,
      TEST_USER_ID,
      ITRAD_STARTER_TEMPLATE
    );
    insertCatalogTune("tune-itrad-1", { genre: "ITRAD" });

    // Populate once
    await populateStarterRepertoireFromCatalog(
      db,
      TEST_USER_ID,
      rep.repertoireId,
      ITRAD_STARTER_TEMPLATE
    );

    // Populate again — tune is already there
    const result = await populateStarterRepertoireFromCatalog(
      db,
      TEST_USER_ID,
      rep.repertoireId,
      ITRAD_STARTER_TEMPLATE
    );

    expect(result.added).toBe(0);
    expect(result.skipped).toBe(1);
  });
});
