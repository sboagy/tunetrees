import { sql } from "drizzle-orm";
import type { SqliteDatabase } from "@/lib/db/client-sqlite";

type BaselineEvent = {
  name: string;
  at: string;
  elapsedMs: number;
  detail?: Record<string, unknown>;
};

type BaselineRequest = {
  id: number;
  method: string;
  url: string;
  category: "sync" | "media";
  startedAt: string;
  elapsedStartMs: number;
  durationMs?: number;
  status?: number;
  ok?: boolean;
  error?: string;
};

type BaselineSnapshot = {
  name: string;
  at: string;
  elapsedMs: number;
  tableCounts?: Record<string, number>;
  queue?: {
    pending: number;
    inProgress: number;
    failed: number;
    total: number;
  };
  user?: {
    id: string;
    profileRows: number;
    repertoireRows: number;
    activeRepertoireRows: number;
    repertoireTuneRows: number;
    activeQueueRows: number;
    stagedRows: number;
  };
  foreignKeyViolations?: Array<{
    table: string;
    rowid: number | string | null;
    parent: string;
    fkid: number | string | null;
  }>;
  errors?: string[];
};

export type SyncBaselineDiagnostics = {
  runId: string;
  startedAt: string;
  enabled: boolean;
  events: BaselineEvent[];
  requests: BaselineRequest[];
  snapshots: BaselineSnapshot[];
};

declare global {
  interface Window {
    __ttBaselineDiagnostics?: SyncBaselineDiagnostics;
    __ttBaselineFetchWrapped?: boolean;
  }
}

let memoryDiagnostics: SyncBaselineDiagnostics | null = null;
let requestId = 0;

const DIAGNOSTICS_STORAGE_KEY = "tunetrees:sync-baseline-diagnostics";
const DIAGNOSTICS_QUERY_KEYS = ["ttSyncDiagnostics", "syncDiagnostics"];

const nowIso = () => new Date().toISOString();

const createDiagnostics = (enabled: boolean): SyncBaselineDiagnostics => ({
  runId: `baseline-${Date.now().toString(36)}`,
  startedAt: nowIso(),
  enabled,
  events: [],
  requests: [],
  snapshots: [],
});

export function isSyncBaselineDiagnosticsEnabled(): boolean {
  return (
    import.meta.env.VITE_SYNC_DIAGNOSTICS === "true" ||
    isRuntimeDiagnosticsEnabled()
  );
}

export function getSyncBaselineDiagnostics(): SyncBaselineDiagnostics {
  const enabled = isSyncBaselineDiagnosticsEnabled();
  memoryDiagnostics ??= createDiagnostics(enabled);
  memoryDiagnostics.enabled = enabled;

  if (globalThis.window !== undefined) {
    globalThis.window.__ttBaselineDiagnostics = memoryDiagnostics;
  }

  return memoryDiagnostics;
}

export function setSyncBaselineDiagnosticsEnabled(enabled: boolean): void {
  if (globalThis.window !== undefined) {
    try {
      globalThis.window.localStorage.setItem(
        DIAGNOSTICS_STORAGE_KEY,
        String(enabled)
      );
    } catch {
      // Ignore storage errors; the in-memory diagnostics object still updates.
    }
  }

  const diagnostics = getSyncBaselineDiagnostics();
  diagnostics.enabled = enabled;

  if (enabled) {
    installSyncBaselineFetchDiagnostics();
  }
}

function elapsedMs(): number {
  const diagnostics = getSyncBaselineDiagnostics();
  return Date.now() - new Date(diagnostics.startedAt).getTime();
}

function emitBaselineLog(message: string, payload?: unknown): void {
  if (!isSyncBaselineDiagnosticsEnabled()) return;
  if (payload === undefined) {
    console.log(`[TTBaseline] ${message}`);
  } else {
    console.log(`[TTBaseline] ${message}`, payload);
  }
}

export function markSyncBaselineEvent(
  name: string,
  detail?: Record<string, unknown>
): void {
  const diagnostics = getSyncBaselineDiagnostics();
  const event = {
    name,
    at: nowIso(),
    elapsedMs: elapsedMs(),
    ...(detail ? { detail } : {}),
  };
  diagnostics.events.push(event);
  emitBaselineLog(`${name} +${event.elapsedMs}ms`, detail);
}

function classifyRequest(url: string): "sync" | "media" | null {
  if (url.includes("/api/sync")) return "sync";
  if (url.includes("/api/media/")) return "media";
  return null;
}

function getRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function parseDiagnosticsFlag(value: string | null): boolean | null {
  if (value === null) return null;

  const normalized = value.trim().toLowerCase();
  if (["", "1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return null;
}

function isRuntimeDiagnosticsEnabled(): boolean {
  if (globalThis.window === undefined) return false;

  try {
    const searchParams = new URLSearchParams(globalThis.window.location.search);
    for (const key of DIAGNOSTICS_QUERY_KEYS) {
      const value = parseDiagnosticsFlag(searchParams.get(key));
      if (value !== null) {
        globalThis.window.localStorage.setItem(
          DIAGNOSTICS_STORAGE_KEY,
          String(value)
        );
        return value;
      }
    }

    return (
      parseDiagnosticsFlag(
        globalThis.window.localStorage.getItem(DIAGNOSTICS_STORAGE_KEY)
      ) === true
    );
  } catch {
    return false;
  }
}

export function installSyncBaselineFetchDiagnostics(): void {
  if (globalThis.window === undefined) return;
  if (globalThis.window.__ttBaselineFetchWrapped) return;
  if (!isSyncBaselineDiagnosticsEnabled()) return;

  const originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.window.__ttBaselineFetchWrapped = true;

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = getRequestUrl(input);
    const category = classifyRequest(requestUrl);

    if (!category || !isSyncBaselineDiagnosticsEnabled()) {
      return await originalFetch(input, init);
    }

    const diagnostics = getSyncBaselineDiagnostics();
    const method =
      init?.method ??
      (typeof input === "object" && "method" in input ? input.method : "GET");
    const id = ++requestId;
    const startedAt = performance.now();
    const request: BaselineRequest = {
      id,
      method,
      url: requestUrl,
      category,
      startedAt: nowIso(),
      elapsedStartMs: elapsedMs(),
    };
    diagnostics.requests.push(request);
    emitBaselineLog(`request:${category}:start #${id}`, {
      method,
      url: requestUrl,
    });

    try {
      const response = await originalFetch(input, init);
      request.durationMs = Math.round(performance.now() - startedAt);
      request.status = response.status;
      request.ok = response.ok;
      emitBaselineLog(`request:${category}:end #${id}`, {
        status: response.status,
        ok: response.ok,
        durationMs: request.durationMs,
      });
      return response;
    } catch (error) {
      request.durationMs = Math.round(performance.now() - startedAt);
      request.error = error instanceof Error ? error.message : String(error);
      emitBaselineLog(`request:${category}:error #${id}`, {
        durationMs: request.durationMs,
        error: request.error,
      });
      throw error;
    }
  };
}

const countRows = (
  db: SqliteDatabase,
  query: ReturnType<typeof sql>
): number => {
  const rows = db.all<{ count: number }>(query);
  return Number(rows[0]?.count ?? 0);
};

export async function captureSyncBaselineSnapshot(
  name: string,
  db: SqliteDatabase,
  userId?: string | null
): Promise<void> {
  const diagnostics = getSyncBaselineDiagnostics();
  if (!diagnostics.enabled) return;

  const snapshot: BaselineSnapshot = {
    name,
    at: nowIso(),
    elapsedMs: elapsedMs(),
  };
  const errors: string[] = [];

  try {
    const tableRows = db.all<{ table_name: string; count: number }>(sql`
      SELECT 'user_profile' AS table_name, COUNT(*) AS count FROM user_profile
      UNION ALL SELECT 'repertoire', COUNT(*) FROM repertoire
      UNION ALL SELECT 'repertoire_tune', COUNT(*) FROM repertoire_tune
      UNION ALL SELECT 'tune', COUNT(*) FROM tune
      UNION ALL SELECT 'genre', COUNT(*) FROM genre
      UNION ALL SELECT 'tune_type', COUNT(*) FROM tune_type
      UNION ALL SELECT 'genre_tune_type', COUNT(*) FROM genre_tune_type
      UNION ALL SELECT 'rhythm_patterns', COUNT(*) FROM rhythm_patterns
      UNION ALL SELECT 'practice_record', COUNT(*) FROM practice_record
      UNION ALL SELECT 'daily_practice_queue', COUNT(*) FROM daily_practice_queue
      UNION ALL SELECT 'media_asset', COUNT(*) FROM media_asset
    `);
    snapshot.tableCounts = Object.fromEntries(
      tableRows.map((row) => [row.table_name, Number(row.count)])
    );
  } catch (error) {
    errors.push(
      `tableCounts: ${error instanceof Error ? error.message : error}`
    );
  }

  try {
    const queueRows = db.all<{
      pending: number;
      in_progress: number;
      failed: number;
      total: number;
    }>(sql`
      SELECT
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
        COUNT(*) AS total
      FROM sync_push_queue
    `);
    const queue = queueRows[0];
    snapshot.queue = {
      pending: Number(queue?.pending ?? 0),
      inProgress: Number(queue?.in_progress ?? 0),
      failed: Number(queue?.failed ?? 0),
      total: Number(queue?.total ?? 0),
    };
  } catch (error) {
    errors.push(`queue: ${error instanceof Error ? error.message : error}`);
  }

  if (userId) {
    try {
      snapshot.user = {
        id: userId,
        profileRows: countRows(
          db,
          sql`SELECT COUNT(*) AS count FROM user_profile WHERE id = ${userId}`
        ),
        repertoireRows: countRows(
          db,
          sql`SELECT COUNT(*) AS count FROM repertoire WHERE user_ref = ${userId}`
        ),
        activeRepertoireRows: countRows(
          db,
          sql`SELECT COUNT(*) AS count FROM repertoire WHERE user_ref = ${userId} AND deleted = 0`
        ),
        repertoireTuneRows: countRows(
          db,
          sql`
            SELECT COUNT(*) AS count
            FROM repertoire_tune pt
            JOIN repertoire p ON p.repertoire_id = pt.repertoire_ref
            WHERE p.user_ref = ${userId}
          `
        ),
        activeQueueRows: countRows(
          db,
          sql`
            SELECT COUNT(*) AS count
            FROM daily_practice_queue
            WHERE user_ref = ${userId} AND active = 1
          `
        ),
        stagedRows: countRows(
          db,
          sql`
            SELECT COUNT(*) AS count
            FROM practice_list_staged
            WHERE user_ref = ${userId}
          `
        ),
      };
    } catch (error) {
      errors.push(`user:${error instanceof Error ? error.message : error}`);
    }
  }

  try {
    snapshot.foreignKeyViolations = db
      .all<{
        table: string;
        rowid: number | string | null;
        parent: string;
        fkid: number | string | null;
      }>("PRAGMA foreign_key_check")
      .slice(0, 25);
  } catch (error) {
    errors.push(
      `foreignKeyCheck: ${error instanceof Error ? error.message : error}`
    );
  }

  if (errors.length > 0) snapshot.errors = errors;
  diagnostics.snapshots.push(snapshot);
  emitBaselineLog(`snapshot:${name} +${snapshot.elapsedMs}ms`, snapshot);
}
