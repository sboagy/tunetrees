# CORS Issues with Sync Worker

## Problem

Browser shows CORS error when syncing:
```
Access to fetch at 'https://tunetrees-sync-worker.sboagy.workers.dev/api/sync' 
from origin 'https://tunetrees.com' has been blocked by CORS policy: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## Root Causes

### 1. Missing Environment Variables

The worker requires `SUPABASE_JWT_SECRET` to be configured. If missing, the worker may fail before it can return proper CORS headers.

**Fix**: Set the secret in Cloudflare Workers:
```bash
cd worker
npx wrangler secret put SUPABASE_JWT_SECRET
# Enter your Supabase JWT secret from: Dashboard → Settings → API → JWT Secret
```

### 2. Missing Database Configuration

The worker needs either `HYPERDRIVE` binding or `DATABASE_URL` environment variable.

**Fix**: Set the database URL:
```bash
cd worker
npx wrangler secret put DATABASE_URL
# Enter your Supabase connection string (use Session pooler URL for Workers)
```

### 3. Worker Not Deployed

If the worker is not deployed to Cloudflare, requests will fail.

**Fix**: Deploy the worker:
```bash
cd worker
npx wrangler deploy
```

### 4. CORS Headers Not Applied to All Responses

Older versions of the worker code didn't apply CORS headers consistently to all error responses.

**Fix**: This was fixed in commit `f7515ca`. Ensure you're using the latest worker code.

## Verification

### Check Worker Status

```bash
cd worker
npx wrangler tail
```

This shows live logs from the worker. You should see:
- `[HTTP] POST /api/sync received` - Worker is receiving requests
- `[AUTH] JWT verified successfully` - Authentication is working
- `[SYNC] Completed` - Sync operations are successful

### Test CORS Preflight

```bash
curl -X OPTIONS \
  -H "Origin: https://tunetrees.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type, Authorization" \
  -v \
  https://tunetrees-sync-worker.sboagy.workers.dev/api/sync
```

Expected response headers:
```
< Access-Control-Allow-Origin: https://tunetrees.com
< Access-Control-Allow-Methods: GET, POST, OPTIONS
< Access-Control-Allow-Headers: Content-Type, Authorization
< Access-Control-Max-Age: 86400
```

### Test Authenticated Sync Request

```bash
# Get a JWT token from the browser console
# (Inspect → Network → any /api/sync request → Request Headers → Authorization)

curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Origin: https://tunetrees.com" \
  -d '{"changes":[],"schemaVersion":1}' \
  -v \
  https://tunetrees-sync-worker.sboagy.workers.dev/api/sync
```

Expected response:
- Status: 200
- Headers include: `Access-Control-Allow-Origin`
- Body: JSON with `{"changes":[],"syncedAt":"..."}`

## Deployment Checklist

After updating worker code:

1. **Deploy Worker**:
   ```bash
   cd worker
   npx wrangler deploy
   ```

2. **Verify Secrets** (one-time setup):
   ```bash
   npx wrangler secret list
   ```
   Should show:
   - `SUPABASE_JWT_SECRET`
   - `DATABASE_URL` (if not using HYPERDRIVE)

3. **Test Health Endpoint**:
   ```bash
   curl https://tunetrees-sync-worker.sboagy.workers.dev/health
   ```
   Should return: `OK`

4. **Monitor Logs** (during first sync):
   ```bash
   npx wrangler tail
   ```

## Common Errors

### "Server configuration error"

**Cause**: `SUPABASE_JWT_SECRET` not set  
**Fix**: Run `npx wrangler secret put SUPABASE_JWT_SECRET`

### "Database configuration error"

**Cause**: Neither `HYPERDRIVE` nor `DATABASE_URL` configured  
**Fix**: Set up HYPERDRIVE binding or set `DATABASE_URL` secret

### "Unauthorized"

**Cause**: JWT verification failed (wrong secret or expired token)  
**Fix**: 
1. Verify `SUPABASE_JWT_SECRET` matches your Supabase project
2. Sign out and sign in again to get a fresh token
3. Check browser console for JWT details

### CORS errors persist after fix

**Cause**: Cached worker version  
**Fix**: 
1. Redeploy: `cd worker && npx wrangler deploy`
2. Clear browser cache (or test in incognito mode)
3. Wait 30 seconds for global propagation

## See Also

- [Deployment Guide](../development/deployment.md)
- [Development Setup](../development/setup.md)
- Worker source: `/worker/src/index.ts`

---

**Last Updated**: 2025-12-28  
**Related Issue**: Blocked by CORS policy (sync worker)
