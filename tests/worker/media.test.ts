const {
  createRemoteJWKSetMock,
  decodeProtectedHeaderMock,
  jwtVerifyMock,
} = vi.hoisted(() => ({
  createRemoteJWKSetMock: vi.fn(() => ({ kind: "jwks" })),
  decodeProtectedHeaderMock: vi.fn<
    (token: string) => {
      alg?: string;
    }
  >(),
  jwtVerifyMock: vi.fn<
    (
      token: string,
      key: Uint8Array | { kind: string }
    ) => Promise<{ payload: { sub?: string } }>
  >(),
}));

vi.mock("jose", () => ({
  createRemoteJWKSet: createRemoteJWKSetMock,
  decodeProtectedHeader: decodeProtectedHeaderMock,
  jwtVerify: jwtVerifyMock,
}));

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  handleMediaRequest,
  type MediaWorkerEnv,
} from "../../worker/src/media";

type StoredObject = {
  contentType: string;
  body: string;
};

const isMockJwksObject = (key: Uint8Array | { kind: string }) =>
  typeof key === "object" && key !== null && "kind" in key && key.kind === "jwks";

const createVault = () => {
  const objects = new Map<string, StoredObject>();

  return {
    objects,
    bucket: {
      put: vi.fn(
        async (
          key: string,
          body: Blob | ReadableStream | string,
          options?: { httpMetadata?: { contentType?: string } }
        ) => {
          const text =
            typeof body === "string"
              ? body
              : body instanceof Blob
                ? await body.text()
                : await new Response(body).text();
          objects.set(key, {
            body: text,
            contentType:
              options?.httpMetadata?.contentType || "application/octet-stream",
          });
        }
      ),
      get: vi.fn(async (key: string) => {
        const object = objects.get(key);
        if (!object) {
          return null;
        }

        return {
          body: object.body,
          size: object.body.length,
          etag: "etag-1",
          writeHttpMetadata(headers: Headers) {
            headers.set("Content-Type", object.contentType);
          },
        };
      }),
    },
  };
};

describe("worker media routes", () => {
  let originalFetch: typeof globalThis.fetch;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    createRemoteJWKSetMock.mockClear();
    decodeProtectedHeaderMock.mockReset();
    jwtVerifyMock.mockReset();

    decodeProtectedHeaderMock.mockImplementation((token) => {
      if (token === "upload-token" || token === "view-token") {
        return { alg: "HS256" };
      }

      if (token === "local-rs-token") {
        return { alg: "RS256" };
      }

      throw new Error("invalid token");
    });
    jwtVerifyMock.mockImplementation(async (token, key) => {
      if (token === "local-rs-token" && isMockJwksObject(key)) {
        return { payload: { sub: "user-1" } };
      }

      throw new Error("jwt verify failed");
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      writable: true,
      value: originalFetch,
    });
    consoleInfoSpy.mockRestore();
  });

  it("stores uploaded note media in the authenticated user's folder", async () => {
    const vault = createVault();
    const env: MediaWorkerEnv = {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      TUNETREES_VAULT: vault.bucket as unknown as R2Bucket,
    };

    const authFetch = vi.fn(async () =>
      new Response(JSON.stringify({ id: "user-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      writable: true,
      value: authFetch,
    });

    const formData = new FormData();
    formData.append(
      "files[0]",
      new File(["png-bytes"], "note image.png", { type: "image/png" })
    );

    const uploadRequest = {
      method: "POST",
      url: "https://worker.example.com/api/media/upload",
      headers: new Headers({
        Authorization: "Bearer upload-token",
      }),
      formData: async () => formData,
    } as unknown as Request;

    const response = await handleMediaRequest(uploadRequest, env);

    expect(response?.status).toBe(200);
    const payload = (await response?.json()) as {
      data: { path: string; files: string[] };
      file: { size: number; contentType: string };
    };

    expect(vault.bucket.put).toHaveBeenCalledTimes(1);
    expect(payload.data.path).toMatch(/^users\/user-1\/notes\//);
    expect(payload.data.files[0]).toContain(
      encodeURIComponent(payload.data.path)
    );
    expect(payload.file.size).toBe(9);
    expect(payload.file.contentType).toBe("image/png");
    expect(consoleInfoSpy).toHaveBeenCalled();
  });

  it("serves stored media only when the key belongs to the authenticated user", async () => {
    const vault = createVault();
    const key = "users/user-1/notes/example.png";
    vault.objects.set(key, {
      body: "image-body",
      contentType: "image/png",
    });

    const env: MediaWorkerEnv = {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      TUNETREES_VAULT: vault.bucket as unknown as R2Bucket,
    };

    const authFetch = vi.fn(async () =>
      new Response(JSON.stringify({ id: "user-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      writable: true,
      value: authFetch,
    });

    const okResponse = await handleMediaRequest(
      new Request(
        `https://worker.example.com/api/media/view?key=${encodeURIComponent(
          key
        )}&token=view-token`
      ),
      env
    );

    expect(okResponse?.status).toBe(200);
    expect(okResponse?.headers.get("Content-Type")).toBe("image/png");
    expect(await okResponse?.text()).toBe("image-body");

    const forbiddenResponse = await handleMediaRequest(
      new Request(
        "https://worker.example.com/api/media/view?key=users%2Fother-user%2Fnotes%2Fexample.png&token=view-token"
      ),
      env
    );

    expect(forbiddenResponse?.status).toBe(403);
  });

  it("verifies asymmetric JWTs locally via jose JWKS handling without hitting Supabase", async () => {
    const vault = createVault();
    const env: MediaWorkerEnv = {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      TUNETREES_VAULT: vault.bucket as unknown as R2Bucket,
    };

    const fetchSpy = vi.fn();
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      writable: true,
      value: fetchSpy,
    });

    const formData = new FormData();
    formData.append(
      "files[0]",
      new File(["png-bytes"], "note image.png", { type: "image/png" })
    );

    const uploadRequest = {
      method: "POST",
      url: "https://worker.example.com/api/media/upload",
      headers: new Headers({
        Authorization: "Bearer local-rs-token",
      }),
      formData: async () => formData,
    } as unknown as Request;

    const response = await handleMediaRequest(uploadRequest, env);

    expect(response?.status).toBe(200);
    expect(decodeProtectedHeaderMock).toHaveBeenCalledWith("local-rs-token");
    expect(createRemoteJWKSetMock).toHaveBeenCalledWith(
      new URL("https://example.supabase.co/auth/v1/.well-known/jwks.json")
    );
    expect(jwtVerifyMock).toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
