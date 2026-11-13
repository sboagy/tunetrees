import { afterEach, expect, it, vi } from "vitest";

vi.mock("@jitl/quickjs-wasmfile-release-asyncify/wasm?url", () => ({
  default: "test.wasm",
}));
vi.mock("quickjs-emscripten", () => ({
  RELEASE_ASYNC: {},
  newVariant: () => ({}),
  newQuickJSAsyncWASMModule: async () => ({ newRuntime: () => ({}) }),
}));
vi.mock("../../../src/lib/plugins/quickjs-core", () => ({
  executePlugin: async () => ({ value: "uncloneable result" }),
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it("responds with the invocation ID when posting a result throws", async () => {
  let receive!: (event: { data: unknown }) => void;
  vi.stubGlobal(
    "addEventListener",
    (_type: string, listener: typeof receive) => {
      receive = listener;
    }
  );
  const postMessage = vi.fn().mockImplementationOnce(() => {
    throw new DOMException("Result could not be cloned", "DataCloneError");
  });
  vi.stubGlobal("postMessage", postMessage);
  vi.spyOn(console, "info").mockImplementation(() => {});
  await import("../../../src/lib/plugins/quickjs-worker");
  receive({
    data: {
      type: "invoke",
      id: 42,
      functionName: "parseImport",
      script: "",
      payload: {},
    },
  });
  // Wait for runtime initialization, invocation, and the transport catch chain.
  await vi.waitFor(() => expect(postMessage).toHaveBeenCalledTimes(2));
  expect(postMessage.mock.calls[1]?.[0]).toEqual({
    id: 42,
    ok: false,
    error: { message: expect.stringContaining("Result could not be cloned") },
  });
});
