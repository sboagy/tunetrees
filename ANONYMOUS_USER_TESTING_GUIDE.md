# Anonymous User Conversion Pattern - Testing Guide

This document provides step-by-step instructions for testing the newly implemented Anonymous User Conversion pattern.

## Overview

The Anonymous User Conversion pattern allows users to:
1. **Try TuneTrees immediately** without creating an account
2. **Use the app fully** with all features (data stored locally only)
3. **Convert to a registered account** later while preserving all their data

## Prerequisites

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open your browser to http://localhost:5173

3. **Important**: Clear localStorage before testing to start fresh:
   - Open browser DevTools (F12)
   - Go to Application/Storage tab
   - Clear localStorage items starting with "tunetrees:"

## Test Scenarios

### Scenario 1: Anonymous Sign-In

**Goal**: Verify users can start using the app without an account

**Steps**:
1. Navigate to http://localhost:5173/login
2. You should see the login form with three options:
   - Email/Password sign-in form
   - OAuth buttons (Google, GitHub)
   - **New: "Use on this Device Only" button** (gray button)
3. Click the "Use on this Device Only" button
4. Expected behavior:
   - You should be redirected to the main app (Practice tab)
   - The app should work fully (you can add tunes, practice, etc.)
   - No Supabase authentication should occur
   - Data is stored in local SQLite WASM database

**Verification**:
- Check localStorage in DevTools:
  - `tunetrees:anonymous:user` should be "true"
  - `tunetrees:anonymous:userId` should contain an anonymous ID like "anon_1234567890_abc123"
- Check console for:
  - "✅ Anonymous sign-in successful: anon_..."
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

**Goal**: Add some data to verify preservation during conversion

**Steps**:
1. While signed in anonymously, go to Catalog tab
2. Click "Add Tune" button
3. Create a test tune:
   - Title: "Test Anonymous Tune"
   - Type: "Jig"
   - Mode: "D Major"
4. Save the tune
5. Go to Repertoire tab
6. Add the tune to a playlist
7. Go to Practice tab
8. Stage the tune for practice

**Verification**:
- Tune appears in Catalog
- Tune appears in Repertoire
- Tune appears in Practice queue
- All data is stored locally (no sync occurs)

### Scenario 4: Account Conversion Flow

**Goal**: Convert anonymous user to registered account while preserving data

**Steps**:
1. Click "Create Account" button in the blue banner
2. Expected behavior:
   - Redirected to login page with `?convert=true` parameter
   - Login form shows special conversion UI:
     - Header: "Backup Your Data"
     - Subtext: "Create an account to save and sync your tunes across devices"
     - Blue info box: "✨ Your local data will be preserved and start syncing automatically"
     - Sign-up form (Name, Email, Password fields)
     - NO "Use on this Device Only" button (hidden during conversion)
     - NO toggle between sign-in/sign-up (you're in sign-up mode)
3. Fill in the form:
   - Name: "Test User"
   - Email: "test@example.com" (use a test email)
   - Password: "password123" (minimum 6 characters)
4. Click "Create Account" button
5. Expected behavior:
   - Account is created in Supabase
   - Anonymous mode flags are cleared from localStorage
   - User is signed in with new account
   - **Local data is preserved** (database is not cleared)
   - Sync starts automatically
   - Banner disappears (no longer anonymous)

**Verification**:
- Check localStorage:
  - `tunetrees:anonymous:user` should be removed
  - `tunetrees:anonymous:userId` should be removed
- Check console for:
  - "✅ Account created, user data will be preserved"
  - "⏳ Starting sync with Supabase..."
- Verify data is still there:
  - Go to Catalog - "Test Anonymous Tune" should still be visible
  - Go to Repertoire - playlist should still contain the tune
  - Go to Practice - tune should still be in queue
- Blue banner should be gone
- TopNav should show user email/name

### Scenario 5: Conversion Preserves Data Across Sessions

**Goal**: Verify converted data syncs properly

**Steps**:
1. After conversion (Scenario 4), note the data you created
2. Sign out (click user menu → Sign Out)
3. Sign in again with the same credentials
4. Expected behavior:
   - Data should sync down from Supabase
   - All tunes, playlists, and practice records should be restored
   - Everything looks identical to before sign-out

**Verification**:
- All data is preserved
- Sync is working (check console for sync logs)
- No anonymous mode indicators

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
   - No anonymous mode involved
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
- Signed in anonymously
- Go to /login
- Try to sign in with existing account
- Should: Sign out of anonymous mode, sign in normally
- Anonymous data: Should be cleared (or ask user to convert first?)

### Edge Case 3: Network Failure During Conversion
- Sign in anonymously
- Create test data
- Disable network
- Try to convert to account
- Should: Show error message, keep anonymous mode active, data preserved

## Known Limitations

1. **No multi-device sync for anonymous users**: Data is local-only until conversion
2. **Data loss on browser cache clear**: Anonymous data is not backed up
3. **No account recovery**: If user clears localStorage, anonymous data is lost
4. **Single-device only**: Cannot use anonymous mode on multiple devices simultaneously

## Developer Notes

### localStorage Keys
- `tunetrees:anonymous:user` - "true" if in anonymous mode
- `tunetrees:anonymous:userId` - Unique anonymous ID (e.g., "anon_1234567890_abc123")

### Console Logs to Watch
- "🔐 Anonymous sign-in attempt"
- "✅ Anonymous sign-in successful: {id}"
- "✅ [AuthContext] Anonymous mode - local database ready"
- "🔄 Converting anonymous user to registered account"
- "✅ Account created, user data will be preserved"

### Key Code Locations
- Anonymous auth logic: `src/lib/auth/AuthContext.tsx`
- Login UI: `src/components/auth/LoginForm.tsx`
- Banner component: `src/components/auth/AnonymousBanner.tsx`
- Integration: `src/components/layout/MainLayout.tsx`

## Troubleshooting

### Banner Not Appearing
- Check: Are you actually in anonymous mode? (Check localStorage)
- Check: Did you dismiss it? (Refresh page)
- Check: Is `isAnonymous()` signal working? (Console log)

### Conversion Not Working
- Check: Network connectivity
- Check: Supabase credentials in .env.local
- Check: Console errors during sign-up
- Check: Email format validity

### Data Not Preserved
- Check: Database was not cleared before conversion
- Check: Sync started after conversion
- Check: Console logs for errors

## Success Criteria

✅ Users can sign in anonymously with one click  
✅ Anonymous users can use all app features  
✅ Blue banner appears for anonymous users  
✅ Conversion flow is clear and seamless  
✅ All local data is preserved during conversion  
✅ Sync starts automatically after conversion  
✅ Regular sign-up flow still works normally  
✅ No TypeScript errors  
✅ No console errors (except expected warnings)

## Next Steps

After manual testing confirms everything works:
1. Consider adding E2E tests with Playwright
2. Update user documentation
3. Add analytics tracking for conversion rate
4. Consider adding "Continue as Guest" instead of "Use on this Device Only" for clarity
