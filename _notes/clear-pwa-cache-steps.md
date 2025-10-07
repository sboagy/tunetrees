# Clear PWA Cache - Service Worker Update

## Quick Fix (Recommended)

### Chrome/Edge DevTools:

1. **Open DevTools** (F12)
2. **Application tab** → **Service Workers**
3. Click **"Unregister"** next to the old service worker
4. **Application tab** → **Storage** (left sidebar)
5. Click **"Clear site data"** button
6. **Close DevTools**
7. **Hard refresh** (Cmd+Shift+R or Ctrl+Shift+R)

---

## Nuclear Option (If Quick Fix Fails)

### Method 1: Clear Everything in Browser

1. **Close ALL tabs** for localhost:4173
2. **Open DevTools** in a fresh tab → localhost:4173
3. **Application tab** → **Storage**
4. Check ALL boxes:
   - ✅ Application
   - ✅ Cookies
   - ✅ Cache storage
   - ✅ IndexedDB
   - ✅ Local storage
   - ✅ Service workers
5. Click **"Clear site data"**
6. **Close browser completely** (Quit Chrome/Edge)
7. **Reopen browser** → localhost:4173

### Method 2: Use Incognito/Private Window

1. **Close all localhost:4173 tabs**
2. **Open Incognito/Private window** (Cmd+Shift+N)
3. Go to `http://localhost:4173/`
4. Service worker will register fresh with new cache

---

## Verify New Service Worker is Active

After clearing:

1. **Open DevTools** → **Application** → **Service Workers**
2. Should see ONLY ONE entry:
   - Status: **activated and running**
   - Source: `/sw.js`
3. **Application** → **Cache Storage**
4. Expand `workbox-precache-v2-http://localhost:4173/`
5. **Verify these files exist:**
   - ✅ `sql-wasm/sql-wasm.wasm` (657 KB)
   - ✅ `drizzle/migrations/sqlite/0000_lowly_obadiah_stane.sql`
   - ✅ `drizzle/migrations/sqlite/0001_thin_chronomancer.sql`

---

## Test Offline Again

1. **Log in** while ONLINE
2. **Wait for** console message: `✅ Local database initialized`
3. **Network tab** → Check **"Offline"**
4. **Reload page** (Cmd+R)
5. **Expected:** No WASM errors, database loads from cache

---

## Why This Happened

**Service Worker Update Cycle:**

- Browser caches the old service worker aggressively
- New service worker enters "waiting" state
- Won't activate until all tabs using old SW are closed
- Manual intervention (skipWaiting/unregister) forces update

**Prevention:**

- Always use **"Update on reload"** checkbox when developing PWAs
- Or use Incognito mode for testing
- Or close all tabs between rebuilds
