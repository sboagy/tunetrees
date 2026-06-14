import { expect, test } from "@playwright/test";

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

const PRODUCTION_BASE_URL = normalizePublicUrl(
  process.env.PRODUCTION_BASE_URL ?? "https://tunetrees.com",
  "PRODUCTION_BASE_URL"
);
const WORKER_URL = normalizePublicUrl(
  process.env.VITE_WORKER_URL ?? "https://api.tunetrees.com",
  "VITE_WORKER_URL"
);
test.describe("PROD-001: deployed production smoke", () => {
  test("anonymous app shell, service worker, and worker health are reachable", async ({
    request,
  }) => {
    const appShell = await request.get(PRODUCTION_BASE_URL);
    expect(appShell.status()).toBe(200);
    const appHtml = await appShell.text();
    expect(appHtml).toContain('<main id="root"></main>');
    expect(appHtml).toContain('type="module"');

    const serviceWorker = await request.get(`${PRODUCTION_BASE_URL}/sw.js`);
    expect(serviceWorker.status()).toBe(200);
    expect(serviceWorker.headers()["content-type"]).toContain("javascript");

    const health = await request.get(`${WORKER_URL}/health`);
    expect(health.status()).toBe(200);
    expect(await health.text()).toBe("OK");
  });

  test("Supabase auth endpoint is reachable without mutating production", async ({
    request,
  }) => {
    const supabaseUrl = normalizePublicUrl(
      process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "",
      "VITE_SUPABASE_URL or SUPABASE_URL"
    );
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseAnonKey) {
      throw new Error("Missing VITE_SUPABASE_ANON_KEY for production smoke.");
    }

    const response = await request.get(`${supabaseUrl}/auth/v1/settings`, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
    });

    expect(response.status()).toBeLessThan(500);
    expect(response.status()).not.toBe(404);
  });
});
