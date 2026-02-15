import type {
  SyncChange,
  SyncRequest,
  SyncRequestOverrides,
  SyncResponse,
} from "@oosync/shared/protocol";

const WORKER_URL = import.meta.env.VITE_WORKER_URL || "http://localhost:8787";
const SYNC_DIAGNOSTICS = import.meta.env.VITE_SYNC_DIAGNOSTICS === "true";
const DEFAULT_SYNC_REQUEST_TIMEOUT_MS = 30_000;

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
      overrides?: SyncRequestOverrides | null;
      timeoutMs?: number;
    }
  ): Promise<SyncResponse> {
    const overrides = options?.overrides ?? undefined;
    const payload: SyncRequest = {
      changes,
      lastSyncAt,
      schemaVersion: 1,
      pullCursor: options?.pullCursor,
      syncStartedAt: options?.syncStartedAt,
      pageSize: options?.pageSize,
      collectionsOverride: overrides?.collectionsOverride,
      genreFilter: overrides?.genreFilter,
      pullTables: overrides?.pullTables,
    };

    const timeoutMs = options?.timeoutMs ?? DEFAULT_SYNC_REQUEST_TIMEOUT_MS;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${WORKER_URL}/api/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        throw new Error(`Sync request timed out after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Sync failed: ${response.status} ${text}`);
    }

    const json = await response.json();

    if (SYNC_DIAGNOSTICS) {
      const total = Array.isArray(json.changes) ? json.changes.length : 0;
      console.log(`[WorkerClientDiag] response totalChanges=${total}`);
      if (Array.isArray(json.debug) && json.debug.length > 0) {
        for (const line of json.debug.slice(0, 50)) {
          console.log(`[WorkerClientDiag] worker: ${String(line)}`);
        }
      }
    }

    return json;
  }
}
