# PWA Testing Guide - TuneTrees

**Date:** October 7, 2025  
**Branch:** `feat/pwa1`  
**Dev Server:** http://localhost:5174/

---

## Prerequisites

- Dev server running: `npm run dev` (port 5174)
- Modern browser: Chrome, Edge, or Safari
- DevTools open (F12 or Cmd+Option+I)

---

## Test 1: Service Worker Registration (Dev Mode)

**Goal:** Verify service worker registers and caches files in development.

### Steps:

1. **Open browser** → `http://localhost:5174/`

2. **Open DevTools** → `Application` tab (Chrome/Edge) or `Storage` tab (Safari)

3. **Navigate to Service Workers section** (left sidebar)

4. **Verify service worker is present:**

   ```
   Status: activated and is running
   Source: /dev-sw.js?dev-sw (dev mode)
   Scope: http://localhost:5174/
   ```

5. **Check browser console** for PWA messages:

   ```
   [PWA] Service worker registered successfully
   [PWA] App ready offline!
   ```

6. **Navigate to Cache Storage** (left sidebar under Application)

7. **Verify caches exist:**
   - `workbox-runtime-http://localhost:5174/` (API responses)
   - `workbox-precache-v2-http://localhost:5174/` (static assets)

**Expected Result:** ✅ Service worker registered, caches populated, console shows success messages

**Troubleshooting:**

- If no service worker: Check console for errors, verify `navigator.serviceWorker` is supported
- If no caches: Wait 5-10 seconds after page load, refresh cache view
- If registration fails: Check `src/index.tsx` service worker registration code

---

## Test 2: Offline Functionality (Cache-First)

**Goal:** Verify app works without network connection.

### Steps:

1. **With dev server running**, load `http://localhost:5174/`

2. **Wait for full page load** (all assets loaded, service worker active)

3. **Open DevTools** → `Network` tab

4. **Enable offline mode:**

   - Chrome/Edge: Check "Offline" checkbox (top of Network tab)
   - Safari: Use Network Link Conditioner (separate app)

5. **Reload the page** (Cmd+R or Ctrl+R)

6. **Verify app loads:**

   - UI renders correctly
   - Static assets load from cache (check Network tab - shows "(disk cache)" or "ServiceWorker")
   - No network errors in console

7. **Test navigation:**
   - Click links within the app
   - Cached routes should load
   - API calls will fail (expected - no Supabase connection)

**Expected Result:** ✅ App UI loads and renders from cache, static navigation works

**Known Limitations:**

- ❌ API calls fail (no offline data sync yet)
- ❌ New routes not in cache won't load
- ❌ No user feedback about offline state

---

## Test 3: Production Build PWA

**Goal:** Test full PWA with production optimizations.

### Steps:

1. **Build production version:**

   ```bash
   npm run build
   ```

2. **Verify build output includes:**

   ```
   dist/sw.js                    # Service worker
   dist/workbox-*.js             # Workbox runtime
   dist/manifest.webmanifest     # PWA manifest
   ```

3. **Serve production build:**

   ```bash
   npm run preview
   # OR
   npx serve dist
   ```

4. **Open browser** → `http://localhost:4173/` (or serve port)

5. **Repeat Test 1 steps** (service worker registration)

   - Should see `/sw.js` instead of `/dev-sw.js`
   - Precache should include ~28 files (3.8 MB)

6. **Repeat Test 2 steps** (offline functionality)

**Expected Result:** ✅ Production SW registers, precaches all assets, works offline

---

## Test 4: PWA Installability

**Goal:** Verify app can be installed as PWA.

### Steps:

1. **Use production build** (from Test 3)

2. **Chrome Desktop:**

   - Look for install icon (⊕) in address bar (right side)
   - Click icon → "Install TuneTrees"
   - App opens in standalone window (no browser UI)

3. **Chrome Mobile (Android):**

   - Open `http://your-ip:4173/` on phone (use `npm run preview -- --host`)
   - Browser shows "Add to Home Screen" banner
   - Tap to install → App icon appears on home screen

