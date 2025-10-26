/**
 * Seed additional test users for parallel E2E testing
 * Run with: npx tsx scripts/seed-test-users.ts
 */

import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ SUPABASE_SERVICE_ROLE_KEY not found in .env.local");
  console.error("   This is required to create users programmatically");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const TEST_USERS = [
  { id: 9002, name: "Bob Test", email: "bob.test@tunetrees.test" },
  { id: 9003, name: "Carol Test", email: "carol.test@tunetrees.test" },
  { id: 9004, name: "Dave Test", email: "dave.test@tunetrees.test" },
  { id: 9005, name: "Eve Test", email: "eve.test@tunetrees.test" },
  { id: 9006, name: "Frank Test", email: "frank.test@tunetrees.test" },
  { id: 9007, name: "Grace Test", email: "grace.test@tunetrees.test" },
  { id: 9008, name: "Henry Test", email: "henry.test@tunetrees.test" },
  { id: 9009, name: "Iris Test", email: "iris.test@tunetrees.test" },
];

const PASSWORD = "TestPassword123!";

async function seedUsers() {
  console.log("🌱 Seeding test users...\n");

  for (const user of TEST_USERS) {
    console.log(`Creating ${user.name} (${user.email})...`);

    // Create auth user
    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email: user.email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { name: user.name },
      });

    if (authError && !authError.message.includes("already registered")) {
      console.error(`  ❌ Auth error: ${authError.message}`);
      continue;
    }

    if (authData?.user) {
      console.log(`  ✅ Auth user created: ${authData.user.id}`);
    } else {
      console.log(`  ℹ️  Auth user already exists`);
    }

    // Create public.user record
    const { error: userError } = await supabase
      .from("user")
      .upsert(
        { id: user.id, name: user.name, email: user.email },
        { onConflict: "id" }
      );

    if (userError) {
      console.error(`  ❌ User table error: ${userError.message}`);
      continue;
    }

    console.log(`  ✅ User record created (id: ${user.id})`);

    // Create playlist
    const { error: playlistError } = await supabase.from("playlist").upsert(
      {
        id: user.id,
        user_ref: user.id,
        instrument: "Flute",
        genre: "Irish",
        name: `${user.name.split(" ")[0]}'s Irish Flute`,
      },
      { onConflict: "id" }
    );

    if (playlistError) {
      console.error(`  ❌ Playlist error: ${playlistError.message}`);
      continue;
    }

    console.log(`  ✅ Playlist created (id: ${user.id})\n`);
  }

  console.log("✅ All test users seeded successfully!");
  console.log("\nTest users:");
  TEST_USERS.forEach((u) => {
    console.log(`  - ${u.email} (user_id: ${u.id}, playlist_id: ${u.id})`);
  });
}

seedUsers().catch(console.error);
