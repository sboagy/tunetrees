import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const STAGING_BASE_URL =
  process.env.STAGING_BASE_URL ?? "https://staging.tunetrees.com";
const WORKER_URL =
  process.env.VITE_WORKER_URL ?? "https://staging-api.tunetrees.com";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const ALICE_PASSWORD = process.env.ALICE_TEST_PASSWORD;
const ALICE_EMAIL = "alice.test@tunetrees.test";

test.describe("STAGING-001: deployed staging smoke", () => {
  test("anonymous app shell and worker health are reachable", async ({
    page,
    request,
  }) => {
    await page.goto(STAGING_BASE_URL);
    await expect(page).toHaveURL(/staging\.tunetrees\.com/);
    await expect(page.locator("body")).toBeVisible();

    const health = await request.get(`${WORKER_URL}/health`);
    expect(health.status()).toBe(200);
    expect(await health.text()).toBe("OK");
  });

  test("email/password token authenticates against sync worker via JWKS", async ({
    request,
  }) => {
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
      throw new Error(
        `Staging email/password sign-in failed: ${error?.message}`
      );
    }

    const syncResponse = await request.post(`${WORKER_URL}/api/sync`, {
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
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
});
