import Database from "better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createNote,
  updateNote,
} from "../../../src/lib/db/queries/notes";
import {
  createReference,
  getReferencesByTune,
  updateReference,
} from "../../../src/lib/db/queries/references";
import { applyMigrations } from "../../../src/lib/services/test-schema-loader";

vi.mock("../../../src/lib/db/client-sqlite", () => ({
  persistDb: vi.fn(() => Promise.resolve()),
}));

const OWNER_ID = "00000000-0000-0000-0000-000000000001";
const OTHER_USER_ID = "00000000-0000-0000-0000-000000000002";
const TUNE_ID = "00000000-0000-0000-0000-000000000010";

let db: BetterSQLite3Database;
let sqlite: InstanceType<typeof Database>;

function seedUser(id: string) {
  sqlite
    .prepare(
      "INSERT OR IGNORE INTO user_profile (id, deleted, sync_version, last_modified_at, device_id) VALUES (?, 0, 1, ?, ?)"
    )
    .run(id, new Date().toISOString(), "test");
}

function seedTune() {
  sqlite
    .prepare(
      `INSERT OR IGNORE INTO tune (id, title, private_for, deleted, sync_version, last_modified_at, device_id)
       VALUES (?, 'Shared Tune', NULL, 0, 1, ?, 'test')`
    )
    .run(TUNE_ID, new Date().toISOString());
}

beforeEach(() => {
  sqlite = new Database(":memory:");
  db = drizzle(sqlite) as BetterSQLite3Database;
  applyMigrations(db);
  seedUser(OWNER_ID);
  seedUser(OTHER_USER_ID);
  seedTune();
});

describe("shared visibility query helpers", () => {
  it("includes public references from other users while hiding their private references", async () => {
    const ownReference = await createReference(
      db as never,
      {
        tuneRef: TUNE_ID,
        url: "https://example.com/own",
        title: "Own",
      },
      OWNER_ID
    );

    const publicReference = await createReference(
      db as never,
      {
        tuneRef: TUNE_ID,
        url: "https://example.com/public",
        title: "Public",
        public: true,
      },
      OTHER_USER_ID
    );

    await createReference(
      db as never,
      {
        tuneRef: TUNE_ID,
        url: "https://example.com/private",
        title: "Private",
      },
      OTHER_USER_ID
    );

    sqlite
      .prepare(
        `INSERT INTO reference (id, url, tune_ref, user_ref, title, public, favorite, deleted, sync_version, last_modified_at, device_id)
         VALUES (?, ?, ?, NULL, ?, 0, 0, 0, 1, ?, 'test')`
      )
      .run(
        "00000000-0000-0000-0000-000000000099",
        "https://example.com/system",
        TUNE_ID,
        "System",
        new Date().toISOString()
      );

    const visibleReferences = await getReferencesByTune(
      db as never,
      TUNE_ID,
      OWNER_ID
    );

    expect(visibleReferences.map((reference) => reference.id)).toEqual(
      expect.arrayContaining([
        ownReference.id,
        publicReference.id,
        "00000000-0000-0000-0000-000000000099",
      ])
    );
    expect(
      visibleReferences.some(
        (reference) =>
          reference.url === "https://example.com/private" && reference.public !== 1
      )
    ).toBe(false);
  });

  it("preserves public flags for references and notes", async () => {
    const reference = await createReference(
      db as never,
      {
        tuneRef: TUNE_ID,
        url: "https://example.com/public",
        title: "Public",
        public: true,
      },
      OWNER_ID
    );
    expect(reference.public).toBe(1);

    const updatedReference = await updateReference(db as never, reference.id, {
      public: false,
    });
    expect(updatedReference?.public).toBe(0);

    const note = await createNote(db as never, {
      tuneRef: TUNE_ID,
      noteText: "Shared rehearsal cue",
      userRef: OWNER_ID,
      public: true,
    });
    expect(note.public).toBe(1);

    const updatedNote = await updateNote(db as never, note.id, {
      public: false,
    });
    expect(updatedNote?.public).toBe(0);
  });
});
