# Cloudflare Pages Deployment Guide

**Project:** TuneTrees SolidJS PWA  
**Target:** Cloudflare Pages (Free Tier)  
**Date:** January 12, 2025

---

## Prerequisites

✅ Cloudflare account (free tier works)  
✅ Supabase project with data migrated  
✅ App builds successfully locally (`npm run build`)  
✅ Wrangler CLI installed (`npm install -D wrangler`)

---

## Quick Deployment (Recommended)

### Option 1: Connect GitHub Repository (Easiest)

This is the **recommended** approach for continuous deployment.

1. **Sign up for Cloudflare**

   - Go to https://dash.cloudflare.com/sign-up
   - Create free account with your email

2. **Create Cloudflare Pages Project**

   - Go to https://dash.cloudflare.com/
   - Click "Workers & Pages" in the sidebar
   - Click "Create Application" → "Pages" → "Connect to Git"
   - Authorize GitHub access
   - Select repository: `sboagy/tunetrees`
   - Select branch: `feat/pwa1` (or `main` after merge)

3. **Configure Build Settings**

   ```
   Framework preset: None (or Vite)
   Build command: npm run build
   Build output directory: dist
   Root directory: /
   Node version: 20.x
   ```

4. **Set Environment Variables**
   In Cloudflare Pages dashboard:

   - Go to Settings → Environment Variables
   - Add these variables (both Production and Preview):
     ```
     VITE_SUPABASE_URL=https://your-project.supabase.co
     VITE_SUPABASE_ANON_KEY=your-anon-key-here
     ```
   - **IMPORTANT:** Get these from your Supabase project dashboard

5. **Deploy**
   - Click "Save and Deploy"
   - Cloudflare will automatically build and deploy
   - Every push to `feat/pwa1` triggers auto-deployment
   - You'll get a URL like: `https://tunetrees-pwa.pages.dev`

---

### Option 2: Manual Deployment via CLI

Use this for quick testing or one-off deployments.

1. **Login to Cloudflare**

   ```bash
   npx wrangler login
   ```

   - Opens browser to authorize
   - Returns to terminal when complete

2. **Create .env.production File**
   Create a file at the root: `.env.production`

   ```bash
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

   - **DO NOT COMMIT THIS FILE** (it's in .gitignore)

3. **Build with Environment Variables**

   ```bash
   npm run build
   ```

   - Vite automatically loads `.env.production` during build
   - Environment variables are embedded in the bundle

4. **Deploy to Cloudflare Pages**

   ```bash
   npm run deploy
   ```

   - First time: Wrangler will ask you to create a new project
   - Project name: `tunetrees-pwa` (or your choice)
   - Subsequent deploys update the existing project

5. **View Deployment**
   - Wrangler will output the deployment URL
   - Example: `https://tunetrees-pwa.pages.dev`
   - Open in browser to test

---

## Environment Variables Setup

### Find Your Supabase Credentials

1. Go to https://supabase.com/dashboard
2. Select your TuneTrees project
3. Go to Settings → API
4. Copy these values:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`

### Add to Cloudflare Pages

**Option A: Via Dashboard (GitHub integration)**

1. Go to your Cloudflare Pages project
2. Settings → Environment Variables
3. Add for **both** Production and Preview environments:
   ```
   VITE_SUPABASE_URL = https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

**Option B: Via wrangler.toml (CLI deployments)**

```toml
[env.production.vars]
VITE_SUPABASE_URL = "https://xxxxx.supabase.co"
VITE_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

⚠️ **IMPORTANT:** Do NOT commit actual keys to git. Use wrangler secrets instead:

```bash
echo "your-supabase-url" | npx wrangler pages secret put VITE_SUPABASE_URL
echo "your-anon-key" | npx wrangler pages secret put VITE_SUPABASE_ANON_KEY
```

---

## Deployment Commands

### Production Deployment

```bash
npm run deploy
```

- Builds app with production optimizations
- Deploys to `https://tunetrees-pwa.pages.dev`
- Uses environment variables from `.env.production` or Cloudflare

### Preview Deployment

```bash
npm run deploy:preview
```

- Creates preview deployment with unique URL
- Useful for testing before production
- Example: `https://abc123.tunetrees-pwa.pages.dev`

### Check Deployment Status

```bash
npx wrangler pages deployment list
```

- Shows recent deployments
- Check build status, URLs, timestamps

---

## Post-Deployment Checklist

After your first deployment:

- [ ] **Test Login**

  - Navigate to `https://your-app.pages.dev`
  - Try logging in with Supabase credentials
  - Verify auth tokens are saved

- [ ] **Test Offline Mode**

  - Open DevTools → Application → Service Workers
  - Check "Offline" checkbox
  - Reload page - should still work
  - Navigate between tabs - should work offline

