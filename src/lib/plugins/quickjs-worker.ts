/// <reference lib="webworker" />

import * as Papa from "papaparse";
import type {
  QuickJSAsyncContext,
  QuickJSAsyncRuntime,
  QuickJSHandle,
} from "quickjs-emscripten";
import { newAsyncRuntime } from "quickjs-emscripten";

export type PluginFunctionName = "parseImport" | "scheduleGoal";

interface InvokeMessage {
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

type AnyMessage = InvokeMessage;

const ctx = self as DedicatedWorkerGlobalScope;

let runtimePromise: Promise<QuickJSAsyncRuntime> | null = null;

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

    const evalResult = await qjs.evalCodeAsync(message.script);
    const evalHandle = qjs.unwrapResult(evalResult);
    if (shouldDispose(evalHandle)) evalHandle.dispose();

    const fnHandle = track(qjs.getProp(qjs.global, message.functionName));
    if (qjs.typeof(fnHandle) !== "function") {
      throw new Error(
        `Plugin did not define ${message.functionName}()`
      );
    }

    const payloadHandle = track(toHandle(message.payload));
    const metaHandle = track(toHandle(message.meta ?? null));
    const callResult = qjs.callFunction(
      fnHandle,
      qjs.global,
      payloadHandle,
      metaHandle
    );
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
  }
});
