/**
 * Sync Outbox Trigger Installation
 *
 * This module handles the installation of SQL triggers that automatically
 * populate the sync_outbox table whenever data changes occur.
 *
 * @module install-triggers
 */

import type { Database as SqlJsDatabase } from "sql.js";

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

const TRIGGER_CONFIGS: TableTriggerConfig[] = [
  { tableName: "daily_practice_queue", primaryKey: "id" },
  { tableName: "genre", primaryKey: "id" },
  { tableName: "genre_tune_type", primaryKey: ["genre_id", "tune_type_id"] },
  { tableName: "note", primaryKey: "id" },
  { tableName: "playlist", primaryKey: "playlist_id" },
  { tableName: "playlist_tune", primaryKey: ["playlist_ref", "tune_ref"] },
  { tableName: "practice_record", primaryKey: "id" },
  { tableName: "prefs_scheduling_options", primaryKey: "user_id" },
  {
    tableName: "prefs_spaced_repetition",
    primaryKey: ["user_id", "playlist_id"],
  },
  { tableName: "reference", primaryKey: "id" },
  { tableName: "repertoire", primaryKey: "id" },
  { tableName: "tab_group_main_state", primaryKey: "id" },
  {
    tableName: "table_state",
    primaryKey: ["user_id", "screen_size", "purpose", "playlist_id"],
  },
  {
    tableName: "table_transient_data",
    primaryKey: ["user_id", "tune_id", "playlist_id"],
  },
  { tableName: "tag", primaryKey: "id" },
  { tableName: "tune", primaryKey: "id" },
  { tableName: "tune_type", primaryKey: "id" },
  { tableName: "user_annotation", primaryKey: "id" },
  { tableName: "user_profile", primaryKey: "supabase_user_id" },
];

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

  // Create INSERT trigger
  db.run(`
    CREATE TRIGGER trg_${tableName}_insert
    AFTER INSERT ON ${tableName}
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

  // Create UPDATE trigger
  db.run(`
    CREATE TRIGGER trg_${tableName}_update
    AFTER UPDATE ON ${tableName}
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

  // Create DELETE trigger
  db.run(`
    CREATE TRIGGER trg_${tableName}_delete
    AFTER DELETE ON ${tableName}
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
 * 1. Creates the sync_outbox table if it doesn't exist
 * 2. Drops any existing triggers (idempotent)
 * 3. Creates INSERT/UPDATE/DELETE triggers for all syncable tables
 *
 * @param db - The sql.js Database instance
 */
export function installSyncTriggers(db: SqlJsDatabase): void {
  console.log("🔧 Installing sync outbox triggers...");

  // First ensure the sync_outbox table exists
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
