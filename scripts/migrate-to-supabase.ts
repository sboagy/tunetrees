/**
 * Migration Script: SQLite → Supabase PostgreSQL
 *
 * Migrates data from production SQLite database to Supabase PostgreSQL.
 * Handles UUID conversion for user IDs (integer → UUID).
 *
 * Usage:
 *   npm run migrate:supabase -- --user-uuid=<your-uuid>
 *
 * @module scripts/migrate-to-supabase
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";
import dotenv from "dotenv";

// Load environment variables from .env.local
dotenv.config({ path: ".env.local" });

// ============================================================================
// Configuration
// ============================================================================

const SQLITE_DB_PATH = "./tunetrees_production_manual.sqlite3";

// Get Supabase credentials from env or command line
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // Need service role for admin operations

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Missing Supabase credentials!");
  console.error("Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

// Get target user UUID from command line
const args = process.argv.slice(2);
const userUuidArg = args.find((arg) => arg.startsWith("--user-uuid="));

if (!userUuidArg) {
  console.error("❌ Missing target user UUID!");
  console.error("Usage: npm run migrate:supabase -- --user-uuid=<your-uuid>");
  console.error(
    "\nGet your UUID by logging into the app and checking the home page.",
  );
  process.exit(1);
}

// split() may produce undefined at index 1 at the type level, assert after runtime check
const TARGET_USER_UUID = userUuidArg.split("=")[1] as string;

// Validate UUID format
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!UUID_REGEX.test(TARGET_USER_UUID)) {
  console.error("❌ Invalid UUID format!");
  console.error(`Got: ${TARGET_USER_UUID}`);
  console.error("Expected format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx");
  process.exit(1);
}

console.log("🔧 Configuration:");
console.log(`   SQLite DB: ${SQLITE_DB_PATH}`);
console.log(`   Supabase URL: ${SUPABASE_URL}`);
console.log(`   Target User UUID: ${TARGET_USER_UUID}`);
console.log();

// ============================================================================
// Initialize Connections
// ============================================================================

const sqlite = new Database(SQLITE_DB_PATH, { readonly: true });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map old integer user ID to new UUID
 */
function mapUserId(oldUserId: number | null): string | null {
  if (oldUserId === null) return null;
  // For now, all user_id=1 maps to TARGET_USER_UUID
  // Extend this mapping if you have multiple users
  if (oldUserId === 1) return TARGET_USER_UUID;
  console.warn(`⚠️  Unknown user ID: ${oldUserId} - mapping to target UUID`);
  return TARGET_USER_UUID;
}

/**
 * Get current timestamp in ISO format
 */
function now(): string {
  return new Date().toISOString();
}

/**
 * Count records in SQLite table
 */
function _countSQLite(tableName: string): number {
  const result = sqlite
    .prepare(`SELECT COUNT(*) as count FROM ${tableName}`)
    .get() as { count: number };
  return result.count;
}

/**
 * Count records in Supabase table
 */
async function countSupabase(tableName: string): Promise<number> {
  // Map SQLite table names to Supabase table names
  const tableNameMap: Record<string, string> = {
    user: "user_profile",
  };

  const supabaseTableName = tableNameMap[tableName] || tableName;

  const { count, error } = await supabase
    .from(supabaseTableName)
    .select("*", { count: "exact", head: true });

  if (error) {
    console.error(`❌ Error counting ${tableName}:`, error);
    return 0;
  }
  return count || 0;
}

/**
 * Clear all data from a Supabase table
 */
async function _clearTable(tableName: string) {
  const { error } = await supabase.from(tableName).delete().neq("id", "");
  if (error && !error.message.includes("violates foreign key constraint")) {
    console.error(`❌ Error clearing ${tableName}:`, error);
  }
}

// ============================================================================
// Migration Functions
// ============================================================================

/**
 * Migrate users table
 */
