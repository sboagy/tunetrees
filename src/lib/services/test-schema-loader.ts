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

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

/**
 * Apply Drizzle migrations to an in-memory test database.
 * Reads migration SQL files and executes them in order.
 */
export function applyMigrations(db: BetterSQLite3Database): void {
  const migrationsDir = join(process.cwd(), "drizzle", "migrations", "sqlite");

  // Load migration files in order
  const migrations = [
    "0000_lowly_obadiah_stane.sql",
    "0001_thin_chronomancer.sql",
  ];

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
        db.run(statement as any);
      } catch (error) {
        console.error(`Failed to execute statement from ${migrationFile}:`);
        console.error(statement);
        throw error;
      }
    }
  }
}

/**
 * Create the practice_list_staged view needed for queue tests.
 *
 * Loads a simplified version of the production view from a test SQL file.
 * The test view includes only the fields used by the practice queue algorithm
 * (id, title, scheduled, latest_due, deleted, playlist_deleted, user_ref, playlist_id).
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
