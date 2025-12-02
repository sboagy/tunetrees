/**
 * Shared Sync Types
 *
 * Defines the API contract between the Client (SQLite) and the Worker (Postgres).
 * These types ensure that both sides agree on the structure of the sync payload
 * and response, preventing protocol mismatches.
 */
import type { TBL } from "./db-constants";

export type TableName = (typeof TBL)[keyof typeof TBL];

export interface SyncChange {
  table: TableName;
  rowId: string; // UUID or JSON composite key
  data: Record<string, any>; // The full row data
  deleted: boolean;
  lastModifiedAt: string; // ISO timestamp from client
}

export interface SyncRequest {
  changes: SyncChange[];
  lastSyncAt?: string; // ISO timestamp of last successful sync
  schemaVersion: number;
}

export interface SyncResponse {
  changes: SyncChange[];
  syncedAt: string; // ISO timestamp of this sync
  error?: string;
  debug?: string[];
}
