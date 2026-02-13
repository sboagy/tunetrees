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
}

interface WorkerResponseError {
  id: number;
  ok: false;
  error: {
    message: string;
    name?: string;
    stack?: string;
  };
}

type WorkerResponse = WorkerResponseOk | WorkerResponseError;

type WorkerMessage = WorkerResponse | QueryRequest | FsrsRequest;

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeoutId: number;
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

  worker = new Worker(new URL("./quickjs-worker.ts", import.meta.url), {
    type: "module",
  });

  worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
    const data = event.data;

    if ("type" in data && data.type === "query") {
      const bridge = bridges.get(data.invokeId);
      const responder: QueryResult = {
        type: "queryResult",
        id: data.id,
        ok: false,
        error: { message: "queryDb not available" },
      };

      if (!bridge?.queryDb) {
        worker?.postMessage(responder);
        return;
      }

      bridge
        .queryDb(data.sql)
        .then((result) => {
          worker?.postMessage({
            type: "queryResult",
            id: data.id,
            ok: true,
            result,
          } satisfies QueryResult);
        })
        .catch((error: Error) => {
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
      const bridge = bridges.get(data.invokeId);
      const responder: FsrsResult = {
        type: "fsrsResult",
        id: data.id,
        ok: false,
        error: { message: "fsrsScheduler not available" },
      };

      const scheduler = bridge?.fsrsScheduler;
      if (!scheduler) {
        worker?.postMessage(responder);
        return;
      }

      const handler =
        data.method === "processFirstReview"
          ? scheduler.processFirstReview
          : scheduler.processReview;

      handler(data.payload)
        .then((result) => {
          worker?.postMessage({
            type: "fsrsResult",
            id: data.id,
            ok: true,
            result,
          } satisfies FsrsResult);
        })
        .catch((error: Error) => {
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

    if (data.ok) {
      entry.resolve(data.result);
    } else {
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

  return await new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      pending.delete(id);
      resetWorker(`Plugin execution timed out (${timeoutMs} ms)`);
      reject(new Error(`Plugin execution timed out (${timeoutMs} ms)`));
    }, timeoutMs);

    pending.set(id, { resolve, reject, timeoutId });
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

    runner.postMessage(message);
  });
}

export function disposeQuickJsWorker() {
  resetWorker("Plugin worker disposed");
}
