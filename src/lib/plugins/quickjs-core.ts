/**
 * One invocation owns one QuickJS context. Host helpers return guest promises:
 * invoke -> host request -> reply -> settle guest promise -> drain guest jobs.
 * QuickJS does not run promise callbacks on JavaScript's own microtask queue.
 * Both the initial drain and drains after replies are needed to make progress.
 * The worker owns the runtime, the page host owns the hard timeout, and this
 * module owns VM handles.
 */
import * as Papa from "papaparse";
import type {
  QuickJSAsyncContext,
  QuickJSAsyncRuntime,
  QuickJSHandle,
  QuickJSDeferredPromise,
} from "quickjs-emscripten";
import type { InvokeRequest, PluginBridge } from "./quickjs-protocol";

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

// A runtime has one guest job queue even when several contexts are active.
// Coalesce drains, and route job errors to the invocation owning that context.
const pumps = new WeakMap<
  QuickJSAsyncRuntime,
  {
    failures: Map<QuickJSAsyncContext, (error: unknown) => void>;
    schedule: () => void;
  }
>();
function getPump(runtime: QuickJSAsyncRuntime) {
  const existing = pumps.get(runtime);
  if (existing) return existing;
  const failures = new Map<QuickJSAsyncContext, (error: unknown) => void>();
  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      if (!runtime.alive) return;
      const result = runtime.executePendingJobs();
      try {
        if (result.error) {
          const context = result.error.context as QuickJSAsyncContext;
          const error = context.dump(result.error);
          failures.get(context)?.(new Error(error?.message ?? String(error)));
        }
      } finally {
        result.dispose();
      }
    });
  };
  const pump = { failures, schedule };
  pumps.set(runtime, pump);
  return pump;
}

