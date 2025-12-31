import type {
  SyncChange,
  SyncRequest,
  SyncResponse,
} from "@oosync/shared/protocol";

const WORKER_URL = import.meta.env.VITE_WORKER_URL || "http://localhost:8787";

export class WorkerClient {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  async sync(
    changes: SyncChange[],
    lastSyncAt?: string,
    options?: {
      pullCursor?: string;
      syncStartedAt?: string;
      pageSize?: number;
    }
  ): Promise<SyncResponse> {
    const payload: SyncRequest = {
      changes,
      lastSyncAt,
      schemaVersion: 1,
      pullCursor: options?.pullCursor,
      syncStartedAt: options?.syncStartedAt,
      pageSize: options?.pageSize,
    };

    const response = await fetch(`${WORKER_URL}/api/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Sync failed: ${response.status} ${text}`);
    }

    const json = await response.json();

    // DEBUG: Check tune count in raw response
    const tuneChanges =
      json.changes?.filter((c: SyncChange) => c.table === "tune") || [];
    console.log(
      `[WorkerClient] Raw response tune count: ${tuneChanges.length}, total changes: ${json.changes?.length || 0}`
    );

    return json;
  }
}
