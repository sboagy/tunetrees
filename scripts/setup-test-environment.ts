/**
 * Complete test environment setup
 * Runs everything needed for Playwright tests
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || "TestPassword123!";

const TEST_USERS = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    email: "alice.test@tunetrees.test",
    name: "Alice Test User",
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    email: "bob.test@tunetrees.test",
    name: "Bob Test User",
  },
  {
    id: "33333333-3333-3333-3333-333333333333",
    email: "charlie.test@tunetrees.test",
    name: "Charlie Test User",
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

  const { error: profileError } = await supabase.from("user_profile").upsert([
    {
      id: 9001,
      supabase_user_id: "11111111-1111-1111-1111-111111111111",
      name: "Alice Test User",
      email: "alice.test@tunetrees.test",
    },
    {
      id: 9002,
      supabase_user_id: "22222222-2222-2222-2222-222222222222",
      name: "Bob Test User",
      email: "bob.test@tunetrees.test",
    },
    {
      id: 9003,
      supabase_user_id: "33333333-3333-3333-3333-333333333333",
      name: "Charlie Test User",
      email: "charlie.test@tunetrees.test",
    },
  ]);

  if (profileError) {
    console.error("   ❌ User profiles failed:", profileError);
  } else {
    console.log("   ✅ User profiles created");
  }

  // Step 3: Alice's playlist
  console.log("\n3️⃣  Creating Alice's playlist...");
  const { error: alicePlaylistError } = await supabase.from("playlist").upsert({
    playlist_id: 9001,
    user_ref: 9001,
    instrument_ref: 1, // flute
    genre_default: "Irish Traditional",
  });

  if (alicePlaylistError) {
    console.error("   ❌ Alice's playlist failed:", alicePlaylistError);
  } else {
    console.log("   ✅ Alice's playlist created (ID: 9001)");
  }

  // Step 4: Alice's tunes
  console.log("\n4️⃣  Creating Alice's tunes...");
  const { error: aliceTunesError } = await supabase.from("tune").upsert([
    {
      id: 9001,
      title: "Banish Misfortune",
      type: "JigD",
      structure: "AABBCC",
      mode: "D Mixolydian",
      incipit: "|fed cAG|",
      genre: "ITRAD",
      private_for: 9001,
    },
    {
      id: 9002,
      title: "Morrison's Jig",
      type: "JigD",
      structure: "AABBCC",
      mode: "E Dorian",
      incipit: "|EDB cAF|",
      genre: "ITRAD",
      private_for: 9001,
    },
  ]);

  if (aliceTunesError) {
    console.error("   ❌ Alice's tunes failed:", aliceTunesError);
  } else {
    console.log("   ✅ Alice's tunes created (IDs: 9001, 9002)");
  }

  // Step 5: Link Alice's tunes to her playlist
  console.log("\n5️⃣  Linking Alice's tunes to playlist...");
  const { error: alicePlaylistTuneError } = await supabase
    .from("playlist_tune")
    .upsert([
      {
        playlist_ref: 9001,
        tune_ref: 9001,
      },
      {
        playlist_ref: 9001,
        tune_ref: 9002,
      },
    ]);

  if (alicePlaylistTuneError) {
    console.error(
      "   ❌ Alice's playlist_tune links failed:",
      alicePlaylistTuneError
    );
  } else {
    console.log("   ✅ Alice's tunes linked to playlist (2 links)");
  }

  // Step 6: Bob's playlist
  console.log("\n6️⃣  Creating Bob's playlist...");
  const { error: bobPlaylistError } = await supabase.from("playlist").upsert({
    playlist_id: 9002,
    user_ref: 9002,
    instrument_ref: 2, // fiddle
    genre_default: "Irish Traditional",
  });

  if (bobPlaylistError) {
    console.error("   ❌ Bob's playlist failed:", bobPlaylistError);
  } else {
    console.log("   ✅ Bob's playlist created (ID: 9002)");
  }

  console.log("\n✨ Test environment ready!");
}

setup().catch(console.error);
