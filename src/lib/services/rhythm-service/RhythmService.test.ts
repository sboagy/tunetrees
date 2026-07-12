import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { createRoot, createSignal } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SqliteDatabase } from "@/lib/db/client-sqlite";
import { BODHRAN_SAMPLE_KIT } from "@/lib/services/rhythm-service/kits/bodhran";
import { createRhythmService, loadRhythmPattern } from "./RhythmService";

const projectRoot = path.resolve(__dirname, "..", "..", "..", "..");
const EXPECTED_BODHRAN_FETCH_URLS = Array.from(
  new Set(
    Object.entries(BODHRAN_SAMPLE_KIT)
      .sort(
        ([leftPitch], [rightPitch]) =>
          Number.parseInt(leftPitch, 10) - Number.parseInt(rightPitch, 10)
      )
      .flatMap(([_pitch, entry]) =>
        entry.kind === "file" ? [`/audio/kits/bodhran/${entry.fileName}`] : []
      )
  )
);
const EXPECTED_BODHRAN_FETCH_COUNT = EXPECTED_BODHRAN_FETCH_URLS.length;
const EXPECTED_BODHRAN_FIRST_FETCH_URL = EXPECTED_BODHRAN_FETCH_URLS[0];
const EXPECTED_BODHRAN_LAST_FETCH_URL =
  EXPECTED_BODHRAN_FETCH_URLS.at(-1) ?? "";

function noop(): void {
  // Intentionally empty for test doubles that implement optional hooks.
}

function asFetch(mock: unknown): typeof fetch {
  return mock as typeof fetch;
}

function getBodhranMockByteLength(url: string): number {
  if (url.includes("bodhran-border")) {
    return 18;
  }
  if (url.includes("bodhran-drag")) {
    return 20;
  }
  if (url.includes("bodhran-ff")) {
    return 14;
  }
  if (url.includes("bodhran-f")) {
    return 13;
  }
  if (url.includes("bodhran-pp")) {
    return 11;
  }
  if (url.includes("bodhran-p")) {
    return 12;
  }
  return 11;
}

function createDb(sqlStatements: string[]): SqliteDatabase {
  const sqlite = new Database(":memory:");
  const db = drizzle(sqlite);

  for (const statement of sqlStatements) {
    db.run(sql.raw(statement));
  }

  return db as unknown as SqliteDatabase;
}

const CURRENT_RHYTHM_PATTERNS_TABLE_SQL =
  "CREATE TABLE rhythm_patterns (id TEXT PRIMARY KEY, genre_id TEXT, tune_type_id TEXT NOT NULL, name TEXT NOT NULL, part_target TEXT DEFAULT '*', abc_string TEXT NOT NULL, is_default INTEGER NOT NULL DEFAULT 0, premium_audio_url TEXT, sample_kit TEXT NOT NULL DEFAULT 'bodhran', tune_id TEXT, user_id TEXT, pattern_type TEXT NOT NULL DEFAULT 'seed', swing_percentage REAL NOT NULL DEFAULT 0, swing_desc TEXT)";

function createPremiumLoopRhythmDb() {
  return createDb([
    "CREATE TABLE genre (id TEXT PRIMARY KEY, name TEXT)",
    "CREATE TABLE tune_type (id TEXT PRIMARY KEY, name TEXT, rhythm TEXT, description TEXT)",
    "CREATE TABLE genre_tune_type (genre_id TEXT NOT NULL, tune_type_id TEXT NOT NULL, default_bpm INTEGER, PRIMARY KEY (genre_id, tune_type_id))",
    CURRENT_RHYTHM_PATTERNS_TABLE_SQL,
    "INSERT INTO genre (id, name) VALUES ('ITRAD', 'Irish Traditional')",
    "INSERT INTO tune_type (id, name, rhythm, description) VALUES ('Reel', 'Reel', '4/4', 'Reel rhythm')",
    "INSERT INTO genre_tune_type (genre_id, tune_type_id, default_bpm) VALUES ('ITRAD', 'Reel', 112)",
    `INSERT INTO rhythm_patterns (id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, tune_id, user_id, pattern_type)
      VALUES ('rp-1', 'ITRAD', 'Reel', 'Basic Rolling', '*', 'X:1
T:Reel Groove
M:4/4
L:1/8
K:clef=perc
|: C2 A2 C2 A2 :|', 1, 'custom/reel.mp3', 'bodhran', NULL, NULL, 'seed')`,
  ]);
}

function createSampleKitRhythmDb() {
  return createDb([
    "CREATE TABLE genre (id TEXT PRIMARY KEY, name TEXT)",
    "CREATE TABLE tune_type (id TEXT PRIMARY KEY, name TEXT, rhythm TEXT, description TEXT)",
    "CREATE TABLE genre_tune_type (genre_id TEXT NOT NULL, tune_type_id TEXT NOT NULL, default_bpm INTEGER, PRIMARY KEY (genre_id, tune_type_id))",
    CURRENT_RHYTHM_PATTERNS_TABLE_SQL,
    "INSERT INTO genre (id, name) VALUES ('TEST', 'Session Test')",
    "INSERT INTO tune_type (id, name, rhythm, description) VALUES ('Reel', 'Reel', '4/4', 'Reel rhythm')",
    "INSERT INTO tune_type (id, name, rhythm, description) VALUES ('Jig', 'Jig', '6/8', 'Jig rhythm')",
    "INSERT INTO genre_tune_type (genre_id, tune_type_id, default_bpm) VALUES ('TEST', 'Reel', 112)",
    "INSERT INTO genre_tune_type (genre_id, tune_type_id, default_bpm) VALUES ('TEST', 'Jig', 115)",
    `INSERT INTO rhythm_patterns (id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, tune_id, user_id, pattern_type)
      VALUES ('rp-1', 'TEST', 'Reel', 'Basic Rolling', '*', 'X:1
T:Reel Groove
M:4/4
L:1/8
K:clef=perc
|: C2 A2 C2 A2 :|', 1, NULL, 'bodhran', NULL, NULL, 'seed')`,
    `INSERT INTO rhythm_patterns (id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, tune_id, user_id, pattern_type)
      VALUES ('rp-jig-1', 'TEST', 'Jig', 'Lift Jig', '*', 'X:1
T:Jig Groove
M:6/8
L:1/8
K:clef=perc
|: C2 c C c c :|', 1, NULL, 'bodhran', NULL, NULL, 'seed')`,
  ]);
}

function createFallbackRhythmDb() {
  return createDb([
    "CREATE TABLE genre (id TEXT PRIMARY KEY, name TEXT)",
    "CREATE TABLE tune_type (id TEXT PRIMARY KEY, name TEXT, rhythm TEXT, description TEXT)",
    "CREATE TABLE genre_tune_type (genre_id TEXT NOT NULL, tune_type_id TEXT NOT NULL, default_bpm INTEGER, PRIMARY KEY (genre_id, tune_type_id))",
    CURRENT_RHYTHM_PATTERNS_TABLE_SQL,
    "INSERT INTO tune_type (id, name, rhythm, description) VALUES ('Reel', 'Reel', '4/4', 'Reel rhythm')",
    "INSERT INTO tune_type (id, name, rhythm, description) VALUES ('Jig', 'Jig', '6/8', 'Jig rhythm')",
    "INSERT INTO tune_type (id, name, rhythm, description) VALUES ('Polka', 'Polka', '2/4', 'Polka rhythm')",
    "INSERT INTO tune_type (id, name, rhythm, description) VALUES ('Hornpipe', 'Hornpipe', '4/4', 'Hornpipe rhythm')",
  ]);
}

function createFallbackJigRhythmDb() {
  return createDb([
    "CREATE TABLE genre (id TEXT PRIMARY KEY, name TEXT)",
    "CREATE TABLE tune_type (id TEXT PRIMARY KEY, name TEXT, rhythm TEXT, description TEXT)",
    "CREATE TABLE genre_tune_type (genre_id TEXT NOT NULL, tune_type_id TEXT NOT NULL, default_bpm INTEGER, PRIMARY KEY (genre_id, tune_type_id))",
    CURRENT_RHYTHM_PATTERNS_TABLE_SQL,
    "INSERT INTO genre (id, name) VALUES ('ITRAD', 'Irish Traditional')",
    "INSERT INTO tune_type (id, name, rhythm, description) VALUES ('Jig', 'Jig', '6/8', 'Jig rhythm')",
    "INSERT INTO genre_tune_type (genre_id, tune_type_id, default_bpm) VALUES ('ITRAD', 'Jig', 115)",
  ]);
}

function createFallbackJigCodeRhythmDb() {
  return createDb([
    "CREATE TABLE genre (id TEXT PRIMARY KEY, name TEXT)",
    "CREATE TABLE tune_type (id TEXT PRIMARY KEY, name TEXT, rhythm TEXT, description TEXT)",
    "CREATE TABLE genre_tune_type (genre_id TEXT NOT NULL, tune_type_id TEXT NOT NULL, default_bpm INTEGER, PRIMARY KEY (genre_id, tune_type_id))",
    CURRENT_RHYTHM_PATTERNS_TABLE_SQL,
    "INSERT INTO genre (id, name) VALUES ('ITRAD', 'Irish Traditional')",
    "INSERT INTO tune_type (id, name, rhythm, description) VALUES ('JigD', 'Jig', '6/8', 'Double jig rhythm')",
    "INSERT INTO genre_tune_type (genre_id, tune_type_id, default_bpm) VALUES ('ITRAD', 'JigD', 115)",
  ]);
}

function createFallbackPolkaRhythmDb() {
  return createDb([
    "CREATE TABLE genre (id TEXT PRIMARY KEY, name TEXT)",
    "CREATE TABLE tune_type (id TEXT PRIMARY KEY, name TEXT, rhythm TEXT, description TEXT)",
    "CREATE TABLE genre_tune_type (genre_id TEXT NOT NULL, tune_type_id TEXT NOT NULL, default_bpm INTEGER, PRIMARY KEY (genre_id, tune_type_id))",
    CURRENT_RHYTHM_PATTERNS_TABLE_SQL,
    "INSERT INTO genre (id, name) VALUES ('ITRAD', 'Irish Traditional')",
    "INSERT INTO tune_type (id, name, rhythm, description) VALUES ('Polka', 'Polka', '2/4', 'Polka rhythm')",
    "INSERT INTO genre_tune_type (genre_id, tune_type_id, default_bpm) VALUES ('ITRAD', 'Polka', 120)",
  ]);
}

function createFallbackHornpipeRhythmDb() {
  return createDb([
    "CREATE TABLE genre (id TEXT PRIMARY KEY, name TEXT)",
    "CREATE TABLE tune_type (id TEXT PRIMARY KEY, name TEXT, rhythm TEXT, description TEXT)",
    "CREATE TABLE genre_tune_type (genre_id TEXT NOT NULL, tune_type_id TEXT NOT NULL, default_bpm INTEGER, PRIMARY KEY (genre_id, tune_type_id))",
    CURRENT_RHYTHM_PATTERNS_TABLE_SQL,
    "INSERT INTO genre (id, name) VALUES ('ITRAD', 'Irish Traditional')",
    "INSERT INTO tune_type (id, name, rhythm, description) VALUES ('Hornpipe', 'Hornpipe', '4/4', 'Hornpipe rhythm')",
    "INSERT INTO genre_tune_type (genre_id, tune_type_id, default_bpm) VALUES ('ITRAD', 'Hornpipe', 90)",
  ]);
}

function createSwingDescriptorRhythmDb() {
  return createDb([
    "CREATE TABLE genre (id TEXT PRIMARY KEY, name TEXT)",
    "CREATE TABLE tune_type (id TEXT PRIMARY KEY, name TEXT, rhythm TEXT, description TEXT)",
    "CREATE TABLE genre_tune_type (genre_id TEXT NOT NULL, tune_type_id TEXT NOT NULL, default_bpm INTEGER, PRIMARY KEY (genre_id, tune_type_id))",
    "CREATE TABLE rhythm_patterns (id TEXT PRIMARY KEY, genre_id TEXT, tune_type_id TEXT NOT NULL, name TEXT NOT NULL, part_target TEXT DEFAULT '*', abc_string TEXT NOT NULL, is_default INTEGER NOT NULL DEFAULT 0, premium_audio_url TEXT, sample_kit TEXT NOT NULL DEFAULT 'bodhran', tune_id TEXT, user_id TEXT, pattern_type TEXT NOT NULL DEFAULT 'seed', swing_percentage REAL NOT NULL DEFAULT 0, swing_desc TEXT)",
    "INSERT INTO genre (id, name) VALUES ('ITRAD', 'Irish Traditional')",
    "INSERT INTO tune_type (id, name, rhythm, description) VALUES ('JigD', 'Jig', '6/8', 'Double jig rhythm')",
    "INSERT INTO genre_tune_type (genre_id, tune_type_id, default_bpm) VALUES ('ITRAD', 'JigD', 115)",
    `INSERT INTO rhythm_patterns (id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, tune_id, user_id, pattern_type, swing_percentage, swing_desc)
      VALUES ('system-default', 'ITRAD', 'JigD', 'Standard Double Jig', '*', 'X:1
T:Standard Double Jig
M:6/8
L:1/8
K:clef=perc
|: C2 c C c c :|', 1, NULL, 'bodhran', NULL, NULL, 'seed', 0.15, '{"timeSignature":"6/8","macroBeatDivision":3,"defaultSwingFactor":1.15,"balanceRemainingNotes":true,"velocityPattern":[100,80,60],"humanizationDeltaMs":15}')`,
  ]);
}

function createMismatchedSwingDefaultRhythmDb() {
  return createDb([
    "CREATE TABLE genre (id TEXT PRIMARY KEY, name TEXT)",
    "CREATE TABLE tune_type (id TEXT PRIMARY KEY, name TEXT, rhythm TEXT, description TEXT)",
    "CREATE TABLE genre_tune_type (genre_id TEXT NOT NULL, tune_type_id TEXT NOT NULL, default_bpm INTEGER, PRIMARY KEY (genre_id, tune_type_id))",
    "CREATE TABLE rhythm_patterns (id TEXT PRIMARY KEY, genre_id TEXT, tune_type_id TEXT NOT NULL, name TEXT NOT NULL, part_target TEXT DEFAULT '*', abc_string TEXT NOT NULL, is_default INTEGER NOT NULL DEFAULT 0, premium_audio_url TEXT, sample_kit TEXT NOT NULL DEFAULT 'bodhran', tune_id TEXT, user_id TEXT, pattern_type TEXT NOT NULL DEFAULT 'seed', swing_percentage REAL NOT NULL DEFAULT 0, swing_desc TEXT)",
    "INSERT INTO genre (id, name) VALUES ('ITRAD', 'Irish Traditional')",
    "INSERT INTO tune_type (id, name, rhythm, description) VALUES ('JigD', 'Jig', '6/8', 'Double jig rhythm')",
    "INSERT INTO genre_tune_type (genre_id, tune_type_id, default_bpm) VALUES ('ITRAD', 'JigD', 115)",
    `INSERT INTO rhythm_patterns (id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, tune_id, user_id, pattern_type, swing_percentage, swing_desc)
      VALUES ('system-default', 'ITRAD', 'JigD', 'Mismatched Jig Default', '*', 'X:1
T:Mismatched Jig Default
M:6/8
L:1/8
K:clef=perc
|: C2 c C c c :|', 1, NULL, 'bodhran', NULL, NULL, 'seed', 0.33, '{"timeSignature":"6/8","macroBeatDivision":3,"defaultSwingFactor":1.15,"balanceRemainingNotes":true,"velocityPattern":[100,80,60],"humanizationDeltaMs":15}')`,
  ]);
}

function createInheritedSwingDescriptorRhythmDb() {
  return createDb([
    "CREATE TABLE genre (id TEXT PRIMARY KEY, name TEXT)",
    "CREATE TABLE tune_type (id TEXT PRIMARY KEY, name TEXT, rhythm TEXT, description TEXT)",
    "CREATE TABLE genre_tune_type (genre_id TEXT NOT NULL, tune_type_id TEXT NOT NULL, default_bpm INTEGER, PRIMARY KEY (genre_id, tune_type_id))",
    "CREATE TABLE rhythm_patterns (id TEXT PRIMARY KEY, genre_id TEXT, tune_type_id TEXT NOT NULL, name TEXT NOT NULL, part_target TEXT DEFAULT '*', abc_string TEXT NOT NULL, is_default INTEGER NOT NULL DEFAULT 0, premium_audio_url TEXT, sample_kit TEXT NOT NULL DEFAULT 'bodhran', tune_id TEXT, user_id TEXT, pattern_type TEXT NOT NULL DEFAULT 'seed', swing_percentage REAL NOT NULL DEFAULT 0, swing_desc TEXT)",
    "INSERT INTO genre (id, name) VALUES ('ITRAD', 'Irish Traditional')",
    "INSERT INTO tune_type (id, name, rhythm, description) VALUES ('JigD', 'Jig', '6/8', 'Double jig rhythm')",
    "INSERT INTO genre_tune_type (genre_id, tune_type_id, default_bpm) VALUES ('ITRAD', 'JigD', 115)",
    `INSERT INTO rhythm_patterns (id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, tune_id, user_id, pattern_type, swing_percentage, swing_desc)
      VALUES ('system-default', 'ITRAD', 'JigD', 'Standard Double Jig', '*', 'X:1
T:Standard Double Jig
M:6/8
L:1/8
K:clef=perc
|: C2 c C c c :|', 1, NULL, 'bodhran', NULL, NULL, 'seed', 0.15, '{"timeSignature":"6/8","macroBeatDivision":3,"defaultSwingFactor":1.15,"balanceRemainingNotes":true,"velocityPattern":[100,80,60],"humanizationDeltaMs":15}')`,
    `INSERT INTO rhythm_patterns (id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, tune_id, user_id, pattern_type, swing_percentage, swing_desc)
      VALUES ('user-default', 'ITRAD', 'JigD', 'My Jig Pattern', '*', 'X:1
T:My Jig Pattern
M:6/8
L:1/8
K:clef=perc
|: C2 z C z z :|', 0, NULL, 'generic_click', NULL, 'user-1', 'seed', 0.15, NULL)`,
  ]);
}

function createRhythmDbWithoutPatternRow() {
  return createDb([
    "CREATE TABLE genre (id TEXT PRIMARY KEY, name TEXT)",
    "CREATE TABLE tune_type (id TEXT PRIMARY KEY, name TEXT, rhythm TEXT, description TEXT)",
    "CREATE TABLE genre_tune_type (genre_id TEXT NOT NULL, tune_type_id TEXT NOT NULL, default_bpm INTEGER, PRIMARY KEY (genre_id, tune_type_id))",
    CURRENT_RHYTHM_PATTERNS_TABLE_SQL,
    "INSERT INTO genre (id, name) VALUES ('ITRAD', 'Irish Traditional')",
    "INSERT INTO tune_type (id, name, rhythm, description) VALUES ('Reel', 'Reel', '4/4', 'Reel rhythm')",
    "INSERT INTO genre_tune_type (genre_id, tune_type_id, default_bpm) VALUES ('ITRAD', 'Reel', 112)",
  ]);
}

