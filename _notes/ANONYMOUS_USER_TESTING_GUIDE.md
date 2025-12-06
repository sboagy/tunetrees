# Anonymous User Conversion Pattern - Testing Guide

This document provides step-by-step instructions for testing the Supabase Native Anonymous Auth implementation.

## Overview

The Anonymous User Conversion pattern uses **Supabase Native Anonymous Auth** which:
1. Creates a real `auth.users` entry with `is_anonymous = true`
2. Preserves the UUID when converting to a registered account
3. Maintains all FK relationships automatically

Users can:
1. **Try TuneTrees immediately** without creating an account
2. **Use the app fully** with all features (data stored locally + user_profile in Supabase)
3. **Convert to a registered account** later while preserving their UUID and all data

## Prerequisites

1. **Enable anonymous sign-ins** in Supabase:
   - The setting should already be enabled in `supabase/config.toml`
   - If starting fresh, run `supabase db reset` to apply config

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open your browser to http://localhost:5173

4. **Important**: Clear browser data before testing:
   - Sign out if signed in
   - Open browser DevTools (F12)
   - Go to Application/Storage tab
   - Clear localStorage and IndexedDB

## Test Scenarios

### Scenario 1: Anonymous Sign-In (Supabase Native)

**Goal**: Verify users can start using the app without email/password

**Steps**:
1. Navigate to http://localhost:5173/login
2. You should see the login form with:
   - **"Use on this Device Only" button** (blue button at top)
   - Email/Password sign-in form
   - OAuth buttons (Google, GitHub)
3. Click the "Use on this Device Only" button
4. Expected behavior:
   - Supabase `signInAnonymously()` is called
   - Real `auth.users` entry created with `is_anonymous = true`
   - `user_profile` entry created in Supabase
   - Redirected to the main app (Practice tab)
   - The app should work fully

