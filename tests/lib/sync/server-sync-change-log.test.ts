import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SYNCABLE_TABLES, supportsIncremental } from "@sync-schema/table-meta";
import { describe, expect, it } from "vitest";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(THIS_DIR, "../../..");
const MIGRATIONS_DIR = path.join(REPO_ROOT, "supabase", "migrations");
const CODEGEN_CONFIG_PATH = path.join(REPO_ROOT, "oosync.codegen.config.json");

function listMigrationFiles(): string[] {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((entry) => entry.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b))
    .map((entry) => path.join(MIGRATIONS_DIR, entry));
}

function extractTablesWithSyncChangeLogTriggers(sql: string): string[] {
  return sql
    .split(";")
    .map((statement) => statement.replace(/\s+/g, " ").trim())
    .filter(
      (statement) =>
        /CREATE(?: OR REPLACE)? TRIGGER/i.test(statement) &&
        /sync_change_log_update/i.test(statement)
    )
    .map((statement) => {
      const tableMatch =
        /ON\s+(?:(?:public|"public")\.)?"?([a-z0-9_]+)"?/i.exec(statement);
      return tableMatch?.[1] ?? "";
    })
    .filter(Boolean);
}

function getConfiguredSqliteMigrations(): {
  databaseVersion: number;
  schemaVersion: string;
  migrationFiles: string[];
} {
  const config = JSON.parse(fs.readFileSync(CODEGEN_CONFIG_PATH, "utf8")) as {
    browserSqlite: {
      databaseVersion: number;
      schemaVersion: string;
      migrationFiles: string[];
    };
  };

  return config.browserSqlite;
}

function extractMigrationVersion(filePath: string): number {
  const match = /^(\d{4})[a-z]?_/.exec(path.basename(filePath));
  if (!match) {
    throw new Error(
      `Expected sqlite migration file name to start with ####_ or ####x_: ${filePath}`
    );
  }
  return Number.parseInt(match[1], 10);
}

describe("server sync change log coverage", () => {
  it("adds sync_change_log triggers for every syncable table", () => {
    const triggeredTables = new Set<string>();

    for (const migrationFile of listMigrationFiles()) {
      const sql = fs.readFileSync(migrationFile, "utf8");
      for (const tableName of extractTablesWithSyncChangeLogTriggers(sql)) {
        triggeredTables.add(tableName);
      }
    }

    expect(
      [...SYNCABLE_TABLES].filter((table) => !triggeredTables.has(table))
    ).toEqual([]);
  });

  it("keeps every syncable table eligible for incremental pull", () => {
    expect(
      [...SYNCABLE_TABLES].filter((table) => !supportsIncremental(table))
    ).toEqual([]);
  });

  it("keeps browser sqlite databaseVersion at or one reset ahead of the latest configured migration", () => {
    const { databaseVersion, migrationFiles, schemaVersion } =
      getConfiguredSqliteMigrations();
    const configuredVersions = migrationFiles.map(extractMigrationVersion);
    const latestMigrationVersion = Math.max(...configuredVersions);

    expect(databaseVersion).toBeLessThanOrEqual(latestMigrationVersion + 1);

    if (databaseVersion === latestMigrationVersion) {
      expect(databaseVersion).toBe(latestMigrationVersion);
      return;
    }

    // The only accepted +1 case is an engine-reset version bump, such as the
    // sql.js to sqlite-wasm swap, where existing browser blobs must be discarded
    // even though the logical migration list has not advanced.
    expect(schemaVersion).toContain("sqlite-wasm-engine");
    expect(databaseVersion).toBe(latestMigrationVersion + 1);
  });
});
