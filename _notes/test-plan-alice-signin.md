# Test Plan: Alice Test User Sign-In and Data Population

**Test User:** alice.test@tunetrees.test  
**Password:** SomePasswordForTesting  
**User Profile ID:** 9001  
**Test Data:**

- 1 Playlist: "Irish Flute (9001)" (instrument_ref=1, genre_default="Irish Traditional")
- 2 Private Tunes: "Banish Misfortune" (9001), "Morrison's Jig" (9002)
- Access to ~492 public tunes in catalog

**Objective:** Verify complete user authentication flow, data sync from Supabase to local SQLite, and correct population of all UI components with user-specific data.

---

## Test Environment Setup

### Prerequisites

1. Supabase local running: `supabase start`
2. Test data loaded: `npx tsx scripts/setup-test-environment.ts`
3. App dev server running: `npm run dev`
4. Browser with clean state (no cached data)

### Expected Initial State

- No logged-in user
- Empty local SQLite database
- Supabase PostgreSQL has Alice's data:
  - auth.users: UUID `11111111-1111-1111-1111-111111111111`
  - user_profile: ID 9001
  - playlist: ID 9001 (user_ref=9001)
  - tune: IDs 9001, 9002 (private_for=9001)
  - playlist_tune: 2 links (playlist_ref=9001, tune_ref=9001/9002)

---

## Test Scenarios

### Scenario 1: User Authentication

**Test ID:** AUTH-001  
**Title:** Sign in with valid credentials  
**Priority:** Critical

**Steps:**

1. Navigate to http://localhost:5173
2. Verify redirect to `/login` page
3. Enter email: `alice.test@tunetrees.test`
4. Enter password: `SomePasswordForTesting`
5. Click "Sign In" button
6. Wait for authentication to complete

**Expected Results:**

- ✅ Login form accepts credentials without errors
- ✅ Redirect to home page (`/`) after successful login
- ✅ No error messages displayed
- ✅ Browser console shows:
  - "Performing initial syncDown on login..."
  - "Initial syncDown completed"
  - Sync stats: ~651 records synced (15 genres, 49 tune types, 492+ tunes, etc.)

**Verification Queries:**

```javascript
// Browser console checks
const db = await window.__getLocalDb();
// Should return Alice's user profile
await db.select().from(user_profile).where(eq(user_profile.id, 9001));
```

---

### Scenario 2: TopNav - Playlist Dropdown Population

**Test ID:** TOPNAV-001  
**Title:** Playlist dropdown shows user's playlists  
**Priority:** Critical

**Preconditions:**

- User is logged in as Alice
- Initial sync completed

**Steps:**

1. Locate the playlist dropdown in the TopNav (left side, after logo)
2. Verify default selected playlist is displayed
3. Click the playlist dropdown button
4. Observe dropdown menu contents

**Expected Results:**

- ✅ Playlist dropdown button shows: **"Irish Flute (9001)"** (or custom name if set)
- ✅ Down arrow icon appears next to playlist name
- ✅ Clicking dropdown opens menu with:
  - **One playlist item:**
    - Name: "Irish Flute (9001)"
    - Subtitle: "2 tunes • Irish Traditional"
    - Blue highlight/checkmark (selected state)
  - **Divider line**
  - **"Manage Playlists..." button** with gear icon
- ✅ Dropdown renders without loading state
- ✅ No "Loading playlists..." message
- ✅ No empty state

**Browser Console Verification:**

```
✅ [TopNav] Got playlists: 1 [{playlistId: 9001, name: null, instrumentName: "Irish Flute", ...}]
```

**Edge Cases:**

- Clicking outside dropdown closes it
- Clicking "Manage Playlists..." navigates to `/playlists`
- Selecting the same playlist closes dropdown without re-fetching

---

### Scenario 3: Repertoire Tab - User's Tunes Display

**Test ID:** REPERTOIRE-001  
**Title:** Repertoire tab shows Alice's 2 private tunes  
**Priority:** Critical

**Preconditions:**

- User logged in as Alice
- Playlist "Irish Flute (9001)" selected in TopNav

**Steps:**

1. Click "Repertoire" tab in main navigation
2. Wait for grid to load
3. Observe tune list contents
4. Verify tune details

**Expected Results:**

