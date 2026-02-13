/**
 * Complete test environment setup
 * Runs everything needed for Playwright tests
 */

import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { CATALOG_INSTRUMENT_IRISH_FLUTE_ID } from "../src/lib/db/catalog-instrument-ids.js";

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

// Test users with UUIDs matching tests/fixtures/test-data.ts
const TEST_USERS = [
  {
    id: "00000000-0000-4000-8000-000000009001", // auth.users.id
    email: "alice.test@tunetrees.test",
    name: "Alice Test",
    playlistId: "00000000-0000-4000-8000-000000019001",
    privateTune1Id: "00000000-0000-4000-8000-000000029001", // Private tune 1
    privateTune2Id: "00000000-0000-4000-8000-000000039001", // Private tune 2
  },
  {
    id: "00000000-0000-4000-8000-000000009002",
    email: "bob.test@tunetrees.test",
    name: "Bob Test",
    playlistId: "00000000-0000-4000-8000-000000019002",
    privateTune1Id: "00000000-0000-4000-8000-000000029002",
    privateTune2Id: "00000000-0000-4000-8000-000000039002",
  },
  {
    id: "00000000-0000-4000-8000-000000009003",
    email: "carol.test@tunetrees.test",
    name: "Carol Test",
    playlistId: "00000000-0000-4000-8000-000000019003",
    privateTune1Id: "00000000-0000-4000-8000-000000029003",
    privateTune2Id: "00000000-0000-4000-8000-000000039003",
  },
  {
    id: "00000000-0000-4000-8000-000000009004",
    email: "dave.test@tunetrees.test",
    name: "Dave Test",
    playlistId: "00000000-0000-4000-8000-000000019004",
    privateTune1Id: "00000000-0000-4000-8000-000000029004",
    privateTune2Id: "00000000-0000-4000-8000-000000039004",
  },
  {
    id: "00000000-0000-4000-8000-000000009005",
    email: "eve.test@tunetrees.test",
    name: "Eve Test",
    playlistId: "00000000-0000-4000-8000-000000019005",
    privateTune1Id: "00000000-0000-4000-8000-000000029005",
    privateTune2Id: "00000000-0000-4000-8000-000000039005",
  },
  {
    id: "00000000-0000-4000-8000-000000009006",
    email: "frank.test@tunetrees.test",
    name: "Frank Test",
    playlistId: "00000000-0000-4000-8000-000000019006",
    privateTune1Id: "00000000-0000-4000-8000-000000029006",
    privateTune2Id: "00000000-0000-4000-8000-000000039006",
  },
  {
    id: "00000000-0000-4000-8000-000000009007",
    email: "grace.test@tunetrees.test",
    name: "Grace Test",
    playlistId: "00000000-0000-4000-8000-000000019007",
    privateTune1Id: "00000000-0000-4000-8000-000000029007",
    privateTune2Id: "00000000-0000-4000-8000-000000039007",
  },
  {
    id: "00000000-0000-4000-8000-000000009008",
    email: "henry.test@tunetrees.test",
    name: "Henry Test",
    playlistId: "00000000-0000-4000-8000-000000019008",
    privateTune1Id: "00000000-0000-4000-8000-000000029008",
    privateTune2Id: "00000000-0000-4000-8000-000000039008",
  },
  {
    id: "00000000-0000-4000-8000-000000009009",
    email: "iris.test@tunetrees.test",
    name: "Iris Test",
    playlistId: "00000000-0000-4000-8000-000000019009",
    privateTune1Id: "00000000-0000-4000-8000-000000029009",
    privateTune2Id: "00000000-0000-4000-8000-000000039009",
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
    id: user.id, // Primary key - References auth.users.id (Supabase Auth UUID)
    email: user.email,
    name: user.name,
    avatar_url: null, // Explicitly set nullable avatar field to avoid undefined
    sr_alg_type: null, // Scheduling algorithm type (null until user chooses)
    phone: null,
    phone_verified: null,
    acceptable_delinquency_window: 21, // Mirror default explicitly for clarity
    deleted: false,
    sync_version: 1,
    last_modified_at: new Date().toISOString(),
    device_id: null,
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
    playlist_id: user.playlistId, // UUID schema uses playlist_id, not id
    user_ref: user.id, // References user_profile.id
    name: null,
    instrument_ref: CATALOG_INSTRUMENT_IRISH_FLUTE_ID, // Can be set per-user if needed
    genre_default: "ITRAD", // Genre code, not full name
    sr_alg_type: null,
    deleted: false,
    sync_version: 1,
    last_modified_at: new Date().toISOString(),
    device_id: null,
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
      id: user.privateTune1Id,
      title: "Banish Misfortune",
      type: "JigD",
      structure: "AABBCC",
      mode: "D Mixolydian",
      incipit: "|fed cAG|",
      genre: "ITRAD",
      private_for: user.id,
    },
    {
      id: user.privateTune2Id,
      title: "Morrison's Jig",
      type: "JigD",
      structure: "AABBCC",
      mode: "E Dorian",
      incipit: "|EDB cAF|",
      genre: "ITRAD",
      private_for: user.id,
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
      tune_ref: user.privateTune1Id,
      // NOTE: scheduled (current) is NULL - tunes not yet added to review
      // Tests can use setupPracticeScenario() to schedule tunes as needed
    },
    {
      playlist_ref: user.playlistId,
      tune_ref: user.privateTune2Id,
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
      `   - ${user.email} (id: ${user.id}, playlist: ${user.playlistId})`
    );
  });
}

setup().catch(console.error);
