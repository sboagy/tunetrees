import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  disposeQuickJsWorker,
  runQuickJsPlugin,
} from "../../../src/lib/plugins/quickjs-host";
import {
  type InvokeRequest,
  isWorkerInput,
  isWorkerOutput,
} from "../../../src/lib/plugins/quickjs-protocol";

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: { message: string }) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  messages: unknown[] = [];
  terminate = vi.fn();
  postMessage = vi.fn((message: unknown) => {
    this.messages.push(message);
  });
  constructor() {
    FakeWorker.instances.push(this);
  }
  receive(data: unknown) {
    this.onmessage?.({ data });
  }
  get invocation() {
    return this.messages[0] as InvokeRequest;
  }
}
const params = {
  script: "function parseImport(){return 1;}",
  functionName: "parseImport" as const,
  payload: {},
  timeoutMs: 100,
};
const latest = () => FakeWorker.instances.at(-1)!;
beforeEach(() => {
  FakeWorker.instances = [];
  vi.stubGlobal("Worker", FakeWorker);
  vi.useFakeTimers();
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  disposeQuickJsWorker();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("worker transport lifetime", () => {
  it("rejects a missing scheduler method without interrupting active work", async () => {
    const active = runQuickJsPlugin(params);
    const worker = latest();
    await expect(
      // @ts-expect-error Exercise invalid input from an untyped caller.
      runQuickJsPlugin({ ...params, functionName: "createScheduler" })
    ).rejects.toThrow("Missing scheduler method name");
    expect(worker.messages).toHaveLength(1);
    expect(worker.terminate).not.toHaveBeenCalled();
    worker.receive({ id: worker.invocation.id, ok: true, result: 6 });
    expect(await active).toBe(6);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("rejects an import method before queuing or resetting active work", async () => {
    const active = runQuickJsPlugin(params);
    const worker = latest();
    await expect(
      // @ts-expect-error Exercise invalid input from an untyped caller.
      runQuickJsPlugin({ ...params, methodName: "processReview" })
    ).rejects.toThrow("Invalid plugin invocation parameters");
    expect(worker.messages).toHaveLength(1);
    expect(worker.terminate).not.toHaveBeenCalled();
    worker.receive({ id: worker.invocation.id, ok: true, result: 6 });
    expect(await active).toBe(6);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("distinguishes a timeout from another invocation interrupted by reset", async () => {
    const a = runQuickJsPlugin(params);
    const b = runQuickJsPlugin({ ...params, timeoutMs: 500 });
    const assertions = Promise.all([
      expect(a).rejects.toThrow("timed out (100 ms)"),
      expect(b).rejects.toThrow("worker reset"),
    ]);
    await vi.advanceTimersByTimeAsync(100);
    await assertions;
    expect(latest().terminate).toHaveBeenCalledOnce();
    const c = runQuickJsPlugin(params);
    latest().receive({ id: latest().invocation.id, ok: true, result: 7 });
    expect(await c).toBe(7);
  });
  it("does not deliver an old bridge reply to a replacement worker", async () => {
    let release!: (value: unknown) => void;
    const a = runQuickJsPlugin({
      ...params,
      bridge: {
        queryDb: () =>
          new Promise((resolve) => {
            release = resolve;
          }),
      },
    });
    const old = latest();
    old.receive({
      type: "query",
      id: 1,
      invokeId: old.invocation.id,
      sql: "SELECT history",
    });
    const assertion = expect(a).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
    const b = runQuickJsPlugin(params);
    const replacement = latest();
    release("old data");
    await vi.advanceTimersByTimeAsync(0);
    expect(replacement.messages).toHaveLength(1);
    replacement.receive({
      id: replacement.invocation.id,
      ok: true,
      result: "new data",
    });
    expect(await b).toBe("new data");
  });
  it("ignores malformed and duplicate responses", async () => {
    const a = runQuickJsPlugin(params);
    const worker = latest();
    worker.receive(null);
    worker.receive({ id: worker.invocation.id, ok: false, error: null });
    worker.receive({ id: worker.invocation.id, ok: true, result: 3 });
    worker.receive({ id: worker.invocation.id, ok: true, result: 9 });
    expect(await a).toBe(3);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("returns a useful bridge-unavailable response", async () => {
    const a = runQuickJsPlugin(params);
    const worker = latest();
    worker.receive({
      type: "query",
      id: 1,
      invokeId: worker.invocation.id,
      sql: "SELECT history",
    });
    expect(worker.messages[1]).toMatchObject({
      type: "queryResult",
      ok: false,
      error: { message: "queryDb not available" },
    });
    worker.receive({
      id: worker.invocation.id,
      ok: false,
      error: { message: "queryDb not available" },
    });
    await expect(a).rejects.toThrow("queryDb not available");
  });
  it("serializes a non-Error bridge rejection instead of hanging", async () => {
    const task = runQuickJsPlugin({
      ...params,
      bridge: { queryDb: async () => Promise.reject(null) },
    });
    const worker = latest();
    worker.receive({
      type: "query",
      id: 1,
      invokeId: worker.invocation.id,
      sql: "SELECT history",
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(worker.messages[1]).toMatchObject({
      ok: false,
      error: { message: "null" },
    });
    worker.receive({
      id: worker.invocation.id,
      ok: false,
      error: { message: "null" },
    });
    await expect(task).rejects.toThrow("null");
  });
  it("recovers after a worker initialization error", async () => {
    const a = runQuickJsPlugin(params);
    latest().onerror?.({ message: "WASM unavailable" });
    await expect(a).rejects.toThrow("WASM unavailable");
    const b = runQuickJsPlugin(params);
    latest().receive({ id: latest().invocation.id, ok: true, result: 4 });
    expect(await b).toBe(4);
  });
});
describe("worker protocol validation", () => {
  it.each([
    null,
    [],
    { type: "invoke", id: 1, script: 4 },
    { type: "invoke", id: NaN },
    { type: "queryResult", id: 1, ok: false, error: {} },
    { type: "unknown", id: 1 },
  ])("rejects malformed input %j", (value) => {
    expect(isWorkerInput(value)).toBe(false);
  });
  it("accepts a scheduler invocation", () => {
    expect(
      isWorkerInput({
        type: "invoke",
        id: 1,
        functionName: "createScheduler",
        methodName: "processReview",
        script: "",
        payload: {},
      })
    ).toBe(true);
  });
  it("rejects an invalid FSRS method from a worker", () => {
    expect(
      isWorkerOutput({ type: "fsrs", id: 1, invokeId: 2, method: "delete" })
    ).toBe(false);
  });
});
