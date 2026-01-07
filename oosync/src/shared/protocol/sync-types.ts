/**
 * Shared Sync Types
 *
 * Defines the API contract between the Client (SQLite) and the Worker (Postgres).
 * These types ensure that both sides agree on the structure of the sync payload
 * and response, preventing protocol mismatches.
 */

export type TableName = string;

export interface SyncChange<TTableName extends string = TableName> {
  table: TTableName;
  rowId: string; // UUID or JSON composite key
  data: Record<string, unknown>; // The full row data
  deleted: boolean;
  lastModifiedAt: string; // ISO timestamp from client
}

export interface SyncRequest<TTableName extends string = TableName> {
  changes: Array<SyncChange<TTableName>>;
  lastSyncAt?: string; // ISO timestamp of last successful sync
  schemaVersion: number;

  /**
   * Optional cursor for paginated pulls (primarily initial sync).
   * When present, the worker returns a page of changes plus `nextCursor`.
   */
  pullCursor?: string;

  /**
   * Watermark for a multi-page initial sync. The worker sets this on the first
   * page, and the client echoes it back on subsequent pages.
   */
  syncStartedAt?: string;

  /**
   * Optional page size hint for paginated pull responses.
   * The worker may clamp this to a safe maximum.
   */
  pageSize?: number;
}

export interface SyncResponse<TTableName extends string = TableName> {
  changes: Array<SyncChange<TTableName>>;
  syncedAt: string; // ISO timestamp of this sync
  error?: string;
  debug?: string[];

  /**
   * When present, indicates there are more pull pages to fetch.
   * Client should call `/api/sync` again with `pullCursor` (and same `syncStartedAt`).
   */
  nextCursor?: string;

  /**
   * Watermark for a multi-page initial sync.
   * Client should use this as its first `lastSyncAt` once pagination is complete.
   */
  syncStartedAt?: string;
}
