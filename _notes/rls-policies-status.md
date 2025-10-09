# RLS Policies Status - TuneTrees PWA

**Date:** October 9, 2025  
**Status:** ✅ **FULLY CONFIGURED AND ACTIVE**

## Quick Answer

**YES, RLS policies are already set up and working!**

You can safely test sync operations. The Supabase JS client will automatically enforce RLS policies based on the authenticated user's JWT token.

---

## What Are RLS Policies?

**Row Level Security (RLS)** is PostgreSQL's way of controlling which rows a user can access in a table. It's the **primary security mechanism** for Supabase apps.

### How It Works

1. **User logs in** → Supabase returns a JWT token
2. **Token contains:** `auth.uid()` (user's Supabase UUID)
3. **Every query checks:** Does this row belong to this user?
4. **Access granted only if:** RLS policy passes

### Example Policy

```sql
-- Users can only see their own playlists
CREATE POLICY "Users can view own playlists" ON playlist
FOR SELECT USING (
  user_ref IN (
    SELECT id FROM user_profile
    WHERE supabase_user_id = auth.uid()
  )
);
```

**What this does:**

- When user queries `playlist` table
- Supabase checks: `user_ref` matches their `user_profile.id`
- If yes → return rows
- If no → return empty (no error, just filtered)

---

## Your Current RLS Setup

### File Location

```
drizzle/migrations/postgres/0001_rls_policies.sql
```

### Coverage

**✅ 19 tables with RLS policies**

#### User-Owned Tables (16 tables)

| Table                      | Policies                       | Description                         |
| -------------------------- | ------------------------------ | ----------------------------------- |
| `user_profile`             | SELECT, INSERT, UPDATE         | User's own profile only             |
| `playlist`                 | SELECT, INSERT, UPDATE, DELETE | User's own playlists                |
| `playlist_tune`            | SELECT, INSERT, UPDATE, DELETE | Tunes in user's playlists           |
| `practice_record`          | SELECT, INSERT, UPDATE         | User's practice history             |
| `daily_practice_queue`     | SELECT, INSERT, UPDATE, DELETE | User's practice queue               |
| `note`                     | SELECT, INSERT, UPDATE, DELETE | User's notes + public notes         |
| `reference`                | SELECT, INSERT, UPDATE, DELETE | User's references + public refs     |
| `tag`                      | SELECT, INSERT, UPDATE, DELETE | User's tags only                    |
| `tune`                     | SELECT, INSERT, UPDATE, DELETE | Public tunes + user's private tunes |
| `tune_override`            | SELECT, INSERT, UPDATE, DELETE | User's tune overrides               |
| `instrument`               | SELECT, INSERT, UPDATE, DELETE | Public instruments + user's private |
| `prefs_spaced_repetition`  | SELECT, INSERT, UPDATE, DELETE | User's SR preferences               |
| `prefs_scheduling_options` | SELECT, INSERT, UPDATE, DELETE | User's scheduling prefs             |
| `table_state`              | SELECT, INSERT, UPDATE, DELETE | User's table state                  |
| `tab_group_main_state`     | SELECT, INSERT, UPDATE, DELETE | User's tab state                    |
| `table_transient_data`     | SELECT, INSERT, UPDATE, DELETE | User's transient UI data            |

#### Reference Data Tables (3 tables)

| Table             | Policies                   | Description              |
| ----------------- | -------------------------- | ------------------------ |
| `genre`           | SELECT (all authenticated) | Read-only reference data |
| `tune_type`       | SELECT (all authenticated) | Read-only reference data |
| `genre_tune_type` | SELECT (all authenticated) | Read-only relationships  |

### Total Policies: ~65

---

## When Were They Applied?

### Phase 1: Authentication & Database Setup

**Completed:** September 2024

**Steps:**

1. ✅ Created RLS policies SQL file
2. ✅ Created `scripts/apply-rls-policies.ts` script
3. ✅ Ran script against Supabase:
   ```bash
   tsx scripts/apply-rls-policies.ts
   ```
4. ✅ Verified policies active in Supabase dashboard

**Evidence:**

- `_notes/phase-1-completion-summary.md` line 103: "✅ RLS policies applied successfully!"
- `_notes/phase-1-final-summary.md` line 706: "✅ Task 2: RLS policies applied"

---

## How to Verify RLS Is Working

### Method 1: Supabase Dashboard

1. Go to: https://app.supabase.com/project/YOUR_PROJECT/database/policies
2. You should see ~65 policies across 19 tables
3. Each policy shows:
   - Table name
   - Policy name
   - Operation (SELECT, INSERT, UPDATE, DELETE)
   - USING clause (the security check)

### Method 2: Test Query

Open Supabase SQL Editor and run:

```sql
-- This query will ONLY return your own playlists
-- Even though you didn't add a WHERE clause!
SELECT * FROM playlist;
```

**What happens:**

- If logged in as User A → sees only User A's playlists
- If logged in as User B → sees only User B's playlists
- RLS automatically filters rows

### Method 3: Browser DevTools

1. Login to app
2. Open DevTools → Network tab
3. Filter: `supabase.co`
4. Make a query (e.g., view playlists)
5. Check request headers → includes JWT token
6. Check response → only your data returned

---

## What This Means for Sync

### ✅ Sync Is Secure

Your sync engine will:

1. **Use Supabase JS client** (includes JWT token automatically)
2. **RLS enforces access control** (server-side, can't be bypassed)
3. **Users can only sync their own data** (impossible to see others' data)

### Example: syncUp()

```typescript
// Your sync code
await this.supabase.from("playlist").insert({
  user_ref: 123, // Your user ID
  name: "My Playlist",
});
```

**What RLS checks:**

- Is `user_ref: 123` your user ID?
- If yes → insert allowed ✅
- If no (trying to insert as another user) → ERROR ❌

### Example: syncDown()

```typescript
// Your sync code
const { data } = await this.supabase.from("playlist").select("*");
```

**What RLS does:**

- Automatically filters to your playlists only
- You don't need `.eq('user_ref', userId)`
- RLS adds this filter server-side

---

## Common RLS Scenarios

### Scenario 1: User Creates Playlist

```typescript
// User A (id=1) creates playlist
await supabase.from("playlist").insert({
  playlist_id: 100,
  user_ref: 1, // User A's ID
  name: "Jigs",
});
```

✅ **Result:** Success (RLS allows own data)

### Scenario 2: User Tries to Access Another User's Playlist

```typescript
// User A tries to read User B's playlist
const { data } = await supabase
  .from("playlist")
  .select("*")
  .eq("playlist_id", 200); // Belongs to User B
```

✅ **Result:** Empty array (RLS filters it out, no error)

### Scenario 3: User Tries to Insert as Another User

```typescript
// User A tries to insert as User B
await supabase.from("playlist").insert({
  user_ref: 2, // User B's ID (not User A!)
  name: "Hacker Playlist",
});
```

❌ **Result:** ERROR - RLS policy violation

### Scenario 4: Public Tunes

```sql
-- RLS policy for tune table
CREATE POLICY "Users can view public or own private tunes" ON tune
FOR SELECT USING (
  private_for IS NULL  -- Public tune
  OR private_for = auth.uid()  -- Or own private tune
);
```

```typescript
// User A queries all tunes
const { data } = await supabase.from("tune").select("*");
```

✅ **Result:** Returns:

- All public tunes (`private_for IS NULL`)
- User A's private tunes (`private_for = 1`)
- Does NOT return User B's private tunes

---

## FAQ

### Q: Do I need to add WHERE clauses for user_ref?

**A: No!** RLS does this automatically. However, you CAN add explicit filters for:

1. **Performance** (helps query planner)
2. **Clarity** (documents intent in code)

```typescript
// Option 1: Let RLS handle it (simpler)
await supabase.from("playlist").select("*");

// Option 2: Explicit filter (clearer, slightly faster)
await supabase.from("playlist").select("*").eq("user_ref", userId);
```

Both are secure. RLS enforces access either way.

### Q: Can users bypass RLS with direct SQL?

**A: No!** RLS is enforced at the PostgreSQL level. Even if someone:

- Uses SQL editor
- Accesses database directly
- Hacks the Supabase JS client

They STILL can't bypass RLS. It's server-side protection.

### Q: What about the Supabase Service Role Key?

**A: That BYPASSES RLS!** That's why it's secret:

- `SUPABASE_ANON_KEY` (public) → RLS enforced ✅
- `SUPABASE_SERVICE_ROLE_KEY` (secret) → RLS bypassed ⚠️

**Never use service role key in browser code!**

### Q: Do I need to test RLS manually?

**A: Optional, but recommended:**

1. Create 2 test users
2. Login as User A
3. Create playlist
4. Login as User B
5. Try to access User A's playlist → should be empty
6. Verify no errors, just filtered results

### Q: What if I see "RLS policies not configured" warning?

**A: Old warning!** If you see this in code comments, it's outdated. RLS policies were applied in Phase 1 (September 2024).

The warning appeared because:

- Sync worker was disabled (Node.js postgres issue)
- Comment incorrectly blamed RLS
- Actually: sync engine needed refactor (now fixed!)

---

## Summary

| Question                        | Answer                                   |
| ------------------------------- | ---------------------------------------- |
| **Are RLS policies set up?**    | ✅ Yes, fully configured                 |
| **When were they applied?**     | September 2024 (Phase 1)                 |
| **How many policies?**          | ~65 policies across 19 tables            |
| **Are they active?**            | ✅ Yes, enforced on all queries          |
| **Do I need to do anything?**   | ❌ No, they work automatically           |
| **Is sync secure?**             | ✅ Yes, RLS prevents unauthorized access |
| **Can users see others' data?** | ❌ No, RLS filters server-side           |

---

## Next Steps

1. ✅ **Test sync operations** - RLS will enforce security
2. ✅ **Login and create data** - Your data only
3. ✅ **Verify in Supabase dashboard** - Check policies tab
4. ✅ **Multi-user testing** - Create 2 accounts, verify isolation

**You're good to go!** Sync operations are secure with RLS. 🔐

---

**References:**

- RLS SQL: `drizzle/migrations/postgres/0001_rls_policies.sql`
- Apply script: `scripts/apply-rls-policies.ts`
- Phase 1 completion: `_notes/phase-1-completion-summary.md`
- Supabase RLS docs: https://supabase.com/docs/guides/auth/row-level-security
