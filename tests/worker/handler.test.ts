const { generatedFetchMock, getCorsHeadersMock, handleMediaRequestMock } =
  vi.hoisted(() => ({
    generatedFetchMock: vi.fn(),
    getCorsHeadersMock: vi.fn(),
    handleMediaRequestMock: vi.fn(),
  }));

vi.mock("../../worker/src/index", () => ({
  default: {
    fetch: generatedFetchMock,
  },
}));

vi.mock("../../worker/src/media", () => ({
  getCorsHeaders: getCorsHeadersMock,
  handleMediaRequest: handleMediaRequestMock,
}));

import { beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../../worker/src/handler";
import type { MediaWorkerEnv } from "../../worker/src/media";

describe("worker handler", () => {
  beforeEach(() => {
    generatedFetchMock.mockReset();
    getCorsHeadersMock.mockReset();
    handleMediaRequestMock.mockReset();
  });

  it("forwards ExecutionContext when delegating to the generated worker", async () => {
    const request = new Request(
      "https://worker.example.com/api/sync"
    ) as unknown as Request<unknown, IncomingRequestCfProperties<unknown>>;
    const env = {} as MediaWorkerEnv;
    const ctx = {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn(),
    } as unknown as ExecutionContext;
    const delegatedResponse = new Response("delegated", { status: 202 });

    handleMediaRequestMock.mockResolvedValue(null);
    generatedFetchMock.mockResolvedValue(delegatedResponse);

    const response = await worker.fetch!(request, env, ctx);

    expect(response).toBe(delegatedResponse);
    expect(generatedFetchMock).toHaveBeenCalledWith(request, env);
  });
});