4. **Safari iOS:**

   - Open app in Safari
   - Tap Share button → "Add to Home Screen"
   - Edit name if desired → Add
   - App icon appears on home screen with custom icon

5. **Verify installed app:**
   - Opens in standalone mode (no browser chrome)
   - Uses theme color (#1e3a8a blue)
   - Shows app name "TuneTrees"
   - Uses custom icons (192x192 or 512x512)

**Expected Result:** ✅ App installs, runs standalone, uses manifest settings

**Troubleshooting:**

- No install prompt: Check HTTPS (localhost is exempt, but production needs SSL)
- Wrong icon: Verify `public/icon-*.png` files exist and are referenced in manifest
- Wrong name: Check `vite.config.ts` → VitePWA → manifest → name/short_name

---

## Test 5: Caching Strategies

**Goal:** Verify different cache strategies work correctly.

### Steps:

1. **NetworkFirst (API calls):**

   - Open DevTools → Network tab
   - Load page, perform action that calls Supabase API
   - **Online:** Should show network request (status 200)
   - **Offline:** Should serve from cache if previously fetched (within 24hrs)
   - Check `Cache Storage` → `workbox-runtime-*` for cached API responses

2. **CacheFirst (Images):**

   - Load page with images (tune covers, logos)
   - Check Network tab → Images show "(from ServiceWorker)" or "(disk cache)"
   - **Offline:** Images should still load from cache

3. **StaleWhileRevalidate (General assets):**
   - Load page multiple times
   - Assets (JS, CSS) serve from cache immediately
   - Network tab shows background requests to update cache

**Expected Result:** ✅ Each strategy behaves as configured

---

## Test 6: Lighthouse PWA Audit

**Goal:** Measure PWA compliance score.

### Steps:

1. **Use production build** (`npm run build && npm run preview`)

2. **Open DevTools** → `Lighthouse` tab

3. **Configure audit:**

   - Mode: Navigation
   - Categories: ✅ Progressive Web App (check only this for focused test)
   - Device: Desktop or Mobile

4. **Click "Analyze page load"**

5. **Review PWA score:**

   - **Target:** ≥ 90/100
   - **Check failures:**
     - "Does not provide a valid apple-touch-icon" (iOS-specific)
     - "Is not configured for a custom splash screen" (optional)
     - "Does not have a maskable icon" (optional enhancement)

6. **Check installability:**
   - ✅ "Web app manifest meets the installability requirements"
   - ✅ "Has a `<meta name='viewport'>` tag with width or initial-scale"
   - ✅ "Configured for a custom splash screen"

**Expected Result:** ✅ PWA score ≥ 90, installable = true

**Common Issues:**

- Score < 90: Check for HTTPS (required for production PWA)
- Not installable: Verify manifest has required fields (name, icons, start_url)
- Apple-touch-icon warning: Add `<link rel="apple-touch-icon" href="/icon-192x192.png">` to `index.html`

---

## Test 7: Service Worker Updates

**Goal:** Verify automatic updates work.

### Steps:

1. **Load app** with service worker registered

2. **Make a code change:**

   - Edit any source file (e.g., change a text label)
   - Save file

3. **Rebuild:**

   ```bash
   npm run build
   npm run preview
   ```

4. **Reload page in browser** (Cmd+R)

5. **Check console:**

   ```
   [PWA] New version available - refresh to update
   ```

6. **Service worker updates automatically** (per `registerType: 'autoUpdate'`)

   - Or triggers update check every hour (3600000ms interval)

7. **Hard refresh** (Cmd+Shift+R) to activate new service worker

**Expected Result:** ✅ New version detected, service worker updates automatically

---

## Known Limitations (Phase 7 Remaining Work)

### ❌ Missing Features:

1. **No Offline Indicator:**

   - Users don't see offline/online status
   - No visual feedback when network is unavailable
   - **Fix:** Implement `OfflineIndicator` component (Task 2)

2. **No Install Prompt:**

   - App is installable, but no custom UI to prompt users
   - Relies on browser's default prompt (often hidden)
   - **Fix:** Implement `InstallPrompt` component (Task 3)

3. **No Background Sync:**

   - Offline changes don't sync when connection returns
   - `sync_queue` table not processed by service worker
   - **Fix:** Implement background sync API (Phase 7 Task 4)

4. **No Update Notifications:**

   - Service worker updates silently
   - Users don't know new version is available
   - **Fix:** Implement update UI with "Reload" button (Task 6)

5. **No Cache Management:**

   - Can't view cache size or clear manually
   - No quota warnings
   - **Fix:** Implement cache management UI (Task 5)

6. **Limited Offline Data:**
   - Only caches API responses fetched while online
   - No proactive caching of user's playlists/tunes
   - **Fix:** Implement selective precaching strategy

---

## Quick Test Checklist

Use this checklist for rapid verification:

```
Production Build:
[ ] npm run build succeeds
[ ] dist/sw.js exists
[ ] dist/manifest.webmanifest exists
[ ] Build precaches ~28 files

Service Worker:
[ ] SW registers in DevTools → Application → Service Workers
[ ] Status shows "activated and running"
[ ] Console logs "[PWA] App ready offline!"

Caching:
[ ] Cache Storage shows workbox-* caches
[ ] Static assets cached (JS, CSS, images)
[ ] API responses cached (after first fetch)

Offline:
[ ] App loads with network disabled
[ ] UI renders correctly from cache
[ ] Navigation works (cached routes)

Installability:
[ ] Install icon appears in browser (Chrome)
[ ] "Add to Home Screen" works (mobile)
[ ] Installed app runs in standalone mode
[ ] Custom icon and theme color applied

Lighthouse:
[ ] PWA score ≥ 90
[ ] "Installable" = true
[ ] No critical PWA failures
```

---

## Troubleshooting Common Issues

### Service Worker Won't Register

**Symptoms:** No SW in DevTools, console shows registration error

**Fixes:**

1. Check `src/index.tsx` - ensure `navigator.serviceWorker` check exists
2. Verify `vite-env.d.ts` has `/// <reference types="vite-plugin-pwa/client" />`
3. Clear browser cache and hard reload (Cmd+Shift+R)
4. Check for JavaScript errors preventing SW registration

### Offline Mode Doesn't Work

**Symptoms:** App shows error page when offline

**Fixes:**

1. Ensure service worker registered BEFORE going offline
2. Wait 10 seconds after page load for caching to complete
3. Check Network tab → Resources should show "(from ServiceWorker)"
4. Verify `workbox-precache` cache exists and has files

### App Not Installable

**Symptoms:** No install prompt, Lighthouse fails installability

**Fixes:**

1. Use HTTPS or localhost (HTTP blocks PWA features)
2. Check `vite.config.ts` → manifest has `name`, `short_name`, `icons`, `start_url`
3. Ensure icons exist: `public/icon-192x192.png` and `public/icon-512x512.png`
4. Add `display: "standalone"` to manifest

### Caches Not Populating

**Symptoms:** Cache Storage empty in DevTools

**Fixes:**

1. Wait 10 seconds after page load, refresh DevTools cache view
2. Check console for Workbox errors
3. Verify `vite.config.ts` → workbox → globPatterns includes your assets
4. Clear all caches and reload: DevTools → Application → Clear storage

---

## Next Steps After Testing

Once basic PWA functionality is verified:

1. **Implement Offline Indicator** (Task 2) - Show network status
2. **Implement Install Prompt** (Task 3) - Custom "Install App" UI
3. **Implement Sync Status** (Task 4) - Show pending sync queue
4. **Run Lighthouse Audit** (Task 7) - Optimize for score ≥ 90
5. **Test on Real Devices** - iOS, Android, different browsers
6. **Implement Background Sync** - Auto-sync when online
7. **Add Update Notifications** - Prompt user to reload for new version

---

**Testing Documentation Complete** ✅