- [ ] **Test Sync**

  - Create a new tune while online
  - Check Supabase dashboard - should appear
  - Go offline, create another tune
  - Go back online - should sync automatically

- [ ] **Check PWA Install**

  - Chrome: Look for install icon in address bar
  - Safari iOS: Share → Add to Home Screen
  - Should install as standalone app

- [ ] **Verify Environment Variables**
  - Open browser console
  - Check network tab for Supabase API calls
  - Should use correct Supabase project URL

---

## Troubleshooting

### Build Fails with TypeScript Errors

```bash
npm run typecheck
```

Fix all TypeScript errors before deploying.

### Build Succeeds But App Doesn't Load

- Check browser console for errors
- Likely missing environment variables
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set

### Service Worker Not Registering

- Cloudflare Pages requires HTTPS (it provides this automatically)
- Check `dist/registerSW.js` exists in build
- Open DevTools → Application → Service Workers

### 404 Errors on Refresh

- Cloudflare Pages handles SPA routing automatically
- If issues persist, add `_redirects` file:
  ```
  /*    /index.html   200
  ```

### Sync Not Working

- Check browser console for Supabase errors
- Verify environment variables are correct
- Check Supabase RLS policies allow your user to write

### Deployment Hangs or Times Out

- Check your bundle size: `npm run build` should output size
- If > 25 MB, investigate large dependencies
- SQLite WASM + sql.js is ~2MB (acceptable)

---

## Custom Domain Setup (Optional)

After testing on `tunetrees-pwa.pages.dev`, you can add a custom domain:

1. **In Cloudflare Pages Dashboard**

   - Go to your project → Custom Domains
   - Click "Set up a custom domain"
   - Enter your domain (e.g., `app.tunetrees.com`)

2. **If Domain is on Cloudflare**

   - Cloudflare auto-configures DNS
   - HTTPS certificate auto-generated
   - Done!

3. **If Domain is Elsewhere**
   - Add CNAME record:
     ```
     app.tunetrees.com CNAME tunetrees-pwa.pages.dev
     ```
   - Wait for DNS propagation (up to 24 hours)

---

## CI/CD with GitHub Actions (Advanced)

For automated deployments on every push:

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloudflare Pages

on:
  push:
    branches: [feat/pwa1, main]
  pull_request:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      deployments: write

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Run type check
        run: npm run typecheck

      - name: Build
        run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: tunetrees-pwa
          directory: dist
          gitHubToken: ${{ secrets.GITHUB_TOKEN }}
```

Add these secrets to your GitHub repo (Settings → Secrets):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `CLOUDFLARE_API_TOKEN` (from Cloudflare dashboard)
- `CLOUDFLARE_ACCOUNT_ID` (from Cloudflare dashboard)

---

## Cost & Limits (Free Tier)

Cloudflare Pages Free Tier includes:

- ✅ Unlimited bandwidth
- ✅ Unlimited requests
- ✅ 500 builds per month
- ✅ 1 concurrent build
- ✅ Automatic HTTPS
- ✅ DDoS protection
- ✅ Global CDN

**Perfect for TuneTrees!** You won't hit these limits unless you have millions of users.

---

## Next Steps After First Deploy

1. **Beta Testing**

   - Share preview URL with trusted users
   - Collect feedback on sync behavior
   - Monitor Cloudflare Analytics dashboard

2. **Monitoring**

   - Set up Cloudflare Web Analytics (free)
   - Monitor error rates in browser console
   - Track sync queue performance

3. **Migration Plan**

   - Once stable, announce to existing users
   - Provide migration instructions
   - Keep legacy app running during transition

4. **Performance**
   - Run Lighthouse audit on deployed URL
   - Target: 90+ on all metrics
   - Your PWA setup should easily hit this

---

## Support Resources

- **Cloudflare Pages Docs:** https://developers.cloudflare.com/pages/
- **Cloudflare Discord:** https://discord.gg/cloudflaredev
- **Wrangler CLI Docs:** https://developers.cloudflare.com/workers/wrangler/
- **Supabase + Cloudflare Guide:** https://supabase.com/docs/guides/hosting/cloudflare-pages

---

## Quick Reference

### Essential Commands

```bash
# Login to Cloudflare
npx wrangler login

# Deploy to production
npm run deploy

# Deploy preview
npm run deploy:preview

# List deployments
npx wrangler pages deployment list

# View logs (after deployment)
npx wrangler pages deployment tail
```

### URLs You'll Get

- **Production:** `https://tunetrees-pwa.pages.dev`
- **Preview (per commit):** `https://[commit-hash].tunetrees-pwa.pages.dev`
- **Custom domain (optional):** `https://app.tunetrees.com`

---

**Last Updated:** January 12, 2025  
**Status:** Ready for first deployment  
**Estimated Time:** 30 minutes for first deploy, 5 minutes for subsequent deploys
