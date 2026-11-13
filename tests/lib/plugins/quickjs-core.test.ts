import {
  newQuickJSAsyncWASMModule,
  type QuickJSAsyncRuntime,
} from "quickjs-emscripten";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executePlugin } from "../../../src/lib/plugins/quickjs-core";
import type {
  InvokeRequest,
  PluginBridge,
} from "../../../src/lib/plugins/quickjs-protocol";
import { DEFAULT_PLUGIN_SCRIPT } from "../../../src/lib/plugins/scheduling-template";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const payload = {
  input: {
    repertoireRef: "repertoire",
    tuneRef: "tune",
    quality: 3,
    practiced: "2026-01-20T12:00:00.000Z",
  },
  fallback: { interval: 21, nextDue: "2026-02-10T12:00:00.000Z" },
};
function invocation(
  script: string,
  overrides: Partial<InvokeRequest> = {}
): InvokeRequest {
  return {
    type: "invoke",
    id: 1,
    functionName: "parseImport",
    payload,
    script,
    ...overrides,
  };
}

describe("QuickJS plugin execution with the real asyncify VM", () => {
  let runtime: QuickJSAsyncRuntime;
  beforeEach(async () => {
    runtime = (await newQuickJSAsyncWASMModule()).newRuntime();
  });
  // Runtime disposal also detects leaked guest handles/contexts.
  afterEach(() => {
    runtime.dispose();
  });
  const run = (script: string, bridge: PluginBridge = {}) =>
    executePlugin(runtime, invocation(script), bridge);

  it("releases callbacks retained by guest aliases and cycles", async () => {
    expect(
      await run(`
      const alias = queryDb;
      const cycle = { callback: parseCsv, scheduler: fsrsScheduler.processReview };
      cycle.self = cycle;
      globalThis.saved = [alias, cycle, log, parseJson, fetchUrl];
      function parseImport() { return 8; }
    `)
    ).toBe(8);
    // afterEach disposes the real runtime, exposing retained HostRef failures.
  });
  it("returns a synchronous result", async () => {
    expect(
      await run('function parseImport() { return {title: "Tune"}; }')
    ).toEqual({ title: "Tune" });
  });
  it("drains a promise without any host bridge calls", async () => {
    expect(
      await run(
        "async function parseImport() { await Promise.resolve(); return 7; }"
      )
    ).toBe(7);
  });
  it("runs the production Fluency template against review history", async () => {
    const queryDb = vi.fn(async () => [{ quality: 3 }, { quality: 3 }]);
    const result = await executePlugin(
      runtime,
      invocation(DEFAULT_PLUGIN_SCRIPT, {
        functionName: "createScheduler",
        methodName: "processReview",
      }),
      { queryDb }
    );
    expect(result).toMatchObject({
      interval: 4,
      scheduledDays: 4,
      nextDue: "2026-01-24T12:00:00.000Z",
    });
    expect(queryDb).toHaveBeenCalledWith(
      expect.stringContaining("repertoire_ref = 'repertoire'")
    );
  });
  it("runs the first-review template with no history", async () => {
    expect(
      await executePlugin(
        runtime,
        invocation(DEFAULT_PLUGIN_SCRIPT, {
          functionName: "createScheduler",
          methodName: "processFirstReview",
        }),
        { queryDb: async () => [] }
      )
    ).toMatchObject({ interval: 2 });
  });
  // History is newest first and follows the rating being scheduled.
  it.each([
    { quality: 4, history: [4, 4, 3], interval: 7 },
    { quality: 3, history: [4, 4, 4], interval: 4 },
  ])(
    "counts the template's Easy streak from the newest rating only: $quality then $history",
    async ({ quality, history, interval }) => {
      const result = await executePlugin(
        runtime,
        invocation(DEFAULT_PLUGIN_SCRIPT, {
          functionName: "createScheduler",
          methodName: "processReview",
          payload: { ...payload, input: { ...payload.input, quality } },
        }),
        { queryDb: async () => history.map((value) => ({ quality: value })) }
      );
      expect(result).toMatchObject({ interval });
    }
  );
  it("reaches a bridge after an initial guest await", async () => {
    expect(
      await run(
        'async function parseImport() { await Promise.resolve(); return await queryDb("history"); }',
        { queryDb: async () => [3] }
      )
    ).toEqual([3]);
  });
  it("propagates the real database error", async () => {
    await expect(
      run('async function parseImport() { return await queryDb("history"); }', {
        queryDb: async () => {
          throw new Error("no such column: playlist_ref");
        },
      })
    ).rejects.toThrow("no such column: playlist_ref");
  });
  it.each([
    { method: "processFirstReview", expectedInterval: 9 },
    { method: "processReview", expectedInterval: 11 },
  ] as const)(
    "supports the $method FSRS bridge",
    async ({ method, expectedInterval }) => {
      const bridge = {
        processFirstReview: async () => ({ interval: 9 }),
        processReview: async () => ({ interval: 11 }),
      };
      expect(
        await run(
          `async function parseImport(p) { return await fsrsScheduler.${method}(p); }`,
          { fsrsScheduler: bridge }
        )
      ).toEqual({ interval: expectedInterval });
    }
  );
  it("keeps overlapping invocations isolated when replies arrive in reverse order", async () => {
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    const a = run(
      'async function parseImport() { return await queryDb("a"); }',
      { queryDb: () => first.promise }
    );
    const b = run(
      'async function parseImport() { return await queryDb("b"); }',
      { queryDb: () => second.promise }
    );
    second.resolve("second");
    expect(await b).toBe("second");
    first.resolve("first");
    expect(await a).toBe("first");
  });
  it("isolates a rejected invocation from another pending invocation", async () => {
    const reply = deferred<unknown>();
    const a = run('async function parseImport() { return queryDb("a"); }', {
      queryDb: () => reply.promise,
    });
    await expect(
      run('async function parseImport() { throw new Error("other failed"); }')
    ).rejects.toThrow("other failed");
    reply.resolve(8);
    expect(await a).toBe(8);
  });
  it("ignores a reply after a plugin returned without awaiting its bridge", async () => {
    const reply = deferred<unknown>();
    expect(
      await run('function parseImport() { queryDb("late"); return 4; }', {
        queryDb: () => reply.promise,
      })
    ).toBe(4);
    reply.resolve([1]);
    // Drain native callbacks after context disposal to expose use-after-free.
    await Promise.resolve();
    await Promise.resolve();
    expect(await run("function parseImport() { return 5; }")).toBe(5);
  });
  it("leaves no guest jobs behind when a script fails after queueing one", async () => {
    const queryDb = vi.fn(async () => []);
    await expect(
      run(
        'Promise.resolve().then(() => queryDb("stale")); throw new Error("early failure");',
        { queryDb }
      )
    ).rejects.toThrow("early failure");
    // The runtime is shared: a leftover job would run inside the next plugin.
    expect(runtime.hasPendingJob()).toBe(false);
    expect(await run("function parseImport() { return 5; }")).toBe(5);
    expect(queryDb).not.toHaveBeenCalled();
  });
  it("reports a missing bridge promptly", async () => {
    await expect(
      run('async function parseImport() { return queryDb("missing"); }')
    ).rejects.toThrow("queryDb not available");
  });
  it.each([
    ["function unrelated() {}", "Plugin did not define parseImport"],
    [
      'function parseImport() { throw new Error("sync failure"); }',
      "sync failure",
    ],
    [
      'async function parseImport() { throw new Error("async failure"); }',
      "async failure",
    ],
  ])("reports plugin errors: %s", async (script, error) => {
    await expect(run(script)).rejects.toThrow(error);
  });
  it("reports a missing scheduler method", async () => {
    await expect(
      executePlugin(
        runtime,
        invocation("function createScheduler() {return {};}", {
          functionName: "createScheduler",
          methodName: "processReview",
        }),
        {}
      )
    ).rejects.toThrow("Scheduler missing processReview");
  });
  it("parses imported text fetched through the proxy", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("title,type\nTune,Reel"));
    expect(
      await executePlugin(
        runtime,
        invocation(
          'async function parseImport() { return parseCsv(await fetchUrl("https://example.test/tunes"))[0]; }'
        ),
        {},
        fetcher
      )
    ).toEqual({ title: "Tune", type: "Reel" });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/proxy?url=https%3A%2F%2Fexample.test%2Ftunes",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });
  it("applies supported parseCsv options and ignores the rest", async () => {
    expect(
      await run(
        'function parseImport() { return parseCsv("a;b\\n1;2", { delimiter: ";", download: true }); }'
      )
    ).toEqual([{ a: "1", b: "2" }]);
  });
  it("preserves CSV typing by header while leaving other columns as strings", async () => {
    expect(
      await run(
        'function parseImport(){return parseCsv("name,count\\n001,2",{dynamicTyping:{name:false,count:true}});}'
      )
    ).toEqual([{ name: "001", count: 2 }]);
  });
  it("preserves CSV typing by column index without a header", async () => {
    expect(
      await run(
        'function parseImport(){return parseCsv("001,2",{header:false,dynamicTyping:{0:false,1:true}});}'
      )
    ).toEqual([["001", 2]]);
  });
  it("rejects non-boolean values in CSV column typing maps", async () => {
    await expect(
      run(
        'function parseImport(){return parseCsv("name,count\\nTune,2",{dynamicTyping:{count:"yes"}});}'
      )
    ).rejects.toThrow('parseCsv option "dynamicTyping"');
  });
  it("preserves custom delimiter detection and skipped preamble lines", async () => {
    expect(
      await run(
        'function parseImport(){return parseCsv("preamble\\nname^count\\nTune^2",{skipFirstNLines:1,delimitersToGuess:["^"]});}'
      )
    ).toEqual([{ name: "Tune", count: "2" }]);
  });
  it("rejects a parseCsv option with an unsupported value", async () => {
    await expect(
      run(
        'function parseImport() { return parseCsv("a,b\\n1,2", { delimiter: 5 }); }'
      )
    ).rejects.toThrow('parseCsv option "delimiter"');
  });
  it("reports failed fetches", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("", { status: 503 }));
    await expect(
      executePlugin(
        runtime,
        invocation(
          'async function parseImport() { return fetchUrl("https://example.test"); }'
        ),
        {},
        fetcher
      )
    ).rejects.toThrow("Proxy request failed: 503");
  });
});
