import {
  type SyncableTableName,
  TABLE_REGISTRY,
} from "@sync-schema/table-meta";
import type { Database as SqlJsDatabase } from "sql.js";

export interface IOutboxBackupItem {
  tableName: SyncableTableName;
  rowId: string;
  operation: "INSERT" | "UPDATE" | "DELETE" | string;
  changedAt: string;
  rowData?: Record<string, unknown>;
}

export interface IOutboxBackup {
  version: 1;
  createdAt: string;
  items: IOutboxBackupItem[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseRowIdToPkObject(
  tableName: SyncableTableName,
  rowId: string
): Record<string, unknown> {
  if (rowId.startsWith("{")) {
    const parsed = JSON.parse(rowId) as unknown;
    if (!isRecord(parsed)) {
      throw new Error(`Invalid composite rowId JSON for ${tableName}`);
    }
    return parsed;
  }

  const primaryKey = TABLE_REGISTRY[tableName]?.primaryKey;
  if (!primaryKey) {
    throw new Error(`Unknown table meta for ${tableName}`);
  }

  if (Array.isArray(primaryKey)) {
    // Composite PKs are always JSON row_id in our trigger convention.
    throw new Error(
      `Expected JSON rowId for composite PK table ${tableName}, got string rowId`
    );
  }

  return { [primaryKey]: rowId };
}

function getExistingColumns(db: SqlJsDatabase, tableName: string): Set<string> {
  const stmt = db.prepare(`PRAGMA table_info("${tableName}")`);
  const columns = new Set<string>();
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    const name = row.name;
    if (typeof name === "string") {
      columns.add(name);
    }
  }
  stmt.free();
  return columns;
}

type SqlValue = string | number | null | Uint8Array;

function toSqlValue(value: unknown): SqlValue {
  if (value === null || typeof value === "undefined") return null;
  if (typeof value === "string") return value;
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value instanceof Uint8Array) return value;

  // Best-effort coercion for rare cases (e.g., object typed column in snapshot).
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function selectRowByPk(
  db: SqlJsDatabase,
  tableName: string,
  pk: Record<string, unknown>
): Record<string, unknown> | null {
  const keys = Object.keys(pk);
  if (keys.length === 0) return null;

  const where = keys.map((k) => `"${k}" = ?`).join(" AND ");
  const sql = `SELECT * FROM "${tableName}" WHERE ${where} LIMIT 1`;
  const stmt = db.prepare(sql);
  stmt.bind(keys.map((k) => toSqlValue(pk[k])));
  try {
    if (!stmt.step()) return null;
    return stmt.getAsObject() as Record<string, unknown>;
  } finally {
    stmt.free();
  }
}

function filterRowDataToExistingColumns(
  rowData: Record<string, unknown>,
  existingColumns: Set<string>
): Record<string, unknown> {
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rowData)) {
    if (existingColumns.has(key)) {
      filtered[key] = value;
    }
  }
  return filtered;
}

export function createOutboxBackup(db: SqlJsDatabase): IOutboxBackup {
  const createdAt = new Date().toISOString();
  const items: IOutboxBackupItem[] = [];

  // Best-effort: only rows we still intend to push.
  // Note: completed items are deleted from the outbox.
  const stmt = db.prepare(`
    SELECT table_name, row_id, operation, changed_at
    FROM sync_push_queue
    WHERE status IN ('pending', 'failed', 'in_progress')
    ORDER BY changed_at ASC
  `);

  try {
    while (stmt.step()) {
      const row = stmt.getAsObject() as Record<string, unknown>;
      const tableName = row.table_name;
      const rowId = row.row_id;
      const operation = row.operation;
      const changedAt = row.changed_at;

      if (
        typeof tableName !== "string" ||
        typeof rowId !== "string" ||
        typeof operation !== "string" ||
        typeof changedAt !== "string"
      ) {
        continue;
      }

      if (!(tableName in TABLE_REGISTRY)) {
        continue;
      }

      const syncableTableName = tableName as SyncableTableName;

      const item: IOutboxBackupItem = {
        tableName: syncableTableName,
        rowId,
        operation,
        changedAt,
      };

      if (operation.toLowerCase() !== "delete") {
        try {
          const pk = parseRowIdToPkObject(syncableTableName, rowId);
          const rowData = selectRowByPk(db, tableName, pk);
          if (rowData) {
            item.rowData = rowData;
          }
        } catch {
          // Ignore snapshot failures; item may still be replayable as a DELETE or be skipped.
        }
      }

      items.push(item);
    }
  } finally {
    stmt.free();
  }

  return {
    version: 1,
    createdAt,
    items,
  };
}

export function replayOutboxBackup(
  db: SqlJsDatabase,
  backup: IOutboxBackup
): { applied: number; skipped: number; errors: string[] } {
  const errors: string[] = [];
  let applied = 0;
  let skipped = 0;

  for (const item of backup.items) {
    try {
      const tableName = item.tableName;
      if (!(tableName in TABLE_REGISTRY)) {
        skipped += 1;
        continue;
      }

      const existingColumns = getExistingColumns(db, tableName);
      if (existingColumns.size === 0) {
        skipped += 1;
        continue;
      }

      const meta = TABLE_REGISTRY[tableName];
      const pkCols = Array.isArray(meta.primaryKey)
        ? meta.primaryKey
        : [meta.primaryKey];

      if (item.operation.toLowerCase() === "delete") {
        const pk = parseRowIdToPkObject(tableName, item.rowId);
        const whereCols = pkCols.filter((c) => c in pk);
        if (whereCols.length === 0) {
          skipped += 1;
          continue;
        }

        const where = whereCols.map((c) => `"${c}" = ?`).join(" AND ");
        const stmt = db.prepare(`DELETE FROM "${tableName}" WHERE ${where}`);
        stmt.bind(whereCols.map((c) => toSqlValue(pk[c])));
        try {
          stmt.step();
          applied += 1;
        } finally {
          stmt.free();
        }
        continue;
      }

      if (!item.rowData) {
        skipped += 1;
        continue;
      }

      const rowData = filterRowDataToExistingColumns(
        item.rowData,
        existingColumns
      );
      const cols = Object.keys(rowData);
      if (cols.length === 0) {
        skipped += 1;
        continue;
      }

      const colList = cols.map((c) => `"${c}"`).join(", ");
      const placeholders = cols.map(() => "?").join(", ");

      const conflictCols = pkCols
        .filter((c) => existingColumns.has(c))
        .map((c) => `"${c}"`)
        .join(", ");

      if (conflictCols.length === 0) {
        skipped += 1;
        continue;
      }

      const updateCols = cols
        .filter((c) => !pkCols.includes(c))
        .map((c) => `"${c}" = excluded."${c}"`)
        .join(", ");

      const sql =
        updateCols.length > 0
          ? `INSERT INTO "${tableName}" (${colList}) VALUES (${placeholders}) ON CONFLICT(${conflictCols}) DO UPDATE SET ${updateCols}`
          : `INSERT INTO "${tableName}" (${colList}) VALUES (${placeholders}) ON CONFLICT(${conflictCols}) DO NOTHING`;

      const stmt = db.prepare(sql);
      stmt.bind(cols.map((c) => toSqlValue(rowData[c])));
      try {
        stmt.step();
        applied += 1;
      } finally {
        stmt.free();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${item.tableName}:${item.rowId}: ${msg}`);
      skipped += 1;
    }
  }

  return { applied, skipped, errors };
}
