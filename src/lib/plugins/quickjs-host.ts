/** The page owns invocation deadlines and the worker generation. Bridge replies
 * return only to that same worker and only while their invocation is active. */
import {
  type FsrsResult,
  type InvokeRequest,
  isWorkerOutput,
  isWorkerInput,
  type PluginInvocation,
  type PluginBridge,
  type PluginFunctionName,
  type QueryResult,
} from "./quickjs-protocol";

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof globalThis.setTimeout>;
  startedAt: number;
  timeoutMs: number;
  functionName: PluginFunctionName;
  methodName?: "processFirstReview" | "processReview";
  pluginId?: string;
  pluginName?: string;
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

  const runner = worker;
  runner.onmessage = (event: MessageEvent<unknown>) => {
    if (worker !== runner || !isWorkerOutput(event.data)) return;
    const data = event.data;
    // A timeout can replace the worker while a database/FSRS callback is still
    // pending. Never deliver that callback to the new worker, whose bridge IDs
    // start over. Completed invocations also discard their late responses.
    const reply = (message: QueryResult | FsrsResult, invokeId: number) => {
      if (worker === runner && pending.has(invokeId))
        runner.postMessage(message);
    };

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
        reply(responder, data.invokeId);
        return;
      }

      Promise.resolve()
        .then(() => bridge.queryDb?.(data.sql))
        .then((result) => {
          console.info("[QuickJS][host] queryDb complete", {
            invokeId: data.invokeId,
            queryId: data.id,
            durationMs: performance.now() - queryStartedAt,
          });
          reply(
            {
              type: "queryResult",
              id: data.id,
              ok: true,
              result,
            } satisfies QueryResult,
            data.invokeId
          );
        })
        .catch((error: unknown) => {
          const message =
            error instanceof Error ? error.message : String(error);
          console.warn("[QuickJS][host] queryDb failed", {
            invokeId: data.invokeId,
            queryId: data.id,
            durationMs: performance.now() - queryStartedAt,
            error: message || "queryDb failed",
          });
          reply(
            {
              type: "queryResult",
              id: data.id,
              ok: false,
              error: { message: message || "queryDb failed" },
            } satisfies QueryResult,
            data.invokeId
          );
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
        reply(responder, data.invokeId);
        return;
      }

      const handler =
        data.method === "processFirstReview"
          ? scheduler.processFirstReview
          : scheduler.processReview;

      Promise.resolve()
        .then(() => handler(data.payload))
        .then((result) => {
          console.info("[QuickJS][host] fsrsScheduler complete", {
            invokeId: data.invokeId,
            fsrsId: data.id,
            method: data.method,
            durationMs: performance.now() - fsrsStartedAt,
          });
          reply(
            {
              type: "fsrsResult",
              id: data.id,
              ok: true,
              result,
            } satisfies FsrsResult,
            data.invokeId
          );
        })
        .catch((error: unknown) => {
          const message =
            error instanceof Error ? error.message : String(error);
          console.warn("[QuickJS][host] fsrsScheduler failed", {
            invokeId: data.invokeId,
            fsrsId: data.id,
            method: data.method,
            durationMs: performance.now() - fsrsStartedAt,
            error: message || "fsrsScheduler failed",
          });
          reply(
            {
              type: "fsrsResult",
              id: data.id,
              ok: false,
              error: { message: message || "fsrsScheduler failed" },
            } satisfies FsrsResult,
            data.invokeId
          );
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

  runner.onerror = (event) => {
    if (worker !== runner) return;
    resetWorker(`Plugin worker error: ${event.message}`);
  };

  runner.onmessageerror = () => {
    if (worker !== runner) return;
    resetWorker("Plugin worker message error");
  };

  return worker;
}

export async function runQuickJsPlugin(
  params: PluginInvocation & {
    timeoutMs?: number;
    bridge?: PluginBridge;
  }
): Promise<unknown> {
  if (params.functionName === "createScheduler" && !params.methodName) {
    throw new Error("Missing scheduler method name");
  }
  if (!isWorkerInput({ ...params, type: "invoke", id: 1 })) {
    throw new Error("Invalid plugin invocation parameters");
  }
  const runner = ensureWorker();
  requestId += 1;
  const id = requestId;
  const timeoutMs = params.timeoutMs ?? 8000;
  const startedAt = performance.now();
  const pluginMeta = extractPluginMeta(params.meta);

  return await new Promise((resolve, reject) => {
    const timeoutId = globalThis.setTimeout(() => {
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
      resetWorker("Plugin worker reset because another invocation timed out");
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

    try {
      runner.postMessage(message);
    } catch (error) {
      clearTimeout(timeoutId);
      pending.delete(id);
      bridges.delete(id);
      reject(error);
    }
  });
}

export function disposeQuickJsWorker() {
  resetWorker("Plugin worker disposed");
}
