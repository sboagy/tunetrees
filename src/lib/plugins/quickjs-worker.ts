/// <reference lib="webworker" />

import * as Papa from "papaparse";
import type {
  QuickJSAsyncContext,
  QuickJSAsyncRuntime,
  QuickJSHandle,
} from "quickjs-emscripten";
import { newAsyncRuntime } from "quickjs-emscripten";

export type PluginFunctionName = "parseImport" | "createScheduler";

interface InvokeMessage {
  type: "invoke";
  id: number;
  functionName: PluginFunctionName;
  methodName?: "processFirstReview" | "processReview";
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

interface QueryRequest {
  type: "query";
  id: number;
  invokeId: number;
  sql: string;
}

interface QueryResponse {
  type: "queryResult";
  id: number;
  ok: boolean;
  result?: unknown;
  error?: { message: string };
}

interface FsrsRequest {
  type: "fsrs";
  id: number;
  invokeId: number;
  method: "processFirstReview" | "processReview";
  payload: unknown;
}

interface FsrsResponse {
  type: "fsrsResult";
  id: number;
  ok: boolean;
  result?: unknown;
  error?: { message: string };
}

type AnyMessage = InvokeMessage | QueryResponse | FsrsResponse;

const ctx = self as DedicatedWorkerGlobalScope;

type CallResult = ReturnType<QuickJSAsyncContext["callFunction"]>;

let runtimePromise: Promise<QuickJSAsyncRuntime> | null = null;
let queryRequestId = 0;
let fsrsRequestId = 0;
const pendingQueries = new Map<
  number,
  { resolve: (value: unknown) => void; reject: (error: Error) => void }
>();
const pendingFsrs = new Map<
  number,
  { resolve: (value: unknown) => void; reject: (error: Error) => void }
>();

function getRuntime(): Promise<QuickJSAsyncRuntime> {
  if (!runtimePromise) {
    runtimePromise = newAsyncRuntime();
  }
  return runtimePromise;
}

function buildStaticHandles(qjs: QuickJSAsyncContext) {
  return {
    undefined: qjs.undefined,
    null: qjs.null,
    true: qjs.true,
    false: qjs.false,
  } as const;
}

function createHandleMapper(params: {
  qjs: QuickJSAsyncContext;
  staticHandles: ReturnType<typeof buildStaticHandles>;
}) {
  const { qjs, staticHandles } = params;

  const isStatic = (handle: QuickJSHandle) =>
    handle === staticHandles.undefined ||
    handle === staticHandles.null ||
    handle === staticHandles.true ||
    handle === staticHandles.false ||
    handle === qjs.global;

  const shouldDispose = (handle: QuickJSHandle) => !isStatic(handle);

  const toHandle = (value: unknown): QuickJSHandle => {
    if (value === null) return staticHandles.null;
    if (value === undefined) return staticHandles.undefined;
    if (typeof value === "string") return qjs.newString(value);
    if (typeof value === "number") return qjs.newNumber(value);
    if (typeof value === "boolean")
      return value ? staticHandles.true : staticHandles.false;

    if (Array.isArray(value)) {
      const arrayHandle = qjs.newArray();
      value.forEach((item, index) => {
        const itemHandle = toHandle(item);
        qjs.setProp(arrayHandle, index, itemHandle);
        if (shouldDispose(itemHandle)) itemHandle.dispose();
      });
      return arrayHandle;
    }

    if (value && typeof value === "object") {
      const objHandle = qjs.newObject();
      for (const [key, entry] of Object.entries(value)) {
        const entryHandle = toHandle(entry);
        qjs.setProp(objHandle, key, entryHandle);
        if (shouldDispose(entryHandle)) entryHandle.dispose();
      }
      return objHandle;
    }

    return staticHandles.undefined;
  };

  return { toHandle, shouldDispose };
}

function requestQuery(invokeId: number, sql: string): Promise<unknown> {
  queryRequestId += 1;
  const id = queryRequestId;
  ctx.postMessage({ type: "query", id, invokeId, sql } as QueryRequest);
  return new Promise((resolve, reject) => {
    pendingQueries.set(id, { resolve, reject });
  });
}

function requestFsrs(params: {
  invokeId: number;
  method: "processFirstReview" | "processReview";
  payload: unknown;
}): Promise<unknown> {
  fsrsRequestId += 1;
  const id = fsrsRequestId;
  ctx.postMessage({
    type: "fsrs",
    id,
    invokeId: params.invokeId,
    method: params.method,
    payload: params.payload,
  } as FsrsRequest);
  return new Promise((resolve, reject) => {
    pendingFsrs.set(id, { resolve, reject });
  });
}

async function executeInvoke(message: InvokeMessage): Promise<WorkerResponse> {
  const runtime = await getRuntime();
  const qjs = runtime.newContext();
  const staticHandles = buildStaticHandles(qjs);
  const { toHandle, shouldDispose } = createHandleMapper({
    qjs,
    staticHandles,
  });

  const disposables: QuickJSHandle[] = [];
  const track = (handle: QuickJSHandle) => {
    if (shouldDispose(handle)) disposables.push(handle);
    return handle;
  };

  try {
    const logHandle = qjs.newFunction("log", (...args) => {
      const values = args.map((arg) => qjs.dump(arg));
      // eslint-disable-next-line no-console
      console.log("[Plugin]", ...values);
      return staticHandles.undefined;
    });
    qjs.setProp(qjs.global, "log", logHandle);
    if (shouldDispose(logHandle)) logHandle.dispose();

    const parseJsonHandle = qjs.newFunction("parseJson", (arg) => {
      const raw = qjs.dump(arg);
      const text = typeof raw === "string" ? raw : JSON.stringify(raw ?? "");
      const parsed = JSON.parse(text);
      return toHandle(parsed);
    });
    qjs.setProp(qjs.global, "parseJson", parseJsonHandle);
    if (shouldDispose(parseJsonHandle)) parseJsonHandle.dispose();

    const parseCsvHandle = qjs.newFunction("parseCsv", (arg, configArg) => {
      const raw = qjs.dump(arg);
      if (typeof raw !== "string") {
        throw new Error("parseCsv expects a CSV string");
      }
      const config = configArg ? qjs.dump(configArg) : undefined;
      const result = Papa.parse(raw, {
        header: true,
        skipEmptyLines: true,
        worker: false,
        ...(config && typeof config === "object" ? config : {}),
      }) as unknown as Papa.ParseResult<unknown>;
      if (result.errors?.length) {
        const message = result.errors[0]?.message ?? "CSV parse error";
        throw new Error(message);
      }
      return toHandle(result.data);
    });
    qjs.setProp(qjs.global, "parseCsv", parseCsvHandle);
    if (shouldDispose(parseCsvHandle)) parseCsvHandle.dispose();

    const fetchUrlHandle = qjs.newAsyncifiedFunction(
      "fetchUrl",
      async (urlHandle, optionsHandle) => {
        const urlValue = qjs.dump(urlHandle);
        if (typeof urlValue !== "string") {
          throw new Error("fetchUrl expects a URL string");
        }
        const options = optionsHandle ? qjs.dump(optionsHandle) : undefined;
        const responseType =
          options && typeof options === "object"
            ? (options as Record<string, unknown>).responseType
            : undefined;
        const headers =
          options && typeof options === "object"
            ? (options as Record<string, unknown>).headers
            : undefined;
        const timeoutMs =
          options && typeof options === "object"
            ? Number((options as Record<string, unknown>).timeoutMs ?? 10000)
            : 10000;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const proxyUrl = `/api/proxy?url=${encodeURIComponent(urlValue)}`;
          const response = await fetch(proxyUrl, {
            headers: {
              Accept:
                responseType === "json" ? "application/json" : "text/plain",
              ...(headers && typeof headers === "object" ? headers : {}),
            },
            signal: controller.signal,
          });

          if (!response.ok) {
            throw new Error(`Proxy request failed: ${response.status}`);
          }

          if (responseType === "json") {
            const data = await response.json();
            return toHandle(data);
          }

          const text = await response.text();
          return qjs.newString(text);
        } finally {
          clearTimeout(timeoutId);
        }
      }
    );
    qjs.setProp(qjs.global, "fetchUrl", fetchUrlHandle);
    if (shouldDispose(fetchUrlHandle)) fetchUrlHandle.dispose();

    const queryDbHandle = qjs.newAsyncifiedFunction(
      "queryDb",
      async (sqlHandle) => {
        const raw = qjs.dump(sqlHandle);
        if (typeof raw !== "string") {
          throw new Error("queryDb expects a SQL string");
        }
        const result = await requestQuery(message.id, raw);
        return toHandle(result);
      }
    );
    qjs.setProp(qjs.global, "queryDb", queryDbHandle);
    if (shouldDispose(queryDbHandle)) queryDbHandle.dispose();

    const fsrsSchedulerHandle = qjs.newObject();
    const processFirstHandle = qjs.newAsyncifiedFunction(
      "processFirstReview",
      async (payloadHandle) => {
        const payload = qjs.dump(payloadHandle);
        const result = await requestFsrs({
          invokeId: message.id,
          method: "processFirstReview",
          payload,
        });
        return toHandle(result);
      }
    );
    qjs.setProp(fsrsSchedulerHandle, "processFirstReview", processFirstHandle);
    if (shouldDispose(processFirstHandle)) processFirstHandle.dispose();

    const processReviewHandle = qjs.newAsyncifiedFunction(
      "processReview",
      async (payloadHandle) => {
        const payload = qjs.dump(payloadHandle);
        const result = await requestFsrs({
          invokeId: message.id,
          method: "processReview",
          payload,
        });
        return toHandle(result);
      }
    );
    qjs.setProp(fsrsSchedulerHandle, "processReview", processReviewHandle);
    if (shouldDispose(processReviewHandle)) processReviewHandle.dispose();
    qjs.setProp(qjs.global, "fsrsScheduler", fsrsSchedulerHandle);
    if (shouldDispose(fsrsSchedulerHandle)) fsrsSchedulerHandle.dispose();

    const evalResult = await qjs.evalCodeAsync(message.script);
    const evalHandle = qjs.unwrapResult(evalResult);
    if (shouldDispose(evalHandle)) evalHandle.dispose();

    let callResult: CallResult;

    if (message.functionName === "createScheduler") {
      const factoryHandle = track(qjs.getProp(qjs.global, "createScheduler"));
      if (qjs.typeof(factoryHandle) !== "function") {
        throw new Error("Plugin did not define createScheduler()");
      }

      const contextHandle = track(qjs.newObject());
      const fsrsHandle = track(qjs.getProp(qjs.global, "fsrsScheduler"));
      const queryHandle = track(qjs.getProp(qjs.global, "queryDb"));
      qjs.setProp(contextHandle, "fsrsScheduler", fsrsHandle);
      qjs.setProp(contextHandle, "queryDb", queryHandle);

      const schedulerResult = qjs.callFunction(
        factoryHandle,
        qjs.global,
        contextHandle
      );
      const schedulerHandle = track(qjs.unwrapResult(schedulerResult));

      if (!message.methodName) {
        throw new Error("Missing scheduler method name");
      }

      const methodHandle = track(
        qjs.getProp(schedulerHandle, message.methodName)
      );
      if (qjs.typeof(methodHandle) !== "function") {
        throw new Error(
          `Scheduler missing ${message.methodName}() implementation`
        );
      }

      const payloadHandle = track(toHandle(message.payload));
      const metaHandle = track(toHandle(message.meta ?? null));
      callResult = qjs.callFunction(
        methodHandle,
        schedulerHandle,
        payloadHandle,
        metaHandle
      );
    } else {
      const fnHandle = track(qjs.getProp(qjs.global, message.functionName));
      if (qjs.typeof(fnHandle) !== "function") {
        throw new Error(`Plugin did not define ${message.functionName}()`);
      }

      const payloadHandle = track(toHandle(message.payload));
      const metaHandle = track(toHandle(message.meta ?? null));
      callResult = qjs.callFunction(
        fnHandle,
        qjs.global,
        payloadHandle,
        metaHandle
      );
    }
    const valueHandle = track(qjs.unwrapResult(callResult));
    const resolvedResult = await qjs.resolvePromise(valueHandle);
    const resolvedHandle = track(qjs.unwrapResult(resolvedResult));

    const result = qjs.dump(resolvedHandle);

    return {
      id: message.id,
      ok: true,
      result,
    };
  } catch (error) {
    const err = error as Error;
    return {
      id: message.id,
      ok: false,
      error: {
        message: err.message || "Plugin execution failed",
        name: err.name,
        stack: err.stack,
      },
    };
  } finally {
    for (const handle of disposables) {
      try {
        handle.dispose();
      } catch {
        // ignore dispose errors
      }
    }
    qjs.dispose();
  }
}

ctx.addEventListener("message", (event: MessageEvent<AnyMessage>) => {
  const message = event.data;
  if (message.type === "invoke") {
    executeInvoke(message).then((response) => {
      ctx.postMessage(response);
    });
    return;
  }

  if (message.type === "queryResult") {
    const pendingQuery = pendingQueries.get(message.id);
    if (!pendingQuery) return;
    pendingQueries.delete(message.id);
    if (message.ok) {
      pendingQuery.resolve(message.result);
    } else {
      pendingQuery.reject(
        new Error(message.error?.message ?? "queryDb failed")
      );
    }
    return;
  }

  if (message.type === "fsrsResult") {
    const pendingRequest = pendingFsrs.get(message.id);
    if (!pendingRequest) return;
    pendingFsrs.delete(message.id);
    if (message.ok) {
      pendingRequest.resolve(message.result);
    } else {
      pendingRequest.reject(
        new Error(message.error?.message ?? "fsrsScheduler failed")
      );
    }
  }
});