function createHierarchicalRhythmDb(options?: {
  includeUserTuneOverride?: boolean;
  includeGlobalTuneOverride?: boolean;
  includeUserDefault?: boolean;
}) {
  const {
    includeUserTuneOverride = true,
    includeGlobalTuneOverride = true,
    includeUserDefault = true,
  } = options ?? {};

  const statements = [
    "CREATE TABLE genre (id TEXT PRIMARY KEY, name TEXT)",
    "CREATE TABLE tune_type (id TEXT PRIMARY KEY, name TEXT, rhythm TEXT, description TEXT)",
    "CREATE TABLE genre_tune_type (genre_id TEXT NOT NULL, tune_type_id TEXT NOT NULL, default_bpm INTEGER, PRIMARY KEY (genre_id, tune_type_id))",
    CURRENT_RHYTHM_PATTERNS_TABLE_SQL,
    "INSERT INTO genre (id, name) VALUES ('ITRAD', 'Irish Traditional')",
    "INSERT INTO tune_type (id, name, rhythm, description) VALUES ('Reel', 'Reel', '4/4', 'Reel rhythm')",
    "INSERT INTO genre_tune_type (genre_id, tune_type_id, default_bpm) VALUES ('ITRAD', 'Reel', 112)",
    `INSERT INTO rhythm_patterns (id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, tune_id, user_id, pattern_type)
      VALUES ('system-default', 'ITRAD', 'Reel', 'System Default', '*', 'X:1
T:System Default
M:4/4
L:1/8
K:clef=perc
|: C2 A2 C2 A2 :|', 1, NULL, 'bodhran', NULL, NULL, 'seed')`,
  ];

  if (includeUserDefault) {
    statements.push(`INSERT INTO rhythm_patterns (id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, tune_id, user_id, pattern_type)
      VALUES ('user-default', 'ITRAD', 'Reel', 'User Default', '*', 'X:1
T:User Default
M:4/4
L:1/8
K:clef=perc
|: D2 A2 D2 A2 :|', 0, NULL, 'generic_click', NULL, 'user-1', 'seed')`);
  }

  if (includeGlobalTuneOverride) {
    statements.push(`INSERT INTO rhythm_patterns (id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, tune_id, user_id, pattern_type)
      VALUES ('global-tune', 'ITRAD', 'Reel', 'Global Tune Override', '*', 'X:1
T:Global Tune Override
M:4/4
L:1/8
K:clef=perc
|: E2 A2 E2 A2 :|', 0, NULL, 'bodhran', 'tune-1', NULL, 'full_track')`);
  }

  if (includeUserTuneOverride) {
    statements.push(`INSERT INTO rhythm_patterns (id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, tune_id, user_id, pattern_type)
      VALUES ('user-tune', 'ITRAD', 'Reel', 'User Tune Override', '*', 'X:1
T:User Tune Override
M:4/4
L:1/8
K:clef=perc
|: F2 A2 F2 A2 :|', 0, 'custom/user-tune.mp3', 'bodhran', 'tune-1', 'user-1', 'full_track')`);
  }

  return createDb(statements);
}

function applySqliteMigration(db: Database.Database, fileName: string) {
  const migrationPath = path.join(
    projectRoot,
    "drizzle",
    "migrations",
    "sqlite",
    fileName
  );
  const contents = fs.readFileSync(migrationPath, "utf8");
  const statements = contents
    .split(/-->\s*statement-breakpoint/g)
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    db.exec(statement);
  }
}

function createMockStorage(): Storage {
  const values = new Map<string, string>();

  const storage: Storage = {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };

  return storage;
}

afterEach(() => {
  vi.restoreAllMocks();
  if (typeof globalThis.localStorage?.clear === "function") {
    globalThis.localStorage.clear();
  }
  vi.unstubAllGlobals();
});

describe("loadRhythmPattern", () => {
  it("prefers rhythm_patterns and genre_tune_type.default_bpm when available", async () => {
    const db = createPremiumLoopRhythmDb();

    const metadata = await loadRhythmPattern(
      db,
      {
        genreName: "Irish Traditional",
        tuneTypeName: "Reel",
      },
      {
        sampleBaseUrl: "",
      }
    );

    expect(metadata).toMatchObject({
      genreName: "Irish Traditional",
      tuneTypeName: "Reel",
      patternType: "seed",
      tempoQpm: 112,
      sampleKit: "bodhran",
      premiumAudioSource: "database",
      premiumAudioSourceTempoQpm: 112,
      source: "rhythm_patterns",
    });
    expect(metadata?.rhythmAbc).toContain("Reel Groove");
    expect(metadata?.premiumAudioUrl).toBe("/custom/reel.mp3");
  });

  it("falls back to generated ABC when rhythm_patterns has no matching row", async () => {
    const db = createRhythmDbWithoutPatternRow();

    const metadata = await loadRhythmPattern(
      db,
      {
        genreName: "Irish Traditional",
        tuneTypeName: "Reel",
      },
      {
        sampleBaseUrl: "",
      }
    );

    expect(metadata).toMatchObject({
      genreName: "Irish Traditional",
      tuneTypeName: "Reel",
      patternType: "seed",
      tempoQpm: 112,
      sampleKit: "generic_click",
      source: "tune_type_fallback",
    });
    expect(metadata?.rhythmAbc).toContain("M:4/4");
    expect(metadata?.premiumAudioUrl).toBeNull();
  });

  it("resolves genre code ITRAD without inventing premium loop URLs", async () => {
    const db = createRhythmDbWithoutPatternRow();

    const metadata = await loadRhythmPattern(
      db,
      {
        genreName: "ITRAD",
        tuneTypeName: "Reel",
      },
      {
        sampleBaseUrl: "",
      }
    );

    expect(metadata).toMatchObject({
      genreName: "Irish Traditional",
      tuneTypeName: "Reel",
      source: "tune_type_fallback",
    });
    expect(metadata?.premiumAudioUrl).toBeNull();
  });

  it("returns canonical genre ids and names from the genre table", async () => {
    const db = createPremiumLoopRhythmDb();

    const metadata = await loadRhythmPattern(
      db,
      {
        genreId: "ITRAD",
        tuneTypeName: "Reel",
      },
      {
        sampleBaseUrl: "",
      }
    );

    expect(metadata).toMatchObject({
      genreName: "Irish Traditional",
      genreId: "ITRAD",
      tuneTypeName: "Reel",
      tuneTypeId: "Reel",
      source: "rhythm_patterns",
    });
  });

  it("resolves jig metadata without synthesizing a premium loop", async () => {
    const db = createFallbackJigRhythmDb();

    const metadata = await loadRhythmPattern(
      db,
      {
        genreName: "Irish Traditional",
        tuneTypeName: "Jig",
      },
      {
        sampleBaseUrl: "",
      }
    );

    expect(metadata).toMatchObject({
      genreName: "Irish Traditional",
      tuneTypeName: "Jig",
      patternType: "seed",
      tempoQpm: 115,
      sampleKit: "generic_click",
      source: "tune_type_fallback",
    });
    expect(metadata?.premiumAudioUrl).toBeNull();
    expect(metadata?.rhythmAbc).toContain("|: !accent!C2 c C c c :|");
  });

  it("matches tune-type ids like JigD and still resolves jig metadata", async () => {
    const db = createFallbackJigCodeRhythmDb();

    const metadata = await loadRhythmPattern(
      db,
      {
        genreName: "Irish Traditional",
        tuneTypeName: "JigD",
      },
      {
        sampleBaseUrl: "",
      }
    );

    expect(metadata).toMatchObject({
      genreName: "Irish Traditional",
      tuneTypeName: "Jig",
      patternType: "seed",
      tempoQpm: 115,
      sampleKit: "generic_click",
      source: "tune_type_fallback",
    });
    expect(metadata?.premiumAudioUrl).toBeNull();
    expect(metadata?.rhythmAbc).toContain("|: !accent!C2 c C c c :|");
  });

  it("parses swing_desc JSON from rhythm_patterns into typed metadata", async () => {
    const db = createSwingDescriptorRhythmDb();

    const metadata = await loadRhythmPattern(
      db,
      {
        genreName: "Irish Traditional",
        tuneTypeName: "JigD",
      },
      {
        sampleBaseUrl: "",
      }
    );

    expect(metadata?.swingPercentage).toBeCloseTo(0.15, 5);
    expect(metadata?.swingDescriptor).toEqual({
      timeSignature: "6/8",
      macroBeatDivision: 3,
      defaultSwingFactor: 1.15,
      balanceRemainingNotes: true,
      velocityPattern: [100, 80, 60],
      humanizationDeltaMs: 15,
    });
  });

  it("inherits swing_desc from the default row when the selected custom row leaves it null", async () => {
    const db = createInheritedSwingDescriptorRhythmDb();

    const metadata = await loadRhythmPattern(
      db,
      {
        genreName: "Irish Traditional",
        tuneTypeName: "JigD",
        userId: "user-1",
      },
      {
        sampleBaseUrl: "",
      }
    );

    expect(metadata?.selectedPatternId).toBe("user-default");
    expect(metadata?.sampleKit).toBe("generic_click");
    expect(metadata?.swingDescriptor).toEqual({
      timeSignature: "6/8",
      macroBeatDivision: 3,
      defaultSwingFactor: 1.15,
      balanceRemainingNotes: true,
      velocityPattern: [100, 80, 60],
      humanizationDeltaMs: 15,
    });
  });

  it("resolves polka metadata without synthesizing a premium loop", async () => {
    const db = createFallbackPolkaRhythmDb();

    const metadata = await loadRhythmPattern(
      db,
      {
        genreName: "Irish Traditional",
        tuneTypeName: "Polka",
      },
      {
        sampleBaseUrl: "",
      }
    );

    expect(metadata).toMatchObject({
      genreName: "Irish Traditional",
      tuneTypeName: "Polka",
      patternType: "seed",
      tempoQpm: 120,
      sampleKit: "generic_click",
      source: "tune_type_fallback",
    });
    expect(metadata?.premiumAudioUrl).toBeNull();
  });

  it("prefixes explicit premium_audio_url values with the configured public R2 base URL", async () => {
    const db = createPremiumLoopRhythmDb();

    const metadata = await loadRhythmPattern(
      db,
      {
        genreName: "Irish Traditional",
        tuneTypeName: "Reel",
      },
      {
        sampleBaseUrl: "https://pub-c77b0e0025a0474588b12433d1a025db.r2.dev",
      }
    );

    expect(metadata?.premiumAudioUrl).toBe(
      "https://pub-c77b0e0025a0474588b12433d1a025db.r2.dev/custom/reel.mp3"
    );
  });

  it("falls back to generated percussion ABC and default tempo when the migrated schema has no matching rhythm pattern rows", async () => {
    const db = createFallbackRhythmDb();

    const metadata = await loadRhythmPattern(
      db,
      {
        tuneTypeName: "Reel",
      },
      {
        sampleBaseUrl: "",
      }
    );

    expect(metadata).toMatchObject({
      genreName: null,
      tuneTypeName: "Reel",
      patternType: "seed",
      tempoQpm: 100,
      source: "tune_type_fallback",
    });
    expect(metadata?.rhythmAbc).toContain("M:4/4");
    expect(metadata?.rhythmAbc).toContain("K:clef=perc");
  });
  it("prioritizes the user tune override over tune and user defaults", async () => {
    const db = createHierarchicalRhythmDb();

    const metadata = await loadRhythmPattern(
      db,
      {
        genreName: "Irish Traditional",
        tuneTypeName: "Reel",
        tuneId: "tune-1",
        userId: "user-1",
      },
      {
        sampleBaseUrl: "https://media.example.test",
      }
    );

    expect(metadata).toMatchObject({
      genreName: "Irish Traditional",
      tuneTypeName: "Reel",
      patternType: "full_track",
      sampleKit: "bodhran",
      premiumAudioSource: "database",
      source: "rhythm_patterns",
    });
    expect(metadata?.rhythmAbc).toContain("User Tune Override");
    expect(metadata?.premiumAudioUrl).toBe(
      "https://media.example.test/custom/user-tune.mp3"
    );
  });

  it("prioritizes the global tune override before the user default", async () => {
    const db = createHierarchicalRhythmDb({
      includeUserTuneOverride: false,
    });

    const metadata = await loadRhythmPattern(
      db,
      {
        genreName: "Irish Traditional",
        tuneTypeName: "Reel",
        tuneId: "tune-1",
        userId: "user-1",
      },
      {
        sampleBaseUrl: "",
      }
    );

    expect(metadata).toMatchObject({
      genreName: "Irish Traditional",
      tuneTypeName: "Reel",
      patternType: "full_track",
      sampleKit: "bodhran",
      source: "rhythm_patterns",
    });
    expect(metadata?.rhythmAbc).toContain("Global Tune Override");
  });

  it("prioritizes the user default before the system default when no tune override exists", async () => {
    const db = createHierarchicalRhythmDb({
      includeUserTuneOverride: false,
      includeGlobalTuneOverride: false,
    });

    const metadata = await loadRhythmPattern(
      db,
      {
        genreName: "Irish Traditional",
        tuneTypeName: "Reel",
        userId: "user-1",
      },
      {
        sampleBaseUrl: "",
      }
    );

    expect(metadata).toMatchObject({
      genreName: "Irish Traditional",
      tuneTypeName: "Reel",
      patternType: "seed",
      sampleKit: "generic_click",
      source: "rhythm_patterns",
    });
    expect(metadata?.rhythmAbc).toContain("User Default");
  });

  it("returns ranked pattern candidates alongside the selected pattern", async () => {
    const db = createHierarchicalRhythmDb();

    const metadata = await loadRhythmPattern(
      db,
      {
        genreName: "Irish Traditional",
        tuneTypeName: "Reel",
        tuneId: "tune-1",
        userId: "user-1",
      },
      {
        sampleBaseUrl: "",
      }
    );

    expect(metadata?.selectedPatternId).toBe("user-tune");
    expect(metadata?.patternCandidates).toEqual([
      {
        id: "user-tune",
        name: "User Tune Override",
        scope: "user_tune",
        patternType: "full_track",
        sampleKit: "bodhran",
        hasPremiumAudio: true,
      },
      {
        id: "global-tune",
        name: "Global Tune Override",
        scope: "tune_default",
        patternType: "full_track",
        sampleKit: "bodhran",
        hasPremiumAudio: false,
      },
      {
        id: "user-default",
        name: "User Default",
        scope: "user_default",
        patternType: "seed",
        sampleKit: "generic_click",
        hasPremiumAudio: false,
      },
      {
        id: "system-default",
        name: "System Default",
        scope: "system_default",
        patternType: "seed",
        sampleKit: "bodhran",
        hasPremiumAudio: false,
      },
    ]);
  });

  it("does not duplicate pattern candidates when multiple genre_tune_type rows exist without a genre filter", async () => {
    const db = createDb([
      "CREATE TABLE genre (id TEXT PRIMARY KEY, name TEXT)",
      "CREATE TABLE tune_type (id TEXT PRIMARY KEY, name TEXT, rhythm TEXT, description TEXT)",
      "CREATE TABLE genre_tune_type (genre_id TEXT NOT NULL, tune_type_id TEXT NOT NULL, default_bpm INTEGER, PRIMARY KEY (genre_id, tune_type_id))",
      CURRENT_RHYTHM_PATTERNS_TABLE_SQL,
      "INSERT INTO genre (id, name) VALUES ('ALT', 'Alt Genre')",
      "INSERT INTO genre (id, name) VALUES ('ITRAD', 'Irish Traditional')",
      "INSERT INTO tune_type (id, name, rhythm, description) VALUES ('Jig', 'Jig', '6/8', 'Jig rhythm')",
      "INSERT INTO genre_tune_type (genre_id, tune_type_id, default_bpm) VALUES ('ALT', 'Jig', 99)",
      "INSERT INTO genre_tune_type (genre_id, tune_type_id, default_bpm) VALUES ('ITRAD', 'Jig', 115)",
      `INSERT INTO rhythm_patterns (id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, tune_id, user_id, pattern_type)
        VALUES ('system-default', 'ITRAD', 'Jig', 'Standard Double Jig', '*', 'X:1
T:Standard Double Jig
M:6/8
L:1/8
K:clef=perc
|: C2 c C c c :|', 1, NULL, 'bodhran', NULL, NULL, 'seed')`,
    ]);

    const metadata = await loadRhythmPattern(
      db,
      {
        genreName: null,
        tuneTypeName: "Jig",
      },
      {
        sampleBaseUrl: "",
      }
    );

    expect(metadata?.selectedPatternId).toBe("system-default");
    expect(metadata?.patternCandidates).toEqual([
      {
        id: "system-default",
        name: "Standard Double Jig",
        scope: "system_default",
        patternType: "seed",
        sampleKit: "bodhran",
        hasPremiumAudio: false,
      },
    ]);
  });

  it("honors a selectedPatternId when it matches an eligible candidate", async () => {
    const db = createHierarchicalRhythmDb();

    const metadata = await loadRhythmPattern(
      db,
      {
        genreName: "Irish Traditional",
        tuneTypeName: "Reel",
        tuneId: "tune-1",
        userId: "user-1",
        selectedPatternId: "global-tune",
      },
      {
        sampleBaseUrl: "",
      }
    );

    expect(metadata?.selectedPatternId).toBe("global-tune");
    expect(metadata?.rhythmAbc).toContain("Global Tune Override");
    expect(metadata?.patternType).toBe("full_track");
  });
});

describe("rhythm pattern sqlite migrations", () => {
  it("adds sample_kit, tune_id, user_id, and pattern_type to migrated local sqlite databases", () => {
    const sqlite = new Database(":memory:");

    sqlite.exec("CREATE TABLE genre (id TEXT PRIMARY KEY, name TEXT)");
    sqlite.exec(
      "CREATE TABLE tune_type (id TEXT PRIMARY KEY, name TEXT, rhythm TEXT, description TEXT)"
    );
    sqlite.exec(
      "CREATE TABLE genre_tune_type (genre_id TEXT NOT NULL, tune_type_id TEXT NOT NULL, PRIMARY KEY (genre_id, tune_type_id))"
    );
    sqlite.exec(
      "INSERT INTO genre (id, name) VALUES ('ITRAD', 'Irish Traditional')"
    );
    sqlite.exec(
      "INSERT INTO tune_type (id, name, rhythm, description) VALUES ('Reel', 'Reel', '4/4', 'Reel rhythm')"
    );

    applySqliteMigration(
      sqlite,
      "0019_add_rhythm_patterns_and_default_bpm.sql"
    );
    applySqliteMigration(sqlite, "0020_add_sample_kit_to_rhythm_patterns.sql");
    applySqliteMigration(sqlite, "0021_add_rhythm_pattern_overrides.sql");

    const columns = sqlite
      .prepare("PRAGMA table_info(rhythm_patterns)")
      .all() as Array<{
      name: string;
      notnull: number;
      dflt_value: string | null;
    }>;

    expect(columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "sample_kit",
        "tune_id",
        "user_id",
        "pattern_type",
      ])
    );

    const patternTypeColumn = columns.find(
      (column) => column.name === "pattern_type"
    );
    expect(patternTypeColumn?.notnull).toBe(1);
    expect(patternTypeColumn?.dflt_value ?? "").toContain("seed");

    sqlite.exec(`INSERT INTO rhythm_patterns (
      id,
      genre_id,
      tune_type_id,
      name,
      abc_string,
      is_default
    ) VALUES (
      'migrated-row',
      'ITRAD',
      'Reel',
      'Migrated Row',
      'X:1\nT:Migrated\nM:4/4\nL:1/8\nK:clef=perc\n|: C2 A2 C2 A2 :|',
      1
    )`);

    const row = sqlite
      .prepare(
        "SELECT sample_kit, tune_id, user_id, pattern_type FROM rhythm_patterns WHERE id = 'migrated-row'"
      )
      .get() as {
      sample_kit: string;
      tune_id: string | null;
      user_id: string | null;
      pattern_type: string;
    };

    expect(row).toMatchObject({
      sample_kit: "bodhran",
      tune_id: null,
      user_id: null,
      pattern_type: "seed",
    });

    sqlite.close();
  });
});