export async function executePlugin(
  runtime: QuickJSAsyncRuntime,
  message: InvokeRequest,
  bridge: PluginBridge,
  fetcher: typeof fetch = fetch
): Promise<unknown> {
  const qjs = runtime.newContext();
  const staticHandles = buildStaticHandles(qjs);
  const { toHandle, shouldDispose } = createHandleMapper({
    qjs,
    staticHandles,
  });
  const handles: QuickJSHandle[] = [];
  const deferreds: QuickJSDeferredPromise[] = [];
  const controller = new AbortController();
  const pump = getPump(runtime);
  let active = true;
  const track = (handle: QuickJSHandle) => {
    if (shouldDispose(handle)) handles.push(handle);
    return handle;
  };
  let failInvocation: (error: unknown) => void = () => {};
  const failure = new Promise<never>((_, reject) => {
    failInvocation = reject;
  });
  pump.failures.set(qjs, failInvocation);

  // Arguments are copied while callback handles are valid. No asynchronous
  // closure retains a borrowed argument handle. Only this invocation owns the
  // deferred promises; late host replies cannot touch a disposed context.
  const asyncFunction = (
    name: string,
    run: (...args: unknown[]) => Promise<unknown>
  ) =>
    qjs.newFunction(name, (...args) => {
      const copied = args.map((arg) => qjs.dump(arg));
      const deferred = qjs.newPromise();
      deferreds.push(deferred);
      const settle = (value: unknown, rejected: boolean) => {
        if (!active) return;
        const handle = rejected
          ? qjs.newError(value instanceof Error ? value.message : String(value))
          : toHandle(value);
        try {
          if (rejected) deferred.reject(handle);
          else deferred.resolve(handle);
        } finally {
          if (shouldDispose(handle)) handle.dispose();
        }
        pump.schedule();
      };
      void Promise.resolve()
        .then(() => run(...copied))
        .then(
          (value) => settle(value, false),
          (error) => settle(error, true)
        )
        .catch(failInvocation);
      return deferred.handle;
    });

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
        throw new TypeError("parseCsv expects a CSV string");
      }
      const config = configArg ? qjs.dump(configArg) : undefined;
      const parseConfig: Papa.ParseConfig = {
        header: true,
        skipEmptyLines: true,
        ...(config && typeof config === "object" ? config : {}),
        worker: false,
      };
      const result = Papa.parse(
        raw,
        parseConfig
      ) as unknown as Papa.ParseResult<unknown>;
      if (result.errors?.length) {
        const msg = result.errors[0]?.message ?? "CSV parse error";
        throw new Error(msg);
      }
      return toHandle(result.data);
    });
    qjs.setProp(qjs.global, "parseCsv", parseCsvHandle);
    if (shouldDispose(parseCsvHandle)) parseCsvHandle.dispose();

    const queryHandle = asyncFunction("queryDb", async (query) => {
      if (typeof query !== "string")
        throw new TypeError("queryDb expects a SQL string");
      if (!bridge.queryDb) throw new Error("queryDb not available");
      return bridge.queryDb(query);
    });
    qjs.setProp(qjs.global, "queryDb", queryHandle);
    queryHandle.dispose();
    const fsrsHandle = track(qjs.newObject());
    for (const method of ["processFirstReview", "processReview"] as const) {
      const fn = asyncFunction(method, async (payload) => {
        if (!bridge.fsrsScheduler)
          throw new Error("fsrsScheduler not available");
        return bridge.fsrsScheduler[method](payload);
      });
      qjs.setProp(fsrsHandle, method, fn);
      fn.dispose();
    }
    qjs.setProp(qjs.global, "fsrsScheduler", fsrsHandle);
    const fetchHandle = asyncFunction("fetchUrl", async (url, rawOptions) => {
      if (typeof url !== "string")
        throw new TypeError("fetchUrl expects a URL string");
      const options =
        rawOptions && typeof rawOptions === "object"
          ? (rawOptions as Record<string, unknown>)
          : {};
      const requestController = new AbortController();
      const abort = () => requestController.abort();
      controller.signal.addEventListener("abort", abort, { once: true });
      if (controller.signal.aborted) abort();
      const timeout = setTimeout(abort, Number(options.timeoutMs ?? 10000));
      try {
        const response = await fetcher(
          `/api/proxy?url=${encodeURIComponent(url)}`,
          {
            signal: requestController.signal,
            headers: {
              Accept:
                options.responseType === "json"
                  ? "application/json"
                  : "text/plain",
              ...(options.headers && typeof options.headers === "object"
                ? options.headers
                : {}),
            },
          }
        );
        if (!response.ok)
          throw new Error(`Proxy request failed: ${response.status}`);
        return options.responseType === "json"
          ? await response.json()
          : await response.text();
      } finally {
        clearTimeout(timeout);
        controller.signal.removeEventListener("abort", abort);
      }
    });
    qjs.setProp(qjs.global, "fetchUrl", fetchHandle);
    fetchHandle.dispose();

    track(qjs.unwrapResult(qjs.evalCode(message.script)));
    let receiver = qjs.global;
    let fn = track(qjs.getProp(qjs.global, message.functionName));
    if (qjs.typeof(fn) !== "function")
      throw new Error(`Plugin did not define ${message.functionName}()`);
    if (message.functionName === "createScheduler") {
      const context = track(qjs.newObject());
      qjs.setProp(context, "fsrsScheduler", fsrsHandle);
      qjs.setProp(
        context,
        "queryDb",
        track(qjs.getProp(qjs.global, "queryDb"))
      );
      receiver = track(
        qjs.unwrapResult(qjs.callFunction(fn, qjs.global, context))
      );
      if (!message.methodName) throw new Error("Missing scheduler method name");
      fn = track(qjs.getProp(receiver, message.methodName));
      if (qjs.typeof(fn) !== "function")
        throw new Error(
          `Scheduler missing ${message.methodName}() implementation`
        );
    }
    const value = track(
      qjs.unwrapResult(
        qjs.callFunction(
          fn,
          receiver,
          track(toHandle(message.payload)),
          track(toHandle(message.meta ?? null))
        )
      )
    );
    // Attach observers BEFORE draining: even an already-fulfilled guest promise
    // needs its queued observer job to run. A leading await needs this drain too.
    const resolved = qjs.resolvePromise(value).then((result) => {
      const handle = qjs.unwrapResult(result);
      try {
        return qjs.dump(handle);
      } finally {
        if (shouldDispose(handle)) handle.dispose();
      }
    });
    pump.schedule();
    return await Promise.race([resolved, failure]);
  } finally {
    active = false;
    controller.abort();
    pump.failures.delete(qjs);
    // Deferred disposal also releases uncalled resolve/reject callbacks for
    // fire-and-forget bridge calls. It is safe after normal settlement too.
    for (const deferred of deferreds) deferred.dispose();
    for (const handle of handles.reverse()) if (handle.alive) handle.dispose();
    // Release the VM's references to host callbacks before freeing its global
    // object. QuickJS 0.32 otherwise retains these through global-object cycles
    // and attempts to release HostRefs after the runtime has been unregistered.
    for (const name of [
      "log",
      "parseJson",
      "parseCsv",
      "queryDb",
      "fsrsScheduler",
      "fetchUrl",
    ]) {
      qjs.setProp(qjs.global, name, qjs.undefined);
    }
    qjs.dispose();
  }
}