async function migrateUsers() {
  console.log("\n📊 Migrating users...");

  const users = sqlite
    .prepare("SELECT * FROM user WHERE deleted = 0 OR deleted IS NULL")
    .all() as any[];

  console.log(`   Found ${users.length} users in SQLite`);

  const supabaseUsers = users.map((user) => ({
    id: mapUserId(user.id)!,
    email: user.email,
    name: user.name,
    // Note: Only including core columns
    // external_source, external_id, deleted, sync_version, etc. may not exist in Supabase schema
  }));

  // Upsert to Supabase (table is named 'user_profile' in PostgreSQL to avoid reserved keyword)
  const { error } = await supabase
    .from("user_profile")
    .upsert(supabaseUsers, { onConflict: "id" });

  if (error) {
    console.error("❌ Error migrating users:", error);
    throw error;
  }

  console.log(`   ✅ Migrated ${supabaseUsers.length} users`);
}

/**
 * Migrate tunes table
 */
async function migrateTunes() {
  console.log("\n📊 Migrating tunes...");

  const tunes = sqlite
    .prepare("SELECT * FROM tune WHERE deleted = 0 OR deleted IS NULL")
    .all() as any[];

  console.log(`   Found ${tunes.length} tunes in SQLite`);

  const supabaseTunes = tunes.map((tune) => ({
    id: tune.id,
    type: tune.type,
    structure: tune.structure,
    title: tune.title,
    mode: tune.mode,
    incipit: tune.incipit,
    genre_ref: tune.genre_ref,
    deleted: false,
    private_for: tune.private_for
      ? mapUserId(parseInt(tune.private_for, 10))
      : null,
    sync_version: 0,
    last_modified_at: now(),
    device_id: "migration-script",
  }));

  // Insert in batches of 100
  const BATCH_SIZE = 100;
  for (let i = 0; i < supabaseTunes.length; i += BATCH_SIZE) {
    const batch = supabaseTunes.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("tune")
      .upsert(batch, { onConflict: "id" });

    if (error) {
      console.error(`❌ Error migrating tunes batch ${i}:`, error);
      throw error;
    }
    console.log(
      `   Migrated ${Math.min(i + BATCH_SIZE, supabaseTunes.length)}/${
        supabaseTunes.length
      } tunes...`,
    );
  }

  console.log(`   ✅ Migrated ${supabaseTunes.length} tunes`);
}

/**
 * Migrate playlists table
 */
async function migratePlaylists() {
  console.log("\n📊 Migrating playlists...");

  const playlists = sqlite
    .prepare("SELECT * FROM playlist WHERE deleted = 0 OR deleted IS NULL")
    .all() as any[];

  console.log(`   Found ${playlists.length} playlists in SQLite`);

  const supabasePlaylists = playlists.map((playlist) => ({
    playlist_id: playlist.playlist_id,
    user_ref: mapUserId(playlist.user_ref)!,
    instrument: playlist.instrument,
    genre: playlist.genre,
    annotation_set_ref: playlist.annotation_set_ref,
    recall_current_position: !!playlist.recall_current_position,
    current: playlist.current,
    deleted: false,
    sync_version: 0,
    last_modified_at: now(),
    device_id: "migration-script",
  }));

  const { error } = await supabase
    .from("playlist")
    .upsert(supabasePlaylists, { onConflict: "playlist_id" });

  if (error) {
    console.error("❌ Error migrating playlists:", error);
    throw error;
  }

  console.log(`   ✅ Migrated ${supabasePlaylists.length} playlists`);
}

/**
 * Migrate playlist_tune table
 */
async function migratePlaylistTunes() {
  console.log("\n📊 Migrating playlist_tune...");

  const playlistTunes = sqlite
    .prepare("SELECT * FROM playlist_tune WHERE deleted = 0 OR deleted IS NULL")
    .all() as any[];

  console.log(
    `   Found ${playlistTunes.length} playlist_tune records in SQLite`,
  );

  const supabasePlaylistTunes = playlistTunes.map((pt) => ({
    playlist_ref: pt.playlist_ref,
    tune_ref: pt.tune_ref,
    deleted: false,
    current: pt.current,
    sync_version: 0,
    last_modified_at: now(),
    device_id: "migration-script",
  }));

  // Insert in batches
  const BATCH_SIZE = 100;
  for (let i = 0; i < supabasePlaylistTunes.length; i += BATCH_SIZE) {
    const batch = supabasePlaylistTunes.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("playlist_tune")
      .upsert(batch, { onConflict: "playlist_ref,tune_ref" });

    if (error) {
      console.error(`❌ Error migrating playlist_tune batch ${i}:`, error);
      throw error;
    }
    console.log(
      `   Migrated ${Math.min(i + BATCH_SIZE, supabasePlaylistTunes.length)}/${
        supabasePlaylistTunes.length
      } records...`,
    );
  }

  console.log(
    `   ✅ Migrated ${supabasePlaylistTunes.length} playlist_tune records`,
  );
}

