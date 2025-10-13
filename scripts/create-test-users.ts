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
 *   - SUPABASE_SERVICE_ROLE_KEY in environment
 *
 * Security Note:
 *   - The default password "TestPassword123!" is SAFE to commit
 *   - These are test-only accounts with .test@tunetrees.test emails
 *   - They only exist in local/CI environments, never production
 *   - For staging/production test accounts, override with TEST_USER_PASSWORD env var
 *
 * Environment Variables:
 *   - SUPABASE_URL: Defaults to http://127.0.0.1:54321 (local)
 *   - SUPABASE_SERVICE_ROLE_KEY: Defaults to local dev key
 *   - TEST_USER_PASSWORD: Defaults to "TestPassword123!" (optional override)
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

// Test password - safe to commit as this is only for local/CI test users
// These credentials are well-known and documented in _notes/test-users.md
// For production test users, set TEST_USER_PASSWORD environment variable
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || "TestPassword123!";

// Test users configuration
const TEST_USERS = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    email: "alice.test@tunetrees.test",
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: {
      name: "Alice Test User",
      role: "primary_test_user",
    },
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    email: "bob.test@tunetrees.test",
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: {
      name: "Bob Test User",
      role: "secondary_test_user",
    },
  },
  {
    id: "33333333-3333-3333-3333-333333333333",
    email: "charlie.test@tunetrees.test",
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: {
      name: "Charlie Test User",
      role: "edge_case_test_user",
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
