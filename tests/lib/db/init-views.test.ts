import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { initializeViews } from "../../../src/lib/db/init-views";

type SqliteRunOnly = {
  run: (query: string) => Promise<null>;
};

function createSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE instrument (
      id TEXT PRIMARY KEY,
      private_to_user TEXT,
      instrument TEXT,
      description TEXT,
      genre_default TEXT,
      deleted INTEGER
    );

    CREATE TABLE repertoire (
      repertoire_id TEXT PRIMARY KEY,
      user_ref TEXT NOT NULL,
      instrument_ref TEXT NOT NULL,
      genre_default TEXT,
      deleted INTEGER
    );

    CREATE TABLE tune (
      id TEXT PRIMARY KEY,
      title TEXT,
      type TEXT,
      structure TEXT,
      mode TEXT,
      incipit TEXT,
      genre TEXT,
      composer TEXT,
      artist TEXT,
      id_foreign TEXT,
      primary_origin TEXT,
      release_year INTEGER,
      private_for TEXT,
      sync_version INTEGER,
      last_modified_at TEXT,
      device_id TEXT,
      deleted INTEGER
    );

    CREATE TABLE tune_override (
      tune_ref TEXT,
      user_ref TEXT,
      title TEXT,
      type TEXT,
      structure TEXT,
      mode TEXT,
      incipit TEXT,
      genre TEXT,
      composer TEXT,
      artist TEXT,
      id_foreign TEXT,
      release_year INTEGER
    );

    CREATE TABLE repertoire_tune (
      tune_ref TEXT NOT NULL,
      repertoire_ref TEXT NOT NULL,
      learned INTEGER,
      goal TEXT,
      scheduled TEXT,
      current TEXT,
      deleted INTEGER
    );

    CREATE TABLE practice_record (
      id TEXT PRIMARY KEY,
      repertoire_ref TEXT NOT NULL,
      tune_ref TEXT NOT NULL,
      practiced TEXT,
      quality INTEGER,
      easiness INTEGER,
      difficulty REAL,
      interval INTEGER,
      stability REAL,
      step INTEGER,
      repetitions INTEGER,
      lapses INTEGER,
      elapsed_days INTEGER,
      due TEXT,
      backup_practiced TEXT,
      goal TEXT,
      technique TEXT,
      state INTEGER,
      sync_version INTEGER,
      last_modified_at TEXT,
      device_id TEXT
    );

    CREATE TABLE tag (
      tune_ref TEXT,
      user_ref TEXT,
      tag_text TEXT
    );

    CREATE TABLE note (
      tune_ref TEXT,
      user_ref TEXT,
      note_text TEXT
    );

    CREATE TABLE reference (
      tune_ref TEXT,
      user_ref TEXT,
      url TEXT,
      favorite INTEGER
    );

    CREATE TABLE table_transient_data (
      user_id TEXT,
      tune_id TEXT,
      repertoire_id TEXT,
      purpose TEXT,
      note_private TEXT,
      note_public TEXT,
      recall_eval TEXT,
      practiced TEXT,
      quality INTEGER,
      easiness INTEGER,
      difficulty REAL,
      interval INTEGER,
      step INTEGER,
      repetitions INTEGER,
      due TEXT,
      backup_practiced TEXT,
      goal TEXT,
      technique TEXT,
      stability REAL,
      state INTEGER,
      sync_version INTEGER,
      last_modified_at TEXT,
      device_id TEXT
    );

    CREATE TABLE daily_practice_queue (
      id TEXT PRIMARY KEY,
      user_ref TEXT NOT NULL,
      repertoire_ref TEXT NOT NULL,
      tune_ref TEXT NOT NULL,
      queue_date TEXT,
      window_start_utc TEXT,
      window_end_utc TEXT,
      bucket INTEGER,
      order_index INTEGER,
      completed_at TEXT,
      active INTEGER,
      mode TEXT,
      snapshot_coalesced_ts TEXT,
      scheduled_snapshot TEXT,
      generated_at TEXT
    );

    CREATE TABLE user_profile (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT
    );
  `);
}

async function initializeTestViews(db: Database.Database): Promise<void> {
  const drizzleDb: SqliteRunOnly = {
    run: async (query) => {
      db.exec(String(query));
      return null;
    },
  };

  await initializeViews(drizzleDb as never);
}

describe("initializeViews", () => {
  it("uses the most recent practiced timestamp instead of the lexicographically largest id", async () => {
    const db = new Database(":memory:");
    createSchema(db);

    db.exec(`
      INSERT INTO instrument (id, instrument, deleted)
      VALUES ('inst-1', 'Irish Flute', 0);

      INSERT INTO repertoire (repertoire_id, user_ref, instrument_ref, deleted)
      VALUES ('rep-1', 'user-1', 'inst-1', 0);

      INSERT INTO tune (id, title, deleted)
      VALUES ('tune-1', 'Sergeant Early''s Dream', 0);

      INSERT INTO repertoire_tune (tune_ref, repertoire_ref, goal, deleted)
      VALUES ('tune-1', 'rep-1', 'recall', 0);

      INSERT INTO practice_record (
        id,
        repertoire_ref,
        tune_ref,
        practiced,
        quality,
        goal,
        technique,
        state,
        last_modified_at
      ) VALUES
        (
          'zzzz-older-hard',
          'rep-1',
          'tune-1',
          '2026-04-19T10:00:00.000Z',
          2,
          'recall',
          'fsrs',
          2,
          '2026-04-19T10:00:00.000Z'
        ),
        (
          'aaaa-newer-good',
          'rep-1',
          'tune-1',
          '2026-04-20T10:00:00.000Z',
          3,
          'recall',
          'fsrs',
          2,
          '2026-04-20T10:00:00.000Z'
        );
    `);

    await initializeTestViews(db);

    const joined = db
      .prepare(
        "SELECT latest_quality FROM practice_list_joined WHERE id = 'tune-1'"
      )
      .get() as { latest_quality: number | null } | undefined;
    const staged = db
      .prepare(
        "SELECT latest_quality FROM practice_list_staged WHERE id = 'tune-1'"
      )
      .get() as { latest_quality: number | null } | undefined;

    expect(joined?.latest_quality).toBe(3);
    expect(staged?.latest_quality).toBe(3);

    db.close();
  });
});
