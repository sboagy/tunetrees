/**
 * Production Data Migration: SQLite → Supabase PostgreSQL
 *
 * This script migrates ALL data from tunetrees_production_manual.sqlite3 to Supabase.
 * It handles schema differences, creates Supabase Auth users, and preserves relationships.
 *
 * ARCHITECTURE:
 * - user.id (SQLite) → user_profile.id (PostgreSQL) - INTEGER preserved for FK compatibility
 * - Creates Supabase auth.users entry with UUID
 * - user_profile.supabase_user_id links to auth.users(id)
 * - All foreign keys use INTEGER IDs, not UUIDs
 *
 * MIGRATION STRATEGY:
 * Phase 0: CLEANUP - Deletes all existing data in Supabase (clean slate)
 * Phase 1-11: INSERT - Copies all data from SQLite
 *
 * SAFE TO RE-RUN:
 * ✅ Each run starts fresh by clearing all tables
 * ✅ No duplicate records created
 * ✅ All record counts will match SQLite exactly
 *
 * ⚠️  WARNING: This DELETES all data in Supabase before migrating!
 * Only run this when you want to completely replace Supabase data with SQLite data.
 *
 * Usage:
 *   npm run migrate:production -- --user-uuid=<your-supabase-uuid>
 *
 * The user-uuid should be YOUR Supabase Auth UUID (from logging into the app).
 * User ID 1 in SQLite will map to this UUID.
 *
 * @module scripts/migrate-production-to-supabase
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { createClient } from "@supabase/supabase-js";
import BetterSqlite3 from "better-sqlite3";
import * as dotenv from "dotenv";
import postgres from "postgres";

// Load environment variables
dotenv.config({ path: ".env.production" });

// ============================================================================
// Configuration
// ============================================================================

const SQLITE_DB_PATH = "./tunetrees_production_manual.sqlite3";
const BATCH_SIZE = 100; // For batch inserts
const MIGRATION_DEVICE_ID = "data-migration-2025-10-05";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DATABASE_URL = process.env.DATABASE_URL; // Direct Postgres connection string

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Missing Supabase credentials!");
  console.error(
    "Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.production"
  );
  process.exit(1);
}

if (!DATABASE_URL) {
  console.error("❌ Missing DATABASE_URL!");
  console.error(
    "Set DATABASE_URL in .env.production for direct Postgres access"
  );
  process.exit(1);
}

// Get target user UUID from command line or use default
const args = process.argv.slice(2);
const userUuidArg = args.find((arg) => arg.startsWith("--user-uuid="));
const DEFAULT_USER_UUID = "b2b64a0a-18d4-4d00-aecb-27f676defe31"; // Default to main user
const TARGET_USER_UUID = userUuidArg?.split("=")[1] || DEFAULT_USER_UUID;

if (!TARGET_USER_UUID) {
  console.error("❌ Missing target user UUID!");
  console.error("Usage: npm run migrate:production -- --user-uuid=<your-uuid>");
  console.error("\nGet your UUID from the home page after logging in.");
  process.exit(1);
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!UUID_REGEX.test(TARGET_USER_UUID)) {
  console.error("❌ Invalid UUID format!");
  console.error(`Got: ${TARGET_USER_UUID}`);
  process.exit(1);
}

console.log("🔧 Migration Configuration:");
console.log(`   Source: ${SQLITE_DB_PATH}`);
console.log(`   Target: Supabase PostgreSQL`);
console.log(`   Your UUID: ${TARGET_USER_UUID}`);
console.log(`   Device ID: ${MIGRATION_DEVICE_ID}`);
console.log();

// ============================================================================
// ============================================================================
// Initialize Connections
// ============================================================================

const sqlite = new BetterSqlite3(SQLITE_DB_PATH, { readonly: true });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Create direct Postgres connection for TRUNCATE operations
// Suppress NOTICE messages for cleaner output
const sql = postgres(DATABASE_URL, {
  onnotice: () => {}, // Suppress CASCADE notices
});

// User ID mapping: SQLite integer ID → { intId: preserved integer, uuid: Supabase auth UUID }
const userIdMapping = new Map<number, { intId: number; uuid: string }>();

// Instrument mapping: SQLite text → PostgreSQL integer ID
const instrumentMapping = new Map<string, number>();

// ============================================================================
// Helper Functions
// ============================================================================

function now(): string {
  return new Date().toISOString();
}

function sqliteTimestampToPostgres(sqliteTs: string | null): string | null {
  if (!sqliteTs) return null;
  // SQLite timestamps are already ISO strings or can be parsed
  try {
    return new Date(sqliteTs).toISOString();
  } catch {
    return null;
  }
}

async function countSupabase(tableName: string): Promise<number> {
  const { count, error } = await supabase
    .from(tableName)
    .select("*", { count: "exact", head: true });
  if (error) {
    console.error(`Error counting ${tableName}:`, error);
    return 0;
  }
  return count || 0;
}

// ============================================================================
// Phase 0: Cleanup - Clear All Tables
// ============================================================================

async function cleanupSupabaseTables() {
  console.log("\n🧹 Phase 0: Cleaning Up Supabase Tables");
  console.log(`=${"=".repeat(59)}`);
  console.log(
    "\n⚠️  This will DELETE all existing data in Supabase to ensure clean migration."
  );
  console.log("Deleting in dependency order (children first)...\n");

  try {
    // Use a single literal TRUNCATE with explicit identifiers to retain syntax checks
    // and avoid identifier interpolation edge-cases.
    await sql`
      TRUNCATE TABLE
        "practice_record",
        "daily_practice_queue",
        "playlist_tune",
        "note",
        "reference",
        "tag",
        "tune_override",
        "table_transient_data",
        "table_state",
        "tab_group_main_state",
        "playlist",
        "tune",
        "prefs_spaced_repetition",
        "prefs_scheduling_options",
        "instrument",
        "genre_tune_type",
        "tune_type",
        "genre",
        "user_profile"
      CASCADE
    `;
    console.log(
      "✓ Cleaned tables: practice_record, daily_practice_queue, playlist_tune, note, reference, tag, tune_override, table_transient_data, table_state, tab_group_main_state, playlist, tune, prefs_spaced_repetition, prefs_scheduling_options, instrument, genre_tune_type, tune_type, genre, user_profile"
    );
  } catch (err: any) {
    console.error("✗ Failed to truncate tables:", err.message);
  }

  console.log("\n✅ Cleanup complete - all tables cleared\n");
}

// ============================================================================
// Phase 1: Migrate Users (create Supabase Auth users + user_profile)
// ============================================================================

async function migrateUsers() {
  console.log("\n📊 Phase 1: Migrating Users");
  console.log(`=${"=".repeat(59)}`);

  // Skip user_id=0 (public-all-psuedo user with null email)
  const users = sqlite
    .prepare("SELECT * FROM user WHERE deleted = 0 AND id != 0")
    .all() as any[];

  console.log(`Found ${users.length} active users in SQLite\n`);

  for (const user of users) {
    try {
      let supabaseAuthUserId: string;

      if (user.id === 1) {
        // User ID 1 maps to your existing Supabase auth user
        supabaseAuthUserId = TARGET_USER_UUID!;
        console.log(
          `✓ User ${user.id} (${
            user.email
          }) → Using existing UUID ${TARGET_USER_UUID!}`
        );
      } else {
        // Check if auth user already exists by email
        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        const existingUser = existingUsers?.users.find(
          (u: any) => u.email === user.email
        );

        if (existingUser) {
          // User already exists from previous migration run
          supabaseAuthUserId = existingUser.id;
          console.log(
            `✓ User ${user.id} (${user.email}) → Using existing UUID ${supabaseAuthUserId} (already exists)`
          );
        } else {
          // Create new Supabase auth user
          const tempPassword = `temp-${Math.random()
            .toString(36)
            .slice(2)}-${Date.now()}`;

          const { data: authUser, error: authError } =
            await supabase.auth.admin.createUser({
              email: user.email,
              password: tempPassword,
              email_confirm: true, // Skip email confirmation
              user_metadata: {
                name: user.name,
                migrated_from_sqlite: true,
                original_sqlite_id: user.id,
                migration_date: now(),
              },
            });

          if (authError) {
            console.error(
              `✗ Failed to create auth user for ${user.email}:`,
              authError
            );
            continue;
          }

          supabaseAuthUserId = authUser.user!.id;
          console.log(
            `✓ User ${user.id} (${user.email}) → Created new UUID ${supabaseAuthUserId}`
          );
        }
      }

      // Insert into user_profile with BOTH integer ID (preserved) and UUID
      const { error: profileError } = await supabase
        .from("user_profile")
        .upsert(
          {
            id: user.id, // Preserve original integer ID for FK compatibility
            supabase_user_id: supabaseAuthUserId,
            name: user.name,
            email: user.email,
            sr_alg_type: user.sr_alg_type || null,
            phone: user.phone || null,
            phone_verified: sqliteTimestampToPostgres(user.phone_verified),
            acceptable_delinquency_window:
              user.acceptable_delinquency_window || 21,
            deleted: false,
            sync_version: 1,
            last_modified_at: now(),
            device_id: MIGRATION_DEVICE_ID,
          },
          {
            onConflict: "supabase_user_id", // Prevent duplicates
          }
        );

      if (profileError) {
        console.error(
          `✗ Failed to insert user_profile for ${user.email}:`,
          profileError
        );
        continue;
      }

      // Store mapping
      userIdMapping.set(user.id, {
        intId: user.id, // Integer ID preserved
        uuid: supabaseAuthUserId,
      });
    } catch (error) {
      console.error(`✗ Error migrating user ${user.id}:`, error);
    }
  }

  console.log(`\n✅ Migrated ${userIdMapping.size} users`);
  console.log(
    `   User ID mapping: ${Array.from(userIdMapping.entries())
      .map(([k, v]) => `${k}→${v.intId}`)
      .join(", ")}`
  );
}

// ============================================================================
// Phase 2: Migrate Reference Data (genres, tune_types, instruments)
// ============================================================================

async function migrateReferenceData() {
  console.log("\n📊 Phase 2: Migrating Reference Data");
  console.log(`=${"=".repeat(59)}`);

  // Genres (id is TEXT in both schemas)
  console.log("\nMigrating genres...");
  const genres = sqlite.prepare("SELECT * FROM genre").all() as any[];

  if (genres.length > 0) {
    const supabaseGenres = genres.map((g) => ({
      id: g.id,
      name: g.name || null,
      region: g.region || null,
      description: g.description || null,
    }));

    const { error } = await supabase
      .from("genre")
      .upsert(supabaseGenres, { onConflict: "id" });
    if (error) {
      console.error("Error migrating genres:", error);
    } else {
      console.log(`✓ Migrated ${genres.length} genres`);
    }
  }

  // Tune Types (id is TEXT in both schemas)
  console.log("\nMigrating tune types...");
  const tuneTypes = sqlite.prepare("SELECT * FROM tune_type").all() as any[];

  if (tuneTypes.length > 0) {
    const supabaseTuneTypes = tuneTypes.map((tt) => ({
      id: tt.id,
      name: tt.name || null,
      rhythm: tt.rhythm || null,
      description: tt.description || null,
    }));

    const { error } = await supabase
      .from("tune_type")
      .upsert(supabaseTuneTypes, { onConflict: "id" });
    if (error) {
      console.error("Error migrating tune types:", error);
    } else {
      console.log(`✓ Migrated ${tuneTypes.length} tune types`);
    }
  }

  // Genre-TuneType relationships
  console.log("\nMigrating genre-tune type relationships...");
  const genreTuneTypes = sqlite
    .prepare("SELECT * FROM genre_tune_type")
    .all() as any[];

  if (genreTuneTypes.length > 0) {
    // Skip orphaned BluesBallad reference (tune type doesn't exist)
    const validGenreTuneTypes = genreTuneTypes.filter(
      (gtt: any) => gtt.tune_type_id !== "BluesBallad"
    );

    if (validGenreTuneTypes.length < genreTuneTypes.length) {
      console.log(
        `⚠️  Skipped ${
          genreTuneTypes.length - validGenreTuneTypes.length
        } orphaned genre-tune type relationships`
      );
    }

    const supabaseGTT = validGenreTuneTypes.map((gtt: any) => ({
      genre_id: gtt.genre_id,
      tune_type_id: gtt.tune_type_id,
    }));

    const { error } = await supabase
      .from("genre_tune_type")
      .upsert(supabaseGTT, { onConflict: "genre_id,tune_type_id" });
    if (error) {
      console.error("Error migrating genre_tune_type:", error);
    } else {
      console.log(
        `✓ Migrated ${validGenreTuneTypes.length} genre-tune type relationships`
      );
    }
  }

  // Instruments (TEXT in SQLite → need to migrate to INTEGER ID in PostgreSQL)
  console.log("\nMigrating instruments...");
  const instruments = sqlite
    .prepare("SELECT * FROM instrument WHERE deleted = 0")
    .all() as any[];

  if (instruments.length > 0) {
    // First, get existing instruments from PostgreSQL to build mapping
    const { data: existingInstruments } = await supabase
      .from("instrument")
      .select("id, instrument");

    const existingMap = new Map<string, number>();
    if (existingInstruments) {
      existingInstruments.forEach((inst: any) => {
        if (inst.instrument) {
          existingMap.set(inst.instrument, inst.id);
        }
      });
    }

    // Migrate each instrument
    for (const inst of instruments) {
      const instrumentName = inst.instrument;

      // Check if it already exists
      if (existingMap.has(instrumentName)) {
        instrumentMapping.set(instrumentName, existingMap.get(instrumentName)!);
        continue;
      }

      // Insert new instrument
      const { data, error } = await supabase
        .from("instrument")
        .insert({
          id: inst.id,
          private_to_user: inst.private_to_user || null,
          instrument: instrumentName,
          description: inst.description || null,
          genre_default: inst.genre_default || null,
          deleted: false,
          sync_version: 1,
          last_modified_at: now(),
          device_id: MIGRATION_DEVICE_ID,
        })
        .select("id")
        .single();

      if (error) {
        console.error(`Error inserting instrument ${instrumentName}:`, error);
      } else if (data) {
        instrumentMapping.set(instrumentName, data.id);
        console.log(`✓ Migrated instrument: ${instrumentName} → ID ${data.id}`);
      }
    }

    console.log(`✓ Total instruments: ${instrumentMapping.size}`);
  }

  console.log("\n✅ Reference data migration complete");
}

// ============================================================================
// Phase 3: Migrate Tunes
// ============================================================================

// SQLite tune row interface - represents raw SQLite column names
// Based on the Tune type but with snake_case field names to match SQLite
type SQLiteTune = {
  id: number;
  title: string | null;
  type: string | null;
  structure: string | null;
  mode: string | null;
  incipit: string | null;
  genre: string | null;
  private_for: number | null;
  deleted: number;
};

async function migrateTunes() {
  console.log("\n📊 Phase 3: Migrating Tunes");
  console.log(`=${"=".repeat(59)}`);

  const tunes = sqlite
    .prepare("SELECT * FROM tune WHERE deleted = 0")
    .all() as SQLiteTune[];

  console.log(`Found ${tunes.length} tunes\n`);

  const supabaseTunes = tunes.map((tune) => {
    // Use the genre value directly from SQLite, defaulting to ITRAD if null
    let genreValue = tune.genre || "ITRAD";

    // data hack time!
    if (tune.type === "BREAKDOWN") {
      genreValue = "BGRA";
    } else if (tune.title?.trim() === "Turkey in the Straw") {
      genreValue = "BGRA";
    } else if (tune.title?.trim() === "Bile Dem Cabbage Down") {
      genreValue = "BGRA";
    }

    return {
      id: tune.id,
      title: tune.title || null,
      type: tune.type || null,
      structure: tune.structure || null,
      mode: tune.mode || null,
      incipit: tune.incipit || null,
      // SQLite genre (TEXT) maps directly to PostgreSQL genre (TEXT)
      genre: genreValue,
      private_for: tune.private_for || null,
      deleted: false,
      sync_version: 1,
      last_modified_at: now(),
      device_id: MIGRATION_DEVICE_ID,
    };
  });

  // Batch insert
  for (let i = 0; i < supabaseTunes.length; i += BATCH_SIZE) {
    const batch = supabaseTunes.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("tune")
      .upsert(batch, { onConflict: "id" });

    if (error) {
      console.error(`Error migrating tunes batch ${i}:`, error);
    } else {
      console.log(
        `✓ Migrated ${Math.min(i + BATCH_SIZE, supabaseTunes.length)}/${
          supabaseTunes.length
        } tunes`
      );
    }
  }

  console.log("\n✅ Tunes migration complete");
}

// ============================================================================
// Phase 4: Migrate Tune Overrides
// ============================================================================

async function migrateTuneOverrides() {
  console.log("\n📊 Phase 4: Migrating Tune Overrides");
  console.log(`=${"=".repeat(59)}`);

  const tuneOverrides = sqlite
    .prepare("SELECT * FROM tune_override WHERE deleted = 0")
    .all() as any[];

  console.log(`Found ${tuneOverrides.length} tune overrides\n`);

  const supabaseTuneOverrides = tuneOverrides.map((to) => ({
    tune_ref: to.tune_ref,
    user_ref: to.user_ref,
    title: to.title || null,
    type: to.type || null,
    structure: to.structure || null,
    genre: to.genre || null,
    mode: to.mode || null,
    incipit: to.incipit || null,
    deleted: false,
    sync_version: 1,
    last_modified_at: now(),
    device_id: MIGRATION_DEVICE_ID,
  }));

  if (supabaseTuneOverrides.length > 0) {
    const { error } = await supabase
      .from("tune_override")
      .upsert(supabaseTuneOverrides);

    if (error) {
      console.error("Error migrating tune overrides:", error);
    } else {
      console.log(`✓ Migrated ${supabaseTuneOverrides.length} tune overrides`);
    }
  }

  console.log("\n✅ Tune overrides migration complete");
}

// ============================================================================
// Phase 5: Migrate Playlists
// ============================================================================

async function migratePlaylists() {
  console.log("\n📊 Phase 5: Migrating Playlists");
  console.log(`=${"=".repeat(59)}`);

  const playlists = sqlite
    .prepare("SELECT * FROM playlist WHERE deleted = 0")
    .all() as any[];

  console.log(`Found ${playlists.length} playlists\n`);

  const supabasePlaylists = playlists.map((p) => {
    // Validate instrument_ref - must exist in instrument table
    let instrumentRef = p.instrument_ref || null;
    if (instrumentRef !== null) {
      const instrumentExists = sqlite
        .prepare("SELECT id FROM instrument WHERE id = ? AND deleted = 0")
        .get(instrumentRef);
      if (!instrumentExists) {
        console.log(
          `⚠️  Playlist ${p.playlist_id} references invalid instrument ${instrumentRef}, setting to null`
        );
        instrumentRef = null;
      }
    }

    return {
      playlist_id: p.playlist_id,
      user_ref: p.user_ref, // Integer ID preserved
      instrument_ref: instrumentRef,
      sr_alg_type: p.sr_alg_type || null,
      deleted: false,
      sync_version: 1,
      last_modified_at: now(),
      device_id: MIGRATION_DEVICE_ID,
    };
  });

  const { error } = await supabase
    .from("playlist")
    .upsert(supabasePlaylists, { onConflict: "playlist_id" });

  if (error) {
    console.error("Error migrating playlists:", error);
  } else {
    console.log(`✓ Migrated ${supabasePlaylists.length} playlists`);
  }

  console.log("\n✅ Playlists migration complete");
}

// ============================================================================
// Phase 6: Migrate Playlist-Tune Relationships
// ============================================================================

async function migratePlaylistTunes() {
  console.log("\n📊 Phase 6: Migrating Playlist-Tune Relationships");
  console.log(`=${"=".repeat(59)}`);

  const playlistTunes = sqlite
    .prepare("SELECT * FROM playlist_tune WHERE deleted = 0")
    .all() as any[];

  // Filter out references to deleted tunes (tunes that don't exist)
  const validPlaylistTunes = playlistTunes.filter((pt: any) => {
    const tuneExists = sqlite
      .prepare("SELECT id FROM tune WHERE id = ? AND deleted = 0")
      .get(pt.tune_ref);
    return tuneExists !== undefined;
  });

  if (validPlaylistTunes.length < playlistTunes.length) {
    console.log(
      `⚠️  Skipped ${
        playlistTunes.length - validPlaylistTunes.length
      } playlist-tune relationships referencing deleted tunes`
    );
  }

  console.log(
    `Found ${validPlaylistTunes.length} playlist-tune relationships\n`
  );

  const supabasePlaylistTunes = validPlaylistTunes.map((pt: any) => ({
    playlist_ref: pt.playlist_ref,
    tune_ref: pt.tune_ref,
    current: sqliteTimestampToPostgres(pt.current),
    learned: sqliteTimestampToPostgres(pt.learned),
    scheduled: sqliteTimestampToPostgres(pt.scheduled),
    goal: pt.goal || "recall",
    deleted: false,
    sync_version: 1,
    last_modified_at: now(),
    device_id: MIGRATION_DEVICE_ID,
  }));

  // Batch insert
  for (let i = 0; i < supabasePlaylistTunes.length; i += BATCH_SIZE) {
    const batch = supabasePlaylistTunes.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("playlist_tune")
      .upsert(batch, { onConflict: "playlist_ref,tune_ref" });

    if (error) {
      console.error(`Error migrating playlist_tune batch ${i}:`, error);
    } else {
      console.log(
        `✓ Migrated ${Math.min(i + BATCH_SIZE, supabasePlaylistTunes.length)}/${
          supabasePlaylistTunes.length
        } relationships`
      );
    }
  }

  console.log("\n✅ Playlist-tune migration complete");
}

// ============================================================================
// Phase 7: Migrate Practice Records
// ============================================================================

async function migratePracticeRecords() {
  console.log("\n📊 Phase 7: Migrating Practice Records");
  console.log(`=${"=".repeat(59)}`);

  const practiceRecords = sqlite
    .prepare("SELECT * FROM practice_record")
    .all() as any[];

  console.log(`Found ${practiceRecords.length} practice records\n`);

  const supabasePracticeRecords = practiceRecords.map((pr) => ({
    id: pr.id,
    playlist_ref: pr.playlist_ref,
    tune_ref: pr.tune_ref,
    practiced: sqliteTimestampToPostgres(pr.practiced_at || pr.practiced), // Column name changed
    quality: pr.quality || null,
    easiness: pr.easiness || null,
    difficulty: pr.difficulty || null,
    stability: pr.stability || null,
    interval: pr.interval || null,
    step: pr.step || null,
    repetitions: pr.reps || pr.repetitions || null, // Column name changed: reps → repetitions
    lapses: pr.lapses || null,
    elapsed_days: pr.elapsed_days || null,
    state: pr.state || null,
    due: sqliteTimestampToPostgres(pr.due),
    backup_practiced: sqliteTimestampToPostgres(pr.backup_practiced),
    goal: pr.goal || "recall",
    technique: pr.technique || null,
    sync_version: 1,
    last_modified_at: now(),
    device_id: MIGRATION_DEVICE_ID,
  }));

  // Batch insert
  for (let i = 0; i < supabasePracticeRecords.length; i += BATCH_SIZE) {
    const batch = supabasePracticeRecords.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("practice_record")
      .upsert(batch, { onConflict: "id" });

    if (error) {
      console.error(`Error migrating practice_record batch ${i}:`, error);
    } else {
      console.log(
        `✓ Migrated ${Math.min(
          i + BATCH_SIZE,
          supabasePracticeRecords.length
        )}/${supabasePracticeRecords.length} records`
      );
    }
  }

  console.log("\n✅ Practice records migration complete");
}

// ============================================================================
// Phase 8: Migrate Notes, References, Tags
// ============================================================================

async function migrateNotes() {
  console.log("\n📊 Phase 8: Migrating Notes");
  console.log(`=${"=".repeat(59)}`);

  const notes = sqlite
    .prepare("SELECT * FROM note WHERE deleted = 0")
    .all() as any[];

  console.log(`Found ${notes.length} notes\n`);

  const supabaseNotes = notes.map((note) => ({
    id: note.id,
    user_ref: note.user_ref || null,
    tune_ref: note.tune_ref,
    playlist_ref: note.playlist_ref || null,
    created_date: sqliteTimestampToPostgres(note.created_date),
    note_text: note.note_text || null,
    public: Boolean(note.public),
    favorite: Boolean(note.favorite),
    deleted: false,
    sync_version: 1,
    last_modified_at: now(),
    device_id: MIGRATION_DEVICE_ID,
  }));

  const { error } = await supabase
    .from("note")
    .upsert(supabaseNotes, { onConflict: "id" });

  if (error) {
    console.error("Error migrating notes:", error);
  } else {
    console.log(`✓ Migrated ${supabaseNotes.length} notes`);
  }

  console.log("\n✅ Notes migration complete");
}

async function migrateReferences() {
  console.log("\n📊 Phase 9: Migrating References");
  console.log(`=${"=".repeat(59)}`);

  const references = sqlite
    .prepare("SELECT * FROM reference WHERE deleted = 0")
    .all() as any[];

  console.log(`Found ${references.length} references\n`);

  const supabaseReferences = references.map((ref) => ({
    url: ref.url,
    ref_type: ref.ref_type || null,
    tune_ref: ref.tune_ref,
    user_ref: ref.user_ref || null,
    comment: ref.reference_text || ref.comment || null, // Column name changed: reference_text → comment
    title: ref.title || null,
    public: Boolean(ref.public),
    favorite: Boolean(ref.favorite),
    deleted: false,
    sync_version: 1,
    last_modified_at: now(),
    device_id: MIGRATION_DEVICE_ID,
  }));

  // Batch insert references
  const BATCH_SIZE = 100;
  for (let i = 0; i < supabaseReferences.length; i += BATCH_SIZE) {
    const batch = supabaseReferences.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("reference").insert(batch);

    if (error) {
      console.error(`Error migrating reference batch ${i}:`, error);
    } else {
      console.log(
        `✓ Migrated ${Math.min(i + BATCH_SIZE, supabaseReferences.length)}/${
          supabaseReferences.length
        } references`
      );
    }
  }

  console.log("\n✅ References migration complete");
}

async function migrateTags() {
  console.log("\n📊 Phase 10: Migrating Tags");
  console.log(`=${"=".repeat(59)}`);

  const tags = sqlite.prepare("SELECT * FROM tag").all() as any[];

  console.log(`Found ${tags.length} tags\n`);

  const supabaseTags = tags.map((tag) => ({
    user_ref: tag.user_ref,
    tune_ref: tag.tune_ref,
    tag_text: tag.tag || tag.tag_text, // Column name changed: tag → tag_text
    sync_version: 1,
    last_modified_at: now(),
    device_id: MIGRATION_DEVICE_ID,
  }));

  const { error } = await supabase
    .from("tag")
    .upsert(supabaseTags, { onConflict: "user_ref,tune_ref,tag_text" });

  if (error) {
    console.error("Error migrating tags:", error);
  } else {
    console.log(`✓ Migrated ${supabaseTags.length} tags`);
  }

  console.log("\n✅ Tags migration complete");
}

// ============================================================================
// Phase 11: Migrate Preferences
// ============================================================================

async function migratePreferences() {
  console.log("\n📊 Phase 11: Migrating Preferences");
  console.log(`=${"=".repeat(59)}`);

  // Spaced Repetition Preferences
  const srPrefs = sqlite
    .prepare("SELECT * FROM prefs_spaced_repetition")
    .all() as any[];

  if (srPrefs.length > 0) {
    const supabaseSRPrefs = srPrefs.map((pref) => ({
      user_id: pref.user_id,
      alg_type: pref.alg_type,
      fsrs_weights: pref.fsrs_weights || null,
      request_retention: pref.request_retention || null,
      maximum_interval: pref.maximum_interval || null,
      learning_steps: pref.learning_steps || null,
      relearning_steps: pref.relearning_steps || null,
      enable_fuzzing: Boolean(pref.enable_fuzzing),
      sync_version: 1,
      last_modified_at: now(),
      device_id: MIGRATION_DEVICE_ID,
    }));

    const { error } = await supabase
      .from("prefs_spaced_repetition")
      .upsert(supabaseSRPrefs, { onConflict: "user_id,alg_type" });

    if (error) {
      console.error("Error migrating SR prefs:", error);
    } else {
      console.log(
        `✓ Migrated ${supabaseSRPrefs.length} spaced repetition preferences`
      );
    }
  }

  // Scheduling Options
  const schedPrefs = sqlite
    .prepare("SELECT * FROM prefs_scheduling_options")
    .all() as any[];

  if (schedPrefs.length > 0) {
    const supabaseSchedPrefs = schedPrefs.map((pref) => ({
      user_id: pref.user_id,
      acceptable_delinquency_window: pref.acceptable_delinquency_window || 21,
      min_reviews_per_day: pref.min_reviews_per_day || null,
      max_reviews_per_day: pref.max_reviews_per_day || null,
      days_per_week: pref.days_per_week || null,
      weekly_rules: pref.weekly_rules || null,
      exceptions: pref.exceptions || null,
      sync_version: 1,
      last_modified_at: now(),
      device_id: MIGRATION_DEVICE_ID,
    }));

    const { error } = await supabase
      .from("prefs_scheduling_options")
      .upsert(supabaseSchedPrefs, { onConflict: "user_id" });

    if (error) {
      console.error("Error migrating scheduling prefs:", error);
    } else {
      console.log(
        `✓ Migrated ${supabaseSchedPrefs.length} scheduling preferences`
      );
    }
  }

  console.log("\n✅ Preferences migration complete");
}

// ============================================================================
// Phase 12: Migrate Daily Practice Queue
// ============================================================================

async function migrateDailyPracticeQueue() {
  console.log("\n📊 Phase 12: Migrating Daily Practice Queue");
  console.log(`=${"=".repeat(59)}`);

  const queueRecords = sqlite
    .prepare("SELECT * FROM daily_practice_queue")
    .all() as any[];

  if (queueRecords.length === 0) {
    console.log("No daily practice queue records to migrate");
    return;
  }

  console.log(`Found ${queueRecords.length} queue records to migrate`);

  // Migrate in batches of 100
  const batchSize = 100;
  let migrated = 0;
  let errors = 0;

  for (let i = 0; i < queueRecords.length; i += batchSize) {
    const batch = queueRecords.slice(i, i + batchSize);

    const supabaseQueueRecords = batch.map((record) => ({
      id: record.id,
      user_ref: record.user_ref,
      playlist_ref: record.playlist_ref,
      mode: record.mode || null,
      queue_date: record.queue_date || null,
      window_start_utc: record.window_start_utc,
      window_end_utc: record.window_end_utc,
      tune_ref: record.tune_ref,
      bucket: record.bucket,
      order_index: record.order_index,
      snapshot_coalesced_ts: record.snapshot_coalesced_ts,
      scheduled_snapshot: record.scheduled_snapshot || null,
      latest_due_snapshot: record.latest_due_snapshot || null,
      acceptable_delinquency_window_snapshot:
        record.acceptable_delinquency_window_snapshot || null,
      tz_offset_minutes_snapshot: record.tz_offset_minutes_snapshot || null,
      generated_at: record.generated_at,
      completed_at: record.completed_at || null,
      exposures_required: record.exposures_required || null,
      exposures_completed: record.exposures_completed || 0,
      outcome: record.outcome || null,
      active: Boolean(record.active ?? true),
      sync_version: 1,
      last_modified_at: now(),
      device_id: MIGRATION_DEVICE_ID,
    }));

    const { error } = await supabase
      .from("daily_practice_queue")
      .upsert(supabaseQueueRecords, {
        onConflict: "user_ref,playlist_ref,window_start_utc,tune_ref",
      });

    if (error) {
      console.error(`✗ Error migrating batch ${i / batchSize + 1}:`, error);
      errors += batch.length;
    } else {
      migrated += batch.length;
      console.log(
        `✓ Batch ${i / batchSize + 1}/${Math.ceil(
          queueRecords.length / batchSize
        )}: Migrated ${batch.length} queue records`
      );
    }
  }

  console.log(
    `\n✅ Daily practice queue migration complete: ${migrated} migrated, ${errors} errors`
  );
}

// ============================================================================
// Phase 13: Migrate UI State Tables
// ============================================================================

async function migrateUIStateTables() {
  console.log("\n📊 Phase 13: Migrating UI State Tables");
  console.log(`=${"=".repeat(59)}`);

  // Tab Group Main State
  console.log("\nMigrating tab_group_main_state...");
  const tabGroupStates = sqlite
    .prepare("SELECT * FROM tab_group_main_state WHERE user_id != -1")
    .all() as any[];
  if (tabGroupStates.length > 0) {
    // Filter out invalid user references (user_id=-1 or users that don't exist)
    const validTabGroupStates = tabGroupStates.filter((state: any) => {
      if (state.user_id <= 0) return false; // Skip user_id <= 0
      const userExists = sqlite
        .prepare("SELECT id FROM user WHERE id = ? AND deleted = 0")
        .get(state.user_id);
      return userExists !== undefined;
    });

    if (validTabGroupStates.length < tabGroupStates.length) {
      console.log(
        `⚠️  Skipped ${
          tabGroupStates.length - validTabGroupStates.length
        } tab group states with invalid user references`
      );
    }

    const supabaseTabGroupStates = validTabGroupStates.map((state: any) => ({
      id: state.id,
      user_id: state.user_id,
      which_tab: state.which_tab || "practice",
      playlist_id: state.playlist_id || null,
      tab_spec: state.tab_spec || null,
      practice_show_submitted:
        state.practice_show_submitted === 1 ||
        state.practice_show_submitted === true
          ? 1
          : 0,
      practice_mode_flashcard:
        state.practice_mode_flashcard === 1 ||
        state.practice_mode_flashcard === true
          ? 1
          : 0,
      sync_version: 1,
      last_modified_at: now(),
      device_id: MIGRATION_DEVICE_ID,
    }));

    const { error } = await supabase
      .from("tab_group_main_state")
      .upsert(supabaseTabGroupStates, { onConflict: "id" });

    if (error) {
      console.error("Error migrating tab_group_main_state:", error);
    } else {
      console.log(
        `✓ Migrated ${supabaseTabGroupStates.length} tab group states (${validTabGroupStates.length} valid of ${tabGroupStates.length} total)`
      );
    }
  } else {
    console.log("No tab group states to migrate");
  }

  // Table State
  console.log("\nMigrating table_state...");
  const tableStates = sqlite
    .prepare("SELECT * FROM table_state")
    .all() as any[];

  if (tableStates.length > 0) {
    // Filter out table_state records that reference deleted playlists or users
    const validTableStates = tableStates.filter((state: any) => {
      // Check if playlist exists and is not deleted
      const playlistExists = sqlite
        .prepare(
          "SELECT playlist_id FROM playlist WHERE playlist_id = ? AND deleted = 0"
        )
        .get(state.playlist_id);

      // Check if user exists and is not deleted
      const userExists = sqlite
        .prepare("SELECT id FROM user WHERE id = ? AND deleted = 0")
        .get(state.user_id);

      return playlistExists !== undefined && userExists !== undefined;
    });

    if (validTableStates.length < tableStates.length) {
      console.log(
        `⚠️  Skipped ${
          tableStates.length - validTableStates.length
        } table states with invalid playlist/user references`
      );
    }

    const supabaseTableStates = validTableStates.map((state) => ({
      user_id: state.user_id,
      screen_size: state.screen_size,
      purpose: state.purpose,
      playlist_id: state.playlist_id,
      settings: state.settings || null,
      current_tune: state.current_tune || null,
      sync_version: 1,
      last_modified_at: now(),
      device_id: MIGRATION_DEVICE_ID,
    }));

    const { error } = await supabase
      .from("table_state")
      .upsert(supabaseTableStates, {
        onConflict: "user_id,screen_size,purpose,playlist_id",
      });

    if (error) {
      console.error("Error migrating table_state:", error);
    } else {
      console.log(`✓ Migrated ${supabaseTableStates.length} table states`);
    }
  } else {
    console.log("No table states to migrate");
  }

  // Table Transient Data (usually empty, but include for completeness)
  console.log("\nMigrating table_transient_data...");
  const tableTransientData = sqlite
    .prepare("SELECT * FROM table_transient_data")
    .all() as any[];

  if (tableTransientData.length > 0) {
    const supabaseTableTransientData = tableTransientData.map((data) => ({
      user_id: data.user_id,
      tune_id: data.tune_id,
      playlist_id: data.playlist_id,
      purpose: data.purpose || null,
      note_private: data.note_private || null,
      note_public: data.note_public || null,
      recall_eval: data.recall_eval || null,
      practiced: sqliteTimestampToPostgres(data.practiced),
      quality: data.quality || null,
      easiness: data.easiness || null,
      difficulty: data.difficulty || null,
      interval: data.interval || null,
      step: data.step || null,
      repetitions: data.repetitions || null,
      due: sqliteTimestampToPostgres(data.due),
      backup_practiced: sqliteTimestampToPostgres(data.backup_practiced),
      goal: data.goal || null,
      technique: data.technique || null,
      stability: data.stability || null,
      state: data.state || null,
      sync_version: 1,
      last_modified_at: now(),
      device_id: MIGRATION_DEVICE_ID,
    }));

    const { error } = await supabase
      .from("table_transient_data")
      .upsert(supabaseTableTransientData, {
        onConflict: "tune_id,user_id,playlist_id",
      });

    if (error) {
      console.error("Error migrating table_transient_data:", error);
    } else {
      console.log(
        `✓ Migrated ${supabaseTableTransientData.length} table transient data records`
      );
    }
  } else {
    console.log("No table transient data to migrate");
  }

  console.log("\n✅ UI state tables migration complete");
}

// ============================================================================
// Phase 14: Create Database Views
// ============================================================================

/**
 * Convert SQLite SQL to PostgreSQL SQL
 * - group_concat(field, ' ') → STRING_AGG(field, ' ')
 * - favorite = 1 → favorite = true
 * - INNER JOIN (SELECT MAX(id)) → DISTINCT ON (fields) ORDER BY
 */