/**
 * Migrate practice_record table
 */
async function migratePracticeRecords() {
  console.log("\n📊 Migrating practice_record...");

  const practiceRecords = sqlite
    .prepare(
      "SELECT * FROM practice_record WHERE deleted = 0 OR deleted IS NULL",
    )
    .all() as any[];

  console.log(`   Found ${practiceRecords.length} practice records in SQLite`);

  const supabasePracticeRecords = practiceRecords.map((pr) => ({
    id: pr.id,
    user_ref: mapUserId(pr.user_ref)!,
    tune_ref: pr.tune_ref,
    playlist_ref: pr.playlist_ref,
    practiced_at: pr.practiced_at,
    quality: pr.quality,
    stability: pr.stability,
    difficulty: pr.difficulty,
    elapsed_days: pr.elapsed_days,
    scheduled_days: pr.scheduled_days,
    reps: pr.reps,
    lapses: pr.lapses,
    state: pr.state,
    last_review: pr.last_review,
    deleted: false,
    sync_version: 0,
    last_modified_at: now(),
    device_id: "migration-script",
  }));

  // Insert in batches
  const BATCH_SIZE = 100;
  for (let i = 0; i < supabasePracticeRecords.length; i += BATCH_SIZE) {
    const batch = supabasePracticeRecords.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("practice_record")
      .upsert(batch, { onConflict: "id" });

    if (error) {
      console.error(`❌ Error migrating practice_record batch ${i}:`, error);
      throw error;
    }
    console.log(
      `   Migrated ${Math.min(
        i + BATCH_SIZE,
        supabasePracticeRecords.length,
      )}/${supabasePracticeRecords.length} records...`,
    );
  }

  console.log(
    `   ✅ Migrated ${supabasePracticeRecords.length} practice records`,
  );
}

/**
 * Migrate notes table
 */
async function migrateNotes() {
  console.log("\n📊 Migrating notes...");

  const notes = sqlite
    .prepare("SELECT * FROM note WHERE deleted = 0 OR deleted IS NULL")
    .all() as any[];

  console.log(`   Found ${notes.length} notes in SQLite`);

  const supabaseNotes = notes.map((note) => ({
    id: note.id,
    tune_ref: note.tune_ref,
    user_ref: note.user_ref ? mapUserId(note.user_ref) : null,
    playlist_ref: note.playlist_ref,
    created_date: note.created_date,
    note_text: note.note_text,
    public: !!note.public,
    favorite: !!note.favorite,
    deleted: false,
    sync_version: 0,
    last_modified_at: now(),
    device_id: "migration-script",
  }));

  const { error } = await supabase
    .from("note")
    .upsert(supabaseNotes, { onConflict: "id" });

  if (error) {
    console.error("❌ Error migrating notes:", error);
    throw error;
  }

  console.log(`   ✅ Migrated ${supabaseNotes.length} notes`);
}

/**
 * Migrate references table
 */
async function migrateReferences() {
  console.log("\n📊 Migrating references...");

  const references = sqlite
    .prepare("SELECT * FROM reference WHERE deleted = 0 OR deleted IS NULL")
    .all() as any[];

  console.log(`   Found ${references.length} references in SQLite`);

  const supabaseReferences = references.map((ref) => ({
    id: ref.id,
    tune_ref: ref.tune_ref,
    reference_text: ref.reference_text,
    url: ref.url,
    deleted: false,
    sync_version: 0,
    last_modified_at: now(),
    device_id: "migration-script",
  }));

  const { error } = await supabase
    .from("reference")
    .upsert(supabaseReferences, { onConflict: "id" });

  if (error) {
    console.error("❌ Error migrating references:", error);
    throw error;
  }

  console.log(`   ✅ Migrated ${supabaseReferences.length} references`);
}

/**
 * Migrate tags table
 */
