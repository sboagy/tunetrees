import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
// Use 127.0.0.1 to avoid localhost resolution issues (IPv4 vs IPv6)
const WORKER_URL = "http://127.0.0.1:8787";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing Supabase env vars");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testWorker() {
  console.log("1. Signing in as Alice...");
  const {
    data: { session },
    error,
  } = await supabase.auth.signInWithPassword({
    email: "alice.test@tunetrees.test",
    password: process.env.ALICE_TEST_PASSWORD || "TestPassword123!",
  });

  if (error || !session) {
    console.error("Login failed:", error);
    process.exit(1);
  }

  console.log("2. Testing Worker Sync Endpoint...");
  const token = session.access_token;

  try {
    const response = await fetch(`${WORKER_URL}/api/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        changes: [],
        lastPulledAt: null,
        schemaVersion: 1,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`❌ Worker returned ${response.status}: ${text}`);
    } else {
      const json = await response.json();
      console.log("✅ Worker Sync Success!");

      const changes = json.changes || [];
      console.log("Total changes:", changes.length);

      const playlists = changes.filter((c: any) => c.table === "playlist");
      console.log("Playlists synced:", playlists.length);
      if (playlists.length > 0) console.log(JSON.stringify(playlists, null, 2));

      const states = changes.filter(
        (c: any) => c.table === "tab_group_main_state"
      );
      console.log("States synced:", states.length);
      if (states.length > 0) console.log(JSON.stringify(states, null, 2));

      const profiles = changes.filter((c: any) => c.table === "user_profile");
      console.log("Profiles synced:", profiles.length);
      if (profiles.length > 0) console.log(JSON.stringify(profiles, null, 2));

      const instruments = changes.filter((c: any) => c.table === "instrument");
      console.log("Instruments synced:", instruments.length);
      if (instruments.length > 0)
        console.log(JSON.stringify(instruments, null, 2));

      const genres = changes.filter((c: any) => c.table === "genre");
      console.log("Genres synced:", genres.length);
      if (genres.length > 0) console.log(JSON.stringify(genres, null, 2));

      const tunes = changes.filter((c: any) => c.table === "tune");
      console.log("Tunes synced:", tunes.length);
      if (tunes.length > 0)
        console.log(JSON.stringify(tunes.slice(0, 5), null, 2));
    }
  } catch (e) {
    console.error("❌ Fetch failed:", e);
  }
}

testWorker();
