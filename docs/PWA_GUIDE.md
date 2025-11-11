# TuneTrees PWA Guide

**Last Updated:** November 7, 2025  
**Status:** Production Ready

---

## Table of Contents

1. [Overview](#overview)
2. [PWA Features](#pwa-features)
3. [Caching Strategy](#caching-strategy)
4. [Update Handling](#update-handling)
5. [Offline Support](#offline-support)
6. [Performance Targets](#performance-targets)
7. [Installation Guide](#installation-guide)
8. [Troubleshooting](#troubleshooting)

---

## Overview

TuneTrees is a Progressive Web App (PWA) that provides a native app-like experience with:

- **Offline-first architecture**: Works without internet connection
- **Installable**: Add to home screen on mobile and desktop
- **Fast loading**: Sub-3 second initial load time
- **Smooth performance**: 60 FPS interactions
- **Background sync**: Changes sync automatically when online

### Architecture

```
User Device
    ├── Service Worker (offline cache + background sync)
    ├── SQLite WASM (local database)
    └── SolidJS App
            ↓
    Supabase Cloud (PostgreSQL + Auth + Realtime)
```

---

## PWA Features

### 1. Service Worker

**Location:** Auto-generated at `dist/sw.js` during build

**Powered by:** Workbox 7.x via vite-plugin-pwa

**Capabilities:**
- Precaching of static assets (HTML, CSS, JS, WASM, SQL migrations)
- Runtime caching of API requests and images
- Background sync for offline changes
- Automatic updates when new version deployed

**Configuration:** `vite.config.ts`

### 2. Web App Manifest

**Location:** Auto-generated at `dist/manifest.webmanifest`

**Metadata:**
- **Name:** TuneTrees - Music Practice Manager
- **Short Name:** TuneTrees
- **Theme Color:** `#1e3a8a` (blue)
- **Background Color:** `#ffffff` (white)
- **Display Mode:** `standalone` (hides browser UI)
- **Icons:** 192x192 and 512x512 PNG (maskable)

### 3. Offline Indicator

**Component:** `src/components/pwa/OfflineIndicator.tsx`

**States:**
- **Online + Synced**: No indicator (clean UI)
- **Online + Pending**: Blue banner with sync count
- **Offline + No Pending**: Yellow banner
- **Offline + Pending**: Orange banner with pending count

**Update Interval:** Polls sync queue every 5 seconds

---

## Caching Strategy

### Precache Strategy (Build-Time)

**Pattern:** All static assets cached during installation

**Includes:**
```
- HTML, CSS, JavaScript bundles
- Icons and logos
- SQL WASM runtime (sql-wasm.wasm, sql-wasm.js)
- SQLite migration files (*.sql)
- Font files (woff, woff2)
```

**Total Size:** ~5 MB (41 files)

**Update Policy:** Cache-busted on new deployment (automatic version bump)

### Runtime Caching Strategies

#### 1. Supabase API Cache

**Pattern:** `/^https:\/\/.*\.supabase\.co\/.*/i`

**Strategy:** NetworkFirst (try network, fallback to cache)

**Configuration:**
- **Cache Name:** `supabase-api-cache`
- **Max Entries:** 100
- **Max Age:** 24 hours
- **Network Timeout:** 10 seconds

**Rationale:** 
- Fresh data when online
- Stale data better than no data when offline
- 10s timeout prevents long waits on slow connections

#### 2. Image Cache

**Pattern:** `/\.(?:png|jpg|jpeg|svg|gif|webp)$/`

**Strategy:** CacheFirst (serve from cache, update in background)

**Configuration:**
- **Cache Name:** `images-cache`
- **Max Entries:** 100
- **Max Age:** 30 days

**Rationale:**
- Images rarely change (avatars, logos)
- Fast loading from cache
- Periodic updates via max age

#### 3. Navigation Fallback

**Pattern:** All navigation requests

**Strategy:** Serve `index.html` from cache

**Exception:** `/api/*` paths (not cached, fail if offline)

**Rationale:**
- Enables offline SPA routing
- All app routes work offline
- Backend API routes fail gracefully

### Cache Cleanup

**Automatic:** Old caches removed on service worker activation

**Manual:** Users can clear via browser settings or cache management UI (future feature)

---

## Update Handling

### Automatic Update Detection

**Check Interval:** Every 60 minutes (1 hour)

**Trigger:** Service worker checks for new version on activation

### Update Flow

```
1. New version deployed → Service worker detects update
2. New service worker enters "waiting" state
3. onNeedRefresh() callback fires
4. User sees notification: "New version available. Reload to update."
5. User reloads page → New service worker activates
6. App loads with new version
```

### User Experience

**Current (Phase 7):**
- Console log: `[PWA] New version available. Reload to update.`
- Manual reload required

**Future Enhancement (Phase 9):**
- UI toast notification with "Update" button
- One-click update (reload triggered programmatically)
- Optional: Force update after N days

### Developer Workflow

**Development Mode:**
- Service worker disabled (prevents caching issues)
- Any existing service workers unregistered on startup

**Production Mode:**
- Service worker enabled and registered
- Auto-update checks every hour

**Testing Updates:**
1. Build: `npm run build`
2. Preview: `npm run preview`
3. Open DevTools → Application → Service Workers
4. Click "Update" to force check
5. See new version in "waiting" state
6. Reload to activate

---

## Offline Support

### Local-First Data Flow

```
User Action
    ↓
SQLite WASM (immediate write)
    ↓
Sync Queue (enqueue change)
    ↓
[If online] → Supabase (background sync)
    ↓
[If offline] → Queue persisted, synced later
```

### Offline Capabilities

**✅ Fully Functional Offline:**
- Practice sessions (record performances)
- Browse repertoire and catalog
- View practice history
- Edit tune metadata
- Add/remove from playlists
- View ABC notation and notes

**⚠️ Requires Initial Online Session:**
- First login (to download user data to SQLite)
- OAuth authentication (Google, GitHub)
- Initial data sync

**❌ Not Available Offline:**
- Sign up (requires Supabase)
- Password reset (requires Supabase)
- Inviting other users (future feature)

### Sync Resolution

**Conflict Strategy:** Last-write-wins (future: user prompt for manual resolution)

**Sync Triggers:**
- Automatic: Online status change
- Automatic: Periodic check (every 30 seconds when online)
- Manual: Sync button (future enhancement)

**Sync Status:**
- Pending count visible in OfflineIndicator
- Console logs for debugging: `[Sync Engine] ...`

---

## Performance Targets

### Target Metrics

| Metric | Target | Device Class |
|--------|--------|-------------|
| First Contentful Paint (FCP) | < 1.5s | Desktop/Mobile |
| Largest Contentful Paint (LCP) | < 2.5s | Desktop/Mobile |
| Time to Interactive (TTI) | < 3.0s | Desktop/Mobile |
| Total Blocking Time (TBT) | < 300ms | Desktop/Mobile |
| Cumulative Layout Shift (CLS) | < 0.1 | Desktop/Mobile |
| Frame Rate | 60 FPS | Desktop/Mobile |

**Test Conditions:**
- Network: Fast 3G (1.6 Mbps, 150ms RTT)
- Device: Moto G4 (mid-range mobile)
- Connection: Supabase production instance

### Current Performance (Build Analysis)

**Bundle Sizes:**
- **Main Chunk:** 1,975.12 KB (562.86 KB gzipped)
- **CSS:** 225.68 KB (41.85 KB gzipped)
- **Total Precache:** 5,058.80 KB (41 files)

**⚠️ Performance Concerns:**
- Main chunk exceeds 500 KB warning threshold
- Large bundle may impact initial load time
- Code splitting recommended

### Optimization Opportunities

**High Impact:**
1. **Code Splitting**: Split large libraries (abcjs, jodit, drizzle-orm) into separate chunks
2. **Dynamic Imports**: Lazy load route components
3. **Tree Shaking**: Remove unused Drizzle/Supabase code
4. **Image Optimization**: Compress avatars and logos

**Medium Impact:**
1. **Font Subsetting**: Reduce font file sizes
2. **CSS Purging**: Remove unused Tailwind classes
3. **Preloading**: Preload critical fonts and WASM

**Low Impact:**
1. **Compression**: Enable Brotli on Cloudflare Pages
2. **CDN Caching**: Leverage Cloudflare edge cache
3. **HTTP/2 Push**: Push critical resources

---

## Installation Guide

### Desktop (Chrome/Edge)

1. Visit TuneTrees web app
2. Look for install icon in address bar (⊕ or computer icon)
3. Click "Install TuneTrees"
4. App opens in standalone window
5. Access from desktop or Start Menu

**Alternative:**
- Chrome → Settings → More Tools → Create Shortcut → ✓ Open as window

### Mobile (Android/iOS)

#### Android (Chrome)
1. Open TuneTrees in Chrome
2. Tap ⋮ (menu) → "Install app" or "Add to Home Screen"
3. Confirm installation
4. App appears on home screen
5. Opens in fullscreen mode

#### iOS (Safari)
1. Open TuneTrees in Safari
2. Tap Share button (square with arrow)
3. Scroll down → "Add to Home Screen"
4. Edit name if desired → Add
5. App appears on home screen

**Note:** iOS PWA limitations:
- No background sync (iOS restriction)
- Storage quota limits (variable)
- May need to re-login after long inactivity

### Verification

**PWA Installed Successfully:**
- ✅ App opens without browser UI
- ✅ Themed status bar (blue)
- ✅ Works offline
- ✅ Sync indicator appears in top nav

**Troubleshooting Install:**
- Clear browser cache and try again
- Check browser version (Chrome 90+, Safari 15.4+)
- Ensure HTTPS connection (required for PWA)
- Check DevTools → Application → Manifest for errors

---

## Troubleshooting

### Service Worker Issues

**Problem:** App not updating to new version

**Solutions:**
1. Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
2. Clear site data: DevTools → Application → Clear Storage → Clear site data
3. Unregister SW: DevTools → Application → Service Workers → Unregister
4. Close all app tabs and reopen

**Problem:** "An error occurred while fetching the script" in console

**Solutions:**
1. Check network connection
2. Verify service worker file exists: `/sw.js`
3. Check Cloudflare Pages deployment status
4. Disable browser extensions (may block SW)

### Offline Functionality Issues

**Problem:** Changes not syncing when back online

**Solutions:**
1. Check OfflineIndicator shows pending count
2. Open DevTools → Console → Look for `[Sync Engine]` errors
3. Check Supabase connection: DevTools → Network → Filter "supabase"
4. Manually trigger sync (future feature)

**Problem:** "Failed to execute 'transaction' on 'IDBDatabase'" error

**Solutions:**
1. Close other TuneTrees tabs (only one tab should use SQLite)
2. Clear IndexedDB: DevTools → Application → IndexedDB → Delete database
3. Reload app (will re-download data from Supabase)

### Performance Issues

**Problem:** Slow initial load (> 3 seconds)

**Diagnostics:**
1. Run Lighthouse audit: DevTools → Lighthouse → Analyze
2. Check "Performance" tab for bottlenecks
3. Verify WASM and SQL files cached: Application → Cache Storage

**Solutions:**
1. Ensure service worker is active (speeds up repeat visits)
2. Disable browser extensions (ad blockers slow down page load)
3. Check network speed (Fast 3G minimum recommended)

**Problem:** Laggy UI / dropped frames

**Diagnostics:**
1. Open Performance monitor: DevTools → More Tools → Performance Monitor
2. Record interaction: DevTools → Performance → Record → Interact → Stop
3. Look for long tasks (> 50ms)

**Solutions:**
1. Close other apps/tabs (reduce memory pressure)
2. Check device specs (need 2GB RAM minimum)
3. Report issue with device info and screenshot

---

## Development

### Testing PWA Locally

```bash
# Build production version
npm run build

# Preview with service worker enabled
npm run preview

# Open http://localhost:4173
```

**Enable Workbox Debug Logs:**
```bash
VITE_WORKBOX_DEBUG=true npm run build
npm run preview
```

### Lighthouse CI Integration (Future)

```yaml
# .github/workflows/lighthouse.yml
- name: Run Lighthouse CI
  run: |
    npm install -g @lhci/cli
    lhci autorun --config=lighthouserc.json
```

### Service Worker Development

**Skip Waiting (Immediate Update):**
```typescript
// vite.config.ts
VitePWA({
  registerType: "autoUpdate", // or "prompt"
  workbox: {
    skipWaiting: true, // Activate immediately
    clientsClaim: true, // Take control immediately
  }
})
```

**Custom Service Worker:**
```typescript
// src/sw.ts (custom logic)
// vite.config.ts → workbox: { injectManifest: { ... } }
```

---

## Future Enhancements

### Phase 9: Advanced PWA Features

- [ ] Install prompt UI (banner or modal)
- [ ] Update notification toast with "Update Now" button
- [ ] Cache management UI (view/clear caches)
- [ ] Manual sync button in toolbar
- [ ] Push notifications (practice reminders)
- [ ] Periodic background sync (update catalog)

### Phase 10: Performance Optimization

- [ ] Code splitting (reduce main bundle to < 500 KB)
- [ ] Dynamic imports for routes
- [ ] Image optimization pipeline
- [ ] Font subsetting and preloading
- [ ] Lighthouse CI integration
- [ ] Performance budgets in CI

### Phase 11: Multi-Device Sync

- [ ] Conflict resolution UI (user chooses which version)
- [ ] Device management (view/remove trusted devices)
- [ ] Selective sync (sync only selected playlists)
- [ ] Sync status dashboard (per-table sync state)

---

## References

- [PWA Documentation](https://web.dev/progressive-web-apps/)
- [Workbox Documentation](https://developer.chrome.com/docs/workbox/)
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/)
- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)

---

**See Also:**
- [Deployment Guide](DEPLOYMENT.md)
- [Setup Guide](SETUP.md)
- [Database Migration](DATABASE_MIGRATION.md)
