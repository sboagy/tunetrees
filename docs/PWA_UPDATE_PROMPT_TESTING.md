# PWA Update Prompt - Manual Testing Guide

This guide explains how to test the new PWA update prompt feature.

## Prerequisites

- Two terminal windows
- Access to localhost:4173 (preview server)
- Browser with PWA support (Chrome, Edge, Safari)

## Test Procedure

### Step 1: Build and Deploy Initial Version

```bash
# Terminal 1: Build the current version
npm run build
npm run preview
```

Open browser to http://localhost:4173 and verify the app loads.

### Step 2: Make a Small Change

In a second terminal:

```bash
# Terminal 2: Make a visible change
# Edit any component to add a small change (e.g., change button text)
```

For example, edit `src/routes/Home.tsx` and change some text.

### Step 3: Build the Updated Version

```bash
# Terminal 2: Build the new version
npm run build
```

### Step 4: Verify Update Detection

1. In Terminal 1, stop the preview server (Ctrl+C)
2. Start it again: `npm run preview`
3. In the browser, DO NOT refresh the page manually
4. Open DevTools → Application → Service Workers
5. Click the "Update" button next to the service worker
6. Wait a few seconds

### Expected Results

✅ **Toast notification should appear** with:
- Title: "New version available"
- Description: "Click Update to refresh and get the latest features."
- Two buttons: "Update" and "Dismiss"

✅ **Clicking "Update"**:
- Console log: `[PWA] User clicked Update, reloading...`
- Page reloads automatically
- New version is active
- Your test change is visible

✅ **Clicking "Dismiss"**:
- Console log: `[PWA] User dismissed update prompt`
- Toast disappears
- App continues with old version
- Refresh is required to see new version

## Alternative Test: Hour-Based Update Check

1. Build and start preview server
2. In another terminal, build a new version
3. Stop and restart preview server
4. Wait for the automatic update check (runs every hour)
5. Toast should appear automatically

**Note:** To speed up testing, you can temporarily reduce the interval in `UpdatePrompt.tsx` from `60 * 60 * 1000` to `10 * 1000` (10 seconds).

## Console Logs to Monitor

- `[PWA] Service Worker registered:` - SW registered successfully
- `[PWA] New version available, showing update prompt` - Update detected
- `[PWA] User clicked Update, reloading...` - User accepted update
- `[PWA] User dismissed update prompt` - User dismissed update

## Troubleshooting

### Toast doesn't appear

1. Check DevTools → Console for errors
2. Verify you're running in production mode (not dev)
3. Check DevTools → Application → Service Workers shows "waiting" state
4. Ensure you clicked "Update" in the Service Workers panel

### Update doesn't reload

1. Check browser console for JavaScript errors
2. Verify network connection
3. Try hard refresh (Ctrl+Shift+R)

### Multiple toasts appear

This is a bug - the component should prevent duplicate toasts. File an issue if this occurs.

## Mobile Testing

### Android PWA

1. Install the PWA on Android device
2. Deploy new version to production
3. Open the installed PWA
4. Wait 24-48 hours (or force update check)
5. Toast should appear

### iOS PWA

1. Install the PWA on iOS device
2. Deploy new version to production
3. Open the installed PWA
4. Wait several days (iOS updates are slow)
5. Toast should appear

**Note:** iOS PWA has more restrictive update policies and may take longer to detect updates.

## Success Criteria

- [x] Toast appears when new SW is waiting
- [x] "Update" button triggers reload and activates new SW
- [x] "Dismiss" button hides toast without reloading
- [x] Toast doesn't appear multiple times
- [x] Toast styling matches app theme
- [x] Console logs provide debugging information
- [x] Works in both desktop and mobile browsers

## Code References

- Component: `src/components/pwa/UpdatePrompt.tsx`
- App integration: `src/App.tsx`
- Configuration: `vite.config.ts` (registerType: "prompt")
- Documentation: `docs/PWA_GUIDE.md`
