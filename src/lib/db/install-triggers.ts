/**
 * Sync Outbox Trigger Installation
 *
 * This module handles the installation of SQL triggers that automatically
 * populate the sync_outbox table whenever data changes occur.
 *
 * The triggers include a suppression mechanism:
 * - A `sync_trigger_control` table with a single row controls whether triggers are active
 * - During syncDown (pulling data from Supabase), triggers are suppressed to avoid
 *   creating outbox entries for data that already exists remotely
 * - User-initiated changes trigger outbox entries normally
 *
 * @module install-triggers
 */

import type { Database as SqlJsDatabase } from "sql.js";
import { TABLE_REGISTRY } from "../sync/table-meta";

/**
 * Create the sync trigger control table.
 * This table has exactly one row with a 'disabled' flag.
 * When disabled = 1, triggers will NOT add entries to sync_outbox.
 */
export function createSyncTriggerControlTable(db: SqlJsDatabase): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS sync_trigger_control (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      disabled INTEGER NOT NULL DEFAULT 0
    )
  `);
  // Ensure exactly one row exists
  db.run(`
    INSERT OR IGNORE INTO sync_trigger_control (id, disabled) VALUES (1, 0)
  `);
  console.log("✅ Created sync_trigger_control table");
}

/**
 * Create the sync_outbox table if it doesn't exist
 */
export function createSyncOutboxTable(db: SqlJsDatabase): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS sync_outbox (
      id TEXT PRIMARY KEY NOT NULL,
      table_name TEXT NOT NULL,
      row_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      changed_at TEXT NOT NULL,
      synced_at TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT
    )
  `);
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_outbox_status_changed ON sync_outbox(status, changed_at)`
  );
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_outbox_table_row ON sync_outbox(table_name, row_id)`
  );
  console.log("✅ Created sync_outbox table and indexes");
}

/**
 * List of all syncable tables with their primary key configurations.
 * Matches the TABLE_REGISTRY in src/lib/sync/table-meta.ts
 */
interface TableTriggerConfig {
  tableName: string;
  /** Primary key column(s) - string for single PK, array for composite */
  primaryKey: string | string[];
}

const TRIGGER_CONFIGS: TableTriggerConfig[] = Object.entries(
  TABLE_REGISTRY
).map(([tableName, meta]) => ({
  tableName,
  primaryKey: meta.primaryKey,
}));

/**
 * Generate the row_id expression for a trigger.
 *
 * For single-column PKs: just the column reference (NEW.id or OLD.id)
 * For composite PKs: json_object('col1', NEW.col1, 'col2', NEW.col2, ...)
 */
function generateRowIdExpression(
  primaryKey: string | string[],
  prefix: "NEW" | "OLD"
): string {
  if (typeof primaryKey === "string") {
    return `${prefix}.${primaryKey}`;
  }

  // Composite key - build json_object expression
  const parts = primaryKey
    .map((col) => `'${col}', ${prefix}.${col}`)
    .join(", ");
  return `json_object(${parts})`;
}

/**
 * Execute triggers for a single table.
 * Executes each statement directly instead of building multi-statement SQL.
 *
 * The triggers include a check against sync_trigger_control.disabled:
 * - When disabled = 0 (default): triggers add entries to sync_outbox
 * - When disabled = 1: triggers are suppressed (no outbox entries)
 */
function createTriggersForTable(
  db: SqlJsDatabase,
  config: TableTriggerConfig
): void {
  const { tableName, primaryKey } = config;
  const newRowId = generateRowIdExpression(primaryKey, "NEW");
  const oldRowId = generateRowIdExpression(primaryKey, "OLD");

  // Drop existing triggers
  db.run(`DROP TRIGGER IF EXISTS trg_${tableName}_insert`);
  db.run(`DROP TRIGGER IF EXISTS trg_${tableName}_update`);
  db.run(`DROP TRIGGER IF EXISTS trg_${tableName}_delete`);

  // Create INSERT trigger with suppression check
  db.run(`
    CREATE TRIGGER trg_${tableName}_insert
    AFTER INSERT ON ${tableName}
    WHEN (SELECT disabled FROM sync_trigger_control WHERE id = 1) = 0
    BEGIN
      INSERT INTO sync_outbox (id, table_name, row_id, operation, changed_at)
      VALUES (
        lower(hex(randomblob(16))),
        '${tableName}',
        ${newRowId},
        'INSERT',
        strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      );
    END
  `);

  // Create UPDATE trigger with suppression check
  db.run(`
    CREATE TRIGGER trg_${tableName}_update
    AFTER UPDATE ON ${tableName}
    WHEN (SELECT disabled FROM sync_trigger_control WHERE id = 1) = 0
    BEGIN
      INSERT INTO sync_outbox (id, table_name, row_id, operation, changed_at)
      VALUES (
        lower(hex(randomblob(16))),
        '${tableName}',
        ${newRowId},
        'UPDATE',
        strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      );
    END
  `);

  // Create DELETE trigger with suppression check
  db.run(`
    CREATE TRIGGER trg_${tableName}_delete
    AFTER DELETE ON ${tableName}
    WHEN (SELECT disabled FROM sync_trigger_control WHERE id = 1) = 0
    BEGIN
      INSERT INTO sync_outbox (id, table_name, row_id, operation, changed_at)
      VALUES (
        lower(hex(randomblob(16))),
        '${tableName}',
        ${oldRowId},
        'DELETE',
        strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      );
    END
  `);
}

