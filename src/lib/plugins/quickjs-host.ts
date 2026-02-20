import type { PluginFunctionName } from "./quickjs-worker";

interface InvokeRequest {
  type: "invoke";
  id: number;
  functionName: PluginFunctionName;
  methodName?: "processFirstReview" | "processReview";
  script: string;
  payload: unknown;
  meta?: unknown;
}

interface QueryRequest {
  type: "query";
  id: number;
  invokeId: number;
  sql: string;
}

interface FsrsRequest {
  type: "fsrs";
  id: number;
  invokeId: number;
  method: "processFirstReview" | "processReview";
  payload: unknown;
}

interface QueryResult {
  type: "queryResult";
  id: number;
  ok: boolean;
  result?: unknown;
  error?: { message: string };
}

interface FsrsResult {
  type: "fsrsResult";
  id: number;
  ok: boolean;
  result?: unknown;
  error?: { message: string };
}

interface WorkerResponseOk {
  id: number;
  ok: true;
  result: unknown;
  timings?: Record<string, number>;
}

interface WorkerResponseError {
  id: number;
  ok: false;
  error: {
    message: string;
    name?: string;
    stack?: string;
  };
  timings?: Record<string, number>;
}

type WorkerResponse = WorkerResponseOk | WorkerResponseError;

type WorkerMessage = WorkerResponse | QueryRequest | FsrsRequest;

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeoutId: number;
  startedAt: number;
  timeoutMs: number;
  functionName: PluginFunctionName;
  methodName?: "processFirstReview" | "processReview";
  pluginId?: string;
  pluginName?: string;
}

interface PluginBridge {
  queryDb?: (sql: string) => Promise<unknown>;
  fsrsScheduler?: {
    processFirstReview: (payload: unknown) => Promise<unknown>;
    processReview: (payload: unknown) => Promise<unknown>;
  };
}

let worker: Worker | null = null;
let requestId = 0;
const pending = new Map<number, PendingRequest>();
const bridges = new Map<number, PluginBridge>();

function extractPluginMeta(meta: unknown): {
  pluginId?: string;
  pluginName?: string;
} {
  if (!meta || typeof meta !== "object") return {};
  const record = meta as Record<string, unknown>;
  return {
    pluginId: typeof record.pluginId === "string" ? record.pluginId : undefined,
    pluginName:
      typeof record.pluginName === "string" ? record.pluginName : undefined,
  };
}

function resetWorker(reason: string) {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  for (const [id, entry] of pending.entries()) {
    clearTimeout(entry.timeoutId);
    entry.reject(new Error(reason));
    pending.delete(id);
  }
  bridges.clear();
}

