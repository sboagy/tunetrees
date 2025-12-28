/**
 * Thin wrapper around the generated SQLite schema.
 *
 * Keep imports stable by continuing to import from `drizzle/schema-sqlite`.
 *
 * Note: Some tables are client-only (not present in Postgres) and are defined
 * here alongside the generated schema.
 */
export * from "./schema-sqlite.generated";

import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Client-side outbox.
 *
 * Populated by SQLite triggers on INSERT/UPDATE/DELETE and consumed by the sync engine.
 */
export const syncPushQueue = sqliteTable(
	"sync_push_queue",
	{
		id: text("id").primaryKey().notNull(),
		tableName: text("table_name").notNull(),
		rowId: text("row_id").notNull(),
		operation: text("operation").notNull(),
		status: text("status").default("pending").notNull(),
		changedAt: text("changed_at").notNull(),
		syncedAt: text("synced_at"),
		attempts: integer("attempts").default(0).notNull(),
		lastError: text("last_error"),
	},
	(t) => [
		index("idx_outbox_status_changed").on(t.status, t.changedAt),
		index("idx_outbox_table_row").on(t.tableName, t.rowId),
	]
);
