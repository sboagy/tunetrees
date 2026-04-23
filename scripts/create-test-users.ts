/**
 * Create test users using Supabase Admin API
 *
 * This script creates test users with known credentials for Playwright testing.
 * It uses the Admin API to properly hash passwords and set up auth records.
 *
 * Usage:
 *   tsx scripts/create-test-users.ts
 *
 * Prerequisites:
 *   - Supabase local stack running (supabase start)
 *   - SUPABASE_SERVICE_ROLE_KEY in environment, or a running local Supabase stack
 *
 * Security Note:
 *   - The shared test-user password must be injected via ALICE_TEST_PASSWORD or
 *     TEST_USER_PASSWORD before running this script
 *   - These are test-only accounts with .test@tunetrees.test emails
 *   - They only exist in local/CI environments, never production
 *
 * Environment Variables:
 *   - SUPABASE_URL: Defaults to http://127.0.0.1:54321 (local)
 *   - SUPABASE_SERVICE_ROLE_KEY: Falls back to local `supabase status` output
 *   - ALICE_TEST_PASSWORD / TEST_USER_PASSWORD: Shared test-user password from 1Password
 */

import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

function getSupabaseServiceRoleKey(): string {
  const envKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (envKey) {
    return envKey;
  }

  try {
    const statusJson = execSync("supabase status --output json", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    const status = JSON.parse(statusJson) as { SERVICE_ROLE_KEY?: string };
    const serviceRoleKey = status.SERVICE_ROLE_KEY?.trim();

    if (!serviceRoleKey) {
      throw new Error(
        "SERVICE_ROLE_KEY missing from `supabase status --output json`"
      );
    }

    return serviceRoleKey;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Missing SUPABASE_SERVICE_ROLE_KEY and failed to get the local value from \`supabase status\`: ${message}`
    );
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_SERVICE_ROLE_KEY = getSupabaseServiceRoleKey();

function getRequiredTestPassword(): string {
  const password =
    process.env.ALICE_TEST_PASSWORD ?? process.env.TEST_USER_PASSWORD;

  if (password && password.trim().length > 0) {
    return password;
  }

  throw new Error(
    "Missing ALICE_TEST_PASSWORD or TEST_USER_PASSWORD. Inject the shared test password from 1Password before running this script."
  );
}

const TEST_PASSWORD = getRequiredTestPassword();

// Test users configuration
// These match the UUIDs in tests/fixtures/test-data.ts
const TEST_USERS = [
  {
    id: "00000000-0000-4000-8000-000000009001",
    email: "alice.test@tunetrees.test",
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: {
      name: "Alice Test",
      role: "playwright_test_user",
    },
  },
  {
    id: "00000000-0000-4000-8000-000000009002",
    email: "bob.test@tunetrees.test",
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: {
      name: "Bob Test",
      role: "playwright_test_user",
    },
  },
  {
    id: "00000000-0000-4000-8000-000000009003",
    email: "carol.test@tunetrees.test",
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: {
      name: "Carol Test",
      role: "playwright_test_user",
    },
  },
  {
    id: "00000000-0000-4000-8000-000000009004",
    email: "dave.test@tunetrees.test",
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: {
      name: "Dave Test",
      role: "playwright_test_user",
    },
  },
  {
    id: "00000000-0000-4000-8000-000000009005",
    email: "eve.test@tunetrees.test",
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: {
      name: "Eve Test",
      role: "playwright_test_user",
    },
  },
  {
    id: "00000000-0000-4000-8000-000000009006",
    email: "frank.test@tunetrees.test",
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: {
      name: "Frank Test",
      role: "playwright_test_user",
    },
  },
  {
    id: "00000000-0000-4000-8000-000000009007",
    email: "grace.test@tunetrees.test",
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: {
      name: "Grace Test",
      role: "playwright_test_user",
    },
  },
  {
    id: "00000000-0000-4000-8000-000000009008",
    email: "henry.test@tunetrees.test",
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: {
      name: "Henry Test",
      role: "playwright_test_user",
    },
  },
  {
    id: "00000000-0000-4000-8000-000000009009",
    email: "iris.test@tunetrees.test",
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: {
      name: "Iris Test",
      role: "playwright_test_user",
    },
  },
];

async function createTestUsers() {
  console.log("🔧 Creating test users...\n");
  console.log(`Supabase URL: ${SUPABASE_URL}`);

  // Create Supabase admin client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  let successCount = 0;
  let errorCount = 0;

  for (const user of TEST_USERS) {
    console.log(`Creating user: ${user.email}...`);

    try {
      const { data, error } = await supabase.auth.admin.createUser({
        id: user.id,
        email: user.email,
        password: user.password,
        email_confirm: user.email_confirm,
        user_metadata: user.user_metadata,
      });

      if (error) {
        // Check if user already exists
        if (
          error.message?.includes("already been registered") ||
          error.message?.includes("duplicate key")
        ) {
          console.log(`  ⚠️  User already exists: ${user.email}`);

          // Try to update existing user's password
          console.log(`  🔄 Updating password for: ${user.email}`);
          const { error: updateError } =
            await supabase.auth.admin.updateUserById(user.id, {
              password: user.password,
            });

          if (updateError) {
            console.log(
              `  ❌ Failed to update password: ${updateError.message}`
            );
            errorCount++;
          } else {
            console.log(`  ✅ Password updated successfully`);
            successCount++;
          }
        } else {
          console.log(`  ❌ Error: ${error.message}`);
          errorCount++;
        }
      } else {
        console.log(`  ✅ Created: ${data.user?.email} (ID: ${data.user?.id})`);
        successCount++;
      }
    } catch (err) {
      console.log(`  ❌ Exception: ${err}`);
      errorCount++;
    }

    console.log("");
  }

  console.log("\n📊 Summary:");
  console.log(`  ✅ Success: ${successCount}`);
  console.log(`  ❌ Errors: ${errorCount}`);
  console.log(`  📝 Total: ${TEST_USERS.length}`);

  if (successCount === TEST_USERS.length) {
    console.log("\n✨ All test users created successfully!");
    process.exit(0);
  } else {
    console.log("\n⚠️  Some test users failed to create.");
    process.exit(1);
  }
}

// Run the script
createTestUsers().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
