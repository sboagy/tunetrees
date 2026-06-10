import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const normalizePublicUrl = (value: string, name: string): string => {
  const trimmed = value.trim();
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    return new URL(withScheme).origin;
  } catch (err) {
    throw new Error(
      `Invalid ${name}: ${value}. ${err instanceof Error ? err.message : String(err)}`
    );
  }
};
const STAGING_BASE_URL = normalizePublicUrl(
  process.env.STAGING_BASE_URL ?? "https://staging.tunetrees.com",
  "STAGING_BASE_URL"
);
const WORKER_URL = normalizePublicUrl(
  process.env.VITE_WORKER_URL ?? "https://staging-api.tunetrees.com",
  "VITE_WORKER_URL"
);
const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const ALICE_PASSWORD = process.env.ALICE_TEST_PASSWORD;
const ALICE_EMAIL = "alice.test@tunetrees.test";

async function signInAsAlice() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !ALICE_PASSWORD) {
    throw new Error(
      "Missing staging Supabase URL, anon key, or ALICE_TEST_PASSWORD."
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { data, error } = await supabase.auth.signInWithPassword({
    email: ALICE_EMAIL,
    password: ALICE_PASSWORD,
  });

  if (error || !data.session?.access_token) {
    throw new Error(`Staging email/password sign-in failed: ${error?.message}`);
  }

  return data.session.access_token;
}

test.describe("STAGING-001: deployed staging smoke", () => {
  test("anonymous app shell and worker health are reachable", async ({
    request,
  }) => {
    const appShell = await request.get(STAGING_BASE_URL);
    expect(appShell.status()).toBe(200);
    const appHtml = await appShell.text();
    expect(appHtml).toContain('<main id="root"></main>');
    expect(appHtml).toContain('type="module"');

    const health = await request.get(`${WORKER_URL}/health`);
    expect(health.status()).toBe(200);
    expect(await health.text()).toBe("OK");
  });

  test("email/password token authenticates against sync worker via JWKS", async ({
    request,
  }) => {
    const accessToken = await signInAsAlice();

    const syncResponse = await request.post(`${WORKER_URL}/api/sync`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        changes: [],
        lastSyncAt: new Date().toISOString(),
        pullTables: ["user_profile"],
        pageSize: 1,
      },
    });

    expect(syncResponse.status()).toBe(200);
    const body = (await syncResponse.json()) as { changes?: unknown[] };
    expect(Array.isArray(body.changes)).toBe(true);
  });

  test("note media uploads and reads through staging R2 vault", async ({
    request,
  }) => {
    const accessToken = await signInAsAlice();
    const content = `TuneTrees staging media smoke ${Date.now()}`;
    const uploadResponse = await request.post(`${WORKER_URL}/api/media/upload`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      multipart: {
        mediaKind: "notes",
        file: {
          name: "staging-smoke.txt",
          mimeType: "text/plain",
          buffer: Buffer.from(content, "utf8"),
        },
      },
    });

    expect(uploadResponse.status()).toBe(200);
    const uploadBody = (await uploadResponse.json()) as {
      file?: { key?: string; contentType?: string; size?: number };
    };
    const key = uploadBody.file?.key;
    expect(key).toBeTruthy();
    expect(key).toContain("/notes/");
    expect(uploadBody.file?.contentType).toBe("text/plain");
    expect(uploadBody.file?.size).toBe(Buffer.byteLength(content));

    const viewResponse = await request.get(`${WORKER_URL}/api/media/view`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      params: {
        key: key ?? "",
      },
    });

    expect(viewResponse.status()).toBe(200);
    expect(viewResponse.headers()["content-type"]).toContain("text/plain");
    expect(await viewResponse.text()).toBe(content);
  });
});
