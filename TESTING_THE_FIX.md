# Testing the "Failed to fetch" Fix

## Overview
This document provides instructions for manually testing the fix for the "Failed to fetch" error when importing tunes from TheSession.org.

## The Fix
The fix adds a CORS proxy endpoint in the Cloudflare Worker that routes requests to TheSession.org, bypassing browser CORS restrictions.

### Changed Files
- `worker/src/index.ts` - Added `/api/proxy/thesession` endpoint
- `src/lib/import/import-utils.ts` - Updated to use proxy endpoint
- `.env.example`, `.env.local.example`, `.env.production.example` - Added `VITE_WORKER_URL`

## Prerequisites
1. Supabase local instance running (`supabase start`)
2. Environment variables configured (copy `.env.local.example` to `.env.local`)

## Testing Steps

### Option 1: Manual Testing (Recommended)

#### Step 1: Start the Cloudflare Worker (Terminal 1)
```bash
cd worker
npm install  # If not already installed
npm run dev
```

The worker should start on `http://localhost:8787`

You should see output like:
```
⎔ Starting local server...
[wrangler:inf] Ready on http://localhost:8787
```

#### Step 2: Set Environment Variable (if needed)
If you don't have a `.env.local` file:
```bash
cd ..  # Back to root
cp .env.local.example .env.local
```

Verify it contains:
```bash
VITE_WORKER_URL=http://localhost:8787
```

#### Step 3: Start the Vite Dev Server (Terminal 2)
```bash
npm run dev
```

The dev server should start on `http://localhost:5173`

#### Step 4: Test the Import Feature
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

### Option 2: Run Both Services Together
Use the combined script (requires `concurrently` package):
```bash
npm run dev:all
```

This starts both the worker and dev server in a single terminal.

### Option 3: Automated E2E Test
Run the Playwright E2E test (requires worker to be running):
```bash
# Terminal 1: Start worker
cd worker && npm run dev

# Terminal 2: Run tests
ENABLE_IMPORT_TESTS=true npx playwright test tune-import-001-thesession
```

Note: E2E tests are skipped by default to avoid external dependencies. Set `ENABLE_IMPORT_TESTS=true` to enable them.

## Troubleshooting

### "Connection refused" error
- Make sure the worker is running on port 8787
- Check that `VITE_WORKER_URL` is set correctly in `.env.local`

### "Invalid URL - only thesession.org is allowed"
- The proxy endpoint validates that only thesession.org URLs are proxied (security feature)
- Make sure you're using the correct TheSession.org URL format

### Worker not starting
- Check that you have the correct Node.js version (v18+)
- Run `npm install` in the `worker` directory
- Check wrangler.toml configuration

### CORS errors still appearing
- Clear browser cache and reload
- Check browser console for actual error details
- Verify the fetch calls in the Network tab are going to `localhost:8787/api/proxy/thesession`

## Production Deployment

### Worker Deployment
1. Deploy the worker to Cloudflare:
   ```bash
   cd worker
   npm run deploy
   ```

2. Set the JWT secret:
   ```bash
   npx wrangler secret put SUPABASE_JWT_SECRET
   ```

3. Update `.env.production` with the deployed worker URL:
   ```bash
   VITE_WORKER_URL=https://tunetrees-pwa.pages.dev
   ```

### Verification
After deployment, test the import feature on the production site to ensure the fix works in production.

## Additional Notes

### Security
- The proxy endpoint validates that only thesession.org URLs are allowed
- The worker adds a User-Agent header to identify TuneTrees requests
- No authentication is required for the proxy endpoint (TheSession.org API is public)

### Performance
- The proxy adds minimal latency (< 100ms typically)
- The worker runs on Cloudflare's edge network for fast response times
- Consider adding caching in the future for frequently accessed tunes

### Future Improvements
- Add rate limiting to prevent abuse
- Implement caching for tune data
- Add support for irishtune.info (currently not implemented)
