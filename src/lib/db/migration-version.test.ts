import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearLocalDatabaseForMigration,
  setLocalSchemaVersion,
} from "./migration-version";

describe("clearLocalDatabaseForMigration", () => {
  beforeEach(() => {
    const storage = new Map<string, string>();

    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    });
  });

  afterEach(() => {
    localStorage.removeItem("schema_version");
    vi.unstubAllGlobals();
  });

  it("refreshes only public rhythm_patterns rows for the stale catalog migration", async () => {
    const sqlite = new Database(":memory:");

    sqlite.exec(`
      CREATE TABLE rhythm_patterns (
        id TEXT PRIMARY KEY NOT NULL,
        genre_id TEXT,
        tune_type_id TEXT NOT NULL,
        name TEXT NOT NULL,
        part_target TEXT DEFAULT '*',
        abc_string TEXT NOT NULL,
        is_default INTEGER NOT NULL DEFAULT 0,
        premium_audio_url TEXT,
        sample_kit TEXT NOT NULL DEFAULT 'bodhran',
        tune_id TEXT,
        user_id TEXT,
        pattern_type TEXT NOT NULL DEFAULT 'seed'
      );

      INSERT INTO rhythm_patterns (
        id,
        genre_id,
        tune_type_id,
        name,
        part_target,
        abc_string,
        is_default,
        premium_audio_url,
        sample_kit,
        tune_id,
        user_id,
        pattern_type
      ) VALUES
        (
          'public-system-default',
          'ITRAD',
          'JigD',
          'Standard Double Jig',
          '*',
          'M:6/8\nL:1/8\nK:clef=perc\n|: C2c Ccc :|',
          1,
          NULL,
          'bodhran',
          NULL,
          NULL,
          'seed'
        ),
        (
          'public-tune-override',
          'ITRAD',
          'JigD',
          'Tune Override',
          '*',
          'X:1\nT:Tobin''s\nM:6/8\nL:1/8\nK:Dmaj\n|:DFA dcd:|',
          0,
          NULL,
          'bodhran',
          'tune-1',
          NULL,
          'full_track'
        ),
        (
          'user-default',
          'ITRAD',
          'JigD',
          'Plain Taps',
          '*',
          'M:6/8\nL:1/8\nK:clef=perc\n|: C2 c C c c :|',
          0,
          NULL,
          'generic_click',
          NULL,
          'user-1',
          'seed'
        );
    `);

    setLocalSchemaVersion("2.0.13-fix-sync-change-log-coverage");

    await clearLocalDatabaseForMigration(
      {},
      {
        rawDb: {
          run: (sql: string) => sqlite.exec(sql),
        },
      }
    );

    const rows = sqlite
      .prepare("SELECT id, user_id, tune_id FROM rhythm_patterns ORDER BY id")
      .all() as Array<{
      id: string;
      user_id: string | null;
      tune_id: string | null;
    }>;

    expect(rows).toEqual([
      {
        id: "user-default",
        user_id: "user-1",
        tune_id: null,
      },
    ]);
  });
});
