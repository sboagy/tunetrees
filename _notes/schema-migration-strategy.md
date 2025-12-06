# TuneTrees Schema & Data Migration Strategy

**Date:** October 4, 2025  
**Phase:** Phase 0 - Schema Definition  
**Source Database:** `tunetrees_production_manual.sqlite3`  
**Target Architecture:** Supabase PostgreSQL + SQLite WASM

---

## Table of Contents

1. [Critical Architecture Decision: Hybrid User Model](#critical-architecture-decision-hybrid-user-model)
2. [Forward Path: 6-Phase Migration](#forward-path-6-phase-migration)
3. [Schema Changes from Current](#schema-changes-from-current)
4. [Testing Strategy](#testing-strategy)
5. [Data Migration Timeline](#data-migration-timeline)
6. [Next Immediate Steps](#next-immediate-steps)

---

## Critical Architecture Decision: Hybrid User Model

Your schema will be split across Supabase and local storage:

### Supabase PostgreSQL (Cloud)

**User Profile Table** (extends Supabase auth.users):

```typescript
// drizzle/schema-postgres.ts
export const userProfile = pgTable("user_profile", {
  id: serial("id").primaryKey(), // Local user ID (kept for compatibility)
  supabaseUserId: uuid("supabase_user_id")
    .notNull()
    .unique()
    .references(() => auth.users.id), // FK to auth.users(id) - source of truth
  name: text("name"),
  email: text("email"), // Denormalized from auth.users for queries
  srAlgType: text("sr_alg_type"),
  acceptableDelinquencyWindow: integer("acceptable_delinquency_window").default(
    21
  ),
  phone: text("phone"),
  phoneVerified: timestamp("phone_verified"),
  deleted: boolean("deleted").default(false),

  // Sync columns
  syncVersion: integer("sync_version").default(1),
  lastModifiedAt: timestamp("last_modified_at").defaultNow(),
});
```

**Drop These Tables** (NextAuth-specific, replaced by Supabase Auth):

- ❌ `account`
- ❌ `session`
- ❌ `verification_token`

### SQLite WASM (Local Offline Cache)

- **Identical schema** to Supabase (Drizzle enables this)
- Stores synced subset of user's data
- Primary keys stay as `INTEGER` for SQLite compatibility
- Add `sync_version` and `last_modified_at` columns for conflict resolution

**Schema Differences (SQLite vs PostgreSQL):**

```typescript
// drizzle/schema-sqlite.ts
export const userProfile = sqliteTable("user_profile", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  supabaseUserId: text("supabase_user_id").notNull().unique(), // TEXT not UUID
  name: text("name"),
  email: text("email"),
  // ... rest identical to PostgreSQL schema
});
```

---

## Forward Path: 6-Phase Migration

### Phase 0: Schema Definition (Current Step)

**What You'll Create:**

```
drizzle/
├── schema-postgres.ts    # Supabase PostgreSQL schema
├── schema-sqlite.ts      # SQLite WASM schema (mostly identical)
├── sync-columns.ts       # Shared sync tracking columns
└── relations.ts          # Drizzle relations for type-safe joins

drizzle.config.ts         # Drizzle config for both databases
```

**Key Schema Changes from Current:**

1. **user → user_profile table:**

   - Add `supabase_user_id` UUID field (foreign key to auth.users)
   - Keep original `id` INTEGER for compatibility with existing foreign keys
   - Remove NextAuth-specific fields (hash, email_verified handled by Supabase)
   - Add sync tracking columns

2. **User-modifiable tables (add sync columns):**

   - Add `sync_version` INTEGER (for optimistic locking)
   - Add `last_modified_at` TIMESTAMP (for conflict resolution)
   - Add `device_id` TEXT (for multi-device debugging and analytics)
   - Keep all existing columns and foreign keys
   - Applies to: playlist, playlist*tune, practice_record, daily_practice_queue, note, reference, tag, tune_override, tune, instrument, prefs*\*, table_state, tab_group_main_state, table_transient_data

   **Reference-only tables (no sync columns needed):**

   - genre, tune_type, genre_tune_type (system data, managed separately)

3. **Foreign Keys:**

   - All `user_ref` columns stay as INTEGER (reference user_profile.id, not Supabase UUID)
   - This preserves compatibility with existing data structure

4. **Views:**
   - Port to PostgreSQL syntax (mostly compatible)
   - Use Drizzle's view builder for type safety
   - Keep SQLite versions for local queries

**Deliverables:**

- ✅ `drizzle/schema-postgres.ts` - Complete PostgreSQL schema
- ✅ `drizzle/schema-sqlite.ts` - Complete SQLite WASM schema
- ✅ `drizzle.config.ts` - Dual database configuration
- ✅ Migration scripts for Supabase: `drizzle-kit generate:pg`

---

### Phase 1: Supabase Schema Setup

**Tools:**

- Drizzle Kit: `drizzle-kit push:pg` (push schema to Supabase)
- Supabase Migration SQL (via dashboard or CLI)
- DBeaver (for schema verification)

**Steps:**

1. **Run Drizzle migrations against Supabase PostgreSQL:**

   ```bash
   # Generate migration files
   drizzle-kit generate:pg

   # Push to Supabase
   drizzle-kit push:pg
   ```

2. **Enable Row Level Security (RLS) policies:**

   ```sql
   -- User Profile policies
   ALTER TABLE user_profile ENABLE ROW LEVEL SECURITY;

   CREATE POLICY "Users can view own profile"
   ON user_profile FOR SELECT
   USING (auth.uid() = supabase_user_id);

   CREATE POLICY "Users can update own profile"
   ON user_profile FOR UPDATE
   USING (auth.uid() = supabase_user_id);

   -- Playlist policies
   ALTER TABLE playlist ENABLE ROW LEVEL SECURITY;

   CREATE POLICY "Users can view own playlists"
   ON playlist FOR SELECT
   USING (user_ref IN (
     SELECT id FROM user_profile WHERE supabase_user_id = auth.uid()
   ));

   -- Similar policies for all user-owned data
   ```

3. **Create indexes (match current SQLite indexes):**

   ```sql
   -- Practice record indexes
   CREATE INDEX idx_practice_record_id ON practice_record (id DESC);
   CREATE INDEX idx_practice_record_tune_playlist_practiced
     ON practice_record (tune_ref, playlist_ref, practiced DESC);
   CREATE INDEX idx_practice_record_practiced
     ON practice_record (practiced DESC);

   -- Queue indexes
   CREATE INDEX idx_queue_user_playlist_window
     ON daily_practice_queue (user_ref, playlist_ref, window_start_utc);
   CREATE INDEX idx_queue_user_playlist_active
     ON daily_practice_queue (user_ref, playlist_ref, active);
   CREATE INDEX idx_queue_user_playlist_bucket
     ON daily_practice_queue (user_ref, playlist_ref, bucket);
   CREATE INDEX idx_queue_generated_at
     ON daily_practice_queue (generated_at);

   -- Note indexes
   CREATE INDEX idx_note_tune_playlist
     ON note (tune_ref, playlist_ref);
   CREATE INDEX idx_note_tune_playlist_user_public
     ON note (tune_ref, playlist_ref, user_ref, public);
   CREATE INDEX idx_note_tune_user
     ON note (tune_ref, user_ref);

   -- Reference indexes
   CREATE INDEX idx_reference_tune_public
     ON reference (tune_ref, public);
   CREATE INDEX idx_reference_tune_user_ref
     ON reference (tune_ref, user_ref);
   CREATE INDEX idx_reference_user_tune_public
     ON reference (user_ref, tune_ref, public);

   -- Tag indexes
   CREATE INDEX idx_tag_user_ref_tag_text
     ON tag (user_ref, tag_text);
   CREATE INDEX idx_tag_user_ref_tune_ref
     ON tag (user_ref, tune_ref);

   -- Instrument indexes
   CREATE INDEX idx_instrument_instrument
     ON instrument (instrument);
   CREATE INDEX idx_instrument_private_to_user
     ON instrument (private_to_user);
   ```

4. **Create PostgreSQL versions of views:**

   ```sql
   -- practice_list_joined view (PostgreSQL syntax)
   CREATE VIEW practice_list_joined AS
   SELECT
     tune.id AS id,
     COALESCE(tune_override.title, tune.title) AS title,
     COALESCE(tune_override.type, tune.type) AS type,
     -- ... (same logic as SQLite, mostly compatible)
   FROM tune
   LEFT JOIN playlist_tune ON playlist_tune.tune_ref = tune.id
   -- ... (rest of joins)
   WHERE (tune_override.user_ref IS NULL OR tune_override.user_ref = playlist.user_ref);

   -- practice_list_staged view
   -- view_playlist_joined view
   ```

5. **Verify schema with DBeaver:**
   - Connect to Supabase PostgreSQL
   - Verify all tables created
   - Check foreign key constraints
   - Validate indexes exist

**Deliverables:**

- ✅ Supabase database with full schema
- ✅ RLS policies protecting user data
- ✅ Indexes for performance
- ✅ Views for complex queries

---

### Phase 2: Data Migration (SQLite → Supabase)

**Migration Script Strategy:**

```typescript
// scripts/migrate-sqlite-to-supabase.ts
import Database from "better-sqlite3";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import * as schema from "../drizzle/schema-postgres";

async function migrateSQLiteToSupabase() {
  // Connect to both databases
  const sqliteDb = new Database("tunetrees_production_manual.sqlite3");
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role for admin operations
  );

  const pgConnection = postgres(process.env.DATABASE_URL!);
  const pgDb = drizzlePg(pgConnection, { schema });

  console.log("Starting migration...");

  // Step 1: Migrate users (create Supabase auth users first)
  console.log("Migrating users...");
  const users = sqliteDb.prepare("SELECT * FROM user WHERE deleted = 0").all();

  const userIdMapping = new Map<number, string>(); // SQLite ID → Supabase UUID

  for (const user of users) {
    try {
      // Create Supabase auth user
      const { data: authUser, error } = await supabase.auth.admin.createUser({
        email: user.email,
        email_confirm: true,
        password: Math.random().toString(36), // Random initial password
        user_metadata: {
          name: user.name,
          migrated_from_sqlite: true,
          original_id: user.id,
        },
      });

      if (error) throw error;

      // Insert user_profile with mapping
      await pgDb.insert(schema.userProfile).values({
        id: user.id, // Preserve original ID for foreign key compatibility
        supabaseUserId: authUser.user!.id,
        name: user.name,
        email: user.email,
        srAlgType: user.sr_alg_type,
        acceptableDelinquencyWindow: user.acceptable_delinquency_window,
        phone: user.phone,
        phoneVerified: user.phone_verified
          ? new Date(user.phone_verified)
          : null,
        deleted: Boolean(user.deleted),
      });

      userIdMapping.set(user.id, authUser.user!.id);
      console.log(`✓ Migrated user: ${user.email}`);
    } catch (error) {
      console.error(`✗ Failed to migrate user ${user.email}:`, error);
    }
  }

  // Step 2: Migrate reference data (genres, tune types, instruments)
  console.log("Migrating genres...");
  const genres = sqliteDb.prepare("SELECT * FROM genre").all();
  await pgDb.insert(schema.genre).values(genres);

  console.log("Migrating tune types...");
  const tuneTypes = sqliteDb.prepare("SELECT * FROM tune_type").all();
  await pgDb.insert(schema.tuneType).values(tuneTypes);

  console.log("Migrating genre-tune type relationships...");
  const genreTuneTypes = sqliteDb
    .prepare("SELECT * FROM genre_tune_type")
    .all();
  await pgDb.insert(schema.genreTuneType).values(genreTuneTypes);

  console.log("Migrating instruments...");
  const instruments = sqliteDb
    .prepare("SELECT * FROM instrument WHERE deleted = 0")
    .all();
  await pgDb.insert(schema.instrument).values(
    instruments.map((i) => ({
      ...i,
      deleted: Boolean(i.deleted),
    }))
  );

  // Step 3: Migrate tunes (batch inserts for performance)
  console.log("Migrating tunes...");
  const tunes = sqliteDb.prepare("SELECT * FROM tune WHERE deleted = 0").all();

  // Batch insert 100 at a time
  for (let i = 0; i < tunes.length; i += 100) {
    const batch = tunes.slice(i, i + 100);
    await pgDb.insert(schema.tune).values(
      batch.map((t) => ({
        ...t,
        deleted: Boolean(t.deleted),
      }))
    );
    console.log(
      `  Progress: ${Math.min(i + 100, tunes.length)}/${tunes.length}`
    );
  }

  console.log("Migrating tune overrides...");
  const tuneOverrides = sqliteDb
    .prepare("SELECT * FROM tune_override WHERE deleted = 0")
    .all();
  await pgDb.insert(schema.tuneOverride).values(
    tuneOverrides.map((t) => ({
      ...t,
      deleted: Boolean(t.deleted),
    }))
  );

  // Step 4: Migrate playlists
  console.log("Migrating playlists...");
  const playlists = sqliteDb
    .prepare("SELECT * FROM playlist WHERE deleted = 0")
    .all();
  await pgDb.insert(schema.playlist).values(
    playlists.map((p) => ({
      ...p,
      deleted: Boolean(p.deleted),
    }))
  );

  // Step 5: Migrate playlist-tune relationships
  console.log("Migrating playlist-tune relationships...");
  const playlistTunes = sqliteDb
    .prepare("SELECT * FROM playlist_tune WHERE deleted = 0")
    .all();

  for (let i = 0; i < playlistTunes.length; i += 100) {
    const batch = playlistTunes.slice(i, i + 100);
    await pgDb.insert(schema.playlistTune).values(
      batch.map((pt) => ({
        ...pt,
        current: pt.current ? new Date(pt.current) : null,
        learned: pt.learned ? new Date(pt.learned) : null,
        scheduled: pt.scheduled ? new Date(pt.scheduled) : null,
        deleted: Boolean(pt.deleted),
      }))
    );
    console.log(
      `  Progress: ${Math.min(i + 100, playlistTunes.length)}/${
        playlistTunes.length
      }`
    );
  }

  // Step 6: Migrate practice records (largest table, careful batching)
  console.log("Migrating practice records...");
  const practiceRecords = sqliteDb
    .prepare("SELECT * FROM practice_record")
    .all();

  for (let i = 0; i < practiceRecords.length; i += 100) {
    const batch = practiceRecords.slice(i, i + 100);
    await pgDb.insert(schema.practiceRecord).values(
      batch.map((pr) => ({
        ...pr,
        practiced: pr.practiced ? new Date(pr.practiced) : null,
        due: pr.due ? new Date(pr.due) : null,
        backupPracticed: pr.backup_practiced
          ? new Date(pr.backup_practiced)
          : null,
      }))
    );
    console.log(
      `  Progress: ${Math.min(i + 100, practiceRecords.length)}/${
        practiceRecords.length
      }`
    );
  }

  // Step 7: Migrate daily practice queue
  console.log("Migrating daily practice queue...");
  const queueItems = sqliteDb
    .prepare("SELECT * FROM daily_practice_queue WHERE active = 1")
    .all();

  for (let i = 0; i < queueItems.length; i += 100) {
    const batch = queueItems.slice(i, i + 100);
    await pgDb.insert(schema.dailyPracticeQueue).values(
      batch.map((q) => ({
        ...q,
        queueDate: q.queue_date ? new Date(q.queue_date) : null,
        windowStartUtc: new Date(q.window_start_utc),
        windowEndUtc: new Date(q.window_end_utc),
        snapshotCoalescedTs: new Date(q.snapshot_coalesced_ts),
        generatedAt: new Date(q.generated_at),
        completedAt: q.completed_at ? new Date(q.completed_at) : null,
        active: Boolean(q.active),
      }))
    );
    console.log(
      `  Progress: ${Math.min(i + 100, queueItems.length)}/${queueItems.length}`
    );
  }

  // Step 8: Migrate notes, references, tags
  console.log("Migrating notes...");
  const notes = sqliteDb.prepare("SELECT * FROM note WHERE deleted = 0").all();
  await pgDb.insert(schema.note).values(
    notes.map((n) => ({
      ...n,
      createdDate: n.created_date ? new Date(n.created_date) : null,
      public: Boolean(n.public),
      favorite: Boolean(n.favorite),
      deleted: Boolean(n.deleted),
    }))
  );

  console.log("Migrating references...");
  const references = sqliteDb
    .prepare("SELECT * FROM reference WHERE deleted = 0")
    .all();
  await pgDb.insert(schema.reference).values(
    references.map((r) => ({
      ...r,
      public: Boolean(r.public),
      favorite: Boolean(r.favorite),
      deleted: Boolean(r.deleted),
    }))
  );

  console.log("Migrating tags...");
  const tags = sqliteDb.prepare("SELECT * FROM tag").all();
  await pgDb.insert(schema.tag).values(tags);

  // Step 9: Migrate preferences
  console.log("Migrating spaced repetition preferences...");
  const srPrefs = sqliteDb
    .prepare("SELECT * FROM prefs_spaced_repetition")
    .all();
  await pgDb.insert(schema.prefsSpacedRepetition).values(
    srPrefs.map((p) => ({
      ...p,
      enableFuzzing: Boolean(p.enable_fuzzing),
    }))
  );

  console.log("Migrating scheduling preferences...");
  const schedPrefs = sqliteDb
    .prepare("SELECT * FROM prefs_scheduling_options")
    .all();
  if (schedPrefs.length > 0) {
    await pgDb.insert(schema.prefsSchedulingOptions).values(schedPrefs);
  }

  // Step 10: Verify counts
  console.log("\n=== Migration Summary ===");

  const tables = [
    "user_profile",
    "genre",
    "tune_type",
    "instrument",
    "tune",
    "playlist",
    "playlist_tune",
    "practice_record",
    "note",
    "reference",
    "tag",
  ];

  for (const table of tables) {
    const sqliteCount =
      sqliteDb
        .prepare(
          `SELECT COUNT(*) as count FROM ${
            table === "user_profile" ? "user" : table
          } WHERE deleted = 0`
        )
        .get()?.count || 0;

    const pgCount = await pgDb
      .select({ count: sql`COUNT(*)` })
      .from(schema[table])
      .where(eq(schema[table].deleted, false));

    const match = sqliteCount === pgCount[0]?.count ? "✓" : "✗";
    console.log(
      `${match} ${table}: SQLite=${sqliteCount}, Supabase=${pgCount[0]?.count}`
    );
  }

  console.log("\nMigration complete!");

  await pgConnection.end();
  sqliteDb.close();
}

// Run migration
migrateSQLiteToSupabase().catch(console.error);
```

**Data Integrity Checks:**

```typescript
// scripts/verify-migration.ts
async function verifyMigration() {
  // 1. Row counts match
  // 2. Foreign key relationships preserved
  // 3. Sample queries return same results
  // 4. No orphaned records

  const checks = [
    {
      name: "User count",
      sqlite: "SELECT COUNT(*) FROM user WHERE deleted = 0",
      postgres: "SELECT COUNT(*) FROM user_profile WHERE deleted = false",
    },
    {
      name: "Practice records per user",
      sqlite: `
        SELECT user_ref, COUNT(*) as count 
        FROM practice_record pr
        JOIN playlist p ON pr.playlist_ref = p.playlist_id
        GROUP BY user_ref
      `,
      postgres: `
        SELECT user_ref, COUNT(*) as count 
        FROM practice_record pr
        JOIN playlist p ON pr.playlist_ref = p.playlist_id
        GROUP BY user_ref
      `,
    },
    // ... more checks
  ];

  for (const check of checks) {
    // Run both queries and compare results
  }
}
```

**Deliverables:**

- ✅ Migration script (`scripts/migrate-sqlite-to-supabase.ts`)
- ✅ Verification script (`scripts/verify-migration.ts`)
- ✅ All production data in Supabase
- ✅ Data integrity verified

---

### Phase 3: SQLite WASM Schema Setup

**Initial Sync Implementation:**

```typescript
// src/lib/db/init-sqlite-wasm.ts
import initSqlJs from "sql.js";
import { drizzle } from "drizzle-orm/sql-js";
import * as schema from "../../drizzle/schema-sqlite";

export async function initLocalDatabase(userId: string) {
  // Load sql.js WASM
  const SQL = await initSqlJs({
    locateFile: (file) => `/sql-wasm/${file}`, // Served from public/
  });

  // Check if database exists in IndexedDB
  const existingDb = await loadFromIndexedDB("tunetrees-db");

  let db: SQL.Database;

  if (existingDb) {
    // Load existing database
    db = new SQL.Database(existingDb);
    console.log("Loaded existing local database");
  } else {
    // Create new database
    db = new SQL.Database();

    // Run Drizzle schema (same structure as PostgreSQL)
    const drizzleDb = drizzle(db, { schema });

    // Apply schema
    db.run(DRIZZLE_SQLITE_SCHEMA); // Generated by drizzle-kit

    console.log("Created new local database");
  }

  // Initial sync: Download user's data from Supabase
  await syncFromSupabase(db, userId);

  // Persist to IndexedDB
  await saveToIndexedDB("tunetrees-db", db.export());

  return drizzle(db, { schema });
}

async function syncFromSupabase(db: SQL.Database, userId: string) {
  console.log("Syncing data from Supabase...");

  // Fetch user's complete dataset
  const userData = await fetchUserDataFromSupabase(userId);

  // Bulk insert into local SQLite
  const drizzleDb = drizzle(db, { schema });

  // Insert in dependency order
  await drizzleDb.insert(schema.userProfile).values(userData.userProfile);
  await drizzleDb.insert(schema.instrument).values(userData.instruments);
  await drizzleDb.insert(schema.playlist).values(userData.playlists);
  await drizzleDb.insert(schema.tune).values(userData.tunes);
  await drizzleDb.insert(schema.playlistTune).values(userData.playlistTunes);
  await drizzleDb
    .insert(schema.practiceRecord)
    .values(userData.practiceRecords);
  // ... other tables

  console.log("Initial sync complete");
}

// IndexedDB persistence
async function saveToIndexedDB(dbName: string, data: Uint8Array) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("tunetrees-storage", 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("databases")) {
        db.createObjectStore("databases");
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("databases", "readwrite");
      const store = tx.objectStore("databases");
      store.put(data, dbName);
      tx.oncomplete = () => resolve(null);
      tx.onerror = () => reject(tx.error);
    };

    request.onerror = () => reject(request.error);
  });
}

async function loadFromIndexedDB(dbName: string): Promise<Uint8Array | null> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("tunetrees-storage", 1);

    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("databases")) {
        resolve(null);
        return;
      }

      const tx = db.transaction("databases", "readonly");
      const store = tx.objectStore("databases");
      const getRequest = store.get(dbName);

      getRequest.onsuccess = () => resolve(getRequest.result || null);
      getRequest.onerror = () => reject(getRequest.error);
    };

    request.onerror = () => reject(request.error);
  });
}
```

**Deliverables:**

- ✅ SQLite WASM initialization code
- ✅ IndexedDB persistence layer
- ✅ Initial sync from Supabase
- ✅ Local database ready for offline use

---

### Phase 4: Sync Layer Implementation

**Two-Way Sync Strategy:**

```typescript
// src/lib/sync/sync-engine.ts
import { createClient } from "@supabase/supabase-js";
import { drizzle } from "drizzle-orm/sql-js";
import { eq, gt } from "drizzle-orm";
import * as schema from "../../drizzle/schema-sqlite";

const SYNC_INTERVAL = 30000; // 30 seconds
const DEVICE_ID = crypto.randomUUID(); // Generated once per device

export class SyncEngine {
  private supabase = createClient(/* ... */);
  private localDb: ReturnType<typeof drizzle>;
  private syncQueue: SyncOperation[] = [];
  private isOnline = navigator.onLine;

  constructor(localDb: ReturnType<typeof drizzle>) {
    this.localDb = localDb;
    this.setupEventListeners();
    this.startSyncLoop();
  }

  private setupEventListeners() {
    // Listen for online/offline events
    window.addEventListener("online", () => {
      this.isOnline = true;
      this.syncNow();
    });

    window.addEventListener("offline", () => {
      this.isOnline = false;
    });

    // Subscribe to Supabase realtime changes
    this.subscribeToRealtimeChanges();
  }

  private subscribeToRealtimeChanges() {
    // Practice records
    this.supabase
      .channel("practice-records")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "practice_record" },
        (payload) => this.handleRemoteChange("practice_record", payload)
      )
      .subscribe();

    // Playlist tunes
    this.supabase
      .channel("playlist-tunes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "playlist_tune" },
        (payload) => this.handleRemoteChange("playlist_tune", payload)
      )
      .subscribe();

    // Notes, references, tags
    // ... subscribe to other tables
  }

  private async handleRemoteChange(table: string, payload: any) {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    // Get local version
    const localRecord = await this.localDb
      .select()
      .from(schema[table])
      .where(eq(schema[table].id, newRecord.id))
      .get();

    if (!localRecord) {
      // Insert new record
      await this.localDb.insert(schema[table]).values(newRecord);
      console.log(`Synced new ${table} from server`);
      return;
    }

    // Check for conflicts
    if (localRecord.sync_version >= newRecord.sync_version) {
      // Local is newer or same, skip
      console.log(`Local ${table} is newer, skipping sync`);
      return;
    }

    // Check if local has uncommitted changes
    const hasPendingChanges = this.syncQueue.some(
      (op) => op.table === table && op.recordId === newRecord.id
    );

    if (hasPendingChanges) {
      // Conflict! Show UI to user
      await this.handleConflict(table, localRecord, newRecord);
    } else {
      // Safe to update
      await this.localDb
        .update(schema[table])
        .set(newRecord)
        .where(eq(schema[table].id, newRecord.id));

      console.log(`Updated ${table} from server`);
    }
  }

  private async handleConflict(
    table: string,
    localRecord: any,
    remoteRecord: any
  ) {
    // Show conflict resolution UI
    const resolution = await showConflictDialog({
      table,
      localRecord,
      remoteRecord,
      options: ["keep_local", "keep_remote", "merge"],
    });

    switch (resolution.choice) {
      case "keep_local":
        // Force push local version
        await this.pushToSupabase(table, localRecord, true);
        break;

      case "keep_remote":
        // Accept remote version
        await this.localDb
          .update(schema[table])
          .set(remoteRecord)
          .where(eq(schema[table].id, remoteRecord.id));
        break;

      case "merge":
        // User manually merged fields
        await this.localDb
          .update(schema[table])
          .set(resolution.mergedRecord)
          .where(eq(schema[table].id, remoteRecord.id));
        await this.pushToSupabase(table, resolution.mergedRecord, true);
        break;
    }
  }

  // Queue local changes for sync
  public queueChange(
    table: string,
    recordId: number,
    operation: "insert" | "update" | "delete"
  ) {
    this.syncQueue.push({
      table,
      recordId,
      operation,
      timestamp: Date.now(),
      retries: 0,
    });

    // Persist queue to IndexedDB
    this.persistSyncQueue();

    // Try immediate sync if online
    if (this.isOnline) {
      this.syncNow();
    }
  }

  private async syncNow() {
    if (!this.isOnline || this.syncQueue.length === 0) return;

    console.log(`Syncing ${this.syncQueue.length} pending changes...`);

    const failed: SyncOperation[] = [];

    for (const operation of this.syncQueue) {
      try {
        await this.pushToSupabase(operation.table, operation);
        console.log(`✓ Synced ${operation.table} #${operation.recordId}`);
      } catch (error) {
        console.error(
          `✗ Failed to sync ${operation.table} #${operation.recordId}:`,
          error
        );
        operation.retries++;

        if (operation.retries < 3) {
          failed.push(operation);
        } else {
          // Max retries, show error to user
          this.showSyncError(operation, error);
        }
      }
    }

    // Update queue with failed operations
    this.syncQueue = failed;
    this.persistSyncQueue();
  }

  private async pushToSupabase(
    table: string,
    operation: SyncOperation,
    force = false
  ) {
    // Get full record from local DB
    const record = await this.localDb
      .select()
      .from(schema[table])
      .where(eq(schema[table].id, operation.recordId))
      .get();

    if (!record) {
      throw new Error(`Record not found: ${table}#${operation.recordId}`);
    }

    // Increment sync version
    const updatedRecord = {
      ...record,
      sync_version: record.sync_version + 1,
      last_modified_at: new Date().toISOString(),
      device_id: DEVICE_ID,
    };

    // Upsert to Supabase
    const { error } = await this.supabase.from(table).upsert(updatedRecord, {
      onConflict: force ? undefined : "id", // Force ignores conflicts
    });

    if (error) throw error;

    // Update local record with new sync version
    await this.localDb
      .update(schema[table])
      .set({
        sync_version: updatedRecord.sync_version,
        last_modified_at: updatedRecord.last_modified_at,
      })
      .where(eq(schema[table].id, operation.recordId));
  }

  private startSyncLoop() {
    setInterval(() => {
      if (this.isOnline) {
        this.syncNow();
      }
    }, SYNC_INTERVAL);
  }

  private async persistSyncQueue() {
    // Save to IndexedDB for persistence across page reloads
    await saveToIndexedDB("sync-queue", JSON.stringify(this.syncQueue));
  }
}

interface SyncOperation {
  table: string;
  recordId: number;
  operation: "insert" | "update" | "delete";
  timestamp: number;
  retries: number;
}
```

**Conflict Resolution UI Component:**

```tsx
// src/components/sync/ConflictDialog.tsx
import { createSignal, Show } from "solid-js";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface ConflictDialogProps {
  table: string;
  localRecord: any;
  remoteRecord: any;
  onResolve: (
    choice: "keep_local" | "keep_remote" | "merge",
    merged?: any
  ) => void;
}

export function ConflictDialog(props: ConflictDialogProps) {
  const [choice, setChoice] = createSignal<
    "keep_local" | "keep_remote" | "merge"
  >("keep_remote");

  return (
    <Dialog open>
      <DialogContent>
        <DialogTitle>Sync Conflict Detected</DialogTitle>

        <div class="space-y-4">
          <p>The {props.table} record has been modified on another device.</p>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <h3 class="font-semibold">Your Version</h3>
              <pre class="text-xs">
                {JSON.stringify(props.localRecord, null, 2)}
              </pre>
            </div>

            <div>
              <h3 class="font-semibold">Server Version</h3>
              <pre class="text-xs">
                {JSON.stringify(props.remoteRecord, null, 2)}
              </pre>
            </div>
          </div>

          <div class="space-y-2">
            <label>
              <input
                type="radio"
                checked={choice() === "keep_local"}
                onChange={() => setChoice("keep_local")}
              />
              Keep my version (overwrite server)
            </label>

            <label>
              <input
                type="radio"
                checked={choice() === "keep_remote"}
                onChange={() => setChoice("keep_remote")}
              />
              Use server version (discard my changes)
            </label>

            <label>
              <input
                type="radio"
                checked={choice() === "merge"}
                onChange={() => setChoice("merge")}
              />
              Manually merge changes
            </label>
          </div>

          <Show when={choice() === "merge"}>
            <div>
              <p class="text-sm text-muted-foreground">
                Review and manually merge the fields below:
              </p>
              {/* Merge UI for each field */}
            </div>
          </Show>

          <button
            onClick={() => props.onResolve(choice())}
            class="btn btn-primary"
          >
            Resolve Conflict
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Deliverables:**

- ✅ Sync engine implementation
- ✅ Realtime subscriptions to Supabase
- ✅ Conflict resolution logic
- ✅ Background sync queue
- ✅ Offline-first architecture working

---

### Phase 5: Authentication Integration

**Supabase Auth Context:**

```typescript
// src/lib/auth/AuthContext.tsx
import {
  createContext,
  useContext,
  createSignal,
  ParentComponent,
  createEffect,
} from "solid-js";
import { createClient, User } from "@supabase/supabase-js";
import { initLocalDatabase } from "../db/init-sqlite-wasm";
import { SyncEngine } from "../sync/sync-engine";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

interface AuthState {
  user: () => User | null;
  loading: () => boolean;
  localDb: () => any;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>();

export const AuthProvider: ParentComponent = (props) => {
  const [user, setUser] = createSignal<User | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [localDb, setLocalDb] = createSignal<any>(null);
  const [syncEngine, setSyncEngine] = createSignal<SyncEngine | null>(null);

  // Check for existing session
  createEffect(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    setUser(session?.user ?? null);

    if (session?.user) {
      await initializeLocalDatabase(session.user.id);
    }

    setLoading(false);
  });

  // Listen for auth changes
  supabase.auth.onAuthStateChange(async (event, session) => {
    setUser(session?.user ?? null);

    if (session?.user) {
      await initializeLocalDatabase(session.user.id);
    } else {
      // Clear local database on sign out
      clearLocalDatabase();
    }
  });

  async function initializeLocalDatabase(userId: string) {
    const db = await initLocalDatabase(userId);
    setLocalDb(db);

    // Start sync engine
    const sync = new SyncEngine(db);
    setSyncEngine(sync);
  }

  function clearLocalDatabase() {
    // Clear IndexedDB
    indexedDB.deleteDatabase("tunetrees-storage");
    setLocalDb(null);
    setSyncEngine(null);
  }

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    setLoading(false);
  };

  const signUp = async (email: string, password: string, name: string) => {
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    });
    if (error) throw error;
    setLoading(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    clearLocalDatabase();
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, localDb, signIn, signUp, signOut }}
    >
      {props.children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
```

**Deliverables:**

- ✅ Auth context with Supabase integration
- ✅ Local database initialization on login
- ✅ Sync engine startup
- ✅ Logout cleanup

---

### Phase 6: Production Deployment

**Deployment Checklist:**

1. **Environment Variables:**

   ```bash
   # .env.production
   VITE_SUPABASE_URL=https://pjxuonglsvouttihjven.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ... # Anon key (safe for client)
   # DO NOT include service role key in client env!
   ```

2. **Cloudflare Pages Configuration:**

   ```toml
   # wrangler.toml
   name = "tunetrees"
   compatibility_date = "2025-10-04"

   [build]
   command = "npm run build"
   cwd = "/"

   [build.upload]
   format = "service-worker"
   ```

3. **Service Worker (PWA):**

   ```typescript
   // vite.config.ts
   import { VitePWA } from "vite-plugin-pwa";

   export default defineConfig({
     plugins: [
       solidPlugin(),
       VitePWA({
         registerType: "autoUpdate",
         workbox: {
           globPatterns: ["**/*.{js,css,html,ico,png,svg,wasm}"],
           runtimeCaching: [
             {
               urlPattern: /^https:\/\/pjxuonglsvouttihjven\.supabase\.co\/.*/i,
               handler: "NetworkFirst",
               options: {
                 cacheName: "supabase-api",
                 expiration: {
                   maxEntries: 100,
                   maxAgeSeconds: 60 * 60 * 24, // 24 hours
                 },
               },
             },
           ],
         },
       }),
     ],
   });
   ```

4. **Production Database:**

   - Use Supabase production project (separate from development)
   - Enable database backups (Supabase dashboard)
   - Monitor query performance
   - Set up alerts for errors

5. **Monitoring:**
   - Supabase: Database metrics, API logs
   - Cloudflare: Analytics, edge logs
   - Client: Error tracking (Sentry or similar)

**Deliverables:**

- ✅ Production build configuration
- ✅ PWA service worker
- ✅ Deployment to Cloudflare Pages
- ✅ Monitoring setup

---

## Schema Changes from Current

### Tables to Drop (NextAuth-specific)

```sql
-- These tables are replaced by Supabase Auth
DROP TABLE IF EXISTS account;
DROP TABLE IF EXISTS session;
DROP TABLE IF EXISTS verification_token;
```

### Tables to Modify

#### user → user_profile

**Before (SQLite):**

```sql
CREATE TABLE "user" (
    id integer not null primary key autoincrement,
    hash TEXT,
    name TEXT,
    email TEXT,
    email_verified TEXT default NULL,
    image TEXT,
    deleted BOOLEAN DEFAULT FALSE,
    sr_alg_type TEXT,
    phone TEXT,
    phone_verified TEXT DEFAULT NULL,
    acceptable_delinquency_window INTEGER DEFAULT 21
);
```

**After (PostgreSQL):**

```sql
CREATE TABLE user_profile (
    id serial PRIMARY KEY,
    supabase_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id),
    name text,
    email text, -- Denormalized from auth.users for queries
    sr_alg_type text,
    phone text,
    phone_verified timestamp,
    acceptable_delinquency_window integer DEFAULT 21,
    deleted boolean DEFAULT false,

    -- Sync columns
    sync_version integer DEFAULT 1,
    last_modified_at timestamp DEFAULT NOW(),
    device_id text
);
```

**After (SQLite WASM):**

```sql
CREATE TABLE user_profile (
    id integer PRIMARY KEY AUTOINCREMENT,
    supabase_user_id text NOT NULL UNIQUE, -- TEXT not UUID
    name text,
    email text,
    sr_alg_type text,
    phone text,
    phone_verified text, -- TEXT timestamp
    acceptable_delinquency_window integer DEFAULT 21,
    deleted integer DEFAULT 0, -- BOOLEAN as INTEGER

    -- Sync columns
    sync_version integer DEFAULT 1,
    last_modified_at text, -- TEXT timestamp
    device_id text
);
```

### All Other Tables

Add sync columns to every table:

```sql
-- Example: practice_record with sync columns
ALTER TABLE practice_record ADD COLUMN sync_version integer DEFAULT 1;
ALTER TABLE practice_record ADD COLUMN last_modified_at timestamp DEFAULT NOW();
ALTER TABLE practice_record ADD COLUMN device_id text;
```

**Tables requiring sync columns:**

- ✅ user_profile (user)
- ✅ playlist
- ✅ playlist_tune
- ✅ practice_record
- ✅ daily_practice_queue
- ✅ note
- ✅ reference
- ✅ tag
- ✅ tune_override
- ✅ tune (**requires sync** - users can create private tunes)
- ✅ instrument (users can create custom instruments)
- ✅ prefs_scheduling_options
- ✅ prefs_spaced_repetition
- ✅ tab_group_main_state
- ✅ table_state
- ✅ table_transient_data

**Tables NOT requiring sync columns (read-only reference data):**

- ❌ genre (system reference data, rarely changes)
- ❌ tune_type (system reference data, rarely changes)
- ❌ genre_tune_type (system reference data, rarely changes)

**Note on `tune` table:**

While most tunes come from shared tune databases (TheSession.org, etc.), users can create **private tunes** that need to sync across their devices. Therefore, the `tune` table requires sync columns (`sync_version`, `last_modified_at`, `device_id`) despite being primarily reference data.

### Views

**No changes required** - Views will work with renamed `user_profile` table by updating column references.

Example:

```sql
-- practice_list_joined view (update user references)
CREATE VIEW practice_list_joined AS
SELECT
    tune.id AS id,
    COALESCE(tune_override.title, tune.title) AS title,
    -- ... rest of columns
FROM tune
LEFT JOIN playlist_tune ON playlist_tune.tune_ref = tune.id
LEFT JOIN playlist ON playlist.playlist_id = playlist_tune.playlist_ref
-- Replace references to user.user_ref with user_profile.id
WHERE (
    tune_override.user_ref IS NULL
    OR tune_override.user_ref IN (SELECT id FROM user_profile WHERE deleted = false)
);
```

---

## Testing Strategy

### Unit Tests (Vitest + Solid Testing Library)

**Schema Tests:**

```typescript
// tests/schema/drizzle-schema.test.ts
import { describe, it, expect } from "vitest";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "../../drizzle/schema-sqlite";

describe("Drizzle Schema", () => {
  it("creates all tables without errors", () => {
    const db = new Database(":memory:");
    const drizzleDb = drizzle(db, { schema });

    // Apply schema
    // Verify tables exist
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all();

    expect(tables).toContainEqual({ name: "user_profile" });
    expect(tables).toContainEqual({ name: "tune" });
    expect(tables).toContainEqual({ name: "practice_record" });
  });

  it("preserves foreign key relationships", () => {
    const db = new Database(":memory:");
    const drizzleDb = drizzle(db, { schema });

    // Insert test data
    const user = drizzleDb
      .insert(schema.userProfile)
      .values({
        supabaseUserId: "test-uuid",
        email: "test@example.com",
      })
      .returning()
      .get();

    const playlist = drizzleDb
      .insert(schema.playlist)
      .values({
        userRef: user.id,
        instrumentRef: 1,
      })
      .returning()
      .get();

    // Verify foreign key works
    expect(playlist.userRef).toBe(user.id);
  });
});
```

**Sync Tests:**

```typescript
// tests/sync/sync-engine.test.ts
import { describe, it, expect, vi } from "vitest";
import { SyncEngine } from "../../src/lib/sync/sync-engine";

describe("Sync Engine", () => {
  it("queues local changes for sync", async () => {
    const mockDb = createMockDb();
    const sync = new SyncEngine(mockDb);

    sync.queueChange("practice_record", 123, "update");

    expect(sync.syncQueue).toHaveLength(1);
    expect(sync.syncQueue[0]).toMatchObject({
      table: "practice_record",
      recordId: 123,
      operation: "update",
    });
  });

  it("syncs queued changes when online", async () => {
    const mockDb = createMockDb();
    const mockSupabase = createMockSupabase();
    const sync = new SyncEngine(mockDb, mockSupabase);

    sync.queueChange("practice_record", 123, "update");
    await sync.syncNow();

    expect(mockSupabase.from).toHaveBeenCalledWith("practice_record");
    expect(mockSupabase.upsert).toHaveBeenCalled();
  });

  it("resolves conflicts with last-write-wins", async () => {
    // Test conflict resolution logic
  });
});
```

### Integration Tests

**Migration Tests:**

```typescript
// tests/migration/data-migration.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import Database from "better-sqlite3";
import { migrateSQLiteToSupabase } from "../../scripts/migrate-sqlite-to-supabase";

describe("SQLite → Supabase Migration", () => {
  beforeAll(async () => {
    // Set up test Supabase project
    // Load test SQLite database
  });

  it("migrates all users", async () => {
    const sqliteDb = new Database("tunetrees_test_clean.sqlite3");
    const sqliteCount = sqliteDb
      .prepare("SELECT COUNT(*) as count FROM user WHERE deleted = 0")
      .get().count;

    await migrateSQLiteToSupabase("test");

    const { count: supabaseCount } = await supabase
      .from("user_profile")
      .select("count")
      .single();

    expect(supabaseCount).toBe(sqliteCount);
  });

  it("preserves practice record relationships", async () => {
    // Verify tune_ref, playlist_ref foreign keys work
  });

  it("migrates all views successfully", async () => {
    // Verify practice_list_joined view returns same results
  });
});
```

### E2E Tests (Playwright)

**Recommended Approach: Option B - Static SQLite Test Database**

**Rationale:**

- ✅ Single test database (`tunetrees_test_clean.sqlite3`) for all test types (Vitest + Playwright)
- ✅ No Supabase quota consumption in CI (preserves free tier limits)
- ✅ Faster test execution (no network latency, works offline)
- ✅ Simpler CI/CD pipeline (no Supabase test project credentials to manage)
- ✅ Appropriate for TuneTrees' risk profile (sync tested separately via unit tests with mocks)
- ✅ Version controlled and easily reproducible test data

**Trade-offs (Acknowledged):**

- ❌ Can't test Supabase Realtime sync in E2E (tested via unit tests instead)
- ❌ Can't test RLS policies in E2E (validated manually during development)
- ❌ Can't test multi-device conflict resolution in E2E (unit tested with mocks)
- ✅ **Mitigation:** Sync engine fully unit tested with mocked Supabase client

**Implementation:**

```typescript
// tests/e2e/setup/load-test-db.ts
import initSqlJs from "sql.js";
import { drizzle } from "drizzle-orm/sql-js";
import * as schema from "@/drizzle/schema-sqlite";

export async function loadTestDatabase() {
  // Load sql.js WASM
  const SQL = await initSqlJs({
    locateFile: (file) => `/sql-wasm/${file}`,
  });

  // Fetch test database file from public directory
  const response = await fetch("/test-data/tunetrees_test_clean.sqlite3");
  const buffer = await response.arrayBuffer();

  // Load into SQLite WASM
  const db = new SQL.Database(new Uint8Array(buffer));

  // Return Drizzle instance
  return drizzle(db, { schema });
}

// tests/e2e/setup/mock-auth.tsx
import { createContext, ParentComponent, createSignal } from "solid-js";
import type { User } from "@supabase/supabase-js";

export function createMockAuthContext(testUserId = 1) {
  const [user, setUser] = createSignal<User | null>({
    id: "test-user-uuid",
    email: "test@example.com",
    app_metadata: {},
    user_metadata: { name: "Test User" },
    aud: "authenticated",
    created_at: new Date().toISOString(),
  });

  const [localDb, setLocalDb] = createSignal(null);

  return {
    user,
    loading: () => false,
    localDb,
    signIn: async () => {
      // Mock sign-in (already signed in for tests)
    },
    signOut: async () => {
      setUser(null);
    },
  };
}

export const MockAuthProvider: ParentComponent = (props) => {
  const authState = createMockAuthContext();

  return (
    <AuthContext.Provider value={authState}>
      {props.children}
    </AuthContext.Provider>
  );
};
```

**Test Scenarios:**

```typescript
// tests/e2e/practice-session.spec.ts
import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Load app with mock auth and static test DB
  await page.goto("/");

  // Inject test mode flag
  await page.evaluate(() => {
    window.__TEST_MODE__ = true;
    window.__TEST_USER_ID__ = 1;
  });

  // App loads tunetrees_test_clean.sqlite3 from /public/test-data/
  await page.waitForSelector('[data-testid="practice-queue"]');
});

test("practice session updates local database", async ({ page }) => {
  // Click first tune in queue
  await page.getByTestId("tune-card-1").click();

  // Grade tune
  await page.getByRole("button", { name: "Good" }).click();
  await page.getByRole("button", { name: "Submit" }).click();

  // Verify UI updates (practice record created locally)
  await expect(page.getByTestId("practice-count")).toHaveText(
    "1 practice today"
  );

  // Verify local database state via JS evaluation
  const recordCount = await page.evaluate(async () => {
    const db = window.__LOCAL_DB__;
    const records = await db.select().from(schema.practiceRecord).all();
    return records.length;
  });

  expect(recordCount).toBeGreaterThan(0);
});

test("queue generation works offline", async ({ page, context }) => {
  // Go offline
  await context.setOffline(true);

  // Navigate to queue page
  await page.goto("/practice/queue");

  // Queue should still render (from local SQLite)
  await expect(page.getByTestId("queue-item-0")).toBeVisible();
});

test("offline mode preserves user actions", async ({ page, context }) => {
  // Go offline
  await context.setOffline(true);

  // Submit practice record
  await page.getByTestId("tune-card-1").click();
  await page.getByRole("button", { name: "Good" }).click();
  await page.getByRole("button", { name: "Submit" }).click();

  // Verify saved locally (no sync to Supabase in test mode)
  const localRecord = await page.evaluate(async () => {
    const db = window.__LOCAL_DB__;
    const records = await db
      .select()
      .from(schema.practiceRecord)
      .where(eq(schema.practiceRecord.tune_ref, 1))
      .all();
    return records[0];
  });

  expect(localRecord).toBeTruthy();
  expect(localRecord.quality).toBeGreaterThan(0);
});
```

**Project Structure:**

```
public/
├── test-data/
│   └── tunetrees_test_clean.sqlite3  # Copied from root during build
└── sql-wasm/
    ├── sql-wasm.js
    └── sql-wasm.wasm

tests/
├── e2e/
│   ├── setup/
│   │   ├── load-test-db.ts        # SQLite WASM loader
│   │   └── mock-auth.tsx          # Mock auth context
│   └── practice-session.spec.ts   # E2E test examples
└── unit/
    └── sync-engine.test.ts        # Sync logic with mocked Supabase
```

**Test Database Maintenance:**

Keep `tunetrees_test_clean.sqlite3` for:

- ✅ Vitest unit tests (schema validation, query logic)
- ✅ Playwright E2E tests (loaded via SQLite WASM)
- ✅ Reference for expected data structures
- ✅ Schema comparison tests (SQLite ↔ PostgreSQL parity)
- ✅ Version controlled test data (git tracked)

---

## Data Migration Timeline

### Development Phase (Now → Phase 1 Complete)

**Week 1-2: Schema Definition**

- ✅ Create Drizzle schema files
- ✅ Test schema generation
- ✅ Verify TypeScript types

**Week 3-4: Supabase Setup**

- ✅ Run migrations on Supabase
- ✅ Set up RLS policies
- ✅ Configure indexes

**Reference Data:**

- Use `tunetrees_test_clean.sqlite3` for development
- Test with 10-20 sample records
- Validate schema in both databases

---

### Beta Phase (Phase 2-3)

**Week 5-6: Data Migration**

- Migrate YOUR production data to Supabase
- Verify data integrity
- Test all queries return correct results

**Week 7-8: SQLite WASM Setup**

- Initialize local database
- Test offline-first workflow
- Validate sync engine basics

**Test with Real Data:**

- Your actual tunes, playlists, practice records
- Multiple devices (phone, tablet, laptop)
- Offline/online transitions

---

### Production Phase (Phase 4+)

**Week 9-10: Sync Layer Polish**

- Test edge cases (conflicts, network errors)
- Optimize sync performance
- Add conflict resolution UI

**Week 11-12: Multi-User Deployment**

- Full migration of production SQLite → Supabase
- Invite beta users
- Monitor sync performance

**Week 13+: Production Launch**

- Public deployment
- Monitor metrics
- Iterate based on user feedback

---

## Next Immediate Steps (Phase 0)

### Step 1: Create Drizzle Directory Structure

```bash
mkdir -p drizzle
touch drizzle/schema-postgres.ts
touch drizzle/schema-sqlite.ts
touch drizzle/sync-columns.ts
touch drizzle/relations.ts
touch drizzle.config.ts
```

### Step 2: Generate Drizzle Schema from Your DDL

I can help generate the complete Drizzle TypeScript schema files from your DDL. This will include:

- Type-safe table definitions
- Foreign key relationships
- Indexes
- Constraints
- Sync columns

### Step 3: Create drizzle.config.ts

```typescript
// drizzle.config.ts
import type { Config } from "drizzle-kit";

export default {
  // PostgreSQL (Supabase)
  schema: "./drizzle/schema-postgres.ts",
  out: "./drizzle/migrations-postgres",
  driver: "pg",
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },

  // SQLite (for reference)
  // Uncomment to generate SQLite migrations
  // schema: './drizzle/schema-sqlite.ts',
  // out: './drizzle/migrations-sqlite',
  // driver: 'better-sqlite',
} satisfies Config;
```

### Step 4: Test Schema Generation

```bash
# Install Drizzle dependencies
npm install drizzle-orm postgres
npm install -D drizzle-kit

# Generate PostgreSQL migration
npx drizzle-kit generate:pg

# Verify output in drizzle/migrations-postgres/
```

---

## What Would You Like Next?

I can help you with:

1. **Generate complete Drizzle schema files** from your DDL (all tables with TypeScript types)
2. **Create the migration script skeleton** (SQLite → Supabase)
3. **Set up drizzle.config.ts** with both database configs
4. **Create test database setup scripts**
5. **All of the above** (comprehensive Phase 0 setup)

Which would you prefer to start with?