/**
 * Install all sync outbox triggers on the database.
 *
 * This function:
 * 1. Creates the sync_trigger_control table for trigger suppression
 * 2. Creates the sync_outbox table if it doesn't exist
 * 3. Drops any existing triggers (idempotent)
 * 4. Creates INSERT/UPDATE/DELETE triggers for all syncable tables
 *
 * @param db - The sql.js Database instance
 */
export function installSyncTriggers(db: SqlJsDatabase): void {
  console.log("🔧 Installing sync outbox triggers...");

  // First ensure the control table exists (for trigger suppression)
  createSyncTriggerControlTable(db);

  // Then ensure the sync_outbox table exists
  createSyncOutboxTable(db);

  // Generate and execute triggers for each table
  let triggerCount = 0;
  for (const config of TRIGGER_CONFIGS) {
    try {
      createTriggersForTable(db, config);
      triggerCount += 3; // INSERT, UPDATE, DELETE
    } catch (err) {
      console.error(
        `❌ Failed to create triggers for ${config.tableName}:`,
        err
      );
      throw err;
    }
  }

  console.log(
    `✅ Installed ${triggerCount} sync triggers for ${TRIGGER_CONFIGS.length} tables`
  );
}

/**
 * Suppress sync triggers (disable outbox population).
 * Call this before syncDown operations to prevent creating outbox entries
 * for data that already exists on the server.
 *
 * @param db - The sql.js Database instance
 */
export function suppressSyncTriggers(db: SqlJsDatabase): void {
  db.run(`UPDATE sync_trigger_control SET disabled = 1 WHERE id = 1`);
}

/**
 * Enable sync triggers (resume outbox population).
 * Call this after syncDown operations to resume normal trigger behavior.
 *
 * @param db - The sql.js Database instance
 */
export function enableSyncTriggers(db: SqlJsDatabase): void {
  db.run(`UPDATE sync_trigger_control SET disabled = 0 WHERE id = 1`);
}

/**
 * Check if sync triggers are currently suppressed.
 *
 * @param db - The sql.js Database instance
 * @returns true if triggers are suppressed, false otherwise
 */
export function areSyncTriggersSuppressed(db: SqlJsDatabase): boolean {
  const result = db.exec(
    `SELECT disabled FROM sync_trigger_control WHERE id = 1`
  );
  if (result.length === 0 || result[0].values.length === 0) {
    return false;
  }
  return result[0].values[0][0] === 1;
}

/**
 * Check if triggers are already installed by looking for a known trigger.
 */
export function areSyncTriggersInstalled(db: SqlJsDatabase): boolean {
  try {
    const result = db.exec(`
      SELECT name FROM sqlite_master
      WHERE type = 'trigger' AND name = 'trg_tune_insert'
    `);
    return result.length > 0 && result[0].values.length > 0;
  } catch {
    return false;
  }
}

/**
 * Get count of installed sync triggers.
 */
export function getSyncTriggerCount(db: SqlJsDatabase): number {
  try {
    const result = db.exec(`
      SELECT COUNT(*) FROM sqlite_master
      WHERE type = 'trigger' AND name LIKE 'trg_%_insert'
         OR name LIKE 'trg_%_update'
         OR name LIKE 'trg_%_delete'
    `);
    return Number(result[0]?.values[0]?.[0] || 0);
  } catch {
    return 0;
  }
}

/**
 * Verify all expected triggers are installed.
 */
export function verifySyncTriggers(db: SqlJsDatabase): {
  installed: boolean;
  missingTables: string[];
} {
  const missingTables: string[] = [];

  for (const config of TRIGGER_CONFIGS) {
    const { tableName } = config;
    try {
      const result = db.exec(`
        SELECT COUNT(*) FROM sqlite_master
        WHERE type = 'trigger'
          AND (name = 'trg_${tableName}_insert'
            OR name = 'trg_${tableName}_update'
            OR name = 'trg_${tableName}_delete')
      `);
      const count = Number(result[0]?.values[0]?.[0] || 0);
      if (count < 3) {
        missingTables.push(tableName);
      }
    } catch {
      missingTables.push(tableName);
    }
  }

  return {
    installed: missingTables.length === 0,
    missingTables,
  };
}
