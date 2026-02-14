# Anonymous User Conversion Pattern - Comprehensive Test Plan

## Application Overview

The Anonymous User Conversion Pattern (PR #287) implements a "Try Before You Buy" experience using **Supabase Native Anonymous Auth**. Users can:

1. **Start using TuneTrees immediately** without creating an account
2. **Use all features** with local SQLite WASM database
3. **Convert to a registered account** later while **preserving their UUID** and all data

### Key Technical Details

- **Supabase Anonymous Auth**: Creates real `auth.users` entry with `is_anonymous = true`
- **UUID Preservation**: `updateUser()` used for conversion (NOT `signUp()`)
- **Local-First**: Anonymous users work offline with SQLite WASM
- **Banner Prompt**: Blue gradient banner prompts conversion with dismissible UI
- **Reference Data Sync**: Genres, tune types, instruments sync for anonymous users

---

## E2E Test Implementation Files

| Test File | Description | Priority |
|-----------|-------------|----------|
| `anonymous-001-sign-in-flow.spec.ts` | Anonymous sign-in button, success, session persistence | P0 |
| `anonymous-002-banner.spec.ts` | Banner visibility, dismissal, navigation | P1 |
| `anonymous-003-account-conversion.spec.ts` | Conversion UI, validation, UUID preservation | P0 |
| `anonymous-004-data-functionality.spec.ts` | Catalog access, add to repertoire, data persistence | P1 |
| `anonymous-005-edge-cases.spec.ts` | Double sign-in, regular signup, sign-out behavior | P2 |
| `anonymous-006-data-preservation.spec.ts` | **CRITICAL**: Data preserved during/after conversion | P0 |

---

## Test Scenarios

### 1. Anonymous Sign-In Flow

**Seed:** None required (fresh state)

#### 1.1 Anonymous Sign-In Button Visibility
**Steps:**
1. Clear all browser storage (localStorage, IndexedDB)
2. Navigate to http://localhost:5173/login
3. Observe the login form layout

**Expected Results:**
- "Use on this Device Only" button visible (blue button)
- Button positioned above OAuth buttons
- Subtext: "Try TuneTrees without an account. Your data will only be stored on this device and won't sync to other devices."
- Email/Password form visible below
- OAuth buttons (Google, GitHub) visible

#### 1.2 Anonymous Sign-In Success
**Steps:**
1. Clear all browser storage
2. Navigate to http://localhost:5173/login
3. Click "Use on this Device Only" button
4. Wait for redirect

**Expected Results:**
- Loading state shown during sign-in
- Redirected to Practice tab (home page)
- Console log: "🔐 Anonymous sign-in attempt (Supabase native)"
- Console log: "✅ Supabase anonymous sign-in successful: [UUID]"
- Console log: "✅ Created user_profile for anonymous user: [UUID]"
- Supabase `auth.users` entry created with `is_anonymous = true`
- Supabase `user_profile` entry created

#### 1.3 Anonymous User Session Persistence
**Steps:**
1. Complete anonymous sign-in (Scenario 1.2)
2. Note the user UUID from console logs
3. Refresh the page (F5)
4. Wait for app to load

**Expected Results:**
- User remains signed in as anonymous
- Same UUID preserved (no new sign-in)
- Console log: "✅ [AuthContext] Anonymous mode - local database ready"
- Practice tab loads correctly

---

### 2. Anonymous User Banner

**Seed:** Complete anonymous sign-in first

#### 2.1 Banner Visibility
**Steps:**
1. Sign in anonymously
2. Observe the page layout below TopNav

**Expected Results:**
- Blue gradient banner appears below TopNav
- 💾 icon visible
- Text: "You're using TuneTrees on this device only"
- Subtext: "Create an account to backup your data and sync across all your devices"
- "Create Account" button (white with blue text)
- X dismiss button visible

#### 2.2 Banner Appears on All Tabs
**Steps:**
1. Sign in anonymously
2. Navigate to Practice tab
3. Observe banner
4. Navigate to Repertoire tab
5. Observe banner
6. Navigate to Catalog tab
7. Observe banner

**Expected Results:**
- Banner visible on Practice tab
- Banner visible on Repertoire tab
- Banner visible on Catalog tab
- Banner position consistent across tabs

#### 2.3 Banner Dismissal
**Steps:**
1. Sign in anonymously
2. Click the X button on the banner
3. Navigate to different tabs

**Expected Results:**
- Banner disappears immediately
- Banner stays hidden on all tabs
- localStorage key `tunetrees:anonymous-banner-dismissed` set to "true"

#### 2.4 Banner Reappears on New Session
**Steps:**
1. Sign in anonymously
2. Dismiss the banner
3. Sign out
4. Clear localStorage key `tunetrees:anonymous-banner-dismissed`
5. Sign in anonymously again

**Expected Results:**
- Banner appears again after fresh anonymous sign-in

---

### 3. Anonymous User Functionality

**Seed:** Complete anonymous sign-in first

#### 3.1 Access Practice Tab
**Steps:**
1. Sign in anonymously
2. Click Practice tab

**Expected Results:**
- Practice tab loads without errors
- Empty queue message shown (no scheduled tunes)
- "Database status" shows connected

#### 3.2 Access Catalog Tab
**Steps:**
1. Sign in anonymously
2. Click Catalog tab

**Expected Results:**
- Catalog tab loads
- Public tunes visible in catalog grid
- Filter dropdowns work (Type, Mode, Genre)

#### 3.3 Add Tune to Repertoire
**Steps:**
1. Sign in anonymously
2. Navigate to Catalog tab
3. Select a tune from catalog
4. Click "Add to Repertoire" button
5. Navigate to Repertoire tab

**Expected Results:**
- Tune added successfully
- Console shows local database write
- Tune appears in Repertoire tab
- `repertoire_tune` entry created with anonymous user's UUID

#### 3.4 Create Practice Record
**Steps:**
1. Sign in anonymously
2. Add tune to repertoire (from Scenario 3.3)
3. Navigate to Practice tab
4. Queue a tune for practice
5. Evaluate the tune (e.g., "Good")
6. Submit the evaluation

**Expected Results:**
- Practice record created in local database
- Evaluation saved
- `practice_record` entry created with anonymous user's UUID
- No sync attempts (anonymous mode)

---

### 4. Account Conversion Flow

**Seed:** Complete anonymous sign-in and create test data first

#### 4.1 Conversion Entry Point (Banner Button)
**Steps:**
1. Sign in anonymously
2. Create at least one tune in repertoire
3. Click "Create Account" button on banner
4. Observe redirect

**Expected Results:**
- Redirected to /login?convert=true
- URL contains `?convert=true` parameter

#### 4.2 Conversion UI Display
**Steps:**
1. Sign in anonymously
2. Navigate to /login?convert=true

**Expected Results:**
- Form header: "Backup Your Data"
- Subtext: "Create an account to save and sync your tunes across devices"
- Blue info box: "✨ Your local data will be preserved and start syncing automatically"
- Sign-up form shows (Name, Email, Password fields)
- "Use on this Device Only" button NOT visible
- OAuth buttons NOT visible in conversion mode

#### 4.3 Conversion Success (UUID Preservation)
**Steps:**
1. Sign in anonymously
2. Note the anonymous user UUID
3. Create test data (add tune to repertoire)
4. Navigate to /login?convert=true
5. Fill in conversion form:
   - Name: "Test Converted User"
   - Email: "converted@test.com"
   - Password: "TestPassword123!"
6. Click "Create Account"

**Expected Results:**
- Console log: "🔄 Converting anonymous user to registered account"
- Console log: "✅ Email/password linked to anonymous account"
- Console log: "👤 User ID preserved: [SAME UUID]"
- UUID PRESERVED (same as anonymous user!)
- `auth.users` entry updated: `is_anonymous = false`, email added
- `user_profile` updated with email and name
- Redirected to Practice tab
- Banner no longer visible
- Sync starts automatically

#### 4.4 Data Preserved After Conversion
**Steps:**
1. Complete conversion (Scenario 4.3)
2. Navigate to Repertoire tab
3. Check for test data

**Expected Results:**
- All tunes from anonymous session still visible
- All practice records preserved
- `user_ref` FK still references SAME UUID

#### 4.5 Conversion Validation Errors
**Steps:**
1. Sign in anonymously
2. Navigate to /login?convert=true
3. Try submitting with:
   a. Empty name
   b. Invalid email format
   c. Password < 6 characters

**Expected Results:**
- Each validation shows appropriate error message
- Form not submitted until all fields valid
- Error messages display in red box

---

### 5. Edge Cases

#### 5.1 Double Anonymous Sign-In Attempt
**Steps:**
1. Sign in anonymously
2. Manually navigate to /login
3. Click "Use on this Device Only" again

**Expected Results:**
- Should either redirect to home OR show already signed in state
- No duplicate users created

#### 5.2 Network Failure During Anonymous Sign-In
**Steps:**
1. Clear browser storage
2. Navigate to /login
3. Disable network (DevTools > Network > Offline)
4. Click "Use on this Device Only"

**Expected Results:**
- Error message displayed
- Sign-in fails gracefully
- User can retry when online

#### 5.3 Network Failure During Conversion
**Steps:**
1. Sign in anonymously
2. Create test data
3. Navigate to /login?convert=true
4. Fill in valid form data
5. Disable network
6. Click "Create Account"

**Expected Results:**
- Error message shown
- User remains in anonymous mode
- Local data preserved
- Can retry when online

#### 5.4 Sign In When Anonymous (Switch User)
**Steps:**
1. Sign in anonymously
2. Create test data
3. Navigate to /login (without ?convert=true)
4. Sign in with existing registered account

**Expected Results:**
- Anonymous session ended
- Signed in with new account
- Anonymous user's data remains orphaned in Supabase

#### 5.5 OAuth Conversion (If Supported)
**Steps:**
1. Sign in anonymously
2. Navigate to /login?convert=true
3. Click Google/GitHub OAuth button (if visible)

**Expected Results:**
- If OAuth linking supported: Account linked, UUID preserved
- If not supported: OAuth buttons hidden in conversion mode

---

### 6. Reference Data Sync

**Seed:** Fresh anonymous sign-in

#### 6.1 Genres Available in Dropdowns
**Steps:**
1. Sign in anonymously
2. Navigate to Catalog tab
3. Open Genre filter dropdown

**Expected Results:**
- Genres populated from Supabase
- Console log: "📥 Synced X genres"

#### 6.2 Tune Types Available in Dropdowns
**Steps:**
1. Sign in anonymously
2. Navigate to Catalog tab
3. Open Type filter dropdown

**Expected Results:**
- Tune types populated (Jig, Reel, Hornpipe, etc.)
- Console log: "📥 Synced X tune types"

#### 6.3 Public Tunes in Catalog
**Steps:**
1. Sign in anonymously
2. Navigate to Catalog tab

**Expected Results:**
- Public tunes visible in grid
- Console log: "📥 Synced X public tunes"

---

### 7. Regular Sign-Up Still Works

**Seed:** None (fresh state)

#### 7.1 Normal Sign-Up Flow Unaffected
**Steps:**
1. Clear all browser storage
2. Navigate to /login
3. Click "Don't have an account? Sign up"
4. Fill in sign-up form normally
5. Create account

**Expected Results:**
- Normal sign-up flow works
- New Supabase user created with `is_anonymous = false`
- No anonymous indicators shown
- Banner never appears

---

### 8. Sign Out Behavior

#### 8.1 Sign Out as Anonymous User
**Steps:**
1. Sign in anonymously
2. Click user menu (avatar/hamburger)
3. Click "Sign Out"

**Expected Results:**
- User signed out
- Redirected to login page
- Local IndexedDB database cleared
- Console log: "🗑️ Cleared local database for anonymous user"

#### 8.2 Sign Out After Conversion
**Steps:**
1. Sign in anonymously
2. Convert to registered account
3. Sign out
4. Sign in again with email/password

**Expected Results:**
- Data syncs down from Supabase
- All converted data restored
- UUID preserved throughout

---

## Success Criteria

✅ Users can sign in anonymously with one click  
✅ Anonymous sign-in creates real Supabase user with `is_anonymous = true`  
✅ Anonymous users can use all app features (Practice, Repertoire, Catalog)  
✅ Blue banner appears for anonymous users (with dismiss option)  
✅ Conversion uses `updateUser()` to preserve UUID  
✅ **UUID is preserved** during conversion (CRITICAL!)  
✅ All local data FK references remain valid after conversion  
✅ Sync starts automatically after conversion  
✅ Regular sign-up flow still works normally  
✅ Reference data (genres, tune types, public tunes) syncs for anonymous users  
✅ No TypeScript errors  
✅ No console errors (except expected warnings)

---

## Test Environment Requirements

1. **Supabase Local**: Running with anonymous sign-ins enabled
   ```bash
   supabase start
   ```

2. **Development Server**: Running on http://localhost:5173
   ```bash
   npm run dev
   ```

3. **Config Verification**: Check `supabase/config.toml`:
   ```toml
   [auth]
   enable_anonymous_sign_ins = true
   enable_manual_linking = true
   ```

4. **Browser DevTools**: For console log verification and network simulation

---

## Console Logs to Watch

- "🔐 Anonymous sign-in attempt (Supabase native)"
- "✅ Supabase anonymous sign-in successful: [UUID]"
- "✅ Created user_profile for anonymous user: [UUID]"
- "✅ Created local user_profile for anonymous user: [UUID]"
- "✅ [AuthContext] Anonymous mode - local database ready"
- "📥 Synced X genres"
- "📥 Synced X tune types"
- "📥 Synced X public tunes"
- "🔄 Converting anonymous user to registered account"
- "✅ Email/password linked to anonymous account"
- "👤 User ID preserved: [UUID]"
- "✅ user_profile updated with email: [email]"
- "⏳ Starting sync with Supabase for converted user..."

---

## Key Code Locations

| Component | File |
|-----------|------|
| Auth Logic | `src/lib/auth/AuthContext.tsx` |
| Login UI | `src/components/auth/LoginForm.tsx` |
| Banner | `src/components/auth/AnonymousBanner.tsx` |
| Layout Integration | `src/components/layout/MainLayout.tsx` |
| Route Protection | `src/routes/Home.tsx`, `src/routes/Login.tsx` |
| Supabase Config | `supabase/config.toml` |

---

**Last Updated:** November 28, 2025  
**PR:** #287 - Implement anonymous user conversion pattern for frictionless onboarding