- ✅ Repertoire grid displays exactly **2 tunes**:

  **Row 1: Banish Misfortune**

  - Title: "Banish Misfortune"
  - Type: "JigD" (displayed as "Jig" badge)
  - Mode: "D Mixolydian" (green badge)
  - Structure: "AABBCC"
  - Learned: "Learning" badge
  - Goal: "recall" badge
  - Scheduled: "—" (not scheduled yet)
  - Last Practiced: "Never"
  - Recall Eval: "—"
  - Status: 🔒 "Private" badge (purple)

  **Row 2: Morrison's Jig**

  - Title: "Morrison's Jig"
  - Type: "JigD"
  - Mode: "E Dorian"
  - Structure: "AABBCC"
  - Learned: "Learning" badge
  - Goal: "recall" badge
  - Status: 🔒 "Private" badge (purple)

- ✅ Grid toolbar shows:
  - "Add To Review" button (disabled, no selection)
  - Search box (empty)
  - "Add Tune" button
  - "Remove From Repertoire" button (disabled)
  - "Delete" button (disabled)
  - "Columns" button
- ✅ Filters section shows:

  - Type dropdown (all types available)
  - Mode dropdown (all modes available)
  - Genre dropdown (should show "Irish Traditional" and other genres)
  - Playlist dropdown (shows current playlist)

- ✅ No loading spinner visible
- ✅ No empty state message

**Browser Console Verification:**

```
REPERTOIRE playlistTunes result: 2 tunes
REPERTOIRE availableGenres: {tunesCount: 2, genresCount: 15, isLoading: false}
```

**SQLite Browser Verification:**

```sql
-- Check playlist_tune links exist
SELECT * FROM playlist_tune WHERE playlist_ref = 9001;
-- Should return 2 rows: tune_ref 9001, 9002

-- Check tunes are in local DB
SELECT id, title, type, mode, private_for FROM tune WHERE id IN (9001, 9002);
-- Should return both "Banish Misfortune" and "Morrison's Jig"
```

---

### Scenario 4: Catalog Tab - Public + Private Tunes Display

**Test ID:** CATALOG-001  
**Title:** Catalog tab shows all public tunes + Alice's private tunes  
**Priority:** High

**Preconditions:**

- User logged in as Alice
- Initial sync completed

**Steps:**

1. Click "Catalog" tab in main navigation
2. Wait for grid to load
3. Observe tune count and contents
4. Scroll through grid to verify data
5. Check private tunes are visible

**Expected Results:**

