# Deployment Guide

TuneTrees deploys to **Cloudflare Pages** as a static PWA with an optional **Cloudflare Worker** for sync operations.

## Architecture

```
User → Cloudflare Pages (Static SolidJS PWA)
           │
           ├── Direct: Supabase (Auth, Realtime)
           │
           └── Optional: Cloudflare Worker (Sync API)
                              │
                              └── Supabase PostgreSQL
```

## Prerequisites

- Cloudflare account
- Supabase project with schema deployed
- GitHub repository connected to Cloudflare Pages

## Cloudflare Pages Setup

### 1. Connect Repository

1. Go to Cloudflare Dashboard → Pages
2. Create new project → Connect to Git
3. Select `tunetrees` repository
4. Choose production branch (e.g., `main` or `feat/pwa1`)

### 2. Build Configuration

| Setting | Value |
|---------|-------|
| Framework preset | None |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/` |

### 3. Environment Variables

Add in Cloudflare Pages settings:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_WORKER_URL=https://tunetrees-sync-worker.your-subdomain.workers.dev

# Optional: enable client-side sync diagnostics logging (debug only)
# VITE_SYNC_DIAGNOSTICS=true
```

### 4. Deploy

Push to your production branch. Cloudflare auto-deploys.

## Cloudflare Worker (Optional)

The Worker handles sync operations with better performance and security.

### Worker Setup

```bash
cd worker
npm install
```

### Worker Secrets

⚠️ **CRITICAL**: The worker MUST have these secrets configured or it will fail with CORS errors:

```bash
npx wrangler secret put SUPABASE_JWT_SECRET
npx wrangler secret put DATABASE_URL
```

- `SUPABASE_JWT_SECRET`: From Supabase Dashboard → Settings → API → JWT Secret
- `DATABASE_URL`: Supabase connection string (use "Session pooler" for Workers)

### Worker Diagnostics (Optional)

The sync worker can emit extra diagnostics into the sync response when enabled.

- `SYNC_DIAGNOSTICS=true` enables worker-side `debug[]` lines.
- `SYNC_DIAGNOSTICS_USER_ID=<supabase auth uid>` optionally restricts diagnostics to a single user.

To see these worker diagnostics in your browser console, enable both:

- `VITE_SYNC_DIAGNOSTICS=true` (client)
- `SYNC_DIAGNOSTICS=true` (worker)

**Verify secrets are set**:
```bash
npx wrangler secret list
```

### Deploy Worker

```bash
cd worker
npx wrangler deploy
```

**Test deployment**:
```bash
# Health check
curl https://tunetrees-sync-worker.sboagy.workers.dev/health

# CORS preflight
curl -X OPTIONS \
  -H "Origin: https://tunetrees.com" \
  -H "Access-Control-Request-Method: POST" \
  -v \
  https://tunetrees-sync-worker.sboagy.workers.dev/api/sync
```

See [CORS Troubleshooting](../troubleshooting/cors-sync-worker.md) if you encounter CORS errors.

## Custom Domain

### Pages Domain

1. Cloudflare Dashboard → Pages → Your project → Custom domains
2. Add domain (e.g., `tunetrees.com`)
3. Update DNS to point to Cloudflare

### Worker Domain (Optional)

Workers get a `*.workers.dev` subdomain by default. For custom domain:

1. Add route in `wrangler.toml`
2. Or use Cloudflare dashboard → Workers → Routes

## Deployment Checklist

### Pre-Deployment

- [ ] All tests passing (`npm run test:e2e`)
- [ ] TypeScript compiles (`npm run typecheck`)
- [ ] Build succeeds (`npm run build`)
- [ ] Environment variables set in Cloudflare

### Post-Deployment

- [ ] Site loads at production URL
- [ ] Login works
- [ ] Data syncs correctly
- [ ] PWA installs on mobile

## Rollback

Cloudflare Pages keeps deployment history. To rollback:

1. Go to Pages → Your project → Deployments
2. Find previous working deployment
3. Click "..." → "Rollback to this deploy"

## Monitoring

### Cloudflare Analytics

Pages dashboard shows:
- Request counts
- Bandwidth usage
- Cache hit rates

### Worker Logs

```bash
cd worker
npx wrangler tail
```

Real-time logs from the Worker.

## Branch Deployments

Cloudflare Pages creates preview URLs for each branch:

```
main        → tunetrees.com (production)
feat/xyz    → feat-xyz.tunetrees-pwa.pages.dev (preview)
```

---

For local development setup, see [setup.md](setup.md).
