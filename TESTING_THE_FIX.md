# Testing the "Failed to fetch" Fix

## Overview
This document provides instructions for manually testing the fix for the "Failed to fetch" error when importing tunes from TheSession.org.

## The Fix
The fix uses different CORS proxy strategies for development vs production:

### Development (Vite Dev Server)
- **Vite proxy** (configured in `vite.config.ts`) proxies `/api/proxy/thesession` requests to TheSession.org
- No separate worker needed for development
- Just run `npm run dev` and the proxy is automatically available

### Production (Cloudflare Pages)
- **Cloudflare Pages Function** (`/functions/api/proxy/thesession.ts`) handles proxy requests
- Deployed automatically with your app (no separate worker deployment)
- Keeps sync functionality separate from import functionality

### Changed Files
- `functions/api/proxy/thesession.ts` - New Cloudflare Pages Function for production proxy
- `vite.config.ts` - Added Vite proxy configuration for development
- `src/lib/import/import-utils.ts` - Updated to use same-origin proxy endpoint
- `.env.example`, `.env.local.example`, `.env.production.example` - Removed `VITE_WORKER_URL` (no longer needed)

## Testing Steps

### Development Testing (Simple!)

#### Step 1: Start the Vite Dev Server
```bash
npm run dev
```

The dev server starts on `http://localhost:5173` with built-in proxy support.

#### Step 2: Test the Import Feature
1. Open browser to `http://localhost:5173`
2. Log in with test credentials (or create a new account)
3. Navigate to the **Catalog** tab
4. Click the **"Add Tune"** button
5. In the dialog, ensure **"Irish Traditional Music"** is selected as the genre
6. In the "URL or Title" field, enter: `Kiss the Maid behind the Barrel`
7. Click the **"Search"** button

#### Expected Results
✅ **Success**: 
- No "Failed to fetch" error appears
- Search results dialog shows multiple tunes with the title
- Clicking on a tune navigates to the tune editor with imported data

❌ **Failure**: 
- Red "Failed to fetch" error message appears (original bug)

### Production Testing

The Cloudflare Pages Function is automatically deployed with your app to Cloudflare Pages. No separate deployment needed.

## Troubleshooting

### "Failed to fetch" error in development
- Make sure you're running `npm run dev` (not just the worker)
- Check browser console for actual error details
- Verify the Network tab shows requests going to `/api/proxy/thesession`
- Check Vite console for proxy logs

### "Connection refused" error
- Make sure the dev server is running on port 5173
- Check that there are no port conflicts

### CORS errors still appearing
- Clear browser cache and reload
- Check browser console for actual error details
- Verify the fetch calls in the Network tab are going to the correct endpoint

## Production Deployment

### Automatic Deployment
When you deploy to Cloudflare Pages, the Pages Function is automatically deployed with your app:

```bash
npm run build
npm run deploy  # Or wrangler pages deploy dist
```

The `/functions` directory is automatically recognized by Cloudflare Pages and deployed as serverless functions.

### Verification
After deployment, test the import feature on the production site to ensure the fix works in production.

## Architecture Comparison

### Old Architecture (What We Fixed)
```
❌ Browser → Direct fetch to thesession.org
   Result: CORS blocked by browser
```

### New Architecture
```
Development:
✅ Browser → Vite proxy (/api/proxy/thesession) → TheSession.org
   No CORS issue (same origin to browser)

Production:
✅ Browser → Pages Function (/api/proxy/thesession) → TheSession.org
   No CORS issue (same origin to browser)
```

## Advantages of This Approach

1. **Simpler Development**: No need to run a separate worker (`wrangler dev`)
2. **Cleaner Architecture**: Import proxy stays with the app, sync worker stays separate
3. **No Environment Variables**: No need for `VITE_WORKER_URL` configuration
4. **Automatic Deployment**: Pages Functions deploy with the app
5. **Same Origin**: No mixed content issues, works in both HTTP (dev) and HTTPS (prod)

## Security Notes

### Security Features (Same as Before)
- Proxy validates that only thesession.org URLs are allowed
- HTTPS-only protocol enforcement
- 10-second timeout prevents hanging connections
- JSON response validation
- No sensitive data transmitted

### Attack Vectors Prevented
- ✅ Subdomain attacks (exact hostname matching)
- ✅ Protocol manipulation (HTTPS-only)
- ✅ Resource exhaustion (timeout)
- ✅ Malformed URLs (validation)
- ✅ Malformed JSON (validation)

## Future Improvements

### Rate Limiting
Add rate limiting to prevent abuse (can be done in Pages Function)

### Caching
Implement caching for frequently accessed tunes (can use Cloudflare KV with Pages Functions)

### IrishTune.info Support
Add support for irishtune.info imports (similar proxy setup)

### Analytics
Track import usage and errors (Cloudflare Analytics)