- ✅ Catalog grid displays approximately **494 tunes**:

  - ~492 public tunes (from production data)
  - 2 private tunes (Alice's: IDs 9001, 9002)

- ✅ Alice's private tunes appear in list:

  - "Banish Misfortune" with 🔒 "Private" badge
  - "Morrison's Jig" with 🔒 "Private" badge

- ✅ Public tunes display without "Private" badge

- ✅ Grid toolbar shows:

  - Search box
  - "Filters" dropdown
  - "Add Tune" button
  - "Delete" button (disabled, no selection)
  - "Columns" button

- ✅ Filters panel shows:

  - Type dropdown (49 tune types available)
  - Mode dropdown (all modes available)
  - Genre dropdown (15 genres available, including "ITRAD")
  - Playlist dropdown

- ✅ All columns render correctly:
  - Title, Type, Mode, Structure, Learned, Goal, etc.

**Browser Console Verification:**

```
engine.ts: ✓ tune: 492 records (or similar count)
```

**SQLite Browser Verification:**

```sql
-- Total tune count
SELECT COUNT(*) FROM tune;
-- Should be ~494

-- Alice's private tunes
SELECT id, title, private_for FROM tune WHERE private_for = 9001;
-- Should return 2 rows

-- Public tunes (no owner)
SELECT COUNT(*) FROM tune WHERE private_for IS NULL;
-- Should be ~492
```

---

### Scenario 5: Practice Tab - Empty State (No Practice Records Yet)

**Test ID:** PRACTICE-001  
**Title:** Practice tab shows appropriate empty/initial state  
**Priority:** Medium

**Preconditions:**

- User logged in as Alice
- No practice records exist yet (fresh test data)

**Steps:**

1. Click "Practice" tab in main navigation
2. Observe grid state
3. Check for empty state message or zero rows

**Expected Results:**

- ✅ Practice grid displays **0 tunes** (no scheduled practice yet)
- ✅ Empty state message or empty grid visible
- ✅ Grid toolbar present but most buttons disabled:
  - "Complete Practice" button (disabled)
  - Search box (empty)
  - "Columns" button (enabled)
- ✅ No errors in console
- ✅ Page renders without loading spinner stuck

**Browser Console Verification:**

```
engine.ts: ✓ practice_record: 0 records
engine.ts: ✓ daily_practice_queue: 0 records
```

**Expected Behavior:**

- User would need to:
  1. Go to Repertoire tab
  2. Select tunes
  3. Click "Add To Review" to schedule practice
  4. Return to Practice tab to see scheduled tunes

---

### Scenario 6: Data Sync Verification

**Test ID:** SYNC-001  
**Title:** Verify complete data sync from Supabase to local SQLite  
**Priority:** Critical

**Preconditions:**

- User logged in as Alice
- Initial sync completed

**Steps:**

1. Open browser DevTools → Console
2. Review sync completion logs
3. Open `/debug/db` page (Dev mode only)
4. Run verification queries

**Expected Results:**

- ✅ Console shows successful sync:

  ```
  ✅ [SyncEngine] SyncDown completed - synced 651 records from 18 tables
  ```

- ✅ All reference data synced:

  - ✓ genre: 15 records
  - ✓ tune_type: 49 records
  - ✓ genre_tune_type: 88 records
  - ✓ instrument: 5 records

- ✅ User-specific data synced:

  - ✓ user_profile: 1 record (Alice, ID 9001)
  - ✓ playlist: 1 record (ID 9001)
  - ✓ tune: ~492 public + 2 private = 494 records
  - ✓ playlist_tune: 2 records (links)
  - ✓ practice_record: 0 records
  - ✓ daily_practice_queue: 0 records

- ✅ Database Browser (`/debug/db`) shows:
  - All 21 tables listed in sidebar
  - Clicking "playlist" table executes query and shows 1 row
  - Clicking "tune" table shows all ~494 tunes
  - Clicking "playlist_tune" shows 2 links

**Verification Queries (Database Browser):**

```sql
-- Verify Alice's playlist exists
SELECT * FROM playlist WHERE playlist_id = 9001;

-- Verify playlist_tune links exist
SELECT * FROM playlist_tune WHERE playlist_ref = 9001;

-- Verify Alice's private tunes
SELECT id, title, private_for FROM tune WHERE private_for = 9001;

-- Count all tunes
SELECT COUNT(*) as total_tunes FROM tune;

-- Verify genres synced
SELECT COUNT(*) as genre_count FROM genre;
```

---

### Scenario 7: Network Status Indicator

**Test ID:** TOPNAV-002  
**Title:** Database/Sync status dropdown shows correct state  
**Priority:** Medium

**Preconditions:**

- User logged in as Alice
- Sync completed
- Online

**Steps:**

1. Locate database icon in TopNav (right side, before theme switcher)
2. Verify status indicator color
3. Click database icon to open dropdown
4. Review status details

**Expected Results:**

- ✅ Database icon has **green checkmark (✓)** badge
- ✅ Clicking icon opens dropdown showing:

  **Database Status Section:**

  - ✓ Local Database: "Initialized and ready"
  - ✓ Synced: "All changes synced to Supabase"
  - 🌐 Network: "Online"

  **Actions:**

  - "Force Sync Down" button (enabled)
  - "Database Browser (Dev)" link (if in dev mode)

- ✅ No warning icons (⚠️)
- ✅ No pending sync count

**After Clicking "Force Sync Down":**

- ✅ Console shows sync progress
- ✅ Status remains "Synced" (no changes to sync)
- ✅ No errors

---

### Scenario 8: User Menu Dropdown

**Test ID:** TOPNAV-003  
**Title:** User menu shows Alice's information  
**Priority:** Low

**Preconditions:**

- User logged in as Alice

**Steps:**

1. Locate user email in TopNav (right side, before database icon)
2. Click to open user menu dropdown
3. Review displayed information

**Expected Results:**

- ✅ User menu button shows: **"alice.test@tunetrees.test"**
- ✅ Dropdown displays:

  **User Information Section:**

  - Email: alice.test@tunetrees.test
  - Name: Alice Test User
  - User ID: 11111111-1111-1111-1111-111111111111 (UUID format)

  **Menu Items:**

  - "User Settings" button (with gear icon)
  - "Sign Out" button (with logout icon)

- ✅ Clicking outside closes dropdown
- ✅ Clicking "Sign Out" logs out and redirects to `/login`

---

## Test Data Summary

### Alice's Expected Data After Sync

| Entity             | Count | Details                                                     |
| ------------------ | ----- | ----------------------------------------------------------- |
| User Profile       | 1     | ID: 9001, email: alice.test@tunetrees.test                  |
| Playlists          | 1     | ID: 9001, instrument: Irish Flute, genre: Irish Traditional |
| Private Tunes      | 2     | "Banish Misfortune" (9001), "Morrison's Jig" (9002)         |
| Playlist Links     | 2     | Both tunes linked to playlist 9001                          |
| Public Tunes       | ~492  | Accessible in Catalog                                       |
| Practice Records   | 0     | None yet (fresh account)                                    |
| Scheduled Practice | 0     | None yet (no queue items)                                   |

### Reference Data (Shared)

| Entity               | Count |
| -------------------- | ----- |
| Genres               | 15    |
| Tune Types           | 49    |
| Genre-TuneType Links | 88    |
| Instruments          | 5     |

---

## Success Criteria

### Critical (Must Pass)

- ✅ Authentication succeeds without errors
- ✅ Initial sync completes successfully (~651 records)
- ✅ Playlist dropdown shows 1 playlist with correct details
- ✅ Repertoire tab shows exactly 2 tunes
- ✅ Catalog tab shows ~494 tunes (public + private)
- ✅ All tunes render with correct data (title, type, mode, etc.)
- ✅ Private badge displays on Alice's 2 tunes

### High Priority (Should Pass)

- ✅ Practice tab renders without errors (empty state OK)
- ✅ Database status indicator shows "Synced"
- ✅ User menu displays Alice's information correctly
- ✅ All navigation tabs are clickable and render

### Medium Priority (Nice to Have)

- ✅ Force Sync Down button works without errors
- ✅ Database Browser shows all tables and allows queries
- ✅ Genre/Type filters populate correctly
- ✅ Grid columns are all visible and formatted

---

## Known Issues / Limitations

1. **No Practice Records:** Fresh test account has no practice history

   - Expected: Empty Practice tab or zero scheduled tunes
   - User must manually add tunes to review to populate Practice tab

2. **Playlist Name:** Test data doesn't set custom playlist name

   - Expected display: "Irish Flute (9001)" (instrument + ID format)
   - Alternative: Set `name` field in setup script for cleaner display

3. **Sync Timing:** Initial sync on login may take 1-3 seconds
   - UI may briefly show loading states or empty grids
   - Should resolve once "syncDown completed" logs appear

---

## Automation Notes

### Playwright Test Structure (Future)

```typescript
test.describe("Alice Sign-In Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Reset: Clear browser storage, ensure fresh state
    await page.goto("http://localhost:5173/login");
  });

  test("AUTH-001: Sign in with valid credentials", async ({ page }) => {
    await page.getByLabel("Email").fill("alice.test@tunetrees.test");
    await page.getByLabel("Password").fill("SomePasswordForTesting");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL("/");
    // Wait for sync to complete
    await page.waitForSelector("text=Synced", { timeout: 10000 });
  });

  test("TOPNAV-001: Playlist dropdown population", async ({ page }) => {
    // Assume already logged in (use storage state)
    await expect(
      page.getByRole("button", { name: /Irish Flute/ })
    ).toBeVisible();
    await page.getByRole("button", { name: /Irish Flute/ }).click();
    await expect(page.getByText("2 tunes")).toBeVisible();
  });

  test("REPERTOIRE-001: Shows 2 tunes", async ({ page }) => {
    await page.getByRole("tab", { name: "Repertoire" }).click();
    await expect(
      page.getByRole("cell", { name: "Banish Misfortune" })
    ).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "Morrison's Jig" })
    ).toBeVisible();
    // Verify exactly 2 rows
    const rows = page.getByRole("row");
    await expect(rows).toHaveCount(3); // Header + 2 data rows
  });

  // ... more tests
});
```

---

## Test Execution Checklist

- [ ] Environment setup complete (Supabase + test data loaded)
- [ ] Browser cleared (no cached auth/data)
- [ ] Scenario 1: Authentication ✅/❌
- [ ] Scenario 2: TopNav Playlist Dropdown ✅/❌
- [ ] Scenario 3: Repertoire Tab ✅/❌
- [ ] Scenario 4: Catalog Tab ✅/❌
- [ ] Scenario 5: Practice Tab ✅/❌
- [ ] Scenario 6: Data Sync Verification ✅/❌
- [ ] Scenario 7: Network Status ✅/❌
- [ ] Scenario 8: User Menu ✅/❌

**Test Date:** \***\*\_\*\***  
**Tester:** \***\*\_\*\***  
**Pass/Fail:** \***\*\_\*\***  
**Notes:** \***\*\_\*\***

---

## Next Steps

1. **Manual Testing:** Execute this plan manually to verify all scenarios
2. **Document Issues:** Record any failures or unexpected behavior
3. **Automate with Playwright:** Convert scenarios to automated tests
4. **CI Integration:** Run tests in GitHub Actions
5. **Expand Coverage:** Add Bob/Charlie test users, error cases, offline scenarios
