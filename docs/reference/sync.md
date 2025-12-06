# Sync Engine Reference

Detailed technical reference for the TuneTrees synchronization system.

## Architecture

```
┌────────────────────────────────────────────────────────┐
│                     SyncService                         │
│  - Orchestrates sync operations                         │
│  - Manages auto-sync intervals                          │
│  - Exposes public API                                   │
└────────────────────┬───────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
┌─────────────────┐    ┌─────────────────────────────────┐
│   SyncQueue     │    │         SyncEngine              │
│ - Queue writes  │    │ - Process queue items           │
│ - Track status  │    │ - Transform data                │
│ - Batch items   │    │ - Upload/download               │
└─────────────────┘    │ - Conflict resolution           │
                       └─────────────────────────────────┘
                                      │
                                      ▼
                       ┌─────────────────────────────────┐
                       │       RealtimeManager           │
                       │ - Subscribe to changes          │
                       │ - Trigger sync on update        │
                       └─────────────────────────────────┘
```

## Files

| File | Purpose |
|------|---------|
| `src/lib/sync/service.ts` | High-level sync API |
| `src/lib/sync/engine.ts` | Core sync logic |
| `src/lib/sync/queue.ts` | Queue management |
| `src/lib/sync/realtime.ts` | Supabase Realtime |
| `src/lib/sync/types.ts` | TypeScript interfaces |

## SyncService

Main entry point for sync operations.

### API

```typescript
class SyncService {
  // Upload pending changes to Supabase
  async syncUp(): Promise<SyncResult>;
  
  // Download remote changes (blocks if pending local changes)
  async syncDown(): Promise<SyncResult>;
  
  // Full bidirectional sync
  async sync(): Promise<SyncResult>;
  
  // Background sync
  startAutoSync(): void;
  stopAutoSync(): void;
}
```

### Auto-Sync Strategy

```typescript
// Sync up every 5 minutes if pending changes
setInterval(async () => {
  const stats = await getSyncQueueStats();
  if (stats.pending > 0) {
    await syncUp();
  }
}, 5 * 60 * 1000);

// Sync down every 20 minutes
setInterval(async () => {
  await syncDown();
}, 20 * 60 * 1000);
```

## Sync Queue

### Schema

```typescript
interface SyncQueueItem {
  id: string;
  tableName: SyncableTable;
  operation: "insert" | "update" | "delete";
  recordData: string; // JSON
  status: "pending" | "synced" | "failed";
  retryCount: number;
  lastError: string | null;
  createdAt: string;
  lastModifiedAt: string;
}
```

### Queueing Writes

```typescript
import { queueSync } from "./queue";

// After local database write:
await queueSync(db, "practice_record", "insert", {
  id: recordId,
  tuneRef: tuneId,
  playlistRef: playlistId,
  practiced: timestamp,
  quality: 3,
  // ... all fields
});
```

### Queue Processing

Queue items processed in FIFO order with retry logic:

```typescript
const pendingItems = await getPendingSyncItems(db, batchSize);

for (const item of pendingItems) {
  try {
    await processQueueItem(item);
    await markSynced(db, item.id);
  } catch (error) {
    await updateSyncStatus(db, item.id, "failed", error.message);
  }
}
```

## Sync Engine

### Field Transformation

Local camelCase ↔ Remote snake_case:

```typescript
function transformLocalToRemote(record: any): any {
  const transformed: any = {};
  for (const [key, value] of Object.entries(record)) {
    const snakeKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
    transformed[snakeKey] = value;
  }
  return transformed;
}
```

### Processing Queue Items

```typescript
async function processQueueItem(item: SyncQueueItem): Promise<void> {
  const table = supabase.from(item.tableName);
  const data = transformLocalToRemote(JSON.parse(item.recordData));

  switch (item.operation) {
    case "insert":
    case "update":
      await table.upsert(data);
      break;
    case "delete":
      await table.delete().eq("id", data.id);
      break;
  }
}
```

### Composite Key Handling

Some tables use composite keys:

```typescript
const compositeKeyTables = {
  playlist_tune: ["playlist_ref", "tune_ref"],
  daily_practice_queue: ["user_ref", "playlist_ref", "window_start_utc", "tune_ref"],
};

// Delete with composite key
await table.delete().match({
  playlist_ref: data.playlist_ref,
  tune_ref: data.tune_ref,
});
```

## Critical Rules

### 1. Sync Up Before Sync Down

**Why?** Prevents "zombie records" where deleted items reappear.

```typescript
async syncDown(): Promise<SyncResult> {
  // CRITICAL: Check for pending changes first
  const stats = await getSyncQueueStats();
  if (stats.pending > 0) {
    const uploadResult = await syncUp();
    if (!uploadResult.success) {
      throw new Error("Cannot syncDown: pending changes failed to upload");
    }
  }
  
  // Now safe to download
  return await pullRemoteChanges();
}
```

### 2. Always Persist After Writes

```typescript
// After any database modification:
await db.run(sql`UPDATE ...`);
await queueSync(db, tableName, operation, data);
await persistDb();  // <-- Required!
```

### 3. Immutable Practice Records

`practice_record` rows are never updated or deleted. Each practice event creates a new row.

## Realtime Manager

Subscribes to Supabase Realtime for live updates from other devices.

```typescript
class RealtimeManager {
  subscribe(tables: string[]): void {
    for (const table of tables) {
      supabase
        .channel(`db-${table}`)
        .on("postgres_changes", { event: "*", schema: "public", table }, 
          (payload) => this.handleChange(table, payload)
        )
        .subscribe();
    }
  }

  private async handleChange(table: string, payload: any): Promise<void> {
    // Trigger syncDown to pull changes
    await this.syncService.syncDown();
    this.onUpdate?.(table, payload);
  }
}
```

## Conflict Resolution

**Strategy:** Last-write-wins based on `last_modified_at`

When Supabase returns a conflict:
1. Compare timestamps
2. Keep the record with the later timestamp
3. Log the conflict for debugging

```typescript
// Supabase upsert handles this via ON CONFLICT
await table.upsert(data, { onConflict: "id" });
```

## Error Handling

### Retry Logic

Failed items retry with exponential backoff:

```typescript
const retryDelays = [1, 5, 15, 60]; // minutes

async function retryFailedItems(): Promise<void> {
  const failedItems = await getFailedSyncItems(db);
  for (const item of failedItems) {
    if (shouldRetry(item)) {
      await processQueueItem(item);
    }
  }
}
```

### Error Categories

| Error | Action |
|-------|--------|
| Network error | Retry later |
| Auth expired | Refresh token, retry |
| Constraint violation | Log, skip item |
| Unknown error | Log, mark failed |

## Debugging

### View Sync Queue

```typescript
// In browser console
const db = window.__tunetrees_db__;
const pending = await db.all(sql`SELECT * FROM sync_queue WHERE status = 'pending'`);
console.table(pending);
```

### Force Sync

```typescript
// Via AuthContext
const { forceSyncUp, forceSyncDown } = useAuth();
await forceSyncUp();
```

### Logging

Enable verbose logging:

```typescript
// SyncEngine constructor
this.debug = true; // or check localStorage
```

---

For high-level architecture, see [development/architecture.md](../development/architecture.md).