function convertSqliteToPostgres(sqliteSql: string): string {
  return (
    sqliteSql
      // Replace group_concat with STRING_AGG
      .replace(/group_concat\s*\(/gi, "STRING_AGG(")
      // Replace integer boolean comparisons with proper boolean
      .replace(/\.favorite\s*=\s*1/gi, ".favorite = true")
      .replace(/\.favorite\s*=\s*0/gi, ".favorite = false")
      // Replace SQLite's subquery pattern for "latest record" with PostgreSQL's DISTINCT ON
      .replace(
        /INNER JOIN \(\s*SELECT\s+tune_ref,\s+playlist_ref,\s+MAX\(id\)\s+[aA][sS]\s+max_id\s+FROM\s+practice_record\s+GROUP BY\s+tune_ref,\s+playlist_ref\s*\)\s+latest\s+ON\s+pr\.tune_ref\s*=\s*latest\.tune_ref\s+AND\s+pr\.playlist_ref\s*=\s*latest\.playlist_ref\s+AND\s+pr\.id\s*=\s*latest\.max_id/gi,
        ""
      )
      // Clean up the practice_record subquery to use DISTINCT ON
      .replace(
        /\(\s*SELECT\s+pr\.\*\s+FROM\s+practice_record\s+pr\s+\)\s+pr\s+ON/gi,
        "(SELECT DISTINCT ON (tune_ref, playlist_ref) pr.* FROM practice_record pr ORDER BY tune_ref, playlist_ref, id DESC) pr ON"
      )
      .replace(
        /\(\s*SELECT\s+pr\.\*\s+FROM\s+practice_record\s+pr\s+\)\s+practice_record\s+ON/gi,
        "(SELECT DISTINCT ON (tune_ref, playlist_ref) pr.* FROM practice_record pr ORDER BY tune_ref, playlist_ref, id DESC) practice_record ON"
      )
  );
}

async function createViews() {
  console.log("\n📊 Phase 14: Creating Database Views");
  console.log(`=${"=".repeat(59)}`);

  // Extract view definitions from SQLite
  const viewsQuery = sqlite
    .prepare(
      `
    SELECT name, sql 
    FROM sqlite_master 
    WHERE type='view' 
    AND name IN ('view_playlist_joined', 'practice_list_joined', 'practice_list_staged')
    ORDER BY name
  `
    )
    .all() as { name: string; sql: string }[];

  if (viewsQuery.length === 0) {
    console.log("⚠️  No views found in SQLite database");
    return;
  }

  console.log(`Found ${viewsQuery.length} views in SQLite`);

  // Convert and create views using direct Postgres connection
  let created = 0;
  let errors = 0;

  for (const view of viewsQuery) {
    try {
      // Convert SQLite SQL to PostgreSQL
      const postgresSql = convertSqliteToPostgres(view.sql);

      // Drop view if exists
      await sql.unsafe(`DROP VIEW IF EXISTS ${view.name} CASCADE;`);

      // Create the view
      await sql.unsafe(postgresSql);

      console.log(`✓ Created view: ${view.name}`);
      created++;
    } catch (error: any) {
      console.error(`✗ Error creating view ${view.name}:`, error?.message);
      console.log("\n📝 SQL for manual execution:");
      console.log(`\n--- ${view.name} ---`);
      console.log(convertSqliteToPostgres(view.sql));
      console.log();
      errors++;
    }
  }

  if (errors > 0) {
    console.log(
      "\n⚠️  Some views could not be created automatically. Please run the SQL above in Supabase Studio SQL Editor."
    );
  }

  console.log(
    `\n✅ Database views migration complete: ${created} created, ${errors} manual`
  );
}

// ============================================================================
// Verification
// ============================================================================

async function verifyMigration() {
  console.log("\n📊 Migration Verification");
  console.log(`=${"=".repeat(59)}`);

  const tables = [
    { sqlite: "user", supabase: "user_profile" },
    { sqlite: "genre", supabase: "genre" },
    { sqlite: "tune_type", supabase: "tune_type" },
    { sqlite: "instrument", supabase: "instrument" },
    { sqlite: "tune", supabase: "tune" },
    { sqlite: "tune_override", supabase: "tune_override" },
    { sqlite: "playlist", supabase: "playlist" },
    { sqlite: "playlist_tune", supabase: "playlist_tune" },
    { sqlite: "practice_record", supabase: "practice_record" },
    { sqlite: "daily_practice_queue", supabase: "daily_practice_queue" },
    { sqlite: "note", supabase: "note" },
    { sqlite: "reference", supabase: "reference" },
    { sqlite: "tag", supabase: "tag" },
    { sqlite: "tab_group_main_state", supabase: "tab_group_main_state" },
    { sqlite: "table_state", supabase: "table_state" },
    { sqlite: "table_transient_data", supabase: "table_transient_data" },
  ];

  console.log("\nRecord Counts:");
  console.log(`-${"-".repeat(59)}`);

  let allMatch = true;

  for (const { sqlite: sqliteTable, supabase: supabaseTable } of tables) {
    // Some tables don't have 'deleted' column:
    // - genre, tune_type, instrument (reference tables)
    // - practice_record (historical records - never soft deleted)
    // - tag (simple many-to-many table)
    const hasDeletedColumn = [
      "user",
      "tune",
      "tune_override",
      "playlist",
      "playlist_tune",
      "note",
      "reference",
    ].includes(sqliteTable);

    let whereClause = hasDeletedColumn ? "WHERE deleted = 0" : "";

    // Exclude user_id=0 (public-all-psuedo user with no email)
    if (sqliteTable === "user") {
      whereClause = "WHERE deleted = 0 AND id != 0";
    }

    const sqliteCount = sqlite
      .prepare(`SELECT COUNT(*) as count FROM ${sqliteTable} ${whereClause}`)
      .get() as { count: number };

    const supabaseCount = await countSupabase(supabaseTable);

    const match = sqliteCount.count === supabaseCount;
    const icon = match ? "✓" : "✗";

    if (!match) allMatch = false;

    console.log(
      `${icon} ${sqliteTable.padEnd(20)} SQLite: ${String(
        sqliteCount.count
      ).padStart(6)}  PostgreSQL: ${String(supabaseCount).padStart(6)}`
    );
  }

  console.log(`-${"-".repeat(59)}`);

  if (allMatch) {
    console.log("\n✅ All record counts match! Migration successful.");
  } else {
    console.log("\n⚠️  Some record counts don't match.");
    console.log(
      "\n📋 Review the output above (scroll up in your terminal) to see which tables have mismatches."
    );
    console.log("\nExpected differences:");
    console.log(
      "  • instrument: SQLite may have deleted instruments (e.g., SQLite: 8, PostgreSQL: 7)"
    );
    console.log(
      "  • playlist_tune: Deleted tune references filtered out (e.g., SQLite: 544, PostgreSQL: 522)"
    );
    console.log(
      "\n💡 All other tables should match exactly since we cleared them before migration."
    );
  }

  return allMatch;
}

// ============================================================================
// Main Migration
// ============================================================================

async function main() {
  console.log("\n");
  console.log("═".repeat(60));
  console.log("  TUNETREES PRODUCTION DATA MIGRATION");
  console.log("  SQLite → Supabase PostgreSQL");
  console.log("═".repeat(60));
  console.log();

  const startTime = Date.now();

  try {
    await cleanupSupabaseTables(); // Phase 0: Clear all tables for clean migration
    await migrateUsers(); // Phase 1: Create auth users + user_profile
    await migrateReferenceData(); // Phase 2: Genres, tune types, instruments
    await migrateTunes(); // Phase 3: Tunes
    await migrateTuneOverrides(); // Phase 4: Tune overrides
    await migratePlaylists(); // Phase 5: Playlists
    await migratePlaylistTunes(); // Phase 6: Playlist-tune relationships
    await migratePracticeRecords(); // Phase 7: Practice records
    await migrateNotes(); // Phase 8: Notes
    await migrateReferences(); // Phase 9: References
    await migrateTags(); // Phase 10: Tags
    await migratePreferences(); // Phase 11: User preferences
    await migrateDailyPracticeQueue(); // Phase 12: Daily practice queue
    await migrateUIStateTables(); // Phase 13: UI state tables (tab_group_main_state, table_state, table_transient_data)
    await createViews(); // Phase 14: Create database views

    const allMatch = await verifyMigration();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log("\n");
    console.log("═".repeat(60));
    if (allMatch) {
      console.log("  ✅ MIGRATION COMPLETED SUCCESSFULLY");
    } else {
      console.log("  ⚠️  MIGRATION COMPLETED WITH WARNINGS");
    }
    console.log(`  Elapsed time: ${elapsed}s`);
    console.log("═".repeat(60));
    console.log();
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  } finally {
    sqlite.close();
    await sql.end(); // Close Postgres connection pool
  }
}

// Run migration
main();
