/// <reference lib="webworker" />
/** Worker shell: validated messages -> isolated VM invocation -> result.
 * Host requests can overlap; each pending entry belongs to one invocation.
 * The owning page terminates this worker when a plugin exceeds its deadline.
 */
import quickJsWasmUrl from "@jitl/quickjs-wasmfile-release-asyncify/wasm?url";
import {
  newQuickJSAsyncWASMModule,
  newVariant,
  type QuickJSAsyncRuntime,
  RELEASE_ASYNC,
} from "quickjs-emscripten";
import { executePlugin } from "./quickjs-core";
import {
  type FsrsRequest,
  type InvokeRequest,
  isWorkerInput,
  type QueryRequest,
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
// S2819: this dedicated worker receives messages from its owning page through
// Worker.postMessage(), not through a window's cross-origin message listener.
// Dedicated-worker messages have an empty event.origin; comparing it with our
// origin would drop valid invocations and bridge replies. Validate the private
// channel's protocol below instead. Keep this exception local to this listener.
// https://developer.mozilla.org/en-US/docs/Web/API/DedicatedWorkerGlobalScope/message_event
// biome-ignore format: NOSONAR must stay on the listener's reported line.
ctx.addEventListener("message", (event: MessageEvent<unknown>) => { // NOSONAR: S2819 — private dedicated-worker channel; see rationale above.
  if (!isWorkerInput(event.data)) return;
  const message = event.data;
  if (message.type === "invoke") {
    void invoke(message)
      .then((response) => ctx.postMessage(response))
      .catch((error: unknown) => {
        // A result can fail structured cloning. Reply with plain strings using
        // the original invocation ID so only this caller is rejected.
        ctx.postMessage({
          id: message.id,
          ok: false,
          error: { message: error instanceof Error ? error.message : String(error) },
        } satisfies WorkerResponse);
      });
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
