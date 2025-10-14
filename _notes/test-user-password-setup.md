# Test User Password Setup Guide

## The Problem

The `supabase/seed-test-users.sql` file has placeholder bcrypt hashes:

```sql
encrypted_password: '$2a$10$YourBcryptHashHereForTestPassword123'
```

These need to be replaced with **real bcrypt hashes** for the password `SomePasswordForTesting`.

## ✅ Recommended Solution: Use Supabase Admin API

This is the **cleanest and most reliable** approach. Let Supabase handle password hashing automatically.

### Step 1: Install dependencies

```bash
npm install --save-dev bcryptjs @types/bcryptjs
```

### Step 2: Run the test user creation script

```bash
# Make sure Supabase is running locally
supabase start

# Run the script
npx tsx scripts/create-test-users.ts
```

### Step 3: Understand the two-file approach

The test setup uses **TWO separate pieces**:

1. **`scripts/create-test-users.ts`** - Creates auth users (Alice, Bob, Charlie) in `auth.users` table
2. **`supabase/seed-test-data.sql`** - Creates application data (playlists, tunes, practice records) in `public` schema

Both are required! The script handles authentication, the SQL file handles application data.

### Step 4: Update your workflow

**For local development:**

```bash
# 1. Reset database and load main seed data
supabase db reset

# 2. Create auth test users (Alice, Bob, Charlie)
npx tsx scripts/create-test-users.ts

# 3. Load test application data (playlists, tunes, practice records)
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/seed-test-data.sql

# 4. Run tests
npm run test:e2e
```

**For CI (GitHub Actions):**

Update `.github/workflows/ci.yml` to run both steps after `supabase db reset`:

```yaml
- name: Create test users
  run: npx tsx scripts/create-test-users.ts
  env:
    SUPABASE_URL: http://127.0.0.1:54321
    SUPABASE_SERVICE_ROLE_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

- name: Load test data
  run: |
    psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
      -f supabase/seed-test-data.sql
```

---

## Alternative: Manual Bcrypt Hash Generation

If you prefer to stick with the SQL file approach, you can generate hashes manually.

### Step 1: Install bcryptjs

```bash
npm install --save-dev bcryptjs @types/bcryptjs
```

### Step 2: Generate hashes

```bash
npx tsx scripts/generate-bcrypt-hash.ts "SomePasswordForTesting"
```

This outputs something like:

```
✅ Generated hash:
$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
```

### Step 3: Copy hashes into SQL file

Replace all three instances in `supabase/seed-test-users.sql`:

```sql
-- Alice's password hash
encrypted_password = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',

-- Bob's password hash
encrypted_password = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',

-- Charlie's password hash
encrypted_password = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
```

**Note:** All three can use the same hash since they all have the same password.

### Step 4: Append to seed.sql

```bash
cat supabase/seed-test-users.sql >> supabase/seed.sql
```

### Step 5: Test locally

```bash
supabase db reset
npm run test:e2e
```

---

## Which Approach Should You Use?

| Approach                           | Pros                                                                                                               | Cons                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| **Admin API Script** (Recommended) | ✅ Clean separation<br>✅ Handles hashing automatically<br>✅ Easy to update passwords<br>✅ Can set user metadata | ❌ Extra script to run<br>❌ Separate from seed.sql                               |
| **Manual SQL**                     | ✅ Everything in one file<br>✅ Simpler CI setup                                                                   | ❌ Manual hash generation<br>❌ Harder to update passwords<br>❌ More error-prone |

### My Recommendation

**Use the two-file approach** (Recommended):

1. `scripts/create-test-users.ts` - For auth users (clean, maintainable)
2. `supabase/seed-test-data.sql` - For application data (playlists, tunes, etc.)

This separation is cleaner and follows Supabase best practices.

---

## Verification

After setting up test users (either method), verify they work:

```bash
# 1. Start Supabase
supabase start

# 2. Reset database
supabase db reset

# 3. Create test users (if using Admin API approach)
npx tsx scripts/create-test-users.ts

# 4. Test login with Playwright
npx playwright test tests/auth-login.spec.ts --headed
```

You should see:

- ✅ Alice logs in successfully
- ✅ Bob logs in successfully
- ✅ Charlie logs in successfully

---

## Troubleshooting

### "Email address not authorized"

This happens if `GOTRUE_EXTERNAL_EMAIL_ENABLED=false` in your Supabase config.

**Fix:**

```bash
# In supabase/config.toml, ensure:
[auth]
enable_signup = true

# Or set in environment:
export GOTRUE_EXTERNAL_EMAIL_ENABLED=true
```

### "Invalid login credentials"

- Check that bcrypt hash matches the password
- Verify `email_confirmed_at` is set (not null)
- Check `auth.users` table directly:
  ```sql
  SELECT id, email, email_confirmed_at FROM auth.users
  WHERE email LIKE '%.test@tunetrees.test';
  ```

### "User already exists" error

This is OK! The script handles this by updating the password:

```
⚠️  User already exists: alice.test@tunetrees.test
🔄 Updating password for: alice.test@tunetrees.test
✅ Password updated successfully
```

---

## Summary

1. **Recommended:** Use `scripts/create-test-users.ts` with Admin API
2. **Alternative:** Generate bcrypt hashes manually and update SQL file
3. **Test:** Run `npm run test:e2e` to verify authentication works
4. **CI:** Add script to GitHub Actions workflow after `db reset`

Let me know which approach you'd like to use, and I can help you implement it! 🚀