describe("createRhythmService", () => {
  it("prefers swing_desc.defaultSwingFactor over stored swing_percentage when no local override exists", async () => {
    const db = createMismatchedSwingDefaultRhythmDb();

    let dispose = () => {};
    const service = createRoot((nextDispose) => {
      dispose = nextDispose;
      return createRhythmService({
        db,
        sampleBaseUrl: "",
      });
    });

    await service.loadPattern({
      genreName: "Irish Traditional",
      tuneTypeName: "JigD",
      userId: "user-1",
    });

    expect(service.swingPercentage()).toBeCloseTo(0.15, 5);

    await service.setSwingPercentage(0.4);
    expect(service.swingPercentage()).toBeCloseTo(0.4, 5);

    await service.resetSwingToDefault();
    expect(service.swingPercentage()).toBeCloseTo(0.15, 5);

    dispose();
  });

  it("defaults metronome mode to off", () => {
    const db = createSampleKitRhythmDb();

    let dispose = () => {};
    const service = createRoot((nextDispose) => {
      dispose = nextDispose;
      return createRhythmService({
        db,
        sampleBaseUrl: "",
      });
    });

    expect(service.metronomeMode()).toBe("off");

    service.setMetronomeMode("on");
    expect(service.metronomeMode()).toBe("on");

    dispose();
  });

  it("mixes metronome clicks with rhythm samples when metronome mode is on", async () => {
    const db = createSampleKitRhythmDb();
    const fetchMock = vi.fn(async (_url: string) => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(16),
    }));

    const bufferSources: Array<{
      buffer: AudioBuffer | null;
      start: ReturnType<typeof vi.fn>;
    }> = [];

    class FakeAudioContext {
      state: AudioContextState = "running";
      currentTime = 0;
      sampleRate = 44_100;
      destination = {};
      resume = vi.fn(async () => undefined);
      decodeAudioData = vi.fn(async () => ({
        duration: 0.25,
        length: 1,
        numberOfChannels: 1,
        sampleRate: 44_100,
      })) as unknown as typeof AudioContext.prototype.decodeAudioData;
      createBuffer = vi.fn(
        (_channels: number, length: number, sampleRate: number) => {
          const data = new Float32Array(length);
          return {
            duration: length / sampleRate,
            length,
            numberOfChannels: 1,
            sampleRate,
            getChannelData: vi.fn(() => data),
          } as unknown as AudioBuffer;
        }
      );
      createBufferSource = vi.fn(() => {
        const source = {
          buffer: null as AudioBuffer | null,
          connect: vi.fn(),
          start: vi.fn(),
        };
        bufferSources.push(source);
        return source as unknown as AudioBufferSourceNode;
      });
      createGain = vi.fn(
        () =>
          ({
            gain: { value: 1 },
            connect: vi.fn(),
          }) as unknown as GainNode
      );
      close = vi.fn(async () => undefined);
    }

    class FakeTimingCallbacks {
      readonly options: {
        qpm?: number;
        beatCallback?: (beatNumber: number) => void;
        eventCallback?: (event: {
          type: "event";
          measureStart: boolean;
          measureNumber: number;
          milliseconds: number;
          millisecondsPerMeasure: number;
          midiPitches: Array<{ pitch: number }>;
          elements: HTMLElement[][];
        }) => void;
      };

      constructor(
        _visualObj: unknown,
        options: FakeTimingCallbacks["options"]
      ) {
        this.options = options;
      }

      start() {
        this.options.beatCallback?.(1);
        this.options.beatCallback?.(2);
        this.options.eventCallback?.({
          type: "event",
          measureStart: true,
          measureNumber: 1,
          milliseconds: 0,
          millisecondsPerMeasure: 2000,
          midiPitches: [{ pitch: 60 }],
          elements: [[]],
        });
      }

      pause() {
        noop();
      }

      reset() {
        noop();
      }

      stop() {
        noop();
      }

      currentMillisecond() {
        return 0;
      }
    }

    const fakeAbcjs = {
      renderAbc: vi.fn(
        () => [{}] as unknown as ReturnType<typeof import("abcjs").renderAbc>
      ),
      TimingCallbacks:
        FakeTimingCallbacks as unknown as typeof import("abcjs").TimingCallbacks,
    };

    let dispose = () => {};
    const service = createRoot((nextDispose) => {
      dispose = nextDispose;
      return createRhythmService({
        db,
        abcjsModule: fakeAbcjs,
        audioContext: new FakeAudioContext() as unknown as AudioContext,
        sampleBaseUrl: "",
        fetchImpl: asFetch(fetchMock),
      });
    });

    await service.loadPattern({
      genreName: "Session Test",
      tuneTypeName: "Reel",
    });
    service.setMetronomeMode("on");

    await service.play();

    expect(bufferSources.map((source) => source.buffer?.length)).toEqual(
      expect.arrayContaining([882, 882, 1])
    );
    expect(fetchMock).toHaveBeenCalledTimes(EXPECTED_BODHRAN_FETCH_COUNT);

    dispose();
  });

  it("plays metronome-only clicks without samples or premium loops", async () => {
    const db = createPremiumLoopRhythmDb();
    const fetchMock = vi.fn(async (_url: string) => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(16),
    }));
    const premiumPlay = vi.fn(async () => undefined);
    const bufferSources: Array<{
      buffer: AudioBuffer | null;
      start: ReturnType<typeof vi.fn>;
    }> = [];

    class FakeAudioContext {
      state: AudioContextState = "running";
      currentTime = 0;
      sampleRate = 44_100;
      destination = {};
      resume = vi.fn(async () => undefined);
      decodeAudioData = vi.fn(async () => ({
        duration: 0.25,
        length: 1,
        numberOfChannels: 1,
        sampleRate: 44_100,
      })) as unknown as typeof AudioContext.prototype.decodeAudioData;
      createBuffer = vi.fn(
        (_channels: number, length: number, sampleRate: number) => {
          const data = new Float32Array(length);
          return {
            duration: length / sampleRate,
            length,
            numberOfChannels: 1,
            sampleRate,
            getChannelData: vi.fn(() => data),
          } as unknown as AudioBuffer;
        }
      );
      createBufferSource = vi.fn(() => {
        const source = {
          buffer: null as AudioBuffer | null,
          connect: vi.fn(),
          start: vi.fn(),
        };
        bufferSources.push(source);
        return source as unknown as AudioBufferSourceNode;
      });
      createGain = vi.fn(
        () =>
          ({
            gain: { value: 1 },
            connect: vi.fn(),
          }) as unknown as GainNode
      );
      close = vi.fn(async () => undefined);
    }

    class FakeTimingCallbacks {
      readonly options: {
        beatCallback?: (beatNumber: number) => void;
      };

      constructor(
        _visualObj: unknown,
        options: FakeTimingCallbacks["options"]
      ) {
        this.options = options;
      }

      start() {
        this.options.beatCallback?.(1);
        this.options.beatCallback?.(2);
      }

      pause() {
        noop();
      }

      reset() {
        noop();
      }

      stop() {
        noop();
      }

      currentMillisecond() {
        return 0;
      }
    }

    const fakeAbcjs = {
      renderAbc: vi.fn(
        () => [{}] as unknown as ReturnType<typeof import("abcjs").renderAbc>
      ),
      TimingCallbacks:
        FakeTimingCallbacks as unknown as typeof import("abcjs").TimingCallbacks,
    };

    let dispose = () => {};
    const service = createRoot((nextDispose) => {
      dispose = nextDispose;
      return createRhythmService({
        db,
        abcjsModule: fakeAbcjs,
        audioContext: new FakeAudioContext() as unknown as AudioContext,
        audioElementFactory: () => ({
          crossOrigin: "",
          currentTime: 0,
          loop: false,
          pause: vi.fn(),
          play: premiumPlay,
          playbackRate: 1,
          preload: "",
          src: "",
        }),
        fetchImpl: asFetch(fetchMock),
        preferPremiumLoop: () => true,
        sampleBaseUrl: "",
      });
    });

    await service.loadPattern({
      genreName: "Irish Traditional",
      tuneTypeName: "Reel",
    });
    service.setMetronomeMode("metronome-only");

    await service.play();

    expect(bufferSources.map((source) => source.buffer?.length)).toEqual([
      882, 882,
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(premiumPlay).not.toHaveBeenCalled();

    dispose();
  });

  it("plays mapped bodhran samples and restarts timing callbacks when tempo changes", async () => {
    const db = createSampleKitRhythmDb();
    const fetchMock = vi.fn(async (_url: string) => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(16),
    }));

    const bufferSources: Array<{
      buffer: AudioBuffer | null;
      connect: ReturnType<typeof vi.fn>;
      start: ReturnType<typeof vi.fn>;
    }> = [];

    class FakeAudioContext {
      state: AudioContextState = "suspended";
      currentTime = 0;
      sampleRate = 44_100;
      destination = {};
      resume = vi.fn(async () => {
        this.state = "running";
      });
      decodeAudioData = vi.fn(async () => ({
        duration: 0.25,
        length: 1,
        numberOfChannels: 1,
        sampleRate: 44_100,
      })) as unknown as typeof AudioContext.prototype.decodeAudioData;
      createBuffer = vi.fn(
        (_channels: number, length: number, sampleRate: number) => {
          const data = new Float32Array(length);
          return {
            duration: length / sampleRate,
            length,
            numberOfChannels: 1,
            sampleRate,
            getChannelData: vi.fn(() => data),
          } as unknown as AudioBuffer;
        }
      );
      createBufferSource = vi.fn(() => {
        const source = {
          buffer: null as AudioBuffer | null,
          connect: vi.fn(),
          start: vi.fn(),
        };
        bufferSources.push(source);
        return source as unknown as AudioBufferSourceNode;
      });
      createGain = vi.fn(
        () =>
          ({
            gain: { value: 1 },
            connect: vi.fn(),
          }) as unknown as GainNode
      );
      close = vi.fn(async () => {
        this.state = "closed";
      });
    }

    class FakeTimingCallbacks {
      static readonly instances: FakeTimingCallbacks[] = [];
      startedWith: Array<{ position?: number; units?: string }> = [];
      paused = false;
      stopped = false;
      currentPositionMs = 0;
      readonly options: {
        qpm?: number;
        beatCallback?: (beatNumber: number) => void;
        eventCallback?: (event: {
          type: "event";
          measureStart: boolean;
          measureNumber: number;
          midiPitches: Array<{ pitch: number }>;
          elements: HTMLElement[][];
        }) => void;
      };

      constructor(
        _visualObj: unknown,
        options: {
          qpm?: number;
          beatCallback?: (beatNumber: number) => void;
          eventCallback?: (event: {
            type: "event";
            measureStart: boolean;
            measureNumber: number;
            midiPitches: Array<{ pitch: number }>;
            elements: HTMLElement[][];
          }) => void;
        }
      ) {
        this.options = options;
        FakeTimingCallbacks.instances.push(this);
      }

      start(position?: number, units?: string) {
        this.startedWith.push({ position, units });
        if (position !== undefined) {
          this.currentPositionMs = position * 1000;
        }
        this.paused = false;
        this.options.beatCallback?.(1);
        this.options.eventCallback?.({
          type: "event",
          measureStart: true,
          measureNumber: 1,
          midiPitches: [{ pitch: 60 }, { pitch: 69 }],
          elements: [[]],
        });
      }

      pause() {
        this.paused = true;
      }

      reset() {
        noop();
      }

      stop() {
        this.stopped = true;
      }

      currentMillisecond() {
        return this.currentPositionMs;
      }
    }

    const fakeAbcjs = {
      renderAbc: vi.fn(
        () => [{}] as unknown as ReturnType<typeof import("abcjs").renderAbc>
      ),
      TimingCallbacks:
        FakeTimingCallbacks as unknown as typeof import("abcjs").TimingCallbacks,
    };

    const audioContext = new FakeAudioContext() as unknown as AudioContext;

    let dispose = () => {};
    const service = createRoot((nextDispose) => {
      dispose = nextDispose;
      return createRhythmService({
        db,
        abcjsModule: fakeAbcjs,
        audioContext,
        sampleBaseUrl: "",
        fetchImpl: asFetch(fetchMock),
      });
    });

    const metadata = await service.loadPattern({
      genreName: "Session Test",
      tuneTypeName: "Reel",
    });

    expect(metadata?.tempoQpm).toBe(112);

    await service.play();

    expect(service.isPlaying()).toBe(true);
    expect(service.isReady()).toBe(true);
    expect(service.currentBeatIndex()).toBe(1);
    expect(service.currentMeasure()).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(EXPECTED_BODHRAN_FETCH_COUNT);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(EXPECTED_BODHRAN_FIRST_FETCH_URL);
    expect(fetchMock.mock.calls[EXPECTED_BODHRAN_FETCH_COUNT - 1]?.[0]).toBe(
      EXPECTED_BODHRAN_LAST_FETCH_URL
    );
    expect(bufferSources).toHaveLength(2);
    expect(bufferSources[0]?.start).toHaveBeenCalledTimes(1);
    expect(bufferSources[1]?.start).toHaveBeenCalledTimes(1);
    expect(FakeTimingCallbacks.instances[0]?.options.qpm).toBe(112);

    FakeTimingCallbacks.instances[0].currentPositionMs = 1500;
    await service.setTempoQpm(132);

    expect(service.tempoQpm()).toBe(132);
    expect(FakeTimingCallbacks.instances).toHaveLength(2);
    expect(FakeTimingCallbacks.instances[1]?.options.qpm).toBe(132);
    expect(FakeTimingCallbacks.instances[1]?.startedWith[0]).toMatchObject({
      position: 1.5,
      units: "seconds",
    });

    service.pause();

    expect(service.isPlaying()).toBe(false);
    expect(service.isPaused()).toBe(true);
    expect(FakeTimingCallbacks.instances[1]?.paused).toBe(true);

    await service.resume();

    expect(FakeTimingCallbacks.instances).toHaveLength(2);
    expect(FakeTimingCallbacks.instances[1]?.startedWith).toEqual([
      { position: 1.5, units: "seconds" },
      { position: undefined, units: undefined },
    ]);
    expect(FakeTimingCallbacks.instances[1]?.currentPositionMs).toBe(1500);

    await service.play();

    expect(FakeTimingCallbacks.instances).toHaveLength(3);
    expect(FakeTimingCallbacks.instances[2]?.startedWith[0]).toMatchObject({
      position: undefined,
      units: "seconds",
    });

    dispose();
  });

  it("restores the stored tempo per user and rhythm type", async () => {
    const db = createPremiumLoopRhythmDb();
    vi.stubGlobal("localStorage", createMockStorage());

    const firstService = createRoot(() =>
      createRhythmService({
        db,
      })
    );

    await firstService.loadPattern({
      userId: "user-1",
      tuneTypeName: "Reel",
    });
    await firstService.setTempoQpm(136);

    const secondService = createRoot(() =>
      createRhythmService({
        db,
      })
    );

    await secondService.loadPattern({
      userId: "user-1",
      tuneTypeName: "Reel",
    });

    expect(secondService.tempoQpm()).toBe(136);
  });

  it("restores the stored metronome mode per user and rhythm type", async () => {
    const db = createPremiumLoopRhythmDb();
    vi.stubGlobal("localStorage", createMockStorage());

    const firstService = createRoot(() =>
      createRhythmService({
        db,
      })
    );

    await firstService.loadPattern({
      userId: "user-1",
      tuneTypeName: "Reel",
    });
    firstService.setMetronomeMode("metronome-only");

    const secondService = createRoot(() =>
      createRhythmService({
        db,
      })
    );

    await secondService.loadPattern({
      userId: "user-1",
      tuneTypeName: "Reel",
    });

    expect(secondService.metronomeMode()).toBe("metronome-only");
  });

  it("keeps stored metronome modes isolated by user", async () => {
    const db = createPremiumLoopRhythmDb();
    vi.stubGlobal("localStorage", createMockStorage());

    const firstService = createRoot(() =>
      createRhythmService({
        db,
      })
    );

    await firstService.loadPattern({
      userId: "user-1",
      tuneTypeName: "Reel",
    });
    firstService.setMetronomeMode("metronome-only");

    const secondService = createRoot(() =>
      createRhythmService({
        db,
      })
    );

    await secondService.loadPattern({
      userId: "user-2",
      tuneTypeName: "Reel",
    });

    expect(secondService.metronomeMode()).toBe("off");
  });

  it("keeps stored metronome modes isolated by rhythm type", async () => {
    const db = createSampleKitRhythmDb();
    vi.stubGlobal("localStorage", createMockStorage());

    const firstService = createRoot(() =>
      createRhythmService({
        db,
      })
    );

    await firstService.loadPattern({
      userId: "user-1",
      tuneTypeName: "Reel",
    });
    firstService.setMetronomeMode("metronome-only");

    const secondService = createRoot(() =>
      createRhythmService({
        db,
      })
    );

    await secondService.loadPattern({
      userId: "user-1",
      tuneTypeName: "Jig",
    });

    expect(secondService.metronomeMode()).toBe("off");
  });

  it("starts playback from a structured beat and measure offset", async () => {
    const db = createSampleKitRhythmDb();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    }));

    class FakeAudioContext {
      state: AudioContextState = "running";
      currentTime = 0;
      sampleRate = 44_100;
      destination = {};
      resume = vi.fn(async () => undefined);
      decodeAudioData = vi.fn(async () => ({
        duration: 0.25,
        length: 1,
        numberOfChannels: 1,
        sampleRate: 44_100,
      })) as unknown as typeof AudioContext.prototype.decodeAudioData;
      createBufferSource = vi.fn(
        () =>
          ({
            buffer: null,
            connect: vi.fn(),
            start: vi.fn(),
          }) as unknown as AudioBufferSourceNode
      );
      createGain = vi.fn(
        () =>
          ({
            gain: { value: 1 },
            connect: vi.fn(),
          }) as unknown as GainNode
      );
      close = vi.fn(async () => undefined);
      createBuffer = vi.fn(
        (_channels: number, length: number, sampleRate: number) => {
          const data = new Float32Array(length);
          return {
            duration: length / sampleRate,
            length,
            numberOfChannels: 1,
            sampleRate,
            getChannelData: vi.fn(() => data),
          } as unknown as AudioBuffer;
        }
      );
    }

    class FakeTimingCallbacks {
      static readonly instances: FakeTimingCallbacks[] = [];
      readonly startedWith: Array<{ position?: number; units?: string }> = [];
      readonly options: {
        qpm?: number;
        beatCallback?: (beatNumber: number) => void;
        eventCallback?: (event: {
          type: "event";
          measureStart: boolean;
          measureNumber: number;
          midiPitches: Array<{ pitch: number }>;
          elements: HTMLElement[][];
        }) => void;
      };

      constructor(_visualObj: unknown, options: typeof this.options) {
        this.options = options;
        FakeTimingCallbacks.instances.push(this);
      }

      start(position?: number, units?: string) {
        this.startedWith.push({ position, units });
        this.options.eventCallback?.({
          type: "event",
          measureStart: true,
          measureNumber: 1,
          midiPitches: [{ pitch: 60 }],
          elements: [[]],
        });
      }

      pause() {
        noop();
      }
      reset() {
        noop();
      }
      stop() {
        noop();
      }
      currentMillisecond() {
        return 0;
      }
    }

    const fakeAbcjs = {
      renderAbc: vi.fn(
        () => [{}] as unknown as ReturnType<typeof import("abcjs").renderAbc>
      ),
      TimingCallbacks:
        FakeTimingCallbacks as unknown as typeof import("abcjs").TimingCallbacks,
    };

    const service = createRoot(() =>
      createRhythmService({
        db,
        abcjsModule: fakeAbcjs,
        audioContext: new FakeAudioContext() as unknown as AudioContext,
        sampleBaseUrl: "",
        fetchImpl: asFetch(fetchMock),
      })
    );

    await service.loadPattern({
      genreName: "Session Test",
      tuneTypeName: "Reel",
    });
    await service.play({
      startPositionMs: 6000,
      startBeatIndex: 3,
      startMeasure: 3,
    });

    const startedInstance = FakeTimingCallbacks.instances.find(
      (instance) => instance.startedWith.length > 0
    );

    expect(startedInstance?.startedWith[0]).toMatchObject({
      position: 6,
      units: "seconds",
    });
    expect(service.currentBeatIndex()).toBe(4);
    expect(service.currentMeasure()).toBe(4);
  });

  it("keeps stored tempos isolated by user", async () => {
    const db = createPremiumLoopRhythmDb();
    vi.stubGlobal("localStorage", createMockStorage());

    const firstService = createRoot(() =>
      createRhythmService({
        db,
      })
    );

    await firstService.loadPattern({
      userId: "user-1",
      tuneTypeName: "Reel",
    });
    await firstService.setTempoQpm(136);

    const secondService = createRoot(() =>
      createRhythmService({
        db,
      })
    );

    await secondService.loadPattern({
      userId: "user-2",
      tuneTypeName: "Reel",
    });

    expect(secondService.tempoQpm()).toBe(112);
  });

  it("keeps stored tempos isolated by rhythm type", async () => {
    vi.stubGlobal("localStorage", createMockStorage());
    const db = createDb([
      "CREATE TABLE genre (id TEXT PRIMARY KEY, name TEXT)",
      "CREATE TABLE tune_type (id TEXT PRIMARY KEY, name TEXT, rhythm TEXT, description TEXT)",
      "CREATE TABLE genre_tune_type (genre_id TEXT NOT NULL, tune_type_id TEXT NOT NULL, default_bpm INTEGER, PRIMARY KEY (genre_id, tune_type_id))",
      CURRENT_RHYTHM_PATTERNS_TABLE_SQL,
      "INSERT INTO genre (id, name) VALUES ('ITRAD', 'Irish Traditional')",
      "INSERT INTO tune_type (id, name, rhythm, description) VALUES ('Reel', 'Reel', '4/4', 'Reel rhythm')",
      "INSERT INTO tune_type (id, name, rhythm, description) VALUES ('Jig', 'Jig', '6/8', 'Jig rhythm')",
      "INSERT INTO genre_tune_type (genre_id, tune_type_id, default_bpm) VALUES ('ITRAD', 'Reel', 112)",
      "INSERT INTO genre_tune_type (genre_id, tune_type_id, default_bpm) VALUES ('ITRAD', 'Jig', 115)",
      `INSERT INTO rhythm_patterns (id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, tune_id, user_id, pattern_type)
        VALUES ('rp-reel', 'ITRAD', 'Reel', 'Basic Rolling', '*', 'X:1
T:Reel Groove
M:4/4
L:1/8
K:clef=perc
|: C2 A2 C2 A2 :|', 1, NULL, 'bodhran', NULL, NULL, 'seed')`,
      `INSERT INTO rhythm_patterns (id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, tune_id, user_id, pattern_type)
        VALUES ('rp-jig', 'ITRAD', 'Jig', 'Lift Jig', '*', 'X:1
T:Jig Groove
M:6/8
L:1/8
K:clef=perc
|: C2 c C c c :|', 1, NULL, 'bodhran', NULL, NULL, 'seed')`,
    ]);

    const firstService = createRoot(() =>
      createRhythmService({
        db,
      })
    );

    await firstService.loadPattern({
      userId: "user-1",
      tuneTypeName: "Reel",
    });
    await firstService.setTempoQpm(136);

    const secondService = createRoot(() =>
      createRhythmService({
        db,
      })
    );

    await secondService.loadPattern({
      userId: "user-1",
      tuneTypeName: "Jig",
    });

    expect(secondService.tempoQpm()).toBe(115);
  });

  it("plays a one-bar count-in before playback when starting from the beginning", async () => {
    const db = createFallbackRhythmDb();
    const fetchMock = vi.fn();
    const waitMock = vi.fn(async (_milliseconds: number) => {});

    const bufferSources: Array<{
      buffer: AudioBuffer | null;
      connect: ReturnType<typeof vi.fn>;
      start: ReturnType<typeof vi.fn>;
    }> = [];

    class FakeAudioContext {
      state: AudioContextState = "suspended";
      currentTime = 5;
      sampleRate = 44_100;
      destination = {};
      resume = vi.fn(async () => {
        this.state = "running";
      });
      decodeAudioData = vi.fn(async () => ({
        duration: 0.25,
        length: 1,
        numberOfChannels: 1,
        sampleRate: 44_100,
      })) as unknown as typeof AudioContext.prototype.decodeAudioData;
      createBuffer = vi.fn(
        (_channels: number, length: number, sampleRate: number) => {
          const data = new Float32Array(length);
          return {
            duration: length / sampleRate,
            length,
            numberOfChannels: 1,
            sampleRate,
            getChannelData: vi.fn(() => data),
          } as unknown as AudioBuffer;
        }
      );
      createBufferSource = vi.fn(() => {
        const source = {
          buffer: null as AudioBuffer | null,
          connect: vi.fn(),
          start: vi.fn(),
        };
        bufferSources.push(source);
        return source as unknown as AudioBufferSourceNode;
      });
      createGain = vi.fn(
        () =>
          ({
            gain: { value: 1 },
            connect: vi.fn(),
          }) as unknown as GainNode
      );
      close = vi.fn(async () => {
        this.state = "closed";
      });
    }

    class FakeTimingCallbacks {
      readonly options: {
        qpm?: number;
        beatCallback?: (beatNumber: number) => void;
        eventCallback?: (event: {
          type: "event";
          measureStart: boolean;
          measureNumber: number;
          midiPitches: Array<{ pitch: number }>;
          elements: HTMLElement[][];
        }) => void;
      };

      constructor(_visualObj: unknown, options: typeof this.options) {
        this.options = options;
      }

      start() {
        this.options.eventCallback?.({
          type: "event",
          measureStart: true,
          measureNumber: 1,
          midiPitches: [{ pitch: 60 }],
          elements: [[]],
        });
      }

      pause() {
        noop();
      }
      reset() {
        noop();
      }
      stop() {
        noop();
      }
      currentMillisecond() {
        return 0;
      }
    }

    const fakeAbcjs = {
      renderAbc: vi.fn(
        () => [{}] as unknown as ReturnType<typeof import("abcjs").renderAbc>
      ),
      TimingCallbacks:
        FakeTimingCallbacks as unknown as typeof import("abcjs").TimingCallbacks,
    };

    const audioContext = new FakeAudioContext() as unknown as AudioContext;

    let dispose = () => {};
    const service = createRoot((nextDispose) => {
      dispose = nextDispose;
      return createRhythmService({
        db,
        abcjsModule: fakeAbcjs,
        audioContext,
        fetchImpl: asFetch(fetchMock),
        initialCountInMeasures: 1,
        sampleBaseUrl: "",
        waitImpl: waitMock,
      });
    });

    await service.loadPattern({ tuneTypeName: "Reel" });
    const countInSnapshots: Array<{
      isCountIn: boolean;
      pulse: number;
      total: number;
    }> = [];
    waitMock.mockImplementation(async (_milliseconds: number) => {
      countInSnapshots.push({
        isCountIn: service.isCountIn(),
        pulse: service.countInPulse(),
        total: service.countInTotalPulses(),
      });
    });
    await service.play();

    expect(waitMock).toHaveBeenCalledTimes(4);
    expect(waitMock).toHaveBeenNthCalledWith(1, 600);
    expect(waitMock).toHaveBeenNthCalledWith(4, 600);
    expect(countInSnapshots).toEqual([
      { isCountIn: true, pulse: 1, total: 4 },
      { isCountIn: true, pulse: 2, total: 4 },
      { isCountIn: true, pulse: 3, total: 4 },
      { isCountIn: true, pulse: 4, total: 4 },
    ]);
    expect(service.isCountIn()).toBe(false);
    expect(service.countInPulse()).toBe(0);
    expect(bufferSources).toHaveLength(5);
    expect(bufferSources[0]?.start).toHaveBeenCalledWith(expect.closeTo(5, 5));
    expect(bufferSources[1]?.start).toHaveBeenCalledWith(
      expect.closeTo(5.6, 5)
    );
    expect(bufferSources[2]?.start).toHaveBeenCalledWith(
      expect.closeTo(6.2, 5)
    );
    expect(bufferSources[3]?.start).toHaveBeenCalledWith(
      expect.closeTo(6.8, 5)
    );
    expect(bufferSources[4]?.start).toHaveBeenCalledTimes(1);

    dispose();
  });

  it("restart() resets the paused position without starting playback", async () => {
    const db = createFallbackRhythmDb();
    const fetchMock = vi.fn();
    const waitMock = vi.fn(async (_milliseconds: number) => {});

    const bufferSources: Array<{
      buffer: AudioBuffer | null;
      connect: ReturnType<typeof vi.fn>;
      start: ReturnType<typeof vi.fn>;
    }> = [];

    class FakeAudioContext {
      state: AudioContextState = "suspended";
      currentTime = 7;
      sampleRate = 44_100;
      destination = {};
      resume = vi.fn(async () => {
        this.state = "running";
      });
      decodeAudioData = vi.fn(async () => ({
        duration: 0.25,
        length: 1,
        numberOfChannels: 1,
        sampleRate: 44_100,
      })) as unknown as typeof AudioContext.prototype.decodeAudioData;
      createBuffer = vi.fn(
        (_channels: number, length: number, sampleRate: number) => {
          const data = new Float32Array(length);
          return {
            duration: length / sampleRate,
            length,
            numberOfChannels: 1,
            sampleRate,
            getChannelData: vi.fn(() => data),
          } as unknown as AudioBuffer;
        }
      );
      createBufferSource = vi.fn(() => {
        const source = {
          buffer: null as AudioBuffer | null,
          connect: vi.fn(),
          start: vi.fn(),
        };
        bufferSources.push(source);
        return source as unknown as AudioBufferSourceNode;
      });
      createGain = vi.fn(
        () =>
          ({
            gain: { value: 1 },
            connect: vi.fn(),
          }) as unknown as GainNode
      );
      close = vi.fn(async () => {
        this.state = "closed";
      });
    }

    class FakeTimingCallbacks {
      currentPositionMs = 0;
      readonly options: {
        qpm?: number;
        beatCallback?: (beatNumber: number) => void;
        eventCallback?: (event: {
          type: "event";
          measureStart: boolean;
          measureNumber: number;
          midiPitches: Array<{ pitch: number }>;
          elements: HTMLElement[][];
        }) => void;
      };

      constructor(_visualObj: unknown, options: typeof this.options) {
        this.options = options;
      }

      start(position?: number) {
        this.currentPositionMs = (position ?? 0) * 1000;
        this.options.eventCallback?.({
          type: "event",
          measureStart: true,
          measureNumber: 1,
          midiPitches: [{ pitch: 60 }],
          elements: [[]],
        });
      }

      pause() {
        noop();
      }
      reset() {
        noop();
      }
      stop() {
        noop();
      }
      currentMillisecond() {
        return this.currentPositionMs;
      }
    }

    const fakeAbcjs = {
      renderAbc: vi.fn(
        () => [{}] as unknown as ReturnType<typeof import("abcjs").renderAbc>
      ),
      TimingCallbacks:
        FakeTimingCallbacks as unknown as typeof import("abcjs").TimingCallbacks,
    };

    const audioContext = new FakeAudioContext() as unknown as AudioContext;

    let dispose = () => {};
    const service = createRoot((nextDispose) => {
      dispose = nextDispose;
      return createRhythmService({
        db,
        abcjsModule: fakeAbcjs,
        audioContext,
        fetchImpl: asFetch(fetchMock),
        initialCountInMeasures: 1,
        sampleBaseUrl: "",
        waitImpl: waitMock,
      });
    });

    await service.loadPattern({ tuneTypeName: "Reel" });
    await service.play();
    service.pause();
    await service.restart();

    expect(waitMock).toHaveBeenCalledTimes(4);
    expect(waitMock).toHaveBeenNthCalledWith(1, 600);
    expect(waitMock).toHaveBeenNthCalledWith(4, 600);
    expect(service.isPlaying()).toBe(false);
    expect(service.isPaused()).toBe(true);
    expect(bufferSources).toHaveLength(5);

    dispose();
  });

  it("defaults to ABC sample-kit playback even when metadata includes a premium loop", async () => {
    const db = createPremiumLoopRhythmDb();
    const fetchMock = vi.fn(async (_url: string) => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(16),
    }));

    const createdAudio: Array<{ src: string }> = [];

    class FakeAudioContext {
      state: AudioContextState = "suspended";
      currentTime = 0;
      sampleRate = 44_100;
      destination = {};
      resume = vi.fn(async () => {
        this.state = "running";
      });
      decodeAudioData = vi.fn(async () => ({
        duration: 0.25,
        length: 1,
        numberOfChannels: 1,
        sampleRate: 44_100,
      })) as unknown as typeof AudioContext.prototype.decodeAudioData;
      createBuffer = vi.fn(
        (_channels: number, length: number, sampleRate: number) => {
          const data = new Float32Array(length);
          return {
            duration: length / sampleRate,
            length,
            numberOfChannels: 1,
            sampleRate,
            getChannelData: vi.fn(() => data),
          } as unknown as AudioBuffer;
        }
      );
      createBufferSource = vi.fn(() => ({
        buffer: null,
        connect: vi.fn(),
        start: vi.fn(),
      })) as unknown as typeof AudioContext.prototype.createBufferSource;
      createGain = vi.fn(
        () =>
          ({
            gain: { value: 1 },
            connect: vi.fn(),
          }) as unknown as GainNode
      );
      close = vi.fn(async () => {
        this.state = "closed";
      });
    }

    class FakeTimingCallbacks {
      readonly options: {
        eventCallback?: (event: {
          type: "event";
          measureStart: boolean;
          measureNumber: number;
          midiPitches: Array<{ pitch: number }>;
          elements: HTMLElement[][];
        }) => void;
      };

      constructor(_visualObj: unknown, options: typeof this.options) {
        this.options = options;
      }

      start() {
        this.options.eventCallback?.({
          type: "event",
          measureStart: true,
          measureNumber: 1,
          midiPitches: [{ pitch: 60 }, { pitch: 69 }],
          elements: [[]],
        });
      }

      pause() {
        noop();
      }
      reset() {
        noop();
      }
      stop() {
        noop();
      }
      currentMillisecond() {
        return 0;
      }
    }

    const fakeAbcjs = {
      renderAbc: vi.fn(
        () => [{}] as unknown as ReturnType<typeof import("abcjs").renderAbc>
      ),
      TimingCallbacks:
        FakeTimingCallbacks as unknown as typeof import("abcjs").TimingCallbacks,
    };

    let dispose = () => {};
    const service = createRoot((nextDispose) => {
      dispose = nextDispose;
      return createRhythmService({
        db,
        abcjsModule: fakeAbcjs,
        audioContext: new FakeAudioContext() as unknown as AudioContext,
        sampleBaseUrl: "",
        audioElementFactory: (src) => {
          createdAudio.push({ src });
          return {
            crossOrigin: null,
            currentTime: 0,
            loop: false,
            pause: vi.fn(),
            play: vi.fn(async () => undefined),
            playbackRate: 1,
            preload: "none",
            src,
          } as unknown as HTMLAudioElement;
        },
        fetchImpl: asFetch(fetchMock),
      });
    });

    const metadata = await service.loadPattern({
      genreName: "Irish Traditional",
      tuneTypeName: "Reel",
    });

    expect(metadata?.premiumAudioUrl).toBe("/custom/reel.mp3");

    await service.play();

    expect(fetchMock).toHaveBeenCalledTimes(EXPECTED_BODHRAN_FETCH_COUNT);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(EXPECTED_BODHRAN_FIRST_FETCH_URL);
    expect(fetchMock.mock.calls[EXPECTED_BODHRAN_FETCH_COUNT - 1]?.[0]).toBe(
      EXPECTED_BODHRAN_LAST_FETCH_URL
    );
    expect(createdAudio).toHaveLength(0);

    dispose();
  });

  it("plays premium loop audio when explicitly enabled and metadata includes a premium loop", async () => {
    const db = createPremiumLoopRhythmDb();
    const fetchMock = vi.fn();
    const [preferPremiumLoop] = createSignal(true);
    const createdAudio: Array<{
      crossOrigin: string | null;
      currentTime: number;
      loop: boolean;
      pause: ReturnType<typeof vi.fn>;
      play: ReturnType<typeof vi.fn>;
      playbackRate: number;
      preload: string;
      src: string;
    }> = [];

    class FakeAudioContext {
      state: AudioContextState = "suspended";
      currentTime = 0;
      sampleRate = 44_100;
      destination = {};
      resume = vi.fn(async () => {
        this.state = "running";
      });
      decodeAudioData = vi.fn(async () => ({
        duration: 0.25,
        length: 1,
        numberOfChannels: 1,
        sampleRate: 44_100,
      })) as unknown as typeof AudioContext.prototype.decodeAudioData;
      createBuffer = vi.fn(
        (_channels: number, length: number, sampleRate: number) => {
          const data = new Float32Array(length);
          return {
            duration: length / sampleRate,
            length,
            numberOfChannels: 1,
            sampleRate,
            getChannelData: vi.fn(() => data),
          } as unknown as AudioBuffer;
        }
      );
      createBufferSource = vi.fn(() => {
        throw new Error(
          "sample buffers should not be used for premium loop playback"
        );
      });
      createGain = vi.fn(
        () =>
          ({
            gain: { value: 1 },
            connect: vi.fn(),
          }) as unknown as GainNode
      );
      close = vi.fn(async () => {
        this.state = "closed";
      });
    }

    class FakeTimingCallbacks {
      static readonly instances: FakeTimingCallbacks[] = [];
      startedWith: Array<{ position?: number; units?: string }> = [];
      paused = false;
      currentPositionMs = 0;
      readonly options: {
        qpm?: number;
        beatCallback?: (beatNumber: number) => void;
        eventCallback?: (event: {
          type: "event";
          measureStart: boolean;
          measureNumber: number;
          midiPitches: Array<{ pitch: number }>;
          elements: HTMLElement[][];
        }) => void;
      };

      constructor(
        _visualObj: unknown,
        options: {
          qpm?: number;
          beatCallback?: (beatNumber: number) => void;
          eventCallback?: (event: {
            type: "event";
            measureStart: boolean;
            measureNumber: number;
            midiPitches: Array<{ pitch: number }>;
            elements: HTMLElement[][];
          }) => void;
        }
      ) {
        this.options = options;
        FakeTimingCallbacks.instances.push(this);
      }

      start(position?: number, units?: string) {
        this.startedWith.push({ position, units });
        this.currentPositionMs = (position ?? 0) * 1000;
        this.options.beatCallback?.(1);
        this.options.eventCallback?.({
          type: "event",
          measureStart: true,
          measureNumber: 1,
          midiPitches: [{ pitch: 60 }],
          elements: [[]],
        });
      }

      pause() {
        this.paused = true;
      }

      reset() {
        noop();
      }

      stop() {
        noop();
      }

      currentMillisecond() {
        return this.currentPositionMs;
      }
    }

    const fakeAbcjs = {
      renderAbc: vi.fn(
        () => [{}] as unknown as ReturnType<typeof import("abcjs").renderAbc>
      ),
      TimingCallbacks:
        FakeTimingCallbacks as unknown as typeof import("abcjs").TimingCallbacks,
    };

    const audioContext = new FakeAudioContext() as unknown as AudioContext;

    let dispose = () => {};
    const service = createRoot((nextDispose) => {
      dispose = nextDispose;
      return createRhythmService({
        db,
        abcjsModule: fakeAbcjs,
        audioContext,
        preferPremiumLoop,
        sampleBaseUrl: "",
        audioElementFactory: (src) => {
          const element = {
            crossOrigin: null,
            currentTime: 0,
            loop: false,
            pause: vi.fn(),
            play: vi.fn(async () => undefined),
            playbackRate: 1,
            preload: "none",
            src,
          };
          createdAudio.push(element);
          return element as unknown as HTMLAudioElement;
        },
        fetchImpl: asFetch(fetchMock),
      });
    });

    const metadata = await service.loadPattern({
      genreName: "Irish Traditional",
      tuneTypeName: "Reel",
    });

    expect(metadata?.premiumAudioUrl).toBe("/custom/reel.mp3");

    await service.play();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(createdAudio).toHaveLength(1);
    expect(createdAudio[0]?.src).toBe("/custom/reel.mp3");
    expect(createdAudio[0]?.loop).toBe(true);
    expect(createdAudio[0]?.crossOrigin).toBe("anonymous");
    expect(createdAudio[0]?.preload).toBe("auto");
    expect(createdAudio[0]?.play).toHaveBeenCalledTimes(1);
    expect(createdAudio[0]?.playbackRate).toBeCloseTo(1, 6);
    expect(service.currentBeatIndex()).toBe(1);
    expect(service.currentMeasure()).toBe(1);

    FakeTimingCallbacks.instances[0].currentPositionMs = 1500;
    await service.setTempoQpm(132);

    expect(createdAudio).toHaveLength(1);
    expect(createdAudio[0]?.playbackRate).toBeCloseTo(132 / 112, 6);
    expect(FakeTimingCallbacks.instances[1]?.startedWith[0]).toMatchObject({
      position: 1.5,
      units: "seconds",
    });

    service.pause();

    expect(createdAudio[0]?.pause).toHaveBeenCalledTimes(1);
    expect(service.isPlaying()).toBe(false);

    dispose();
  });

  it("uses synthesized generic clicks when no uploaded kit applies", async () => {
    const db = createFallbackRhythmDb();
    const fetchMock = vi.fn();

    const bufferSources: Array<{
      buffer: AudioBuffer | null;
      connect: ReturnType<typeof vi.fn>;
      start: ReturnType<typeof vi.fn>;
    }> = [];

    class FakeAudioContext {
      state: AudioContextState = "suspended";
      currentTime = 0;
      sampleRate = 44_100;
      destination = {};
      resume = vi.fn(async () => {
        this.state = "running";
      });
      decodeAudioData = vi.fn(async () => ({
        duration: 0.25,
        length: 1,
        numberOfChannels: 1,
        sampleRate: 44_100,
      })) as unknown as typeof AudioContext.prototype.decodeAudioData;
      createBuffer = vi.fn(
        (_channels: number, length: number, sampleRate: number) => {
          const data = new Float32Array(length);
          return {
            duration: length / sampleRate,
            length,
            numberOfChannels: 1,
            sampleRate,
            getChannelData: vi.fn(() => data),
          } as unknown as AudioBuffer;
        }
      );
      createBufferSource = vi.fn(() => {
        const source = {
          buffer: null as AudioBuffer | null,
          connect: vi.fn(),
          start: vi.fn(),
        };
        bufferSources.push(source);
        return source as unknown as AudioBufferSourceNode;
      });
      createGain = vi.fn(
        () =>
          ({
            gain: { value: 1 },
            connect: vi.fn(),
          }) as unknown as GainNode
      );
      close = vi.fn(async () => {
        this.state = "closed";
      });
    }

    class FakeTimingCallbacks {
      readonly options: {
        qpm?: number;
        beatCallback?: (beatNumber: number) => void;
        eventCallback?: (event: {
          type: "event";
          measureStart: boolean;
          measureNumber: number;
          midiPitches: Array<{ pitch: number }>;
          elements: HTMLElement[][];
        }) => void;
      };

      constructor(
        _visualObj: unknown,
        options: {
          qpm?: number;
          beatCallback?: (beatNumber: number) => void;
          eventCallback?: (event: {
            type: "event";
            measureStart: boolean;
            measureNumber: number;
            midiPitches: Array<{ pitch: number }>;
            elements: HTMLElement[][];
          }) => void;
        }
      ) {
        this.options = options;
      }

      start() {
        const kickoffMeasure = 1;
        this.options.eventCallback?.({
          type: "event",
          measureStart: true,
          measureNumber: kickoffMeasure,
          midiPitches: [{ pitch: 60 }, { pitch: 69 }],
          elements: [[]],
        });
      }

      pause() {
        noop();
      }

      reset() {
        noop();
      }

      stop() {
        noop();
      }

      currentMillisecond() {
        return 0;
      }
    }

    const fakeAbcjs = {
      renderAbc: vi.fn(
        () => [{}] as unknown as ReturnType<typeof import("abcjs").renderAbc>
      ),
      TimingCallbacks:
        FakeTimingCallbacks as unknown as typeof import("abcjs").TimingCallbacks,
    };

    let dispose = () => {};
    const service = createRoot((nextDispose) => {
      dispose = nextDispose;
      return createRhythmService({
        db,
        abcjsModule: fakeAbcjs,
        audioContext: new FakeAudioContext() as unknown as AudioContext,
        sampleBaseUrl: "",
        fetchImpl: asFetch(fetchMock),
      });
    });

    const metadata = await service.loadPattern({
      tuneTypeName: "Reel",
    });

    expect(metadata?.sampleKit).toBe("generic_click");

    await service.play();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(bufferSources).toHaveLength(2);
    expect(bufferSources[0]?.start).toHaveBeenCalledTimes(1);
    expect(bufferSources[1]?.start).toHaveBeenCalledTimes(1);

    dispose();
  });

  it("falls back to sample-kit audio when premium loop play() rejects", async () => {
    const db = createPremiumLoopRhythmDb();
    const [preferPremiumLoop] = createSignal(true);
    const fetchMock = vi.fn(async (_url: string) => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(16),
    }));

    const bufferSources: Array<{
      buffer: AudioBuffer | null;
      connect: ReturnType<typeof vi.fn>;
      start: ReturnType<typeof vi.fn>;
    }> = [];

    class FakeAudioContext {
      state: AudioContextState = "suspended";
      currentTime = 0;
      sampleRate = 44_100;
      destination = {};
      resume = vi.fn(async () => {
        this.state = "running";
      });
      decodeAudioData = vi.fn(async () => ({
        duration: 0.25,
        length: 1,
        numberOfChannels: 1,
        sampleRate: 44_100,
      })) as unknown as typeof AudioContext.prototype.decodeAudioData;
      createBuffer = vi.fn(
        (_channels: number, length: number, sampleRate: number) => {
          const data = new Float32Array(length);
          return {
            duration: length / sampleRate,
            length,
            numberOfChannels: 1,
            sampleRate,
            getChannelData: vi.fn(() => data),
          } as unknown as AudioBuffer;
        }
      );
      createBufferSource = vi.fn(() => {
        const source = {
          buffer: null as AudioBuffer | null,
          connect: vi.fn(),
          start: vi.fn(),
        };
        bufferSources.push(source);
        return source as unknown as AudioBufferSourceNode;
      });
      createGain = vi.fn(
        () =>
          ({
            gain: { value: 1 },
            connect: vi.fn(),
          }) as unknown as GainNode
      );
      close = vi.fn(async () => {
        this.state = "closed";
      });
    }

    class FakeTimingCallbacks {
      readonly options: {
        eventCallback?: (event: {
          type: "event";
          measureStart: boolean;
          measureNumber: number;
          midiPitches: Array<{ pitch: number }>;
          elements: HTMLElement[][];
        }) => void;
      };

      constructor(_visualObj: unknown, options: typeof this.options) {
        this.options = options;
      }

      start() {
        const kickoffPitches = [60, 69] as const;
        this.options.eventCallback?.({
          type: "event",
          measureStart: true,
          measureNumber: 1,
          midiPitches: kickoffPitches.map((pitch) => ({ pitch })),
          elements: [[]],
        });
      }

      pause() {
        noop();
      }
      reset() {
        noop();
      }
      stop() {
        noop();
      }
      currentMillisecond() {
        return 0;
      }
    }

    const fakeAbcjs = {
      renderAbc: vi.fn(
        () => [{}] as unknown as ReturnType<typeof import("abcjs").renderAbc>
      ),
      TimingCallbacks:
        FakeTimingCallbacks as unknown as typeof import("abcjs").TimingCallbacks,
    };

    const audioContext = new FakeAudioContext() as unknown as AudioContext;

    let dispose = () => {};
    const service = createRoot((nextDispose) => {
      dispose = nextDispose;
      return createRhythmService({
        db,
        abcjsModule: fakeAbcjs,
        audioContext,
        preferPremiumLoop,
        sampleBaseUrl: "",
        // Audio element whose play() always rejects to simulate autoplay
        // denial or network failure.
        audioElementFactory: (src) =>
          ({
            crossOrigin: null,
            currentTime: 0,
            loop: false,
            pause: vi.fn(),
            play: vi.fn(async () => {
              throw new Error("NotAllowedError: autoplay blocked");
            }),
            playbackRate: 1,
            preload: "none",
            src,
          }) as unknown as HTMLAudioElement,
        fetchImpl: asFetch(fetchMock),
      });
    });

    await service.loadPattern({
      genreName: "Irish Traditional",
      tuneTypeName: "Reel",
    });

    // Should not throw even though the premium loop play() rejects.
    await service.play();

    // Fell back to the bodhran sample kit fetches.
    expect(fetchMock).toHaveBeenCalledTimes(EXPECTED_BODHRAN_FETCH_COUNT);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(EXPECTED_BODHRAN_FIRST_FETCH_URL);
    expect(fetchMock.mock.calls[EXPECTED_BODHRAN_FETCH_COUNT - 1]?.[0]).toBe(
      EXPECTED_BODHRAN_LAST_FETCH_URL
    );
    // Sample buffers were used to drive the timing callbacks.
    expect(bufferSources).toHaveLength(2);
    expect(service.isPlaying()).toBe(true);
    expect(service.isReady()).toBe(true);

    dispose();
  });

  it("surfaces an error instead of substituting clicks when bodhran kit sample fetch fails", async () => {
    const db = createSampleKitRhythmDb();
    // Always fail so decodeSample throws for every bodhran file.
    const fetchMock = vi.fn(async (_url: string) => ({
      ok: false,
      arrayBuffer: async () => new ArrayBuffer(0),
    }));

    const bufferSources: Array<{
      buffer: AudioBuffer | null;
      connect: ReturnType<typeof vi.fn>;
      start: ReturnType<typeof vi.fn>;
    }> = [];

    class FakeAudioContext {
      state: AudioContextState = "suspended";
      currentTime = 0;
      sampleRate = 44_100;
      destination = {};
      resume = vi.fn(async () => {
        this.state = "running";
      });
      decodeAudioData = vi.fn(async () => ({
        duration: 0.25,
        length: 1,
        numberOfChannels: 1,
        sampleRate: 44_100,
      })) as unknown as typeof AudioContext.prototype.decodeAudioData;
      createBuffer = vi.fn(
        (_channels: number, length: number, sampleRate: number) => {
          const data = new Float32Array(length);
          return {
            duration: length / sampleRate,
            length,
            numberOfChannels: 1,
            sampleRate,
            getChannelData: vi.fn(() => data),
          } as unknown as AudioBuffer;
        }
      );
      createBufferSource = vi.fn(() => {
        const source = {
          buffer: null as AudioBuffer | null,
          connect: vi.fn(),
          start: vi.fn(),
        };
        bufferSources.push(source);
        return source as unknown as AudioBufferSourceNode;
      });
      createGain = vi.fn(
        () =>
          ({
            gain: { value: 1 },
            connect: vi.fn(),
          }) as unknown as GainNode
      );
      close = vi.fn(async () => {
        this.state = "closed";
      });
    }

    class FakeTimingCallbacks {
      readonly options: {
        eventCallback?: (event: {
          type: "event";
          measureStart: boolean;
          measureNumber: number;
          midiPitches: Array<{ pitch: number }>;
          elements: HTMLElement[][];
        }) => void;
      };

      constructor(_visualObj: unknown, options: typeof this.options) {
        this.options = options;
      }

      start() {
        noop();
        this.options.eventCallback?.({
          type: "event",
          measureStart: true,
          measureNumber: 1,
          midiPitches: [{ pitch: 60 }, { pitch: 69 }],
          elements: [[]],
        });
      }

      pause() {
        noop();
      }
      reset() {
        noop();
      }
      stop() {
        noop();
      }
      currentMillisecond() {
        return 0;
      }
    }

    const fakeAbcjs = {
      renderAbc: vi.fn(
        () => [{}] as unknown as ReturnType<typeof import("abcjs").renderAbc>
      ),
      TimingCallbacks:
        FakeTimingCallbacks as unknown as typeof import("abcjs").TimingCallbacks,
    };

    const audioContext = new FakeAudioContext() as unknown as AudioContext;

    let dispose = () => {};
    const service = createRoot((nextDispose) => {
      dispose = nextDispose;
      return createRhythmService({
        db,
        abcjsModule: fakeAbcjs,
        audioContext,
        sampleBaseUrl: "",
        fetchImpl: asFetch(fetchMock),
      });
    });

    await service.loadPattern({
      genreName: "Session Test",
      tuneTypeName: "Reel",
    });

    await service.play();

    expect(fetchMock).toHaveBeenCalledTimes(EXPECTED_BODHRAN_FETCH_COUNT);
    expect(bufferSources).toHaveLength(0);
    expect(service.isPlaying()).toBe(false);
    expect(service.isReady()).toBe(false);
    expect(service.error()).toBe(
      "Failed to fetch rhythm sample: /audio/kits/bodhran/65849__bosone__bodhran-pp01.mp3"
    );

    dispose();
  });

  it("falls back to percussion sample pitches when timing events omit midi pitches", async () => {
    const db = createFallbackRhythmDb();
    const fetchMock = vi.fn();

    const bufferSources: Array<{
      buffer: AudioBuffer | null;
      connect: ReturnType<typeof vi.fn>;
      start: ReturnType<typeof vi.fn>;
    }> = [];

    class FakeAudioContext {
      state: AudioContextState = "suspended";
      currentTime = 0;
      sampleRate = 44_100;
      destination = {};
      resume = vi.fn(async () => {
        this.state = "running";
      });
      decodeAudioData = vi.fn(async () => ({
        duration: 0.25,
        length: 1,
        numberOfChannels: 1,
        sampleRate: 44_100,
      })) as unknown as typeof AudioContext.prototype.decodeAudioData;
      createBuffer = vi.fn(
        (_channels: number, length: number, sampleRate: number) => {
          const data = new Float32Array(length);
          return {
            duration: length / sampleRate,
            length,
            numberOfChannels: 1,
            sampleRate,
            getChannelData: vi.fn(() => data),
          } as unknown as AudioBuffer;
        }
      );
      createBufferSource = vi.fn(() => {
        const source = {
          buffer: null as AudioBuffer | null,
          connect: vi.fn(),
          start: vi.fn(),
        };
        bufferSources.push(source);
        return source as unknown as AudioBufferSourceNode;
      });
      createGain = vi.fn(
        () =>
          ({
            gain: { value: 1 },
            connect: vi.fn(),
          }) as unknown as GainNode
      );
      close = vi.fn(async () => {
        this.state = "closed";
      });
    }

    class FakeTimingCallbacks {
      readonly options: {
        eventCallback?: (event: {
          type: "event";
          measureStart: boolean;
          measureNumber: number;
          midiPitches?: Array<{ pitch: number }>;
          elements: Array<
            Array<{ getAttribute: (name: string) => string | null }>
          >;
        }) => void;
      };

      constructor(_visualObj: unknown, options: typeof this.options) {
        this.options = options;
      }

      start() {
        this.options.eventCallback?.({
          type: "event",
          measureStart: true,
          measureNumber: 1,
          midiPitches: [],
          elements: [[{ getAttribute: () => "abcjs-note abcjs-accent" }]],
        });
        this.options.eventCallback?.({
          type: "event",
          measureStart: false,
          measureNumber: 1,
          midiPitches: [],
          elements: [[{ getAttribute: () => "abcjs-note" }]],
        });
      }

      pause() {
        noop();
      }
      reset() {
        noop();
      }
      stop() {
        noop();
      }
      currentMillisecond() {
        return 0;
      }
    }

    const fakeAbcjs = {
      renderAbc: vi.fn(
        () => [{}] as unknown as ReturnType<typeof import("abcjs").renderAbc>
      ),
      TimingCallbacks:
        FakeTimingCallbacks as unknown as typeof import("abcjs").TimingCallbacks,
    };

    const audioContext = new FakeAudioContext() as unknown as AudioContext;

    let dispose = () => {};
    const service = createRoot((nextDispose) => {
      dispose = nextDispose;
      return createRhythmService({
        db,
        abcjsModule: fakeAbcjs,
        audioContext,
        sampleBaseUrl: "",
        fetchImpl: asFetch(fetchMock),
      });
    });

    await service.loadPattern({
      tuneTypeName: "Reel",
    });

    await service.play();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(bufferSources).toHaveLength(2);
    expect(bufferSources[0]?.start).toHaveBeenCalledTimes(1);
    expect(bufferSources[1]?.start).toHaveBeenCalledTimes(1);
    expect(service.isPlaying()).toBe(true);
    expect(service.isReady()).toBe(true);

    dispose();
  });

  it("uses abcjs pitch classes to alternate bodhran strikes when midi pitches are absent", async () => {
    const db = createSampleKitRhythmDb();
    const fetchMock = vi.fn(async (_url: string) => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(16),
    }));

    const bufferSources: Array<{
      buffer: AudioBuffer | null;
      connect: ReturnType<typeof vi.fn>;
      start: ReturnType<typeof vi.fn>;
    }> = [];
    const gainNodes: Array<{
      gain: { value: number };
      connect: ReturnType<typeof vi.fn>;
    }> = [];

    class FakeAudioContext {
      state: AudioContextState = "suspended";
      currentTime = 0;
      sampleRate = 44_100;
      destination = {};
      resume = vi.fn(async () => {
        this.state = "running";
      });
      decodeAudioData = vi.fn(async (buffer: ArrayBuffer) => {
        const bytes = buffer.byteLength;
        return {
          duration: bytes / 1000,
          length: 1,
          numberOfChannels: 1,
          sampleRate: 44_100,
        } as unknown as AudioBuffer;
      }) as unknown as typeof AudioContext.prototype.decodeAudioData;
      createBuffer = vi.fn(
        (_channels: number, length: number, sampleRate: number) => {
          const data = new Float32Array(length);
          return {
            duration: length / sampleRate,
            length,
            numberOfChannels: 1,
            sampleRate,
            getChannelData: vi.fn(() => data),
          } as unknown as AudioBuffer;
        }
      );
      createBufferSource = vi.fn(() => {
        const source = {
          buffer: null as AudioBuffer | null,
          connect: vi.fn(),
          start: vi.fn(),
        };
        bufferSources.push(source);
        return source as unknown as AudioBufferSourceNode;
      });
      createGain = vi.fn(() => {
        const gainNode = {
          gain: { value: 1 },
          connect: vi.fn(),
        };
        gainNodes.push(gainNode);
        return gainNode as unknown as GainNode;
      });
      close = vi.fn(async () => {
        this.state = "closed";
      });
    }

    class FakeTimingCallbacks {
      readonly options: {
        eventCallback?: (event: {
          type: "event";
          measureStart: boolean;
          measureNumber: number;
          midiPitches?: Array<{ pitch: number }>;
          elements: Array<
            Array<{ getAttribute: (name: string) => string | null }>
          >;
        }) => void;
      };

      constructor(_visualObj: unknown, options: typeof this.options) {
        this.options = options;
      }

      start() {
        this.options.eventCallback?.({
          type: "event",
          measureStart: true,
          measureNumber: 1,
          midiPitches: [],
          elements: [[{ getAttribute: () => "abcjs-note abcjs-p0" }]],
        });
        this.options.eventCallback?.({
          type: "event",
          measureStart: false,
          measureNumber: 1,
          midiPitches: [],
          elements: [[{ getAttribute: () => "abcjs-note abcjs-p7" }]],
        });
      }

      pause() {
        noop();
      }
      reset() {
        noop();
      }
      stop() {
        noop();
      }
      currentMillisecond() {
        return 0;
      }
    }

    const fakeAbcjs = {
      renderAbc: vi.fn(
        () => [{}] as unknown as ReturnType<typeof import("abcjs").renderAbc>
      ),
      TimingCallbacks:
        FakeTimingCallbacks as unknown as typeof import("abcjs").TimingCallbacks,
    };

    const audioContext = new FakeAudioContext() as unknown as AudioContext;

    let dispose = () => {};
    const service = createRoot((nextDispose) => {
      dispose = nextDispose;
      return createRhythmService({
        db,
        abcjsModule: fakeAbcjs,
        audioContext,
        sampleBaseUrl: "",
        fetchImpl: asFetch(fetchMock),
      });
    });

    await service.loadPattern({
      genreName: "Session Test",
      tuneTypeName: "Reel",
    });

    await service.play();

    expect(fetchMock).toHaveBeenCalledTimes(EXPECTED_BODHRAN_FETCH_COUNT);
    expect(bufferSources).toHaveLength(2);
    expect(bufferSources[0]?.buffer?.duration).toBeCloseTo(16 / 1000, 6);
    expect(bufferSources[1]?.buffer?.duration).toBeCloseTo(16 / 1000, 6);
    expect(bufferSources[0]?.buffer).not.toBe(bufferSources[1]?.buffer);
    expect(gainNodes).toHaveLength(2);
    expect(gainNodes[0]?.gain.value).toBeCloseTo(0.8, 6);
    expect(gainNodes[1]?.gain.value).toBeCloseTo(0.8, 6);

    dispose();
  });

  it("applies subtle playback-rate offsets to low and high bodhran strikes only", async () => {
    const db = createSampleKitRhythmDb();
    const fetchMock = vi.fn(async (_url: string) => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(16),
    }));

    const bufferSources: Array<{
      buffer: AudioBuffer | null;
      connect: ReturnType<typeof vi.fn>;
      start: ReturnType<typeof vi.fn>;
      playbackRate: { value: number };
    }> = [];

    class FakeAudioContext {
      state: AudioContextState = "suspended";
      currentTime = 0;
      sampleRate = 44_100;
      destination = {};
      resume = vi.fn(async () => {
        this.state = "running";
      });
      decodeAudioData = vi.fn(async (buffer: ArrayBuffer) => {
        const bytes = buffer.byteLength;
        return {
          duration: bytes / 1000,
          length: 1,
          numberOfChannels: 1,
          sampleRate: 44_100,
        } as unknown as AudioBuffer;
      }) as unknown as typeof AudioContext.prototype.decodeAudioData;
      createBuffer = vi.fn(
        (_channels: number, length: number, sampleRate: number) => {
          const data = new Float32Array(length);
          return {
            duration: length / sampleRate,
            length,
            numberOfChannels: 1,
            sampleRate,
            getChannelData: vi.fn(() => data),
          } as unknown as AudioBuffer;
        }
      );
      createBufferSource = vi.fn(() => {
        const source = {
          buffer: null as AudioBuffer | null,
          connect: vi.fn(),
          start: vi.fn(),
          playbackRate: { value: 1 },
        };
        bufferSources.push(source);
        return source as unknown as AudioBufferSourceNode;
      });
      createGain = vi.fn(
        () =>
          ({
            gain: { value: 1 },
            connect: vi.fn(),
          }) as unknown as GainNode
      );
      close = vi.fn(async () => {
        this.state = "closed";
      });
    }

    class FakeTimingCallbacks {
      readonly options: {
        eventCallback?: (event: {
          type: "event";
          measureStart: boolean;
          measureNumber: number;
          midiPitches?: Array<{ pitch: number }>;
          elements: Array<
            Array<{ getAttribute: (name: string) => string | null }>
          >;
        }) => void;
      };

      constructor(_visualObj: unknown, options: typeof this.options) {
        this.options = options;
      }

      start() {
        this.options.eventCallback?.({
          type: "event",
          measureStart: true,
          measureNumber: 1,
          midiPitches: [{ pitch: 24 }],
          elements: [[]],
        });
        this.options.eventCallback?.({
          type: "event",
          measureStart: false,
          measureNumber: 1,
          midiPitches: [{ pitch: 57 }],
          elements: [[]],
        });
        this.options.eventCallback?.({
          type: "event",
          measureStart: false,
          measureNumber: 1,
          midiPitches: [{ pitch: 91 }],
          elements: [[]],
        });
      }

      pause() {
        noop();
      }
      reset() {
        noop();
      }
      stop() {
        noop();
      }
      currentMillisecond() {
        return 0;
      }
    }

    const fakeAbcjs = {
      renderAbc: vi.fn(
        () => [{}] as unknown as ReturnType<typeof import("abcjs").renderAbc>
      ),
      TimingCallbacks:
        FakeTimingCallbacks as unknown as typeof import("abcjs").TimingCallbacks,
    };

    const audioContext = new FakeAudioContext() as unknown as AudioContext;

    let dispose = () => {};
    const service = createRoot((nextDispose) => {
      dispose = nextDispose;
      return createRhythmService({
        db,
        abcjsModule: fakeAbcjs,
        audioContext,
        sampleBaseUrl: "",
        fetchImpl: asFetch(fetchMock),
      });
    });

    await service.loadPattern({
      genreName: "Session Test",
      tuneTypeName: "Reel",
    });

    await service.play();

    expect(bufferSources).toHaveLength(3);
    expect(bufferSources[0]?.playbackRate.value).toBeLessThan(1);
    expect(bufferSources[1]?.playbackRate.value).toBeCloseTo(1, 6);
    expect(bufferSources[2]?.playbackRate.value).toBeGreaterThan(1);

    dispose();
  });

  it("routes the bodhran upper alias lane to body strikes instead of border taps", async () => {
    const db = createSampleKitRhythmDb();

    const fetchMock = vi.fn(async (url: string) => {
      const bytes = getBodhranMockByteLength(url);

      return {
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(bytes),
      };
    });

    const bufferSources: Array<{
      buffer: AudioBuffer | null;
      connect: ReturnType<typeof vi.fn>;
      start: ReturnType<typeof vi.fn>;
      playbackRate: { value: number };
    }> = [];

    class FakeAudioContext {
      state: AudioContextState = "suspended";
      currentTime = 0;
      sampleRate = 44_100;
      destination = {};
      resume = vi.fn(async () => {
        this.state = "running";
      });
      decodeAudioData = vi.fn(async (buffer: ArrayBuffer) => ({
        duration: buffer.byteLength / 1000,
        length: 1,
        numberOfChannels: 1,
        sampleRate: 44_100,
      })) as unknown as typeof AudioContext.prototype.decodeAudioData;
      createBuffer = vi.fn(
        (_channels: number, length: number, sampleRate: number) => {
          const data = new Float32Array(length);
          return {
            duration: length / sampleRate,
            length,
            numberOfChannels: 1,
            sampleRate,
            getChannelData: vi.fn(() => data),
          } as unknown as AudioBuffer;
        }
      );
      createBufferSource = vi.fn(() => {
        const source = {
          buffer: null as AudioBuffer | null,
          connect: vi.fn(),
          start: vi.fn(),
          playbackRate: { value: 1 },
        };
        bufferSources.push(source);
        return source as unknown as AudioBufferSourceNode;
      });
      createGain = vi.fn(
        () =>
          ({
            gain: { value: 1 },
            connect: vi.fn(),
          }) as unknown as GainNode
      );
      close = vi.fn(async () => {
        this.state = "closed";
      });
    }

    class FakeTimingCallbacks {
      readonly options: {
        eventCallback?: (event: {
          type: "event";
          measureStart: boolean;
          measureNumber: number;
          midiPitches?: Array<{ pitch: number }>;
          elements: Array<
            Array<{ getAttribute: (name: string) => string | null }>
          >;
        }) => void;
      };

      constructor(_visualObj: unknown, options: typeof this.options) {
        this.options = options;
      }

      start() {
        this.options.eventCallback?.({
          type: "event",
          measureStart: true,
          measureNumber: 1,
          midiPitches: [{ pitch: 92 }],
          elements: [[]],
        });
      }

      pause() {
        noop();
      }
      reset() {
        noop();
      }
      stop() {
        noop();
      }
      currentMillisecond() {
        return 0;
      }
    }

    const fakeAbcjs = {
      renderAbc: vi.fn(
        () => [{}] as unknown as ReturnType<typeof import("abcjs").renderAbc>
      ),
      TimingCallbacks:
        FakeTimingCallbacks as unknown as typeof import("abcjs").TimingCallbacks,
    };

    const audioContext = new FakeAudioContext() as unknown as AudioContext;

    let dispose = () => {};
    const service = createRoot((nextDispose) => {
      dispose = nextDispose;
      return createRhythmService({
        db,
        abcjsModule: fakeAbcjs,
        audioContext,
        sampleBaseUrl: "",
        fetchImpl: asFetch(fetchMock),
      });
    });

    await service.loadPattern({
      genreName: "Session Test",
      tuneTypeName: "Reel",
    });

    await service.play();

    expect(bufferSources).toHaveLength(1);
    expect(bufferSources[0]?.buffer?.duration).toBeCloseTo(11 / 1000, 6);
    expect(bufferSources[0]?.playbackRate.value).toBeLessThan(1);

    dispose();
  });

  it("maps bodhran abcjs low notes to body strikes instead of border taps", async () => {
    const db = createSampleKitRhythmDb();

    const fetchMock = vi.fn(async (url: string) => {
      const bytes = getBodhranMockByteLength(url);

      return {
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(bytes),
      };
    });

    const bufferSources: Array<{
      buffer: AudioBuffer | null;
      connect: ReturnType<typeof vi.fn>;
      start: ReturnType<typeof vi.fn>;
      playbackRate: { value: number };
    }> = [];

    class FakeAudioContext {
      state: AudioContextState = "suspended";
      currentTime = 0;
      sampleRate = 44_100;
      destination = {};
      resume = vi.fn(async () => {
        this.state = "running";
      });
      decodeAudioData = vi.fn(async (buffer: ArrayBuffer) => ({
        duration: buffer.byteLength / 1000,
        length: 1,
        numberOfChannels: 1,
        sampleRate: 44_100,
      })) as unknown as typeof AudioContext.prototype.decodeAudioData;
      createBuffer = vi.fn(
        (_channels: number, length: number, sampleRate: number) => {
          const data = new Float32Array(length);
          return {
            duration: length / sampleRate,
            length,
            numberOfChannels: 1,
            sampleRate,
            getChannelData: vi.fn(() => data),
          } as unknown as AudioBuffer;
        }
      );
      createBufferSource = vi.fn(() => {
        const source = {
          buffer: null as AudioBuffer | null,
          connect: vi.fn(),
          start: vi.fn(),
          playbackRate: { value: 1 },
        };
        bufferSources.push(source);
        return source as unknown as AudioBufferSourceNode;
      });
      createGain = vi.fn(
        () =>
          ({
            gain: { value: 1 },
            connect: vi.fn(),
          }) as unknown as GainNode
      );
      close = vi.fn(async () => {
        this.state = "closed";
      });
    }

    class FakeTimingCallbacks {
      readonly options: {
        eventCallback?: (event: {
          type: "event";
          measureStart: boolean;
          measureNumber: number;
          midiPitches?: Array<{ pitch: number }>;
          elements: Array<
            Array<{ getAttribute: (name: string) => string | null }>
          >;
        }) => void;
      };

      constructor(_visualObj: unknown, options: typeof this.options) {
        this.options = options;
      }

      start() {
        this.options.eventCallback?.({
          type: "event",
          measureStart: true,
          measureNumber: 1,
          midiPitches: [{ pitch: 72 }],
          elements: [[]],
        });
        this.options.eventCallback?.({
          type: "event",
          measureStart: false,
          measureNumber: 1,
          midiPitches: [{ pitch: 69 }],
          elements: [[]],
        });
      }

      pause() {
        noop();
      }
      reset() {
        noop();
      }
      stop() {
        noop();
      }
      currentMillisecond() {
        return 0;
      }
    }

    const fakeAbcjs = {
      renderAbc: vi.fn(
        () => [{}] as unknown as ReturnType<typeof import("abcjs").renderAbc>
      ),
      TimingCallbacks:
        FakeTimingCallbacks as unknown as typeof import("abcjs").TimingCallbacks,
    };

    const audioContext = new FakeAudioContext() as unknown as AudioContext;

    let dispose = () => {};
    const service = createRoot((nextDispose) => {
      dispose = nextDispose;
      return createRhythmService({
        db,
        abcjsModule: fakeAbcjs,
        audioContext,
        sampleBaseUrl: "",
        fetchImpl: asFetch(fetchMock),
      });
    });

    await service.loadPattern({
      genreName: "Session Test",
      tuneTypeName: "Reel",
    });

    await service.play();

    expect(bufferSources).toHaveLength(2);
    expect(bufferSources[0]?.buffer).not.toBe(bufferSources[1]?.buffer);
    expect(bufferSources[0]?.buffer?.duration ?? 0).toBeGreaterThan(10 / 1000);
    expect(bufferSources[0]?.buffer?.duration ?? 0).toBeLessThan(18 / 1000);
    expect(bufferSources[1]?.buffer?.duration ?? 0).toBeGreaterThan(10 / 1000);
    expect(bufferSources[1]?.buffer?.duration ?? 0).toBeLessThan(18 / 1000);
    expect(bufferSources[0]?.playbackRate.value).toBeLessThan(1);
    expect(bufferSources[1]?.playbackRate.value).toBeLessThan(1);

    dispose();
  });

  it("maps the live jig bodhran template pitch classes onto body strikes", async () => {
    const db = createSampleKitRhythmDb();

    const fetchMock = vi.fn(async (url: string) => {
      const bytes = getBodhranMockByteLength(url);

      return {
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(bytes),
      };
    });

    const bufferSources: Array<{
      buffer: AudioBuffer | null;
      connect: ReturnType<typeof vi.fn>;
      start: ReturnType<typeof vi.fn>;
      playbackRate: { value: number };
    }> = [];

    class FakeAudioContext {
      state: AudioContextState = "suspended";
      currentTime = 0;
      sampleRate = 44_100;
      destination = {};
      resume = vi.fn(async () => {
        this.state = "running";
      });
      decodeAudioData = vi.fn(async (buffer: ArrayBuffer) => ({
        duration: buffer.byteLength / 1000,
        length: 1,
        numberOfChannels: 1,
        sampleRate: 44_100,
      })) as unknown as typeof AudioContext.prototype.decodeAudioData;
      createBuffer = vi.fn(
        (_channels: number, length: number, sampleRate: number) => {
          const data = new Float32Array(length);
          return {
            duration: length / sampleRate,
            length,
            numberOfChannels: 1,
            sampleRate,
            getChannelData: vi.fn(() => data),
          } as unknown as AudioBuffer;
        }
      );
      createBufferSource = vi.fn(() => {
        const source = {
          buffer: null as AudioBuffer | null,
          connect: vi.fn(),
          start: vi.fn(),
          playbackRate: { value: 1 },
        };
        bufferSources.push(source);
        return source as unknown as AudioBufferSourceNode;
      });
      createGain = vi.fn(
        () =>
          ({
            gain: { value: 1 },
            connect: vi.fn(),
          }) as unknown as GainNode
      );
      close = vi.fn(async () => {
        this.state = "closed";
      });
    }

    class FakeTimingCallbacks {
      readonly options: {
        eventCallback?: (event: {
          type: "event";
          measureStart: boolean;
          measureNumber: number;
          midiPitches?: Array<{ pitch: number }>;
          elements: Array<
            Array<{ getAttribute: (name: string) => string | null }>
          >;
        }) => void;
      };

      constructor(_visualObj: unknown, options: typeof this.options) {
        this.options = options;
      }

      start() {
        this.options.eventCallback?.({
          type: "event",
          measureStart: true,
          measureNumber: 1,
          midiPitches: [],
          elements: [
            [
              {
                getAttribute: () => "abcjs-note abcjs-p-4 abcjs-p-6 abcjs-p-7",
              },
            ],
          ],
        });
      }

      pause() {
        noop();
      }
      reset() {
        noop();
      }
      stop() {
        noop();
      }
      currentMillisecond() {
        return 0;
      }
    }

    const fakeAbcjs = {
      renderAbc: vi.fn(
        () => [{}] as unknown as ReturnType<typeof import("abcjs").renderAbc>
      ),
      TimingCallbacks:
        FakeTimingCallbacks as unknown as typeof import("abcjs").TimingCallbacks,
    };

    const audioContext = new FakeAudioContext() as unknown as AudioContext;

    let dispose = () => {};
    const service = createRoot((nextDispose) => {
      dispose = nextDispose;
      return createRhythmService({
        db,
        abcjsModule: fakeAbcjs,
        audioContext,
        sampleBaseUrl: "",
        fetchImpl: asFetch(fetchMock),
      });
    });

    await service.loadPattern({
      genreName: "Session Test",
      tuneTypeName: "Jig",
    });

    await service.play();

    expect(bufferSources).toHaveLength(3);
    expect(bufferSources[0]?.buffer?.duration ?? 0).toBeGreaterThan(10 / 1000);
    expect(bufferSources[0]?.buffer?.duration ?? 0).toBeLessThan(18 / 1000);
    expect(bufferSources[1]?.buffer?.duration ?? 0).toBeGreaterThan(10 / 1000);
    expect(bufferSources[1]?.buffer?.duration ?? 0).toBeLessThan(18 / 1000);
    expect(bufferSources[2]?.buffer?.duration ?? 0).toBeGreaterThan(10 / 1000);
    expect(bufferSources[2]?.buffer?.duration ?? 0).toBeLessThan(18 / 1000);
    expect(bufferSources[0]?.playbackRate.value).toBeLessThan(1);
    expect(bufferSources[1]?.playbackRate.value).toBeLessThan(1);
    expect(bufferSources[2]?.playbackRate.value).toBeLessThan(1);

    dispose();
  });

  it("keeps abcjs rest events silent during playback", async () => {
    const db = createFallbackRhythmDb();
    const fetchMock = vi.fn();

    const bufferSources: Array<{
      buffer: AudioBuffer | null;
      connect: ReturnType<typeof vi.fn>;
      start: ReturnType<typeof vi.fn>;
    }> = [];

    class FakeAudioContext {
      state: AudioContextState = "suspended";
      currentTime = 0;
      sampleRate = 44_100;
      destination = {};
      resume = vi.fn(async () => {
        this.state = "running";
      });
      decodeAudioData = vi.fn(async () => ({
        duration: 0.25,
        length: 1,
        numberOfChannels: 1,
        sampleRate: 44_100,
      })) as unknown as typeof AudioContext.prototype.decodeAudioData;
      createBuffer = vi.fn(
        (_channels: number, length: number, sampleRate: number) => {
          const data = new Float32Array(length);
          return {
            duration: length / sampleRate,
            length,
            numberOfChannels: 1,
            sampleRate,
            getChannelData: vi.fn(() => data),
          } as unknown as AudioBuffer;
        }
      );
      createBufferSource = vi.fn(() => {
        const source = {
          buffer: null as AudioBuffer | null,
          connect: vi.fn(),
          start: vi.fn(),
        };
        bufferSources.push(source);
        return source as unknown as AudioBufferSourceNode;
      });
      createGain = vi.fn(
        () =>
          ({
            gain: { value: 1 },
            connect: vi.fn(),
          }) as unknown as GainNode
      );
      close = vi.fn(async () => {
        this.state = "closed";
      });
    }

    class FakeTimingCallbacks {
      readonly options: {
        eventCallback?: (event: {
          type: "event";
          measureStart: boolean;
          measureNumber: number;
          midiPitches?: Array<{ pitch: number }>;
          elements: Array<
            Array<{ getAttribute: (name: string) => string | null }>
          >;
        }) => void;
      };

      constructor(_visualObj: unknown, options: typeof this.options) {
        this.options = options;
      }

      start() {
        this.options.eventCallback?.({
          type: "event",
          measureStart: true,
          measureNumber: 1,
          midiPitches: [],
          elements: [[{ getAttribute: () => "abcjs-rest" }]],
        });
        this.options.eventCallback?.({
          type: "event",
          measureStart: false,
          measureNumber: 1,
          midiPitches: [{ pitch: 60 }],
          elements: [[]],
        });
      }

      pause() {
        noop();
      }
      reset() {
        noop();
      }
      stop() {
        noop();
      }
      currentMillisecond() {
        return 0;
      }
    }

    const fakeAbcjs = {
      renderAbc: vi.fn(
        () => [{}] as unknown as ReturnType<typeof import("abcjs").renderAbc>
      ),
      TimingCallbacks:
        FakeTimingCallbacks as unknown as typeof import("abcjs").TimingCallbacks,
    };

    const audioContext = new FakeAudioContext() as unknown as AudioContext;

    let dispose = () => {};
    const service = createRoot((nextDispose) => {
      dispose = nextDispose;
      return createRhythmService({
        db,
        abcjsModule: fakeAbcjs,
        audioContext,
        sampleBaseUrl: "",
        fetchImpl: asFetch(fetchMock),
      });
    });

    await service.loadPattern({
      tuneTypeName: "Reel",
    });

    await service.play();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(bufferSources).toHaveLength(1);
    expect(bufferSources[0]?.start).toHaveBeenCalledTimes(1);

    dispose();
  });

  it("honors the selected generic click kit instead of forcing bodhran samples", async () => {
    const db = createHierarchicalRhythmDb({
      includeGlobalTuneOverride: false,
      includeUserTuneOverride: false,
      includeUserDefault: true,
    });
    const fetchMock = vi.fn();

    const bufferSources: Array<{
      buffer: AudioBuffer | null;
      connect: ReturnType<typeof vi.fn>;
      start: ReturnType<typeof vi.fn>;
    }> = [];

    class FakeAudioContext {
      state: AudioContextState = "suspended";
      currentTime = 0;
      sampleRate = 44_100;
      destination = {};
      resume = vi.fn(async () => {
        this.state = "running";
      });
      decodeAudioData = vi.fn(async () => {
        throw new Error("generic click playback should not fetch files");
      }) as unknown as typeof AudioContext.prototype.decodeAudioData;
      createBuffer = vi.fn(
        (_channels: number, length: number, sampleRate: number) => {
          const data = new Float32Array(length);
          return {
            duration: length / sampleRate,
            length,
            numberOfChannels: 1,
            sampleRate,
            getChannelData: vi.fn(() => data),
          } as unknown as AudioBuffer;
        }
      );
      createBufferSource = vi.fn(() => {
        const source = {
          buffer: null as AudioBuffer | null,
          connect: vi.fn(),
          start: vi.fn(),
        };
        bufferSources.push(source);
        return source as unknown as AudioBufferSourceNode;
      });
      createGain = vi.fn(
        () =>
          ({
            gain: { value: 1 },
            connect: vi.fn(),
          }) as unknown as GainNode
      );
      close = vi.fn(async () => {
        this.state = "closed";
      });
    }

    class FakeTimingCallbacks {
      readonly options: {
        eventCallback?: (event: {
          type: "event";
          measureStart: boolean;
          measureNumber: number;
          midiPitches?: Array<{ pitch: number }>;
          elements: Array<
            Array<{ getAttribute: (name: string) => string | null }>
          >;
        }) => void;
      };

      constructor(_visualObj: unknown, options: typeof this.options) {
        this.options = options;
      }

      start() {
        this.options.eventCallback?.({
          type: "event",
          measureStart: true,
          measureNumber: 1,
          midiPitches: [{ pitch: 60 }],
          elements: [[]],
        });
        this.options.eventCallback?.({
          type: "event",
          measureStart: false,
          measureNumber: 1,
          midiPitches: [{ pitch: 69 }],
          elements: [[]],
        });
      }

      pause() {
        noop();
      }
      reset() {
        noop();
      }
      stop() {
        noop();
      }
      currentMillisecond() {
        return 0;
      }
    }

    const fakeAbcjs = {
      renderAbc: vi.fn(
        () => [{}] as unknown as ReturnType<typeof import("abcjs").renderAbc>
      ),
      TimingCallbacks:
        FakeTimingCallbacks as unknown as typeof import("abcjs").TimingCallbacks,
    };

    const audioContext = new FakeAudioContext() as unknown as AudioContext;

    let dispose = () => {};
    const service = createRoot((nextDispose) => {
      dispose = nextDispose;
      return createRhythmService({
        db,
        abcjsModule: fakeAbcjs,
        audioContext,
        sampleBaseUrl: "",
        fetchImpl: asFetch(fetchMock),
      });
    });

    await service.loadPattern({
      genreName: "Irish Traditional",
      tuneTypeName: "Reel",
      userId: "user-1",
    });

    await service.play();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(bufferSources).toHaveLength(2);
    expect(bufferSources[0]?.buffer).not.toBeNull();
    expect(bufferSources[1]?.buffer).not.toBeNull();

    dispose();
  });

  it("maps varied abcjs element pitches onto distinct bodhran samples when midi pitches are absent", async () => {
    const db = createSampleKitRhythmDb();
    const fetchMock = vi.fn(async (_url: string) => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(16),
    }));

    const bufferSources: Array<{
      buffer: AudioBuffer | null;
      connect: ReturnType<typeof vi.fn>;
      start: ReturnType<typeof vi.fn>;
    }> = [];

    class FakeAudioContext {
      state: AudioContextState = "suspended";
      currentTime = 0;
      sampleRate = 44_100;
      destination = {};
      resume = vi.fn(async () => {
        this.state = "running";
      });
      decodeAudioData = vi.fn(async (buffer: ArrayBuffer) => {
        const bytes = buffer.byteLength;
        return {
          duration: bytes / 1000,
          length: 1,
          numberOfChannels: 1,
          sampleRate: 44_100,
        } as unknown as AudioBuffer;
      }) as unknown as typeof AudioContext.prototype.decodeAudioData;
      createBuffer = vi.fn(
        (_channels: number, length: number, sampleRate: number) => {
          const data = new Float32Array(length);
          return {
            duration: length / sampleRate,
            length,
            numberOfChannels: 1,
            sampleRate,
            getChannelData: vi.fn(() => data),
          } as unknown as AudioBuffer;
        }
      );
      createBufferSource = vi.fn(() => {
        const source = {
          buffer: null as AudioBuffer | null,
          connect: vi.fn(),
          start: vi.fn(),
        };
        bufferSources.push(source);
        return source as unknown as AudioBufferSourceNode;
      });
      createGain = vi.fn(
        () =>
          ({
            gain: { value: 1 },
            connect: vi.fn(),
          }) as unknown as GainNode
      );
      close = vi.fn(async () => {
        this.state = "closed";
      });
    }

    class FakeTimingCallbacks {
      readonly options: {
        eventCallback?: (event: {
          type: "event";
          measureStart: boolean;
          measureNumber: number;
          midiPitches?: Array<{ pitch: number }>;
          elements: Array<
            Array<{ getAttribute: (name: string) => string | null }>
          >;
        }) => void;
      };

      constructor(_visualObj: unknown, options: typeof this.options) {
        this.options = options;
      }

      start() {
        this.options.eventCallback?.({
          type: "event",
          measureStart: true,
          measureNumber: 1,
          midiPitches: [],
          elements: [[{ getAttribute: () => "abcjs-note abcjs-p-4 abcjs-p0" }]],
        });
        this.options.eventCallback?.({
          type: "event",
          measureStart: false,
          measureNumber: 1,
          midiPitches: [],
          elements: [[{ getAttribute: () => "abcjs-note abcjs-p7 abcjs-p12" }]],
        });
      }

      pause() {
        noop();
      }
      reset() {
        noop();
      }
      stop() {
        noop();
      }
      currentMillisecond() {
        return 0;
      }
    }

    const fakeAbcjs = {
      renderAbc: vi.fn(
        () => [{}] as unknown as ReturnType<typeof import("abcjs").renderAbc>
      ),
      TimingCallbacks:
        FakeTimingCallbacks as unknown as typeof import("abcjs").TimingCallbacks,
    };

    const audioContext = new FakeAudioContext() as unknown as AudioContext;

    let dispose = () => {};
    const service = createRoot((nextDispose) => {
      dispose = nextDispose;
      return createRhythmService({
        db,
        abcjsModule: fakeAbcjs,
        audioContext,
        sampleBaseUrl: "",
        fetchImpl: asFetch(fetchMock),
      });
    });

    await service.loadPattern({
      genreName: "Session Test",
      tuneTypeName: "Reel",
    });

    await service.play();

    expect(bufferSources).toHaveLength(4);
    const distinctBuffers = new Set(
      bufferSources.map((source) => source.buffer)
    );
    expect(distinctBuffers.size).toBeGreaterThan(2);

    dispose();
  });

  it("logs playback pitch resolution for one pass when debug playback logging is enabled", async () => {
    const db = createSampleKitRhythmDb();
    const fetchMock = vi.fn(async (_url: string) => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(16),
    }));
    const consoleInfoSpy = vi
      .spyOn(console, "info")
      .mockImplementation(() => undefined);

    class FakeAudioContext {
      state: AudioContextState = "suspended";
      currentTime = 0;
      sampleRate = 44_100;
      destination = {};
      resume = vi.fn(async () => {
        this.state = "running";
      });
      decodeAudioData = vi.fn(async () => ({
        duration: 0.25,
        length: 1,
        numberOfChannels: 1,
        sampleRate: 44_100,
      })) as unknown as typeof AudioContext.prototype.decodeAudioData;
      createBuffer = vi.fn(
        (_channels: number, length: number, sampleRate: number) => {
          const data = new Float32Array(length);
          return {
            duration: length / sampleRate,
            length,
            numberOfChannels: 1,
            sampleRate,
            getChannelData: vi.fn(() => data),
          } as unknown as AudioBuffer;
        }
      );
      createBufferSource = vi.fn(
        () =>
          ({
            buffer: null,
            connect: vi.fn(),
            start: vi.fn(),
          }) as unknown as AudioBufferSourceNode
      );
      createGain = vi.fn(
        () =>
          ({
            gain: { value: 1 },
            connect: vi.fn(),
          }) as unknown as GainNode
      );
      close = vi.fn(async () => {
        this.state = "closed";
      });
    }

    class FakeTimingCallbacks {
      readonly options: {
        eventCallback?: (
          event: {
            type: "event";
            measureStart: boolean;
            measureNumber: number;
            midiPitches?: Array<{ pitch: number }>;
            elements: Array<
              Array<{ getAttribute: (name: string) => string | null }>
            >;
          } | null
        ) => "continue" | Promise<"continue"> | undefined;
      };

      constructor(_visualObj: unknown, options: typeof this.options) {
        this.options = options;
      }

      start() {
        this.options.eventCallback?.({
          type: "event",
          measureStart: true,
          measureNumber: 1,
          midiPitches: [{ pitch: 60 }, { pitch: 72 }],
          elements: [[{ getAttribute: () => "abcjs-note abcjs-p0 abcjs-p7" }]],
        });
      }

      pause() {
        noop();
      }
      reset() {
        noop();
      }
      stop() {
        noop();
      }
      currentMillisecond() {
        return 0;
      }
    }

    const fakeAbcjs = {
      renderAbc: vi.fn(
        () => [{}] as unknown as ReturnType<typeof import("abcjs").renderAbc>
      ),
      TimingCallbacks:
        FakeTimingCallbacks as unknown as typeof import("abcjs").TimingCallbacks,
    };

    const audioContext = new FakeAudioContext() as unknown as AudioContext;

    let dispose = () => {};
    const service = createRoot((nextDispose) => {
      dispose = nextDispose;
      return createRhythmService({
        db,
        abcjsModule: fakeAbcjs,
        audioContext,
        sampleBaseUrl: "",
        fetchImpl: asFetch(fetchMock),
      });
    });

    await service.loadPattern({
      genreName: "Session Test",
      tuneTypeName: "Reel",
    });

    (
      globalThis as typeof globalThis & {
        __TT_DEBUG_RHYTHM_PLAYBACK__?: boolean;
      }
    ).__TT_DEBUG_RHYTHM_PLAYBACK__ = true;

    await service.play();

    expect(consoleInfoSpy).toHaveBeenCalledWith(
      "[RhythmService] playback event",
      expect.objectContaining({
        midiPitches: [60, 72],
        playbackSource: "midi",
        resolvedPitches: [60, 43],
      })
    );

    delete (
      globalThis as typeof globalThis & {
        __TT_DEBUG_RHYTHM_PLAYBACK__?: boolean;
      }
    ).__TT_DEBUG_RHYTHM_PLAYBACK__;
    consoleInfoSpy.mockRestore();
    dispose();
  });

  it("plays both bodhran pitches when abcjs elements include low and high note classes", async () => {
    const db = createSampleKitRhythmDb();
    const fetchMock = vi.fn(async (_url: string) => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(16),
    }));

    const bufferSources: Array<{
      buffer: AudioBuffer | null;
      connect: ReturnType<typeof vi.fn>;
      start: ReturnType<typeof vi.fn>;
    }> = [];

    class FakeAudioContext {
      state: AudioContextState = "suspended";
      currentTime = 0;
      sampleRate = 44_100;
      destination = {};
      resume = vi.fn(async () => {
        this.state = "running";
      });
      decodeAudioData = vi.fn(async (buffer: ArrayBuffer) => {
        const bytes = buffer.byteLength;
        return {
          duration: bytes / 1000,
          length: 1,
          numberOfChannels: 1,
          sampleRate: 44_100,
        } as unknown as AudioBuffer;
      }) as unknown as typeof AudioContext.prototype.decodeAudioData;
      createBuffer = vi.fn(
        (_channels: number, length: number, sampleRate: number) => {
          const data = new Float32Array(length);
          return {
            duration: length / sampleRate,
            length,
            numberOfChannels: 1,
            sampleRate,
            getChannelData: vi.fn(() => data),
          } as unknown as AudioBuffer;
        }
      );
      createBufferSource = vi.fn(() => {
        const source = {
          buffer: null as AudioBuffer | null,
          connect: vi.fn(),
          start: vi.fn(),
        };
        bufferSources.push(source);
        return source as unknown as AudioBufferSourceNode;
      });
      createGain = vi.fn(
        () =>
          ({
            gain: { value: 1 },
            connect: vi.fn(),
          }) as unknown as GainNode
      );
      close = vi.fn(async () => {
        this.state = "closed";
      });
    }

    class FakeTimingCallbacks {
      readonly options: {
        eventCallback?: (event: {
          type: "event";
          measureStart: boolean;
          measureNumber: number;
          midiPitches?: Array<{ pitch: number }>;
          elements: Array<
            Array<{ getAttribute: (name: string) => string | null }>
          >;
        }) => void;
      };

      constructor(_visualObj: unknown, options: typeof this.options) {
        this.options = options;
      }

      start() {
        this.options.eventCallback?.({
          type: "event",
          measureStart: true,
          measureNumber: 1,
          midiPitches: [],
          elements: [
            [
              {
                getAttribute: () => "abcjs-note abcjs-p0 abcjs-p7",
              },
            ],
          ],
        });
      }

      pause() {
        noop();
      }
      reset() {
        noop();
      }
      stop() {
        noop();
      }
      currentMillisecond() {
        return 0;
      }
    }

    const fakeAbcjs = {
      renderAbc: vi.fn(
        () => [{}] as unknown as ReturnType<typeof import("abcjs").renderAbc>
      ),
      TimingCallbacks:
        FakeTimingCallbacks as unknown as typeof import("abcjs").TimingCallbacks,
    };

    const audioContext = new FakeAudioContext() as unknown as AudioContext;

    let dispose = () => {};
    const service = createRoot((nextDispose) => {
      dispose = nextDispose;
      return createRhythmService({
        db,
        abcjsModule: fakeAbcjs,
        audioContext,
        sampleBaseUrl: "",
        fetchImpl: asFetch(fetchMock),
      });
    });

    await service.loadPattern({
      genreName: "Session Test",
      tuneTypeName: "Reel",
    });

    await service.play();

    expect(fetchMock).toHaveBeenCalledTimes(EXPECTED_BODHRAN_FETCH_COUNT);
    expect(bufferSources).toHaveLength(2);
    expect(bufferSources[0]?.buffer).not.toBe(bufferSources[1]?.buffer);

    dispose();
  });

  it("delays hornpipe off-beat eighth notes to add swing during playback", async () => {
    const db = createFallbackHornpipeRhythmDb();
    const fetchMock = vi.fn();

    const bufferSources: Array<{
      buffer: AudioBuffer | null;
      connect: ReturnType<typeof vi.fn>;
      start: ReturnType<typeof vi.fn>;
    }> = [];

    class FakeAudioContext {
      state: AudioContextState = "suspended";
      currentTime = 10;
      sampleRate = 44_100;
      destination = {};
      resume = vi.fn(async () => {
        this.state = "running";
      });
      decodeAudioData = vi.fn(async () => ({
        duration: 0.25,
        length: 1,
        numberOfChannels: 1,
        sampleRate: 44_100,
      })) as unknown as typeof AudioContext.prototype.decodeAudioData;
      createBuffer = vi.fn(
        (_channels: number, length: number, sampleRate: number) => {
          const data = new Float32Array(length);
          return {
            duration: length / sampleRate,
            length,
            numberOfChannels: 1,
            sampleRate,
            getChannelData: vi.fn(() => data),
          } as unknown as AudioBuffer;
        }
      );
      createBufferSource = vi.fn(() => {
        const source = {
          buffer: null as AudioBuffer | null,
          connect: vi.fn(),
          start: vi.fn(),
        };
        bufferSources.push(source);
        return source as unknown as AudioBufferSourceNode;
      });
      createGain = vi.fn(
        () =>
          ({
            gain: { value: 1 },
            connect: vi.fn(),
          }) as unknown as GainNode
      );
      close = vi.fn(async () => {
        this.state = "closed";
      });
    }

    class FakeTimingCallbacks {
      readonly options: {
        eventCallback?: (event: {
          type: "event";
          measureStart: boolean;
          measureNumber: number;
          milliseconds: number;
          millisecondsPerMeasure: number;
          midiPitches: Array<{ pitch: number }>;
          elements: HTMLElement[][];
        }) => void;
      };

      constructor(_visualObj: unknown, options: typeof this.options) {
        this.options = options;
      }

      start() {
        this.options.eventCallback?.({
          type: "event",
          measureStart: true,
          measureNumber: 1,
          milliseconds: 0,
          millisecondsPerMeasure: 2000,
          midiPitches: [{ pitch: 60 }],
          elements: [[]],
        });
        this.options.eventCallback?.({
          type: "event",
          measureStart: false,
          measureNumber: 1,
          milliseconds: 250,
          millisecondsPerMeasure: 2000,
          midiPitches: [{ pitch: 69 }],
          elements: [[]],
        });
      }

      pause() {
        noop();
      }
      reset() {
        noop();
      }
      stop() {
        noop();
      }
      currentMillisecond() {
        return 0;
      }
    }

    const fakeAbcjs = {
      renderAbc: vi.fn(
        () => [{}] as unknown as ReturnType<typeof import("abcjs").renderAbc>
      ),
      TimingCallbacks:
        FakeTimingCallbacks as unknown as typeof import("abcjs").TimingCallbacks,
    };

    const audioContext = new FakeAudioContext() as unknown as AudioContext;

    let dispose = () => {};
    const service = createRoot((nextDispose) => {
      dispose = nextDispose;
      return createRhythmService({
        db,
        abcjsModule: fakeAbcjs,
        audioContext,
        sampleBaseUrl: "",
        fetchImpl: asFetch(fetchMock),
      });
    });

    await service.loadPattern({
      genreName: "Irish Traditional",
      tuneTypeName: "Hornpipe",
    });

    await service.setSwingPercentage(1 / 3);

    await service.play();

    expect(bufferSources).toHaveLength(2);
    expect(bufferSources[0]?.start).toHaveBeenCalledWith();
    expect(bufferSources[1]?.start).toHaveBeenCalledWith(
      expect.closeTo(10 + 0.25 / 3, 5)
    );

    dispose();
  });

  it("delays the second and third eighths in each jig triplet group during playback", async () => {
    const db = createFallbackJigRhythmDb();
    const fetchMock = vi.fn();

    const bufferSources: Array<{
      buffer: AudioBuffer | null;
      connect: ReturnType<typeof vi.fn>;
      start: ReturnType<typeof vi.fn>;
    }> = [];

    class FakeAudioContext {
      state: AudioContextState = "suspended";
      currentTime = 20;
      sampleRate = 44_100;
      destination = {};
      resume = vi.fn(async () => {
        this.state = "running";
      });
      decodeAudioData = vi.fn(async () => ({
        duration: 0.25,
        length: 1,
        numberOfChannels: 1,
        sampleRate: 44_100,
      })) as unknown as typeof AudioContext.prototype.decodeAudioData;
      createBuffer = vi.fn(
        (_channels: number, length: number, sampleRate: number) => {
          const data = new Float32Array(length);
          return {
            duration: length / sampleRate,
            length,
            numberOfChannels: 1,
            sampleRate,
            getChannelData: vi.fn(() => data),
          } as unknown as AudioBuffer;
        }
      );
      createBufferSource = vi.fn(() => {
        const source = {
          buffer: null as AudioBuffer | null,
          connect: vi.fn(),
          start: vi.fn(),
        };
        bufferSources.push(source);
        return source as unknown as AudioBufferSourceNode;
      });
      createGain = vi.fn(
        () =>
          ({
            gain: { value: 1 },
            connect: vi.fn(),
          }) as unknown as GainNode
      );
      close = vi.fn(async () => {
        this.state = "closed";
      });
    }

    class FakeTimingCallbacks {
      readonly options: {
        eventCallback?: (event: {
          type: "event";
          measureStart: boolean;
          measureNumber: number;
          milliseconds: number;
          millisecondsPerMeasure: number;
          midiPitches: Array<{ pitch: number }>;
          elements: HTMLElement[][];
        }) => void;
      };

      constructor(_visualObj: unknown, options: typeof this.options) {
        this.options = options;
      }

      start() {
        this.options.eventCallback?.({
          type: "event",
          measureStart: true,
          measureNumber: 1,
          milliseconds: 0,
          millisecondsPerMeasure: 600,
          midiPitches: [{ pitch: 60 }],
          elements: [[]],
        });
        this.options.eventCallback?.({
          type: "event",
          measureStart: false,
          measureNumber: 1,
          milliseconds: 100,
          millisecondsPerMeasure: 600,
          midiPitches: [{ pitch: 69 }],
          elements: [[]],
        });
        this.options.eventCallback?.({
          type: "event",
          measureStart: false,
          measureNumber: 1,
          milliseconds: 200,
          millisecondsPerMeasure: 600,
          midiPitches: [{ pitch: 60 }],
          elements: [[]],
        });
        this.options.eventCallback?.({
          type: "event",
          measureStart: false,
          measureNumber: 1,
          milliseconds: 300,
          millisecondsPerMeasure: 600,
          midiPitches: [{ pitch: 60 }],
          elements: [[]],
        });
        this.options.eventCallback?.({
          type: "event",
          measureStart: false,
          measureNumber: 1,
          milliseconds: 400,
          millisecondsPerMeasure: 600,
          midiPitches: [{ pitch: 69 }],
          elements: [[]],
        });
        this.options.eventCallback?.({
          type: "event",
          measureStart: false,
          measureNumber: 1,
          milliseconds: 500,
          millisecondsPerMeasure: 600,
          midiPitches: [{ pitch: 60 }],
          elements: [[]],
        });
      }

      pause() {
        noop();
      }
      reset() {
        noop();
      }
      stop() {
        noop();
      }
      currentMillisecond() {
        return 0;
      }
    }

    const fakeAbcjs = {
      renderAbc: vi.fn(
        () => [{}] as unknown as ReturnType<typeof import("abcjs").renderAbc>
      ),
      TimingCallbacks:
        FakeTimingCallbacks as unknown as typeof import("abcjs").TimingCallbacks,
    };

    const audioContext = new FakeAudioContext() as unknown as AudioContext;

    let dispose = () => {};
    const service = createRoot((nextDispose) => {
      dispose = nextDispose;
      return createRhythmService({
        db,
        abcjsModule: fakeAbcjs,
        audioContext,
        sampleBaseUrl: "",
        fetchImpl: asFetch(fetchMock),
      });
    });

    await service.loadPattern({
      genreName: "Irish Traditional",
      tuneTypeName: "Jig",
    });

    await service.setSwingPercentage(1 / 6);

    await service.play();

    expect(bufferSources).toHaveLength(6);
    expect(bufferSources[0]?.start).toHaveBeenCalledWith();
    expect(bufferSources[1]?.start).toHaveBeenCalledWith(
      expect.closeTo(20 + 0.1 / 6, 5)
    );
    expect(bufferSources[2]?.start).toHaveBeenCalledWith(
      expect.closeTo(20 + 0.1 / 12, 5)
    );
    expect(bufferSources[3]?.start).toHaveBeenCalledWith();
    expect(bufferSources[4]?.start).toHaveBeenCalledWith(
      expect.closeTo(20 + 0.1 / 6, 5)
    );
    expect(bufferSources[5]?.start).toHaveBeenCalledWith(
      expect.closeTo(20 + 0.1 / 12, 5)
    );

    dispose();
  });

  it("plays seed jig samples for each note event in the expanded sample pattern", async () => {
    const db = createFallbackJigRhythmDb();
    const fetchMock = vi.fn();

    const bufferSources: Array<{
      buffer: AudioBuffer | null;
      connect: ReturnType<typeof vi.fn>;
      start: ReturnType<typeof vi.fn>;
    }> = [];

    class FakeAudioContext {
      state: AudioContextState = "suspended";
      currentTime = 0;
      sampleRate = 44_100;
      destination = {};
      resume = vi.fn(async () => {
        this.state = "running";
      });
      decodeAudioData = vi.fn(async () => ({
        duration: 0.25,
        length: 1,
        numberOfChannels: 1,
        sampleRate: 44_100,
      })) as unknown as typeof AudioContext.prototype.decodeAudioData;
      createBuffer = vi.fn(
        (_channels: number, length: number, sampleRate: number) => {
          const data = new Float32Array(length);
          return {
            duration: length / sampleRate,
            length,
            numberOfChannels: 1,
            sampleRate,
            getChannelData: vi.fn(() => data),
          } as unknown as AudioBuffer;
        }
      );
      createBufferSource = vi.fn(() => {
        const source = {
          buffer: null as AudioBuffer | null,
          connect: vi.fn(),
          start: vi.fn(),
        };
        bufferSources.push(source);
        return source as unknown as AudioBufferSourceNode;
      });
      createGain = vi.fn(
        () =>
          ({
            gain: { value: 1 },
            connect: vi.fn(),
          }) as unknown as GainNode
      );
      close = vi.fn(async () => {
        this.state = "closed";
      });
    }

    class FakeTimingCallbacks {
      readonly options: {
        eventCallback?: (event: {
          type: "event";
          measureStart: boolean;
          measureNumber: number;
          milliseconds: number;
          millisecondsPerMeasure: number;
          midiPitches: Array<{ pitch: number }>;
          elements: HTMLElement[][];
        }) => void;
      };

      constructor(_visualObj: unknown, options: typeof this.options) {
        this.options = options;
      }

      start() {
        this.options.eventCallback?.({
          type: "event",
          measureStart: true,
          measureNumber: 1,
          milliseconds: 0,
          millisecondsPerMeasure: 600,
          midiPitches: [{ pitch: 60 }],
          elements: [[]],
        });
        this.options.eventCallback?.({
          type: "event",
          measureStart: false,
          measureNumber: 1,
          milliseconds: 100,
          millisecondsPerMeasure: 600,
          midiPitches: [{ pitch: 60 }],
          elements: [[]],
        });
        this.options.eventCallback?.({
          type: "event",
          measureStart: false,
          measureNumber: 1,
          milliseconds: 200,
          millisecondsPerMeasure: 600,
          midiPitches: [{ pitch: 60 }],
          elements: [[]],
        });
        this.options.eventCallback?.({
          type: "event",
          measureStart: false,
          measureNumber: 1,
          milliseconds: 300,
          millisecondsPerMeasure: 600,
          midiPitches: [{ pitch: 60 }],
          elements: [[]],
        });
        this.options.eventCallback?.({
          type: "event",
          measureStart: false,
          measureNumber: 1,
          milliseconds: 400,
          millisecondsPerMeasure: 600,
          midiPitches: [{ pitch: 60 }],
          elements: [[]],
        });
      }

      pause() {
        noop();
      }
      reset() {
        noop();
      }
      stop() {
        noop();
      }
      currentMillisecond() {
        return 0;
      }
    }

    const fakeAbcjs = {
      renderAbc: vi.fn(
        () => [{}] as unknown as ReturnType<typeof import("abcjs").renderAbc>
      ),
      TimingCallbacks:
        FakeTimingCallbacks as unknown as typeof import("abcjs").TimingCallbacks,
    };

    const audioContext = new FakeAudioContext() as unknown as AudioContext;

    let dispose = () => {};
    const service = createRoot((nextDispose) => {
      dispose = nextDispose;
      return createRhythmService({
        db,
        abcjsModule: fakeAbcjs,
        audioContext,
        sampleBaseUrl: "",
        fetchImpl: asFetch(fetchMock),
      });
    });

    await service.loadPattern({
      genreName: "Irish Traditional",
      tuneTypeName: "Jig",
    });

    await service.play();

    expect(bufferSources).toHaveLength(5);
    expect(bufferSources[0]?.start).toHaveBeenCalledTimes(1);
    expect(bufferSources[1]?.start).toHaveBeenCalledTimes(1);
    expect(bufferSources[2]?.start).toHaveBeenCalledTimes(1);
    expect(bufferSources[3]?.start).toHaveBeenCalledTimes(1);
    expect(bufferSources[4]?.start).toHaveBeenCalledTimes(1);

    dispose();
  });

  it("coalesces concurrent play() calls into a single playback start", async () => {
    const db = createSampleKitRhythmDb();
    let releaseFetch!: () => void;
    const fetchGate = new Promise<void>((resolve) => {
      releaseFetch = resolve;
    });
    const fetchMock = vi.fn(async (_url: string) => {
      await fetchGate;
      return {
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(16),
      };
    });

    const bufferSources: Array<{
      buffer: AudioBuffer | null;
      connect: ReturnType<typeof vi.fn>;
      start: ReturnType<typeof vi.fn>;
    }> = [];

    class FakeAudioContext {
      state: AudioContextState = "suspended";
      currentTime = 0;
      sampleRate = 44_100;
      destination = {};
      resume = vi.fn(async () => {
        this.state = "running";
      });
      decodeAudioData = vi.fn(async () => ({
        duration: 0.25,
        length: 1,
        numberOfChannels: 1,
        sampleRate: 44_100,
      })) as unknown as typeof AudioContext.prototype.decodeAudioData;
      createBuffer = vi.fn(
        (_channels: number, length: number, sampleRate: number) => {
          const data = new Float32Array(length);
          return {
            duration: length / sampleRate,
            length,
            numberOfChannels: 1,
            sampleRate,
            getChannelData: vi.fn(() => data),
          } as unknown as AudioBuffer;
        }
      );
      createBufferSource = vi.fn(() => {
        const source = {
          buffer: null as AudioBuffer | null,
          connect: vi.fn(),
          start: vi.fn(),
        };
        bufferSources.push(source);
        return source as unknown as AudioBufferSourceNode;
      });
      createGain = vi.fn(
        () =>
          ({
            gain: { value: 1 },
            connect: vi.fn(),
          }) as unknown as GainNode
      );
      close = vi.fn(async () => {
        this.state = "closed";
      });
    }

    class FakeTimingCallbacks {
      readonly options: {
        eventCallback?: (event: {
          type: "event";
          measureStart: boolean;
          measureNumber: number;
          midiPitches: Array<{ pitch: number }>;
          elements: HTMLElement[][];
        }) => void;
      };

      constructor(_visualObj: unknown, options: typeof this.options) {
        this.options = options;
      }

      start() {
        const kickoffPitch = 60;
        this.options.eventCallback?.({
          type: "event",
          measureStart: true,
          measureNumber: 1,
          midiPitches: [{ pitch: kickoffPitch }],
          elements: [[]],
        });
      }

      pause() {
        noop();
      }
      reset() {
        noop();
      }
      stop() {
        noop();
      }
      currentMillisecond() {
        return 0;
      }
    }

    const fakeAbcjs = {
      renderAbc: vi.fn(
        () => [{}] as unknown as ReturnType<typeof import("abcjs").renderAbc>
      ),
      TimingCallbacks:
        FakeTimingCallbacks as unknown as typeof import("abcjs").TimingCallbacks,
    };

    const audioContext = new FakeAudioContext() as unknown as AudioContext;

    let dispose = () => {};
    const service = createRoot((nextDispose) => {
      dispose = nextDispose;
      return createRhythmService({
        db,
        abcjsModule: fakeAbcjs,
        audioContext,
        sampleBaseUrl: "",
        fetchImpl: asFetch(fetchMock),
      });
    });

    await service.loadPattern({
      genreName: "Session Test",
      tuneTypeName: "Reel",
    });

    const firstPlay = service.play();
    const secondPlay = service.play();

    releaseFetch();
    await Promise.all([firstPlay, secondPlay]);

    expect(fetchMock).toHaveBeenCalledTimes(EXPECTED_BODHRAN_FETCH_COUNT);
    expect(bufferSources).toHaveLength(1);
    expect(bufferSources[0]?.start).toHaveBeenCalledTimes(1);

    dispose();
  });

  it("loops the full rhythm form from the beginning when playback reaches the end", async () => {
    const db = createSampleKitRhythmDb();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(16),
    }));

    class FakeAudioContext {
      state: AudioContextState = "running";
      currentTime = 0;
      sampleRate = 44_100;
      destination = {} as AudioDestinationNode;

      resume = vi.fn(async () => {});
      decodeAudioData = vi.fn(
        async () =>
          ({
            duration: 0.1,
            numberOfChannels: 1,
            sampleRate: this.sampleRate,
            getChannelData: vi.fn(() => new Float32Array(1)),
          }) as unknown as AudioBuffer
      );
      createBufferSource = vi.fn(
        () =>
          ({
            buffer: null,
            connect: vi.fn(),
            start: vi.fn(),
          }) as unknown as AudioBufferSourceNode
      );
      createGain = vi.fn(
        () =>
          ({
            gain: { value: 1 },
            connect: vi.fn(),
          }) as unknown as GainNode
      );
      close = vi.fn(async () => {
        this.state = "closed";
      });
    }

    class FakeTimingCallbacks {
      static readonly instances: FakeTimingCallbacks[] = [];
      startedWith: Array<{ position?: number; units?: string }> = [];
      readonly options: {
        qpm?: number;
        beatCallback?: (beatNumber: number) => void;
        eventCallback?: (
          event: {
            type: "event";
            measureStart: boolean;
            measureNumber: number;
            midiPitches: Array<{ pitch: number }>;
            elements: HTMLElement[][];
          } | null
        ) => "continue" | Promise<"continue"> | undefined;
      };

      constructor(
        _visualObj: unknown,
        options: FakeTimingCallbacks["options"]
      ) {
        this.options = options;
        FakeTimingCallbacks.instances.push(this);
      }

      start(position?: number, units?: string) {
        this.startedWith.push({ position, units });
        this.options.eventCallback?.({
          type: "event",
          measureStart: true,
          measureNumber: 1,
          midiPitches: [{ pitch: 60 }],
          elements: [[]],
        });

        if (FakeTimingCallbacks.instances.length === 1) {
          this.options.eventCallback?.(null);
        }
      }

      pause() {
        noop();
      }
      reset() {
        noop();
      }
      stop() {
        noop();
      }
      currentMillisecond() {
        return 0;
      }
    }

    const fakeAbcjs = {
      renderAbc: vi.fn(
        () => [{}] as unknown as ReturnType<typeof import("abcjs").renderAbc>
      ),
      TimingCallbacks:
        FakeTimingCallbacks as unknown as typeof import("abcjs").TimingCallbacks,
    };

    const audioContext = new FakeAudioContext() as unknown as AudioContext;

    let dispose = () => {};
    const service = createRoot((nextDispose) => {
      dispose = nextDispose;
      return createRhythmService({
        db,
        abcjsModule: fakeAbcjs,
        audioContext,
        sampleBaseUrl: "",
        fetchImpl: asFetch(fetchMock),
      });
    });

    await service.loadPattern({
      genreName: "Session Test",
      tuneTypeName: "Reel",
    });

    await service.play();
    await Promise.resolve();
    await Promise.resolve();

    expect(FakeTimingCallbacks.instances).toHaveLength(2);
    expect(FakeTimingCallbacks.instances[0]?.startedWith[0]).toEqual({
      position: undefined,
      units: "seconds",
    });
    expect(FakeTimingCallbacks.instances[1]?.startedWith[0]).toEqual({
      position: undefined,
      units: "seconds",
    });

    dispose();
  });

  it("stops an older rhythm service when a new one starts playback", async () => {
    const db = createSampleKitRhythmDb();
    const fetchMock = vi.fn(async (_url: string) => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(16),
    }));

    class FakeAudioContext {
      state: AudioContextState = "suspended";
      currentTime = 0;
      sampleRate = 44_100;
      destination = {};
      resume = vi.fn(async () => {
        this.state = "running";
      });
      decodeAudioData = vi.fn(async () => ({
        duration: 0.25,
        length: 1,
        numberOfChannels: 1,
        sampleRate: 44_100,
      })) as unknown as typeof AudioContext.prototype.decodeAudioData;
      createBuffer = vi.fn(
        (_channels: number, length: number, sampleRate: number) => {
          const data = new Float32Array(length);
          return {
            duration: length / sampleRate,
            length,
            numberOfChannels: 1,
            sampleRate,
            getChannelData: vi.fn(() => data),
          } as unknown as AudioBuffer;
        }
      );
      createBufferSource = vi.fn(
        () =>
          ({
            buffer: null,
            connect: vi.fn(),
            start: vi.fn(),
          }) as unknown as AudioBufferSourceNode
      );
      createGain = vi.fn(
        () =>
          ({
            gain: { value: 1 },
            connect: vi.fn(),
          }) as unknown as GainNode
      );
      close = vi.fn(async () => {
        this.state = "closed";
      });
    }

    const timingInstances: Array<{ stop: ReturnType<typeof vi.fn> }> = [];

    class FakeTimingCallbacks {
      stop = vi.fn();

      constructor(_visualObj: unknown, _options: unknown) {
        timingInstances.push(this);
      }

      start() {
        noop();
      }
      pause() {
        noop();
      }
      reset() {
        noop();
      }
      currentMillisecond() {
        return 0;
      }
    }

    const fakeAbcjs = {
      renderAbc: vi.fn(
        () => [{}] as unknown as ReturnType<typeof import("abcjs").renderAbc>
      ),
      TimingCallbacks:
        FakeTimingCallbacks as unknown as typeof import("abcjs").TimingCallbacks,
    };

    let disposeFirst = () => {};
    const firstService = createRoot((nextDispose) => {
      disposeFirst = nextDispose;
      return createRhythmService({
        db,
        abcjsModule: fakeAbcjs,
        audioContext: new FakeAudioContext() as unknown as AudioContext,
        sampleBaseUrl: "",
        fetchImpl: asFetch(fetchMock),
      });
    });

    let disposeSecond = () => {};
    const secondService = createRoot((nextDispose) => {
      disposeSecond = nextDispose;
      return createRhythmService({
        db,
        abcjsModule: fakeAbcjs,
        audioContext: new FakeAudioContext() as unknown as AudioContext,
        sampleBaseUrl: "",
        fetchImpl: asFetch(fetchMock),
      });
    });

    await firstService.loadPattern({
      genreName: "Session Test",
      tuneTypeName: "Reel",
    });
    await secondService.loadPattern({
      genreName: "Session Test",
      tuneTypeName: "Reel",
    });

    await firstService.play();
    expect(firstService.isPlaying()).toBe(true);
    expect(timingInstances).toHaveLength(1);

    await secondService.play();

    expect(timingInstances).toHaveLength(2);
    expect(timingInstances[0]?.stop).toHaveBeenCalledTimes(1);
    expect(firstService.isPlaying()).toBe(false);
    expect(secondService.isPlaying()).toBe(true);

    disposeFirst();
    disposeSecond();
  });
});
