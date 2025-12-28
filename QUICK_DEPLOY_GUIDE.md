# Quick Deployment Guide - CORS Fix

## TL;DR - What You Need to Do

The CORS fix is ready in code but requires deploying the updated worker to production.

## 🚀 Deploy in 3 Steps

### Step 1: Verify Secrets (One-Time Setup)

```bash
cd worker
npx wrangler secret list
```

**Must have**:
- ✅ `SUPABASE_JWT_SECRET`
- ✅ `DATABASE_URL`

**If missing**, add them:
```bash
npx wrangler secret put SUPABASE_JWT_SECRET
# Get from: Supabase Dashboard → Settings → API → JWT Secret

npx wrangler secret put DATABASE_URL
# Get from: Supabase Dashboard → Settings → Database → Session pooler connection string
```

### Step 2: Deploy Worker

```bash
cd worker
npx wrangler deploy
```

Wait for: `✨ Deployment complete!`

### Step 3: Verify Fix

Test health endpoint:
```bash
curl https://tunetrees-sync-worker.sboagy.workers.dev/health
```

Expected: `OK`

Test CORS headers:
```bash
curl -X OPTIONS \
  -H "Origin: https://tunetrees.com" \
  -H "Access-Control-Request-Method: POST" \
  -v \
  https://tunetrees-sync-worker.sboagy.workers.dev/api/sync
```

Expected headers:
```
< Access-Control-Allow-Origin: https://tunetrees.com
< Access-Control-Allow-Methods: GET, POST, OPTIONS
< Access-Control-Allow-Headers: Content-Type, Authorization
< Access-Control-Max-Age: 86400
```

## ✅ Test in Browser

1. Open https://tunetrees.com
2. Sign in
3. Open browser console (F12)
4. Look for sync activity
5. Verify NO CORS errors

## 📊 Monitor Live

Watch worker logs during first sync:
```bash
cd worker
npx wrangler tail
```

Look for:
- `[HTTP] POST /api/sync received` ✅
- `[AUTH] JWT verified successfully` ✅
- `[SYNC] Completed` ✅

## ❌ Troubleshooting

### "Server configuration error"
→ Missing `SUPABASE_JWT_SECRET`  
→ Run: `npx wrangler secret put SUPABASE_JWT_SECRET`

### "Database configuration error"
→ Missing `DATABASE_URL`  
→ Run: `npx wrangler secret put DATABASE_URL`

### CORS errors still appear
→ Clear browser cache or test in incognito mode  
→ Wait 30 seconds for global propagation  
→ Check worker logs: `npx wrangler tail`

## 📖 Full Documentation

- **Detailed Guide**: `CORS_FIX_SUMMARY.md`
- **Troubleshooting**: `docs/troubleshooting/cors-sync-worker.md`
- **Deployment**: `docs/development/deployment.md`

---

**Need Help?** Check `CORS_FIX_SUMMARY.md` for complete details.
