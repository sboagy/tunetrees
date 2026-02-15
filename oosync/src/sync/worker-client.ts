import type {
  SyncChange,
  SyncRequest,
  SyncRequestOverrides,
  SyncResponse,
} from "@oosync/shared/protocol";

const WORKER_URL = import.meta.env.VITE_WORKER_URL || "http://localhost:8787";
const SYNC_DIAGNOSTICS = import.meta.env.VITE_SYNC_DIAGNOSTICS !== "false";
const DEFAULT_SYNC_REQUEST_TIMEOUT_MS = 30_000;

export class WorkerClient {
  private token: string;
  private static requestSeq = 0;

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

    const requestId = `wc-${Date.now().toString(36)}-${(++WorkerClient.requestSeq).toString(36)}`;

    const timeoutMs = options?.timeoutMs ?? DEFAULT_SYNC_REQUEST_TIMEOUT_MS;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = performance.now();

    if (SYNC_DIAGNOSTICS) {
      const cursorSummary = options?.pullCursor
        ? "present"
        : "none";
      console.log(
        `[WorkerClientDiag] request id=${requestId} changesIn=${changes.length} lastSyncAt=${lastSyncAt ?? "null"} cursor=${cursorSummary} pageSize=${options?.pageSize ?? "null"} timeoutMs=${timeoutMs}`
      );
    }

    let response: Response;
    try {
      response = await fetch(`${WORKER_URL}/api/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`,
          "x-client-sync-request-id": requestId,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        if (SYNC_DIAGNOSTICS) {
          const durationMs = Math.round(performance.now() - startedAt);
          console.warn(
            `[WorkerClientDiag] timeout id=${requestId} durationMs=${durationMs} timeoutMs=${timeoutMs}`
          );
        }
        throw new Error(`Sync request timed out after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const text = await response.text();
      if (SYNC_DIAGNOSTICS) {
        const durationMs = Math.round(performance.now() - startedAt);
        console.warn(
          `[WorkerClientDiag] httpError id=${requestId} status=${response.status} durationMs=${durationMs}`
        );
      }
      throw new Error(`Sync failed: ${response.status} ${text}`);
    }

    const json = await response.json();

    if (SYNC_DIAGNOSTICS) {
      const durationMs = Math.round(performance.now() - startedAt);
      const total = Array.isArray(json.changes) ? json.changes.length : 0;
      console.log(
        `[WorkerClientDiag] response id=${requestId} status=${response.status} totalChanges=${total} nextCursor=${json.nextCursor ? "yes" : "no"} durationMs=${durationMs}`
      );
      if (Array.isArray(json.debug) && json.debug.length > 0) {
        for (const line of json.debug.slice(0, 50)) {
          console.log(`[WorkerClientDiag] worker: ${String(line)}`);
        }
      }
    }

    return json;
  }
}
