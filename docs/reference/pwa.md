# PWA Reference

Detailed technical reference for TuneTrees Progressive Web App implementation.

## Service Worker

### Configuration

Located in `vite.config.ts`:

```typescript
VitePWA({
  registerType: 'prompt',
  includeAssets: ['favicon.ico', 'robots.txt'],
  manifest: {
    name: 'TuneTrees - Music Practice Manager',
    short_name: 'TuneTrees',
    theme_color: '#1e3a8a',
    background_color: '#ffffff',
    display: 'standalone',
    icons: [/* ... */]
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm,sql}'],
    maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB for WASM
  }
})
```

### Caching Strategy

| Resource Type | Strategy | TTL |
|--------------|----------|-----|
| Static assets (JS/CSS) | Precache | Until new version |
| WASM files | Precache | Until new version |
| HTML | Stale-while-revalidate | - |
| API calls | Network-first | - |
| Images | Cache-first | 30 days |

### Update Flow

1. New version deployed to Cloudflare
2. Browser fetches updated service worker
3. New SW installs in background
4. User prompted "New version available"
5. User clicks refresh → new SW activates
6. Page reloads with new version

### Components

**UpdatePrompt:** `src/components/pwa/UpdatePrompt.tsx`
```typescript
// Listens for SW update events, shows toast notification
```

**OfflineIndicator:** `src/components/pwa/OfflineIndicator.tsx`
```typescript
// Shows sync status: online, offline, pending changes
```

## Precache Manifest

Assets precached on install:
- All JavaScript bundles
- All CSS files
- SQLite WASM binary (~8MB)
- SQL migration files
- HTML shell
- Favicons and app icons

Total precache: ~5-6MB

## Workbox Integration

Workbox generates the service worker automatically. Custom routing in `vite.config.ts`:

```typescript
workbox: {
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/.*supabase\.co\/.*$/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'supabase-api',
        expiration: { maxAgeSeconds: 60 * 60 * 24 }
      }
    }
  ]
}
```

## Web App Manifest

Generated at `/manifest.webmanifest`:

```json
{
  "name": "TuneTrees - Music Practice Manager",
  "short_name": "TuneTrees",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#1e3a8a",
  "background_color": "#ffffff",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

## Offline Capabilities

### What Works Offline

- ✅ View all repertoire and catalog
- ✅ Complete practice sessions
- ✅ Rate tunes (evaluations staged locally)
- ✅ Submit practice session (queued for sync)
- ✅ Edit tune metadata

### What Requires Online

- ❌ Initial sign-in
- ❌ Sign up / password reset
- ❌ Real-time collaboration
- ❌ Sharing playlists (planned)

### Offline Detection

```typescript
// Network status hook
const isOnline = () => navigator.onLine;

// Listen for changes
window.addEventListener('online', handleOnline);
window.addEventListener('offline', handleOffline);
```

## Installation Prompts

### iOS (Safari)

No native prompt. Users must:
1. Tap Share button
2. Select "Add to Home Screen"

### Android (Chrome)

Browser shows install prompt automatically when criteria met:
- HTTPS
- Valid manifest
- Service worker registered
- User engagement (2+ visits)

### Desktop (Chrome/Edge)

Install icon appears in address bar. Can be triggered programmatically:

```typescript
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  // Show custom install button
});

// On button click:
deferredPrompt.prompt();
```

## Debugging

### Chrome DevTools

1. Open DevTools → Application
2. Service Workers: View registration, update status
3. Storage: View IndexedDB, Cache Storage
4. Manifest: Validate manifest

### Force Update

```javascript
// In DevTools console
navigator.serviceWorker.getRegistrations().then(regs => {
  regs.forEach(reg => reg.update());
});
```

### Clear All Data

```javascript
// Clear IndexedDB
indexedDB.deleteDatabase('tunetrees-storage');

// Clear caches
caches.keys().then(keys => {
  keys.forEach(key => caches.delete(key));
});

// Unregister service worker
navigator.serviceWorker.getRegistrations().then(regs => {
  regs.forEach(reg => reg.unregister());
});
```

## Performance

### Targets

| Metric | Target |
|--------|--------|
| First Contentful Paint | < 1.5s |
| Time to Interactive | < 3.0s |
| Lighthouse PWA Score | 100 |

### Optimizations

1. **Code splitting** - Vendor chunks cached separately
2. **Precaching** - Critical assets available instantly
3. **Lazy loading** - Routes loaded on demand
4. **WASM streaming** - SQLite loads in parallel

---

For user-facing PWA docs, see [user/getting-started.md](../user/getting-started.md).
