---
name: "Bug: Local SQLite state diverges across tabs"
about: "SQLite WASM per-tab divergence: practice vs debug/db vs multi-tab"
labels: ["bug", "offline", "sqlite", "sync"]
---

### Summary

Local SQLite WASM state is effectively **per-tab**, not per-user. Practice queue and other tables only reflect changes in the tab where they were created, and `/debug/db` (opened in another tab) often shows stale or empty data.

This violates the intended invariant:

> For a given user, all open tabs should observe the same local SQLite DB state.

### Steps to Reproduce

1. Log in as a normal user in Tab A.
2. Navigate to the Practice tab and trigger queue generation so that `getPracticeList` logs something like:

   ```ts
   [getPracticeList] Queue has 3 active rows for user=00000000-0000-4000-8000-000000009002, playlist=00000000-0000-4000-8000-000000019002
   ```

3. In a **new Tab B**, navigate to `/debug/db` and run:

   ```sql
   SELECT * FROM daily_practice_queue
   WHERE user_ref = '00000000-0000-4000-8000-000000009002'
     AND playlist_ref = '00000000-0000-4000-8000-000000019002'
     AND active = 1;
   ```

4. Observe: 0 rows returned. Even `SELECT * FROM daily_practice_queue;` is empty.
5. Now, in **Tab A**, change the location to `/debug/db` (same tab, no new tab). Run the same query again.
6. Observe: 3 rows are returned, matching what `getPracticeList` saw.

### Expected Behavior

- For a given `userId`, all tabs should share a single logical local DB:
  - If Tab A generates the daily queue, Tab B should see those rows (after a predictable persistence + reload cycle at worst).
  - `/debug/db` should always be a faithful view of the current user's DB state, regardless of how you reach it.

### Actual Behavior

- Each tab ends up with its **own in-memory** `sqliteDb` instance for the same user.
- Practice grid and sync logic mutate Tab A's in-memory DB (daily queue rows, transient data, etc.).
- Tab B initializes its own `sqliteDb` from an *older* IndexedDB snapshot and never sees Tab A's in-memory changes.
- `/debug/db` only shows the expected rows when opened in the *same tab* that ran practice.

### Technical Details

Relevant code: `src/lib/db/client-sqlite.ts`

- We keep global singletons in the module:

  ```ts
  let sqliteDb: SqlJsDatabase | null = null;
  let drizzleDb: ReturnType<typeof drizzle> | null = null;
  let currentUserId: string | null = null;
  ```

- IndexedDB config:

  ```ts
  const INDEXEDDB_NAME = "tunetrees-storage";
  const INDEXEDDB_STORE = "databases";
  const DB_KEY_PREFIX = "tunetrees-db";
  const DB_VERSION_KEY_PREFIX = "tunetrees-db-version";
  const CURRENT_DB_VERSION = 6;
  
  function getDbKey(userId: string): string {
    return `${DB_KEY_PREFIX}-${userId}`;
  }
  ```

- `initializeDb(userId)` behavior (simplified):

  ```ts
  const dbKey = getDbKey(userId);
  const existingData = await loadFromIndexedDB(dbKey);
  const storedVersion = await loadFromIndexedDB(dbVersionKey);

  if (existingData && storedVersionNum === CURRENT_DB_VERSION) {
    sqliteDb = new SQL.Database(existingData);
    drizzleDb = drizzle(sqliteDb, { schema: { ...schema, ...relations } });
    await recreateViews(drizzleDb);
  } else {
    sqliteDb = new SQL.Database();
    // apply migrations, install triggers, etc.
    // persist to IndexedDB with dbKey + version key
  }
  ```

Implications:

- All tabs for the same `userId` share the *same persistent blob* in IndexedDB (keyed by `tunetrees-db-{userId}`), but:
  - On page load, each tab creates its *own* in-memory `sqliteDb` (via `new SQL.Database(existingData)` or `new SQL.Database()`).
  - Mutations (queue generation, practice records, staging, etc.) only affect that tab's in-memory DB until we explicitly call `persistDb()`.
  - Another tab opened later will deserialize from the last persisted state, which may not include the latest changes from Tab A.

### Impact

- **Multi-tab correctness:**
  - Two tabs for the same user can have diverging views of the practice queue, transient data, and possibly other tables.
  - There is no cross-tab notification or conflict handling.

- **Debug tooling:**
  - `/debug/db` is misleading unless opened in the same tab that produced the state you're inspecting.
  - E2E debugging that relies on `/debug/db` from a separate tab may inspect stale or empty data.

### Proposed Direction

We need a clearer, explicit model of how the local SQLite DB behaves across tabs, and adjust the implementation to match it.

Options (not mutually exclusive):

1. **Snapshot model with explicit persistence:**
   - Define when we call `persistDb()` (e.g., after daily queue generation, after each sync batch, on key user actions).
   - Document that other tabs see a *snapshot* of the most recently persisted state, and require reload to pick up changes.
   - Add a small version/timestamp record in IndexedDB so other tabs can detect that a newer snapshot exists.

2. **Cross-tab coherence with notifications:**
   - Use `BroadcastChannel` or `storage` events to signal "DB snapshot updated for user X".
   - On receiving the signal, other tabs:
     - Either reload the page, or
     - Re-open the DB from IndexedDB (creating a new `sqliteDb` instance) and drop/replace the old one.

3. **Debug route safeguards:**
   - At minimum, `/debug/db` should:
     - Detect when there is a newer DB snapshot in IndexedDB than the one it loaded and surface a warning.
     - Provide a visible hint that opening `/debug/db` in a fresh tab may reflect an older snapshot.
   - Longer term, consider a small bridge/endpoint so `/debug/db` can query the *current* tab's `sqliteDb` rather than reinitializing its own.

### Acceptance Criteria

- Opening multiple tabs for the same user no longer silently produces diverging local DBs.
- There is a defined, testable story for how and when state is shared across tabs.
- `/debug/db` is reliable for inspecting the current user's DB (or very clearly communicates when it is showing a snapshot).

### Notes

This bug showed up while debugging practice queue behavior:

- Practice grid showed 3 daily queue rows.
- `/debug/db` in another tab showed an empty `daily_practice_queue`.
- Navigating the *same tab* to `/debug/db` then showed the expected 3 rows.

This strongly suggests that our current model is: **one WASM SQLite instance per tab**, plus a shared IndexedDB snapshot per user, but we are not persisting / refreshing frequently enough to treat it as "one DB per user" in practice.
