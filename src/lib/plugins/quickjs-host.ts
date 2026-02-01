import type { PluginFunctionName } from "./quickjs-worker";

interface InvokeRequest {
  type: "invoke";
  id: number;
  functionName: PluginFunctionName;
  script: string;
  payload: unknown;
  meta?: unknown;
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

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeoutId: number;
}

let worker: Worker | null = null;
let requestId = 0;
const pending = new Map<number, PendingRequest>();

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
}

function ensureWorker(): Worker {
  if (worker) return worker;

  worker = new Worker(new URL("./quickjs-worker.ts", import.meta.url), {
    type: "module",
  });

  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const data = event.data;
    const entry = pending.get(data.id);
    if (!entry) return;

    clearTimeout(entry.timeoutId);
    pending.delete(data.id);

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
  payload: unknown;
  meta?: unknown;
  timeoutMs?: number;
}): Promise<unknown> {
  const runner = ensureWorker();
  requestId += 1;
  const id = requestId;
  const timeoutMs = params.timeoutMs ?? 8000;

  return await new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      pending.delete(id);
      resetWorker("Plugin execution timed out");
      reject(new Error("Plugin execution timed out"));
    }, timeoutMs);

    pending.set(id, { resolve, reject, timeoutId });

    const message: InvokeRequest = {
      type: "invoke",
      id,
      functionName: params.functionName,
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