function ensureWorker(): Worker {
  if (worker) return worker;

  const workerStart = performance.now();
  worker = new Worker(new URL("./quickjs-worker.ts", import.meta.url), {
    type: "module",
  });
  console.info("[QuickJS][host] Worker created", {
    createMs: performance.now() - workerStart,
  });

  worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
    const data = event.data;

    if ("type" in data && data.type === "query") {
      const queryStartedAt = performance.now();
      const bridge = bridges.get(data.invokeId);
      const responder: QueryResult = {
        type: "queryResult",
        id: data.id,
        ok: false,
        error: { message: "queryDb not available" },
      };

      if (!bridge?.queryDb) {
        console.warn("[QuickJS][host] queryDb bridge missing", {
          invokeId: data.invokeId,
          queryId: data.id,
        });
        worker?.postMessage(responder);
        return;
      }

      bridge
        .queryDb(data.sql)
        .then((result) => {
          console.info("[QuickJS][host] queryDb complete", {
            invokeId: data.invokeId,
            queryId: data.id,
            durationMs: performance.now() - queryStartedAt,
          });
          worker?.postMessage({
            type: "queryResult",
            id: data.id,
            ok: true,
            result,
          } satisfies QueryResult);
        })
        .catch((error: Error) => {
          console.warn("[QuickJS][host] queryDb failed", {
            invokeId: data.invokeId,
            queryId: data.id,
            durationMs: performance.now() - queryStartedAt,
            error: error.message || "queryDb failed",
          });
          worker?.postMessage({
            type: "queryResult",
            id: data.id,
            ok: false,
            error: { message: error.message || "queryDb failed" },
          } satisfies QueryResult);
        });
      return;
    }

    if ("type" in data && data.type === "fsrs") {
      const fsrsStartedAt = performance.now();
      const bridge = bridges.get(data.invokeId);
      const responder: FsrsResult = {
        type: "fsrsResult",
        id: data.id,
        ok: false,
        error: { message: "fsrsScheduler not available" },
      };

      const scheduler = bridge?.fsrsScheduler;
      if (!scheduler) {
        console.warn("[QuickJS][host] fsrsScheduler bridge missing", {
          invokeId: data.invokeId,
          fsrsId: data.id,
          method: data.method,
        });
        worker?.postMessage(responder);
        return;
      }

      const handler =
        data.method === "processFirstReview"
          ? scheduler.processFirstReview
          : scheduler.processReview;

      handler(data.payload)
        .then((result) => {
          console.info("[QuickJS][host] fsrsScheduler complete", {
            invokeId: data.invokeId,
            fsrsId: data.id,
            method: data.method,
            durationMs: performance.now() - fsrsStartedAt,
          });
          worker?.postMessage({
            type: "fsrsResult",
            id: data.id,
            ok: true,
            result,
          } satisfies FsrsResult);
        })
        .catch((error: Error) => {
          console.warn("[QuickJS][host] fsrsScheduler failed", {
            invokeId: data.invokeId,
            fsrsId: data.id,
            method: data.method,
            durationMs: performance.now() - fsrsStartedAt,
            error: error.message || "fsrsScheduler failed",
          });
          worker?.postMessage({
            type: "fsrsResult",
            id: data.id,
            ok: false,
            error: { message: error.message || "fsrsScheduler failed" },
          } satisfies FsrsResult);
        });
      return;
    }

    const entry = pending.get(data.id);
    if (!entry) return;

    clearTimeout(entry.timeoutId);
    pending.delete(data.id);
    bridges.delete(data.id);

    const totalMs = performance.now() - entry.startedAt;

    console.info("[QuickJS][host] invoke response", {
      id: data.id,
      ok: data.ok,
      functionName: entry.functionName,
      methodName: entry.methodName,
      pluginId: entry.pluginId,
      pluginName: entry.pluginName,
      timeoutMs: entry.timeoutMs,
      totalMs,
      workerTimings: data.timings,
    });

    if (data.ok) {
      entry.resolve(data.result);
    } else {
      console.warn("[QuickJS][host] invoke failed", {
        id: data.id,
        functionName: entry.functionName,
        methodName: entry.methodName,
        pluginId: entry.pluginId,
        pluginName: entry.pluginName,
        totalMs,
        error: data.error.message,
        workerTimings: data.timings,
      });
      const err = new Error(data.error.message);
      err.name = data.error.name ?? "PluginError";
      if (data.error.stack) err.stack = data.error.stack;
      entry.reject(err);
    }
  };

  worker.onerror = (event) => {
    resetWorker(`Plugin worker error: ${event.message}`);
  };

  worker.onmessageerror = () => {
    resetWorker("Plugin worker message error");
  };

  return worker;
}

export async function runQuickJsPlugin(params: {
  script: string;
  functionName: PluginFunctionName;
  methodName?: "processFirstReview" | "processReview";
  payload: unknown;
  meta?: unknown;
  timeoutMs?: number;
  bridge?: PluginBridge;
}): Promise<unknown> {
  const runner = ensureWorker();
  requestId += 1;
  const id = requestId;
  const timeoutMs = params.timeoutMs ?? 8000;
  const startedAt = performance.now();
  const pluginMeta = extractPluginMeta(params.meta);

  return await new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      const elapsedMs = performance.now() - startedAt;
      console.warn("[QuickJS][host] invoke timeout", {
        id,
        functionName: params.functionName,
        methodName: params.methodName,
        timeoutMs,
        elapsedMs,
        pendingCount: pending.size,
        ...pluginMeta,
      });
      pending.delete(id);
      resetWorker(`Plugin execution timed out (${timeoutMs} ms)`);
      reject(new Error(`Plugin execution timed out (${timeoutMs} ms)`));
    }, timeoutMs);

    pending.set(id, {
      resolve,
      reject,
      timeoutId,
      startedAt,
      timeoutMs,
      functionName: params.functionName,
      methodName: params.methodName,
      ...pluginMeta,
    });
    if (params.bridge) {
      bridges.set(id, params.bridge);
    }

    const message: InvokeRequest = {
      type: "invoke",
      id,
      functionName: params.functionName,
      methodName: params.methodName,
      script: params.script,
      payload: params.payload,
      meta: params.meta,
    };

    console.info("[QuickJS][host] invoke dispatched", {
      id,
      functionName: params.functionName,
      methodName: params.methodName,
      timeoutMs,
      hasBridge: Boolean(params.bridge),
      ...pluginMeta,
    });

    runner.postMessage(message);
  });
}

export function disposeQuickJsWorker() {
  resetWorker("Plugin worker disposed");
}
