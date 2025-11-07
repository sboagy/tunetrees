# TuneTrees Performance Optimization Guide

**Last Updated:** November 7, 2025  
**Status:** Initial Baseline

---

## Table of Contents

1. [Performance Targets](#performance-targets)
2. [Current Baseline](#current-baseline)
3. [Optimization Strategy](#optimization-strategy)
4. [Implementation Plan](#implementation-plan)
5. [Measurement Tools](#measurement-tools)
6. [Common Issues](#common-issues)

---

## Performance Targets

### Core Web Vitals

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| First Contentful Paint (FCP) | < 1.5s | TBD | 🔄 Pending |
| Largest Contentful Paint (LCP) | < 2.5s | TBD | 🔄 Pending |
| Time to Interactive (TTI) | < 3.0s | TBD | 🔄 Pending |
| Total Blocking Time (TBT) | < 300ms | TBD | 🔄 Pending |
| Cumulative Layout Shift (CLS) | < 0.1 | TBD | 🔄 Pending |
| Speed Index | < 3.0s | TBD | 🔄 Pending |

### Runtime Performance

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Frame Rate | 60 FPS | TBD | 🔄 Pending |
| Main Thread Idle Time | > 50% | TBD | 🔄 Pending |
| JavaScript Execution | < 2s | TBD | 🔄 Pending |
| Memory Usage | < 100 MB | TBD | 🔄 Pending |

### Network Performance

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Bundle Size (JS) | < 500 KB gzipped | 562.86 KB | ⚠️ Exceeds |
| Bundle Size (CSS) | < 50 KB gzipped | 41.85 KB | ✅ Good |
| Total Page Weight | < 2 MB | 5.06 MB precache | ⚠️ High |
| Number of Requests | < 50 | 41 (precache) | ✅ Good |

---

## Current Baseline

### Build Output Analysis (November 7, 2025)

**JavaScript Bundles:**
```
dist/assets/index-e-XTShcu.js          1,975.12 KB │ gzip: 562.86 KB  ⚠️ LARGE
dist/assets/index-CVV2fpJZ.css           225.68 KB │ gzip:  41.85 KB  ✅ OK
dist/assets/avatar-BAv0NwyO.js             7.09 KB │ gzip:   2.95 KB  ✅ OK
dist/assets/workbox-window...js            5.76 KB │ gzip:   2.37 KB  ✅ OK
dist/assets/index-SsijEZPB.js              3.86 KB │ gzip:   1.57 KB  ✅ OK
dist/assets/reset-password...js            2.67 KB │ gzip:   1.16 KB  ✅ OK
... (smaller chunks omitted)
```

**Warning:** Main bundle exceeds Vite's 500 KB threshold

**Static Assets:**
```
sql-wasm.wasm                          1,024 KB (SQLite runtime)
jodit.min.css                            163 KB (Rich text editor)
logo4.png                                475 KB (Branding)
logo3.png                                409 KB (Branding)
logo2.png                                293 KB (Branding)
icon-512x512.png                         207 KB (PWA icon)
logo.png                                 122 KB (Branding)
icon-192x192.png                          44 KB (PWA icon)
```

**Total Precache Size:** 5,058.80 KB (41 files)

### Bundle Composition (Estimated)

**Large Dependencies:**
- `drizzle-orm` (~300 KB) - ORM for SQLite and PostgreSQL
- `@supabase/supabase-js` (~150 KB) - Backend client
- `abcjs` (~200 KB) - Music notation rendering
- `jodit` (~250 KB) - Rich text editor
- `solid-js` (~50 KB) - Framework
- `@tanstack/solid-table` (~100 KB) - Data tables

**Total Estimated:** ~1,050 KB (before other dependencies)

---

## Optimization Strategy

### Phase 1: Quick Wins (High Impact, Low Effort)

#### 1. Enable Brotli Compression on Cloudflare Pages

**Impact:** 15-20% size reduction over gzip

**Implementation:**
- Cloudflare Pages enables Brotli by default
- Verify via Response Headers: `content-encoding: br`
- No code changes needed

**Expected Savings:** 562 KB → ~450 KB (100 KB saved)

#### 2. Optimize Images

**Current Issues:**
- Multiple large logo files (475 KB, 409 KB, 293 KB, 122 KB)
- PNG format (not optimal for photos/complex images)

**Actions:**
```bash
# Install image optimizer
npm install -D @squoosh/cli

# Optimize logos (WebP format, 90% quality)
npx @squoosh/cli --webp auto public/logo*.png

# Generate multiple sizes
npx @squoosh/cli --resize '{width:256}' public/icon-512x512.png
```

**Expected Savings:** 1,300 KB → ~400 KB (900 KB saved)

#### 3. Lazy Load Non-Critical Routes

**Current:** All routes bundled in main chunk

**Implementation:**
```typescript
// src/App.tsx - Before
import Practice from './routes/practice/Index';
import Repertoire from './routes/repertoire';
import Catalog from './routes/catalog';

// After (lazy loading)
const Practice = lazy(() => import('./routes/practice/Index'));
const Repertoire = lazy(() => import('./routes/repertoire'));
const Catalog = lazy(() => import('./routes/catalog');
```

**Expected Savings:** Main bundle -30% (~500 KB → 350 KB)

### Phase 2: Medium Impact Optimizations

#### 4. Code Splitting for Large Libraries

**Split abcjs (music notation):**
```typescript
// Only load when viewing tune details
const AbcNotation = lazy(() => import('./components/AbcNotation'));
```

**Split jodit (rich text editor):**
```typescript
// Only load when editing notes/references
const RichTextEditor = lazy(() => import('./components/RichTextEditor'));
```

**Expected Savings:** Main bundle -20% (~150 KB)

#### 5. Tree Shake Drizzle ORM

**Issue:** Both SQLite and PostgreSQL schemas included

**Current:**
```typescript
import { drizzle } from 'drizzle-orm/node-postgres'; // PostgreSQL
import { drizzle } from 'drizzle-orm/sql-js'; // SQLite
```

**Solution:** Create separate builds or use dynamic imports

**Expected Savings:** -100 KB from main bundle

#### 6. Remove Unused Dependencies

**Audit:**
```bash
npm install -g depcheck
depcheck
```

**Likely Candidates:**
- `jodit-react` (we use SolidJS, not React)
- `sonner` (duplicate of `solid-sonner`?)

**Expected Savings:** -50 KB

### Phase 3: Advanced Optimizations

#### 7. Implement Virtual Scrolling

**Issue:** Large tune lists (500+ items) render all rows

**Solution:** Already using `@tanstack/solid-virtual`

**Verify Implementation:**
```typescript
// src/components/grids/TunesGrid*.tsx
import { createVirtualizer } from '@tanstack/solid-virtual';

const virtualizer = createVirtualizer({
  count: data().length,
  getScrollElement: () => scrollRef,
  estimateSize: () => 48, // Row height
});
```

**Expected Improvement:** Smooth 60 FPS scrolling with 1000+ rows

#### 8. Debounce and Throttle Expensive Operations

**Candidates:**
- Search filtering (debounce 300ms)
- Sync queue polling (throttle to 5s, already implemented)
- Window resize handlers (throttle 100ms)

#### 9. Optimize SQL Queries

**Use Drizzle's prepared statements:**
```typescript
// Before (dynamic query each time)
const tunes = await db.select().from(tunesTable).where(eq(tunesTable.userId, userId));

// After (prepared statement)
const getTunesForUser = db.select()
  .from(tunesTable)
  .where(eq(tunesTable.userId, sql.placeholder('userId')))
  .prepare();

const tunes = await getTunesForUser.execute({ userId });
```

**Expected Improvement:** 20-30% faster queries

#### 10. Preload Critical Resources

**Add to index.html:**
```html
<!-- Preload WASM -->
<link rel="preload" href="/sql-wasm/sql-wasm.wasm" as="fetch" crossorigin>

<!-- Preload critical fonts -->
<link rel="preload" href="/fonts/inter-var.woff2" as="font" type="font/woff2" crossorigin>

<!-- Preconnect to Supabase -->
<link rel="preconnect" href="https://your-project.supabase.co">
```

**Expected Improvement:** 200-500ms faster initial load

---

## Implementation Plan

### Sprint 1: Baseline Collection (Week 1)

**Goal:** Establish performance baseline with Lighthouse

**Tasks:**
1. Set up Lighthouse CI in GitHub Actions
2. Run audits on staging environment
3. Document baseline scores (FCP, LCP, TTI, TBT, CLS)
4. Test on target devices (Moto G4, iPhone 12 Mini)
5. Record frame rates during interactions
6. Measure initial load time (3G throttled)

**Deliverables:**
- Lighthouse reports (HTML + JSON)
- Performance baseline spreadsheet
- Device-specific recordings

### Sprint 2: Quick Wins (Week 2)

**Goal:** Implement high-impact, low-effort optimizations

**Tasks:**
1. Enable Brotli (verify Cloudflare config)
2. Optimize images (WebP conversion, resizing)
3. Implement lazy loading for routes
4. Remove unused dependencies
5. Re-run Lighthouse audits
6. Compare before/after metrics

**Success Criteria:**
- Main bundle < 450 KB gzipped
- Total page weight < 2 MB
- FCP < 1.5s (3G)

### Sprint 3: Code Splitting (Week 3)

**Goal:** Split large libraries into separate chunks

**Tasks:**
1. Lazy load abcjs (music notation)
2. Lazy load jodit (rich text editor)
3. Configure Vite manual chunks
4. Test all routes load correctly
5. Verify service worker caches new chunks

**Success Criteria:**
- Main bundle < 350 KB gzipped
- Individual route chunks < 100 KB
- No loading flicker on route navigation

### Sprint 4: Runtime Optimization (Week 4)

**Goal:** Achieve 60 FPS and optimize memory usage

**Tasks:**
1. Profile scroll performance (Chrome DevTools)
2. Optimize virtual scrolling implementation
3. Debounce search and filters
4. Optimize SQL queries (prepared statements)
5. Test on low-end devices

**Success Criteria:**
- 60 FPS scrolling (verified via Performance Monitor)
- No jank during tune list rendering
- Memory usage < 100 MB after 15min session

### Sprint 5: Validation (Week 5)

**Goal:** Validate all targets met on staging

**Tasks:**
1. Deploy optimized build to staging
2. Run full Lighthouse audit suite
3. Test on multiple devices (iOS/Android/Desktop)
4. Verify offline functionality still works
5. Load test with 1000+ tunes
6. Document final performance scores

**Success Criteria:**
- ✅ FCP < 1.5s
- ✅ LCP < 2.5s
- ✅ TTI < 3.0s
- ✅ TBT < 300ms
- ✅ CLS < 0.1
- ✅ 60 FPS interactions

---

## Measurement Tools

### 1. Lighthouse CLI

**Installation:**
```bash
npm install -g lighthouse
```

**Run Audit:**
```bash
# Desktop
lighthouse https://tunetrees-pwa.pages.dev --view

# Mobile (Moto G4 throttled)
lighthouse https://tunetrees-pwa.pages.dev \
  --preset=perf \
  --throttling.cpuSlowdownMultiplier=4 \
  --view
```

**Output:** HTML report + JSON data

### 2. Chrome DevTools Performance

**Record Session:**
1. Open DevTools → Performance tab
2. Click Record (⚫)
3. Perform actions (navigate, scroll, search)
4. Stop recording (⏹)
5. Analyze flame chart for bottlenecks

**Look For:**
- Long tasks (> 50ms) - blocks main thread
- Layout thrashing - repeated style recalculations
- Forced reflows - synchronous layout reads/writes

### 3. Web Vitals Library

**Add to app:**
```typescript
// src/lib/analytics/web-vitals.ts
import { onCLS, onFCP, onLCP, onTTFB } from 'web-vitals';

export function initWebVitals() {
  onCLS(console.log);
  onFCP(console.log);
  onLCP(console.log);
  onTTFB(console.log);
}

// src/index.tsx
import { initWebVitals } from './lib/analytics/web-vitals';
initWebVitals();
```

### 4. Lighthouse CI (GitHub Actions)

**Configuration:**
```json
// lighthouserc.json
{
  "ci": {
    "collect": {
      "numberOfRuns": 3,
      "url": ["https://tunetrees-pwa.pages.dev/"]
    },
    "assert": {
      "assertions": {
        "first-contentful-paint": ["error", { "maxNumericValue": 1500 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "interactive": ["error", { "maxNumericValue": 3000 }],
        "total-blocking-time": ["error", { "maxNumericValue": 300 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }]
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}
```

### 5. Bundle Analyzer

**Add to project:**
```bash
npm install -D rollup-plugin-visualizer
```

**Configure Vite:**
```typescript
// vite.config.ts
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    visualizer({
      open: true,
      gzipSize: true,
      brotliSize: true,
    })
  ]
});
```

**Output:** Interactive HTML treemap of bundle

---

## Common Issues

### Issue 1: Slow Initial Load

**Symptoms:**
- White screen > 3 seconds
- Console shows "Downloading SQLite WASM..."

**Diagnosis:**
- WASM file not cached (1 MB download)
- Service worker not active

**Solutions:**
1. Verify service worker registered: DevTools → Application → Service Workers
2. Check precache: Application → Cache Storage → workbox-precache-*
3. Preload WASM: Add `<link rel="preload" href="/sql-wasm/sql-wasm.wasm">`

### Issue 2: Laggy Scrolling

**Symptoms:**
- Dropped frames during scroll (< 60 FPS)
- Scroll feels janky or stuttery

**Diagnosis:**
- Too many DOM nodes rendered
- Heavy computations in scroll handler
- Missing virtual scrolling

**Solutions:**
1. Enable virtual scrolling for lists > 50 items
2. Use `will-change: transform` on scrollable containers
3. Debounce scroll event handlers
4. Profile with Performance Monitor

### Issue 3: High Memory Usage

**Symptoms:**
- Browser tab crashes on low-end devices
- Memory > 200 MB after 10 minutes

**Diagnosis:**
- Memory leaks (event listeners not cleaned up)
- Too many cached objects in memory
- Large SQLite database in memory

**Solutions:**
1. Clean up SolidJS effects with `onCleanup`
2. Limit cache sizes (LRU cache for queries)
3. Lazy load unused features
4. Profile with Memory tab → Heap Snapshot

### Issue 4: Large Bundle Size

**Symptoms:**
- Build warning: "chunk larger than 500 kB"
- Slow initial page load

**Diagnosis:**
- No code splitting
- Unused dependencies included
- Large libraries not lazy loaded

**Solutions:**
1. Implement route-based code splitting
2. Lazy load heavy libraries (abcjs, jodit)
3. Remove unused dependencies: `npm prune`
4. Configure manual chunks in Vite

---

## References

- [Web.dev Performance](https://web.dev/performance/)
- [Core Web Vitals](https://web.dev/vitals/)
- [Lighthouse Documentation](https://developer.chrome.com/docs/lighthouse/)
- [Vite Performance](https://vite.dev/guide/performance.html)
- [SolidJS Performance](https://www.solidjs.com/guides/rendering#performance)

---

**See Also:**
- [PWA Guide](PWA_GUIDE.md)
- [Deployment Guide](DEPLOYMENT.md)