**Verification**:
- Check Supabase Studio (http://localhost:54323):
  - `auth.users` table should have a new entry with `is_anonymous = true`
  - `user_profile` table should have a matching entry
- Check console for:
  - "🔐 Anonymous sign-in attempt (Supabase native)"
  - "✅ Supabase anonymous sign-in successful: [UUID]"
  - "✅ Created user_profile for anonymous user: [UUID]"
  - "✅ [AuthContext] Anonymous mode - local database ready"

### Scenario 2: Anonymous User Banner

**Goal**: Verify the conversion prompt appears for anonymous users

**Steps**:
1. While signed in anonymously (from Scenario 1)
2. Look at the top of the app (below TopNav, above tabs)
3. Expected behavior:
   - A **blue banner** should appear with:
     - 💾 icon
     - Text: "You're using TuneTrees on this device only"
     - Subtext: "Create an account to backup your data and sync across all your devices"
     - **"Create Account" button** (white button with blue text)
     - Dismiss button (X icon)

**Verification**:
- Banner is visible on all pages while anonymous
- Clicking X dismisses the banner (for current session)
- Refreshing page shows banner again

### Scenario 3: Creating Test Data as Anonymous User

**Goal**: Add some data to verify UUID preservation during conversion

**Steps**:
1. While signed in anonymously, note your user UUID (check console or Supabase Studio)
2. Go to Catalog tab
3. Click "Add Tune" button
4. Create a test tune:
   - Title: "Test Anonymous Tune"
   - Type: "Jig"
   - Mode: "D Major"
5. Save the tune
6. Go to Repertoire tab
7. Add the tune to a playlist
8. Go to Practice tab
9. Stage the tune for practice

**Verification**:
- Tune appears in Catalog
- Tune appears in Repertoire
- Tune appears in Practice queue
- All data stored with `user_ref = [your anonymous UUID]`
- Data is stored locally (no sync to Supabase yet)

### Scenario 4: Account Conversion Flow (UUID-Preserving)

**Goal**: Convert anonymous user to registered account while preserving UUID

**Steps**:
1. Note your anonymous UUID from earlier
2. Click "Create Account" button in the blue banner
3. Expected behavior:
   - Redirected to login page with `?convert=true` parameter
   - Login form shows special conversion UI:
     - Header: "Backup Your Data"
     - Subtext: "Create an account to save and sync your tunes across devices"
     - Blue info box: "✨ Your local data will be preserved and start syncing automatically"
     - Sign-up form (Name, Email, Password fields)
4. Fill in the form:
   - Name: "Test User"
   - Email: "test@example.com"
   - Password: "password123"
5. Click "Create Account" button
6. Expected behavior:
   - `supabase.auth.updateUser()` called (NOT `signUp()`)
   - **UUID PRESERVED** - same ID as anonymous user!
   - `auth.users` entry updated: `is_anonymous = false`, email added
   - `user_profile` updated with email and name
   - Sync starts automatically
   - Banner disappears

**Verification**:
- Check Supabase Studio:
  - `auth.users`: Same UUID, now `is_anonymous = false`, has email
  - `user_profile`: Same UUID, now has email and updated name
- Check console for:
  - "🔄 Converting anonymous user to registered account"
  - "✅ Email/password linked to anonymous account"
  - "👤 User ID preserved: [SAME UUID]"
  - "✅ user_profile updated with email: test@example.com"
  - "⏳ Starting sync with Supabase for converted user..."
- Verify data is still there:
  - Go to Catalog - "Test Anonymous Tune" should be visible
  - Go to Repertoire - playlist should contain the tune
  - All `user_ref` FKs still reference the SAME UUID
- Blue banner should be gone
- TopNav should show user email/name

### Scenario 5: Conversion Preserves Data Across Sessions

**Goal**: Verify converted data syncs properly

**Steps**:
1. After conversion (Scenario 4), note the UUID
2. Sign out (click user menu → Sign Out)
3. Sign in again with email/password
4. Expected behavior:
   - Data should sync down from Supabase
   - All tunes, playlists, and practice records restored
   - Same UUID used for all data

**Verification**:
- All data is preserved
- UUID is the same throughout
- Sync is working (check console for sync logs)

### Scenario 6: Dismissing the Banner

**Goal**: Verify banner can be dismissed

**Steps**:
1. Sign in anonymously (Scenario 1)
2. Click the X button on the blue banner
3. Expected behavior:
   - Banner disappears
   - Dismissal is per-session only (not persistent)
4. Refresh the page
5. Expected behavior:
   - Banner reappears (dismissal is not saved to localStorage)

**Verification**:
- Banner dismissal works
- Banner reappears on refresh

### Scenario 7: Regular Sign-Up Still Works

**Goal**: Verify normal sign-up flow is unaffected

**Steps**:
1. Clear localStorage completely
2. Navigate to http://localhost:5173/login
3. Click "Don't have an account? Sign up" link
4. Fill in sign-up form normally (not anonymous)
5. Create account
6. Expected behavior:
   - Normal sign-up flow works
   - Creates new Supabase user with `is_anonymous = false`
   - No banner appears (you're a regular user)
   - Starts with empty database (normal flow)

**Verification**:
- Account created normally
- No anonymous indicators
- No conversion flow triggered

## Edge Cases to Test

### Edge Case 1: Clicking "Use on this Device Only" When Already Anonymous
- Already signed in anonymously
- Go to /login (manually type URL)
- Click "Use on this Device Only" again
- Should: Do nothing or redirect to home (already anonymous)

### Edge Case 2: Sign In When Anonymous
- Signed in anonymously (has real Supabase UUID)
- Go to /login
- Try to sign in with existing account
- Should: Sign out anonymous user, sign in with existing account
- Note: Anonymous user's data stays in Supabase under old UUID (orphaned)

### Edge Case 3: Network Failure During Anonymous Sign-In
- Clear browser state
- Go to /login
- Disable network
- Click "Use on this Device Only"
- Should: Show error message (Supabase native auth requires network)

### Edge Case 4: Network Failure During Conversion
- Sign in anonymously
- Create test data
- Disable network
- Try to convert to account
- Should: Show error message, keep anonymous mode active, data preserved locally

## Known Limitations

1. **Requires network for anonymous sign-in**: Unlike local-only approach, Supabase native auth needs network for initial sign-in
2. **Data stored with Supabase UUID from start**: Even for anonymous users
3. **No multi-device sync for anonymous users**: Local SQLite data is not synced until conversion
4. **Orphaned data on abandon**: If user never converts or signs in elsewhere, anonymous data remains orphaned

## Developer Notes

### Key Supabase Auth Methods
- `supabase.auth.signInAnonymously()` - Creates `auth.users` with `is_anonymous = true`
- `supabase.auth.updateUser({ email, password })` - Links credentials, preserves UUID
- JWT metadata contains `is_anonymous` flag

### Console Logs to Watch
- "🔐 Anonymous sign-in attempt (Supabase native)"
- "✅ Supabase anonymous sign-in successful: [UUID]"
- "✅ Created user_profile for anonymous user: [UUID]"
- "✅ [AuthContext] Anonymous mode - local database ready"
- "🔄 Converting anonymous user to registered account"
- "✅ Email/password linked to anonymous account"
- "👤 User ID preserved: [UUID]"
- "✅ user_profile updated with email: [email]"
- "⏳ Starting sync with Supabase for converted user..."

### Key Code Locations
- Anonymous auth logic: `src/lib/auth/AuthContext.tsx`
- Login UI: `src/components/auth/LoginForm.tsx`
- Banner component: `src/components/auth/AnonymousBanner.tsx`
- Integration: `src/components/layout/MainLayout.tsx`
- Supabase config: `supabase/config.toml` (enable_anonymous_sign_ins)

### Checking Anonymous Status
- **In AuthContext**: `isUserAnonymous(user)` helper checks JWT metadata
- **Supabase Studio**: Check `auth.users` table for `is_anonymous` column
- **Console**: "Anonymous mode" vs "Registered user" logs

## Troubleshooting

### "Anonymous Sign-In Failed"
- Check: Is `enable_anonymous_sign_ins = true` in supabase/config.toml?
- Check: Run `supabase db reset` to apply config changes
- Check: Network connectivity (Supabase native auth requires network)
- Check: Supabase service is running (`supabase status`)

### Banner Not Appearing
- Check: Is `isAnonymous()` signal returning true? (Console log)
- Check: Did you dismiss it? (Refresh page)
- Check: Is the user actually anonymous? (Check Supabase Studio)

### Conversion Not Working
- Check: Network connectivity
- Check: Email format validity
- Check: Password meets requirements (6+ characters)
- Check: Console errors during updateUser call

### UUID Changed After Conversion
- This should NOT happen with Supabase native auth
- Check: Console logs show "👤 User ID preserved:"
- Check: updateUser was called, not signUp

### Data Not Preserved
- Check: Are you looking at the right UUID's data?
- Check: Sync started after conversion
- Check: Console logs for errors
- Check: user_ref FKs in local SQLite match the UUID

## Success Criteria

✅ Users can sign in anonymously with one click  
✅ Anonymous sign-in creates real Supabase user with `is_anonymous = true`  
✅ Anonymous users can use all app features  
✅ Blue banner appears for anonymous users  
✅ Conversion uses `updateUser()` to preserve UUID  
✅ **UUID is preserved** during conversion (critical!)  
✅ All local data FK references remain valid after conversion  
✅ Sync starts automatically after conversion  
✅ Regular sign-up flow still works normally  
✅ No TypeScript errors  
✅ No console errors (except expected warnings)

## Next Steps

After manual testing confirms everything works:
1. Consider adding E2E tests with Playwright for anonymous flow
2. Update user documentation
3. Add analytics tracking for conversion rate
4. Consider periodic cleanup of abandoned anonymous users in Supabase
