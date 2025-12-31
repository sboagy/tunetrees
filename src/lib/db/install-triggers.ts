/**
 * Sync Push Queue Trigger Installation
 *
 * This module handles the installation of SQL triggers that automatically
 * populate the sync_push_queue table whenever data changes occur.
 *
 * sync_push_queue is the client-side queue of changes to push to the server.
 * Note: Different from the server's sync_change_log which is stateless.
 *
 * The triggers include a suppression mechanism:
 * - A `sync_trigger_control` table with a single row controls whether triggers are active
 * - During syncDown (pulling data from Supabase), triggers are suppressed to avoid
 *   creating queue entries for data that already exists remotely
 * - User-initiated changes trigger queue entries normally
 *
 * @module install-triggers
 */

import type { Database as SqlJsDatabase } from "sql.js";
import { TABLE_REGISTRY } from "@oosync/shared/table-meta";

/**
 * Create the sync trigger control table.
 * This table has exactly one row with a 'disabled' flag.
 * When disabled = 1, triggers will NOT add entries to sync_push_queue.
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
 * Create the sync_push_queue table if it doesn't exist
 */
export function createSyncPushQueueTable(db: SqlJsDatabase): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS sync_push_queue (
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
    `CREATE INDEX IF NOT EXISTS idx_push_queue_status_changed ON sync_push_queue(status, changed_at)`
  );
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_push_queue_table_row ON sync_push_queue(table_name, row_id)`
  );
  console.log("✅ Created sync_push_queue table and indexes");
}

/**
 * List of all syncable tables with their primary key configurations.
 * Matches the TABLE_REGISTRY in shared/table-meta.ts
 */
interface TableTriggerConfig {
  tableName: string;
  /** Primary key column(s) - string for single PK, array for composite */
  primaryKey: string | string[];
  /** Whether the table has last_modified_at for incremental sync */
  supportsIncremental: boolean;
}

const TRIGGER_CONFIGS: TableTriggerConfig[] = Object.entries(
  TABLE_REGISTRY
).map(([tableName, meta]) => ({
  tableName,
  primaryKey: meta.primaryKey,
  supportsIncremental: meta.supportsIncremental,
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
 * Generate a WHERE clause for a trigger to match the row by primary key.
 *
 * For single-column PKs: "id = NEW.id"
 * For composite PKs: "col1 = NEW.col1 AND col2 = NEW.col2"
 */
function generatePkWhereClause(
  primaryKey: string | string[],
  prefix: "NEW" | "OLD"
): string {
  if (typeof primaryKey === "string") {
    return `${primaryKey} = ${prefix}.${primaryKey}`;
  }

  // Composite key - build AND expression
  return primaryKey.map((col) => `${col} = ${prefix}.${col}`).join(" AND ");
}

/**
 * Execute triggers for a single table.
 * Executes each statement directly instead of building multi-statement SQL.
 *
 * The triggers include a check against sync_trigger_control.disabled:
 * - When disabled = 0 (default): triggers add entries to sync_push_queue
 * - When disabled = 1: triggers are suppressed (no queue entries)
 *
 * For tables with supportsIncremental=true (have last_modified_at column),
 * an additional BEFORE UPDATE trigger auto-sets last_modified_at to ensure
 * sync propagation works correctly even when code forgets to set it.
 */
function createTriggersForTable(
  db: SqlJsDatabase,
  config: TableTriggerConfig
): void {
  const { tableName, primaryKey, supportsIncremental } = config;
  const newRowId = generateRowIdExpression(primaryKey, "NEW");
  const oldRowId = generateRowIdExpression(primaryKey, "OLD");

  // Drop existing triggers (including new auto-modified trigger)
  db.run(`DROP TRIGGER IF EXISTS trg_${tableName}_insert`);
  db.run(`DROP TRIGGER IF EXISTS trg_${tableName}_update`);
  db.run(`DROP TRIGGER IF EXISTS trg_${tableName}_delete`);
  db.run(`DROP TRIGGER IF EXISTS trg_${tableName}_auto_modified`);

  // For tables with last_modified_at, create a BEFORE UPDATE trigger that
  // auto-sets last_modified_at when it wasn't explicitly updated.
  // This ensures sync propagation works even when code forgets to set it.
  //
  // The trigger only fires when last_modified_at is unchanged, preventing
  // infinite recursion and allowing explicit overrides.
  if (supportsIncremental) {
    db.run(`
      CREATE TRIGGER trg_${tableName}_auto_modified
      AFTER UPDATE ON ${tableName}
      FOR EACH ROW
      WHEN NEW.last_modified_at = OLD.last_modified_at
        OR NEW.last_modified_at IS NULL
      BEGIN
        UPDATE ${tableName}
        SET last_modified_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE ${generatePkWhereClause(primaryKey, "NEW")};
      END
    `);
  }

  // Create INSERT trigger with suppression check
  db.run(`
    CREATE TRIGGER trg_${tableName}_insert
    AFTER INSERT ON ${tableName}
    WHEN (SELECT disabled FROM sync_trigger_control WHERE id = 1) = 0
    BEGIN
      INSERT INTO sync_push_queue (id, table_name, row_id, operation, changed_at)
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
      INSERT INTO sync_push_queue (id, table_name, row_id, operation, changed_at)
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
      INSERT INTO sync_push_queue (id, table_name, row_id, operation, changed_at)
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
 * Install all sync push queue triggers on the database.
 *
 * This function:
 * 1. Creates the sync_trigger_control table for trigger suppression
 * 2. Creates the sync_push_queue table if it doesn't exist
 * 3. Drops any existing triggers (idempotent)
 * 4. Creates INSERT/UPDATE/DELETE triggers for all syncable tables
 * 5. Creates auto_modified triggers for tables with last_modified_at
 *
 * @param db - The sql.js Database instance
 */
