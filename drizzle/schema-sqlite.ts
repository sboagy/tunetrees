/**
 * Thin wrapper around the generated SQLite schema.
 *
 * Keep imports stable by continuing to import from `drizzle/schema-sqlite`.
 *
 * Note: Some tables are client-only (not present in Postgres) and are defined
 * here alongside the generated schema.
 */
export * from "./schema-sqlite.generated";

import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { genre, userProfile } from "./schema-sqlite.generated";
import { sqliteSyncColumns } from "./sync-columns";

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

export const userGenreSelection = sqliteTable(
  "user_genre_selection",
  {
    userId: text("user_id")
      .notNull()
      .references(() => userProfile.supabaseUserId, { onDelete: "cascade" }),
    genreId: text("genre_id")
      .notNull()
      .references(() => genre.id, { onDelete: "cascade" }),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    ...sqliteSyncColumns,
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.genreId] }),
    index("idx_user_genre_selection_user_id").on(t.userId),
    index("idx_user_genre_selection_genre_id").on(t.genreId),
  ]
);

export const viewColumnMeta = sqliteTable(
  "view_column_meta",
  {
    viewName: text("view_name").notNull(),
    columnName: text("column_name").notNull(),
    description: text("description").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.viewName, t.columnName] }),
    index("idx_view_column_meta_view").on(t.viewName),
  ]
);