async function migrateTags() {
  console.log("\n📊 Migrating tags...");

  const tags = sqlite
    .prepare("SELECT * FROM tag WHERE deleted = 0 OR deleted IS NULL")
    .all() as any[];

  console.log(`   Found ${tags.length} tags in SQLite`);

  const supabaseTags = tags.map((tag) => ({
    id: tag.id,
    tune_ref: tag.tune_ref,
    user_ref: tag.user_ref ? mapUserId(tag.user_ref) : null,
    tag: tag.tag,
    deleted: false,
    sync_version: 0,
    last_modified_at: now(),
    device_id: "migration-script",
  }));

  const { error } = await supabase
    .from("tag")
    .upsert(supabaseTags, { onConflict: "id" });

  if (error) {
    console.error("❌ Error migrating tags:", error);
    throw error;
  }

  console.log(`   ✅ Migrated ${supabaseTags.length} tags`);
}

/**
 * Migrate reference data tables (genre, instrument, tune_type)
 */
async function migrateReferenceData() {
  console.log("\n📊 Migrating reference data...");

  // Genres
  const genres = sqlite.prepare("SELECT * FROM genre").all() as any[];
  if (genres.length > 0) {
    const supabaseGenres = genres.map((g) => ({
      id: g.id,
      deleted: false,
      sync_version: 0,
      last_modified_at: now(),
      device_id: "migration-script",
    }));
    await supabase.from("genre").upsert(supabaseGenres, { onConflict: "id" });
    console.log(`   ✅ Migrated ${genres.length} genres`);
  }

  // Instruments
  const instruments = sqlite.prepare("SELECT * FROM instrument").all() as any[];
  if (instruments.length > 0) {
    const supabaseInstruments = instruments.map((i) => ({
      id: i.id,
      default_note_height: i.default_note_height,
      default_clef: i.default_clef,
      deleted: false,
      sync_version: 0,
      last_modified_at: now(),
      device_id: "migration-script",
    }));
    await supabase
      .from("instrument")
      .upsert(supabaseInstruments, { onConflict: "id" });
    console.log(`   ✅ Migrated ${instruments.length} instruments`);
  }

  // Tune Types
  const tuneTypes = sqlite.prepare("SELECT * FROM tune_type").all() as any[];
  if (tuneTypes.length > 0) {
    const supabaseTuneTypes = tuneTypes.map((tt) => ({
      id: tt.id,
      deleted: false,
      sync_version: 0,
      last_modified_at: now(),
      device_id: "migration-script",
    }));
    await supabase
      .from("tune_type")
      .upsert(supabaseTuneTypes, { onConflict: "id" });
    console.log(`   ✅ Migrated ${tuneTypes.length} tune types`);
  }
}

// ============================================================================
// Main Migration Function
// ============================================================================

async function main() {
  console.log("🚀 Starting migration from SQLite to Supabase...\n");

  try {
    // Migrate in dependency order
    await migrateReferenceData(); // No dependencies
    await migrateUsers(); // No dependencies
    await migrateTunes(); // Depends on users (for private_for), genres
    await migratePlaylists(); // Depends on users
    await migratePlaylistTunes(); // Depends on playlists, tunes
    await migratePracticeRecords(); // Depends on users, tunes, playlists
    await migrateNotes(); // Depends on users, tunes, playlists
    await migrateReferences(); // Depends on tunes
    await migrateTags(); // Depends on users, tunes

    console.log(`\n${"=".repeat(60)}`);
    console.log("✅ Migration completed successfully!");
    console.log("=".repeat(60));

    // Verify counts
    console.log("\n📊 Record counts:");
    console.log(`   Users: ${await countSupabase("user")}`);
    console.log(`   Tunes: ${await countSupabase("tune")}`);
    console.log(`   Playlists: ${await countSupabase("playlist")}`);
    console.log(`   Playlist-Tune: ${await countSupabase("playlist_tune")}`);
    console.log(
      `   Practice Records: ${await countSupabase("practice_record")}`,
    );
    console.log(`   Notes: ${await countSupabase("note")}`);
    console.log(`   References: ${await countSupabase("reference")}`);
    console.log(`   Tags: ${await countSupabase("tag")}`);
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  } finally {
    sqlite.close();
  }
}

// Run migration
main();