export function installSyncTriggers(db: SqlJsDatabase): void {
  console.log("🔧 Installing sync push queue triggers...");

  // First ensure the control table exists (for trigger suppression)
  createSyncTriggerControlTable(db);

  // Then ensure the sync_push_queue table exists
  createSyncPushQueueTable(db);

  // Generate and execute triggers for each table
  let triggerCount = 0;
  let autoModifiedCount = 0;
  for (const config of TRIGGER_CONFIGS) {
    try {
      createTriggersForTable(db, config);
      triggerCount += 3; // INSERT, UPDATE, DELETE
      if (config.supportsIncremental) {
        autoModifiedCount += 1; // auto_modified trigger
      }
    } catch (err) {
      console.error(
        `❌ Failed to create triggers for ${config.tableName}:`,
        err
      );
      throw err;
    }
  }

  console.log(
    `✅ Installed ${triggerCount} sync triggers + ${autoModifiedCount} auto-modified triggers for ${TRIGGER_CONFIGS.length} tables`
  );
}

/**
 * Suppress sync triggers (disable push queue population).
 * Call this before syncDown operations to prevent creating queue entries
 * for data that already exists on the server.
 *
 * @param db - The sql.js Database instance
 */
export function suppressSyncTriggers(db: SqlJsDatabase): void {
  db.run(`UPDATE sync_trigger_control SET disabled = 1 WHERE id = 1`);
}

/**
 * Enable sync triggers (resume push queue population).
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
      WHERE type = 'trigger' AND (
        name LIKE 'trg_%_insert'
        OR name LIKE 'trg_%_update'
        OR name LIKE 'trg_%_delete'
        OR name LIKE 'trg_%_auto_modified'
      )
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
    const { tableName, supportsIncremental } = config;
    const expectedCount = supportsIncremental ? 4 : 3; // +1 for auto_modified
    try {
      const result = db.exec(`
        SELECT COUNT(*) FROM sqlite_master
        WHERE type = 'trigger'
          AND (name = 'trg_${tableName}_insert'
            OR name = 'trg_${tableName}_update'
            OR name = 'trg_${tableName}_delete'
            OR name = 'trg_${tableName}_auto_modified')
      `);
      const count = Number(result[0]?.values[0]?.[0] || 0);
      if (count < expectedCount) {
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
