/**
 * Complete test environment setup
 * Runs everything needed for Playwright tests
 */

import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

/**
 * Get the service role key from the running Supabase instance
 */
function getSupabaseServiceRoleKey(): string {
  try {
    const statusJson = execSync("supabase status --output json", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    const status = JSON.parse(statusJson);
    return status.SERVICE_ROLE_KEY;
  } catch {
    throw new Error(
      "Failed to get Supabase service role key. Make sure Supabase is running (supabase start)."
    );
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_SERVICE_ROLE_KEY = getSupabaseServiceRoleKey();

const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || "TestPassword123!";

const TEST_USERS = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    email: "alice.test@tunetrees.test",
    name: "Alice Test User",
    userId: 9001,
    playlistId: 9001,
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    email: "bob.test@tunetrees.test",
    name: "Bob Test User",
    userId: 9002,
    playlistId: 9002,
  },
  {
    id: "33333333-3333-3333-3333-333333333333",
    email: "carol.test@tunetrees.test",
    name: "Carol Test User",
    userId: 9003,
    playlistId: 9003,
  },
  {
    id: "44444444-4444-4444-4444-444444444444",
    email: "dave.test@tunetrees.test",
    name: "Dave Test User",
    userId: 9004,
    playlistId: 9004,
  },
  {
    id: "55555555-5555-5555-5555-555555555555",
    email: "eve.test@tunetrees.test",
    name: "Eve Test User",
    userId: 9005,
    playlistId: 9005,
  },
  {
    id: "66666666-6666-6666-6666-666666666666",
    email: "frank.test@tunetrees.test",
    name: "Frank Test User",
    userId: 9006,
    playlistId: 9006,
  },
  {
    id: "77777777-7777-7777-7777-777777777777",
    email: "grace.test@tunetrees.test",
    name: "Grace Test User",
    userId: 9007,
    playlistId: 9007,
  },
  {
    id: "88888888-8888-8888-8888-888888888888",
    email: "henry.test@tunetrees.test",
    name: "Henry Test User",
    userId: 9008,
    playlistId: 9008,
  },
  {
    id: "99999999-9999-9999-9999-999999999999",
    email: "iris.test@tunetrees.test",
    name: "Iris Test User",
    userId: 9009,
    playlistId: 9009,
  },
];

async function setup() {
  console.log("🧪 Setting up test environment...\n");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Step 1: Create auth users
  console.log("1️⃣  Creating test users...");
  for (const user of TEST_USERS) {
    const { error } = await supabase.auth.admin.createUser({
      id: user.id,
      email: user.email,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { name: user.name },
    });

    if (error && !error.message?.includes("already been registered")) {
      console.error(`   ❌ ${user.email}: ${error.message}`);
    } else {
      console.log(`   ✅ ${user.email}`);
    }
  }

  // Step 2: Create user_profile records
  console.log("\n2️⃣  Creating user profiles...");

  const userProfiles = TEST_USERS.map((user) => ({
    id: user.userId,
    supabase_user_id: user.id,
    name: user.name,
    email: user.email,
  }));

  const { error: profileError } = await supabase
    .from("user_profile")
    .upsert(userProfiles);

  if (profileError) {
    console.error("   ❌ User profiles failed:", profileError);
  } else {
    console.log(`   ✅ ${userProfiles.length} user profiles created`);
  }

  // Step 3: Create playlists for all users
  console.log("\n3️⃣  Creating playlists...");

  const playlists = TEST_USERS.map((user) => ({
    playlist_id: user.playlistId,
    user_ref: user.userId,
    instrument_ref: 1, // All use flute for consistency
    genre_default: "Irish Traditional",
  }));

  const { error: playlistError } = await supabase
    .from("playlist")
    .upsert(playlists);

  if (playlistError) {
    console.error("   ❌ Playlists failed:", playlistError);
  } else {
    console.log(`   ✅ ${playlists.length} playlists created`);
  }

  // Step 4: Create private tunes for all users
  console.log("\n4️⃣  Creating private tunes for all users...");

  const privateTunes = TEST_USERS.flatMap((user) => [
    {
      id: user.userId, // Use userId as base for first tune (9001, 9002, 9004, etc.)
      title: "Banish Misfortune",
      type: "JigD",
      structure: "AABBCC",
      mode: "D Mixolydian",
      incipit: "|fed cAG|",
      genre: "ITRAD",
      private_for: user.userId,
    },
    {
      id: user.userId + 10000, // Offset for second tune (19001, 19002, 19004, etc.)
      title: "Morrison's Jig",
      type: "JigD",
      structure: "AABBCC",
      mode: "E Dorian",
      incipit: "|EDB cAF|",
      genre: "ITRAD",
      private_for: user.userId,
    },
  ]);

  const { error: privateTunesError } = await supabase
    .from("tune")
    .upsert(privateTunes);

  if (privateTunesError) {
    console.error("   ❌ Private tunes failed:", privateTunesError);
  } else {
    console.log(
      `   ✅ ${privateTunes.length} private tunes created (2 per user)`
    );
  }

  // Step 5: Link each user's private tunes to their playlist
  console.log("\n5️⃣  Linking private tunes to playlists...");

  const playlistTuneLinks = TEST_USERS.flatMap((user) => [
    {
      playlist_ref: user.playlistId,
      tune_ref: user.userId, // First private tune
      // NOTE: scheduled (current) is NULL - tunes not yet added to review
      // Tests can use setupPracticeScenario() to schedule tunes as needed
    },
    {
      playlist_ref: user.playlistId,
      tune_ref: user.userId + 10000, // Second private tune
      // NOTE: scheduled (current) is NULL - tunes not yet added to review
    },
  ]);

  const { error: playlistTuneError } = await supabase
    .from("playlist_tune")
    .upsert(playlistTuneLinks);

  if (playlistTuneError) {
    console.error("   ❌ Playlist_tune links failed:", playlistTuneError);
  } else {
    console.log(
      `   ✅ ${playlistTuneLinks.length} playlist_tune links created`
    );
  }

  console.log("\n✨ Test environment ready!");
  console.log("\n📋 Test users created:");
  TEST_USERS.forEach((user) => {
    console.log(
      `   - ${user.email} (user_id: ${user.userId}, playlist_id: ${user.playlistId})`
    );
  });
}

setup().catch(console.error);
