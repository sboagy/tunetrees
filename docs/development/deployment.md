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

For schema-changing releases, follow the [Supabase Schema Promotion Runbook](schema-promotion.md). Production promotion must apply migrations only after the exact SHA has passed the staging deployment proof gate, and before production Worker/Pages deploy.

## Manual Production Promotion

Use this runbook to promote an already-verified staging build to production. Do not use it to introduce new code: the production deploy must use the exact `main` commit SHA that already passed the staging deploy job.

### Before You Start

- Confirm the `main` branch CI run for the target commit completed successfully, including the staging deploy, staging database refresh, staging smoke tests, and `Create successful staging Deployment record`.
- Treat staging as locked for this SHA while production promotion is running. Do not merge another deploy-bound change until the production workflow finishes or is explicitly abandoned.
- If the release includes Supabase migrations, confirm the schema compatibility review in `AGENTS.md` and [schema-promotion.md](schema-promotion.md) has been done. The production workflow applies migrations before deploying the Worker and Pages.
- Confirm the GitHub `production` environment has `OP_SERVICE_ACCOUNT_TOKEN` and that the 1Password production item values are current.

### Get The Exact SHA

1. Open GitHub → `sboagy/tunetrees` → Actions.
2. Open the successful `CI` run on `main` that deployed staging.
3. Copy the full 40-character commit SHA for that run. Do not use a branch name, short SHA, tag, or "latest main" by memory.
4. In the same CI run, open the `Create successful staging Deployment record` step and confirm it created a `success` status for environment `staging`.

Optional CLI verification:

```sh
DEPLOY_SHA=<40-character-sha>
gh api repos/sboagy/tunetrees/deployments \
  --method GET \
  -F environment=staging \
  -F ref="$DEPLOY_SHA" \
  --jq '.[] | {id, sha, ref, environment}'
```

Then check at least one returned deployment has a successful status:

```sh
DEPLOYMENT_ID=<deployment-id>
gh api repos/sboagy/tunetrees/deployments/"$DEPLOYMENT_ID"/statuses \
  --jq 'map({state, created_at, description})'
```

### Trigger Production

1. Open GitHub → `sboagy/tunetrees` → Actions → `Deploy Production`.
2. Select `Run workflow`.
3. Use branch `main`.
4. Set `deploy_sha` to the exact 40-character SHA that passed staging.
5. Leave `override_staging_check` unchecked.
6. Leave `override_reason` blank.
7. Start the workflow.

Use `override_staging_check` only for an emergency. If it is enabled, `override_reason` is required and the workflow writes an audit entry to the job summary and issue comment.

### What The Workflow Does

In order, the workflow:

1. Validates that `deploy_sha` is exactly 40 hex characters.
2. Verifies a successful GitHub Deployment record for environment `staging` on that exact SHA.
3. Checks out TuneTrees at that exact SHA.
4. Installs app and Worker dependencies.
5. Resolves production secrets from `.env.prod.template` through 1Password.
6. Runs `npm run db:production:schema:push`.
7. Deploys the production Worker.
8. Builds the production Pages bundle.
9. Deploys Cloudflare Pages project `tunetrees-pwa` on branch `main`.
10. Runs production-safe Playwright smoke tests.
11. Writes the result to the GitHub job summary.

The workflow does not copy staging database data, staging R2 objects, or staging schema artifacts into production. Production database changes occur only through committed migrations applied by `db:production:schema:push`.

### After It Finishes

If the workflow succeeds:

- Open `https://tunetrees.com/`.
- Hard refresh or use a clean browser profile if service worker caching looks suspicious.
- Verify login.
- Verify sync reaches the production Worker.
- Verify rhythm playback and the R2-backed media paths that matter for the release.
- Check the workflow summary for the deployed SHA and production URL.

If the workflow fails before Worker/Pages deploy, production code was not promoted. Check the failing migration/preflight step before retrying.

If the workflow fails after Worker deploy but before Pages deploy, production may have a new Worker with the previous Pages bundle. Prefer fixing forward by rerunning the same SHA after resolving the cause. If needed, redeploy the prior known-good Worker.

If the workflow fails after Pages deploy, inspect production manually. Cloudflare Pages can roll back to a previous deployment from the Pages dashboard, but schema migrations are not automatically rolled back. For schema-related failures, follow the recovery guidance in [schema-promotion.md](schema-promotion.md).

## Cloudflare Pages Setup

### 1. Connect Repository

1. Go to Cloudflare Dashboard → Pages
2. Create new project → Connect to Git
3. Select `tunetrees` repository
4. Choose production branch (e.g., `main` or `feat/pwa1`)

### 2. Build Configuration

| Setting                | Value           |
| ---------------------- | --------------- |
| Framework preset       | None            |
| Build command          | `npm run build` |
| Build output directory | `dist`          |
| Root directory         | `/`             |

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

⚠️ **CRITICAL**: The worker MUST have these secrets configured or it will fail with auth/media or CORS errors:

```bash
npx wrangler secret put SUPABASE_JWT_SECRET
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put DATABASE_URL
```

- `SUPABASE_JWT_SECRET`: From Supabase Dashboard → Settings → API → JWT Secret
- `SUPABASE_SERVICE_ROLE_KEY`: From Supabase Dashboard → Settings → API → service_role key
- `DATABASE_URL`: Supabase connection string (use "Session pooler" for Workers)

### Worker Storage Bindings

The note-media upload/view routes require the `TUNETREES_VAULT` R2 binding in
`worker/wrangler.toml`.

Create the configured buckets before deploying if they do not already exist:

```bash
npx wrangler r2 bucket create tunetrees-vault
npx wrangler r2 bucket create tunetrees-vault-preview
npx wrangler r2 bucket create tunetrees-vault-staging
```

### Rhythm Asset R2 Sync

Staging rhythm playback uses a separate public R2 bucket when
`VITE_R2_AUDIO_BASE_URL` points at the staging rhythm asset URL. Keep the bucket
contents in sync from production with the Phase 4 helper:

```bash
npm run r2:rhythm-assets:sync:dry-run
npm run r2:rhythm-assets:sync:apply
```

Defaults:

- source bucket: `tunetrees-rhythm-assets`
- target bucket: `tunetrees-rhythm-assets-staging`
- credentials: `CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, and
  `R2_SECRET_ACCESS_KEY` from `.env.staging.template`

The sync uses Cloudflare R2's S3-compatible API to list source objects, compare
target objects by size and ETag, and copy changed objects server-side without
downloading media through CI. It refuses to run if source and target buckets are
the same.

For a partial test run:

```bash
npm run r2:rhythm-assets:sync:dry-run -- --prefix audio/kits/bodhran/ --limit 5
```

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
