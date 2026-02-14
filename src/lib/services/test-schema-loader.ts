/**
 * Test Schema Loader
 *
 * Loads the production schema from Drizzle migrations into test databases.
 * This ensures test schemas never drift from production schemas.
 *
 * Usage:
 * ```typescript
 * import { applyMigrations } from './test-schema-loader';
 *
 * const sqlite = new Database(":memory:");
 * const db = drizzle(sqlite);
 * await applyMigrations(db);
 * ```
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

/**
 * Apply Drizzle migrations to an in-memory test database.
 * Reads migration SQL files and executes them in order.
 */
export function applyMigrations(db: BetterSQLite3Database): void {
  const migrationsDir = join(process.cwd(), "drizzle", "migrations", "sqlite");

  // Load migration files in order (keeps test schema aligned with production migrations)
  // We only consider top-level numbered migration SQL files.
  const migrations = readdirSync(migrationsDir)
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort((a, b) => a.localeCompare(b));

  for (const migrationFile of migrations) {
    const migrationPath = join(migrationsDir, migrationFile);
    const sql = readFileSync(migrationPath, "utf-8");

    // Split by statement breakpoint and execute each statement
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      try {
        // Skip INSERT...SELECT statements in test environment (migrations 0002/0003)
        // These copy data from old tables during production schema changes,
        // but fail on fresh test databases with no data
        if (statement.includes("INSERT INTO") && statement.includes("SELECT")) {
          // Skip data migration statements in tests
          continue;
        }

        // Skip specific ALTER TABLE ADD statements that cause "duplicate column" errors
        // when the column already exists in the base schema (migration 0004)
        if (
          statement.includes("ALTER TABLE") &&
          statement.includes("ADD") &&
          statement.includes("avatar_url")
        ) {
          // Skip avatar_url ADD statement (already in base schema)
          continue;
        }

        db.run(statement as unknown as string);
      } catch (error) {
        console.error(`Failed to execute statement from ${migrationFile}:`);
        console.error(statement);
        throw error;
      }
    }
  }

  // Create sync_push_queue table (not yet in migrations, added for trigger-based sync)
  // This table is populated by triggers on syncable tables
  db.run(
    `
    CREATE TABLE IF NOT EXISTS sync_push_queue (
      id TEXT PRIMARY KEY NOT NULL,
      table_name TEXT NOT NULL,
      row_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      status TEXT DEFAULT 'pending' NOT NULL,
      changed_at TEXT NOT NULL,
      synced_at TEXT,
      attempts INTEGER DEFAULT 0 NOT NULL,
      last_error TEXT
    )
  ` as any
  );
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_push_queue_status_changed ON sync_push_queue(status, changed_at)` as any
  );
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_push_queue_table_row ON sync_push_queue(table_name, row_id)` as any
  );

  // Compatibility shim for Slice C rename rollout:
  // Legacy SQLite migrations still define daily_practice_queue.repertoire_ref,
  // while generated Drizzle schema now expects daily_practice_queue.repertoire_ref.
  // Align the in-memory unit-test schema to the generated contract.
  const queueColumns = db.all<{ name: string }>(
    `PRAGMA table_info('daily_practice_queue')` as any
  );
  const hasRepertoireRef = queueColumns.some(
    (column) => column.name === "repertoire_ref"
  );

  if (!hasRepertoireRef) {
    throw new Error(
      "daily_practice_queue schema missing repertoire_ref column in test loader"
    );
  }
}

/**
 * Create the practice_list_staged view needed for queue tests.
 *
 * Loads a simplified version of the production view from a test SQL file.
 * The test view includes only the fields used by the practice queue algorithm
 * (id, title, scheduled, latest_due, deleted, repertoire_deleted, user_ref, repertoire_id).
 *
 * Production view has 40+ fields with tune_override joins, transient data, tags, notes, etc.
 * See: scripts/create-views-direct.ts for full production implementation.
 *
 * This approach prevents schema drift while keeping tests lightweight and focused.
 */
export function createPracticeListStagedView(db: BetterSQLite3Database): void {
  const viewPath = join(
    process.cwd(),
    "drizzle",
    "migrations",
    "sqlite",
    "test-views",
    "practice_list_staged.sql"
  );

  try {
    const viewSQL = readFileSync(viewPath, "utf-8");
    db.run(viewSQL as any);
  } catch (error) {
    console.error("Failed to load practice_list_staged view:");
    console.error(error);
    throw error;
  }
}
