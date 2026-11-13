/// <reference lib="webworker" />
/** Worker shell: validated messages -> isolated VM invocation -> result.
 * Host requests can overlap; each pending entry belongs to one invocation.
 * The owning page terminates this worker when a plugin exceeds its deadline.
 */
import quickJsWasmUrl from "@jitl/quickjs-wasmfile-release-asyncify/wasm?url";
import {
  newQuickJSAsyncWASMModule,
  newVariant,
  RELEASE_ASYNC,
  type QuickJSAsyncRuntime,
} from "quickjs-emscripten";
import { executePlugin } from "./quickjs-core";
import {
  isWorkerInput,
  type QueryRequest,
  type FsrsRequest,
  type InvokeRequest,
  type WorkerResponse,
} from "./quickjs-protocol";
export type { PluginFunctionName } from "./quickjs-protocol";
const ctx = globalThis;
const QUICKJS_ASYNC_VARIANT = newVariant(RELEASE_ASYNC, {
  wasmLocation: quickJsWasmUrl,
  locateFile: (fileName) =>
    fileName.endsWith("emscripten-module.wasm") ? quickJsWasmUrl : fileName,
});

let runtimePromise: Promise<QuickJSAsyncRuntime> | null = null;
let runtimeInitMs: number | null = null;
let queryRequestId = 0;
let fsrsRequestId = 0;
const pendingQueries = new Map<
  number,
  {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    startedAt: number;
    invokeId: number;
  }
>();
const pendingFsrs = new Map<
  number,
  {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    startedAt: number;
    invokeId: number;
    method: "processFirstReview" | "processReview";
  }
>();

function getRuntime(): Promise<QuickJSAsyncRuntime> {
  if (!runtimePromise) {
    const startedAt = performance.now();
    runtimePromise = newQuickJSAsyncWASMModule(QUICKJS_ASYNC_VARIANT)
      .then((quickJsModule) => {
        const runtime = quickJsModule.newRuntime();
        runtimeInitMs = performance.now() - startedAt;
        console.info("[QuickJS][worker] Runtime initialized", {
          runtimeInitMs,
          wasmUrl: quickJsWasmUrl,
        });
        return runtime;
      })
      .catch((error) => {
        runtimePromise = null;
        console.warn("[QuickJS][worker] Runtime initialization failed", {
          wasmUrl: quickJsWasmUrl,
          error:
            error instanceof Error
              ? { name: error.name, message: error.message }
              : { message: "Unknown runtime initialization failure" },
        });
        throw error;
      });
  }
  return runtimePromise;
}

function requestQuery(invokeId: number, sql: string): Promise<unknown> {
  queryRequestId += 1;
  const id = queryRequestId;
  const msg: QueryRequest = { type: "query", id, invokeId, sql };
  ctx.postMessage(msg);
  return new Promise((resolve, reject) => {
    pendingQueries.set(id, {
      resolve,
      reject,
      startedAt: performance.now(),
      invokeId,
    });
  });
}

function requestFsrs(params: {
  invokeId: number;
  method: "processFirstReview" | "processReview";
  payload: unknown;
}): Promise<unknown> {
  fsrsRequestId += 1;
  const id = fsrsRequestId;
  const msg: FsrsRequest = {
    type: "fsrs",
    id,
    invokeId: params.invokeId,
    method: params.method,
    payload: params.payload,
  };
  ctx.postMessage(msg);
  return new Promise((resolve, reject) => {
    pendingFsrs.set(id, {
      resolve,
      reject,
      startedAt: performance.now(),
      invokeId: params.invokeId,
      method: params.method,
    });
  });
}

async function invoke(message: InvokeRequest): Promise<WorkerResponse> {
  const startedAt = performance.now();
  try {
    const runtime = await getRuntime();
    const result = await executePlugin(runtime, message, {
      queryDb: (query) => requestQuery(message.id, query),
      fsrsScheduler: {
        processFirstReview: (payload) =>
          requestFsrs({
            invokeId: message.id,
            method: "processFirstReview",
            payload,
          }),
        processReview: (payload) =>
          requestFsrs({
            invokeId: message.id,
            method: "processReview",
            payload,
          }),
      },
    });
    return {
      id: message.id,
      ok: true,
      result,
      timings: {
        runtimeInitMs: runtimeInitMs ?? 0,
        totalMs: performance.now() - startedAt,
      },
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    return {
      id: message.id,
      ok: false,
      error: { message: err.message, name: err.name, stack: err.stack },
    };
  } finally {
    // Release fire-and-forget host requests too. Their rejection is observed by
    // the core bridge, which no longer accesses its disposed guest context.
    for (const map of [pendingQueries, pendingFsrs]) {
      for (const [id, pending] of map)
        if (pending.invokeId === message.id) {
          map.delete(id);
          pending.reject(new Error("Plugin invocation finished"));
        }
    }
  }
}
ctx.addEventListener("message", (event: MessageEvent<unknown>) => {
  // Dedicated workers receive parent messages with an empty event.origin.
  // Window-style origin comparisons drop valid invocations and bridge replies.
  // Validate the private channel's protocol instead (see MDN worker message).
  if (!isWorkerInput(event.data)) return;
  const message = event.data;
  if (message.type === "invoke") {
    void invoke(message).then((response) => ctx.postMessage(response));
    return;
  }
  const map = message.type === "queryResult" ? pendingQueries : pendingFsrs;
  const pending = map.get(message.id);
  if (!pending) return;
  map.delete(message.id);
  if (message.ok) pending.resolve(message.result);
  else
    pending.reject(new Error(message.error?.message ?? "Plugin bridge failed"));
});
