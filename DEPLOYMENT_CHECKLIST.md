# TuneTrees PWA - First Deployment Checklist

**Date:** January 12, 2025  
**Target:** Cloudflare Pages  
**Status:** Pre-deployment

---

## Pre-Deployment Checklist

### 1. Environment Setup ✅

- [x] Wrangler CLI installed (`npm install -D wrangler`)
- [x] Deployment scripts added to package.json
- [x] `.env.production.example` created
- [x] `.gitignore` updated for Cloudflare
- [x] **ACTION NEEDED:** Create `.env.production` with real Supabase credentials

### 2. Supabase Configuration 🔑

- [x] **Get Supabase credentials:**
  1. Go to https://supabase.com/dashboard
  2. Select your TuneTrees project
  3. Settings → API
  4. Copy **Project URL** → `VITE_SUPABASE_URL`
  5. Copy **anon public** key → `VITE_SUPABASE_ANON_KEY`
- [x] **Create `.env.production` file:**
  ```bash
  cp .env.production.example .env.production
  # Edit .env.production with real values
  ```

### 3. Pre-Deployment Testing ✅

- [x] **Build locally:**

  ```bash
  npm run build
  ```

  ✅ Build succeeds with no TypeScript errors (fixed Jan 12, 2025)

- [x] **Preview build:**
  ```bash
  npm run preview
  ```
  Open http://localhost:4173 and test:
  - [x] Login works
  - [x] Can view tunes
  - [x] Offline mode works (DevTools → Network → Offline)
  - [x] Service worker registers

### 4. Cloudflare Account Setup 🌐

- [ ] **Create Cloudflare account:**

  - Go to https://dash.cloudflare.com/sign-up
  - Use your email (free tier is fine)
  - Verify email

- [ ] **Choose deployment method:**
  - [ ] **Option A:** GitHub integration (recommended)
  - [ ] **Option B:** CLI deployment (faster for testing)

---

## Deployment Options

### Option A: GitHub Integration (Recommended) 🚀

**Best for:** Continuous deployment, production use

1. [ ] **Connect GitHub to Cloudflare:**

   - https://dash.cloudflare.com/
   - Workers & Pages → Create Application → Pages
   - Connect to Git → Authorize GitHub
   - Select: `sboagy/tunetrees`
   - Branch: `feat/pwa1`

2. [ ] **Configure build settings:**

   ```
   Framework: None (or Vite)
   Build command: npm run build
   Build output directory: dist
   Root directory: /
   Node version: 20.x
   ```

3. [ ] **Add environment variables:**

   - Settings → Environment Variables
   - Add for **Production** and **Preview**:
     - `VITE_SUPABASE_URL` = (your Supabase URL)
     - `VITE_SUPABASE_ANON_KEY` = (your anon key)

4. [ ] **Deploy:**

   - Click "Save and Deploy"
   - Wait 2-5 minutes for build
   - Get URL: `https://tunetrees-pwa.pages.dev`

5. [ ] **Test deployed app:**
   - [ ] Open URL in browser
   - [ ] Login works
   - [ ] Offline mode works
   - [ ] Can install as PWA

---

### Option B: CLI Deployment (Quick Test) ⚡

**Best for:** Quick testing, manual control

1. [x] **Login to Cloudflare:**

   ```bash
   npx wrangler login
   ```

   - Opens browser to authorize
   - Wait for "Successfully logged in" message

2. [x] **Verify `.env.production` exists:**

   ```bash
   cat .env.production
   ```

   Should show your Supabase credentials

3. [x] **Deploy:**

   ```bash
   npm run deploy
   ```

   - First time: Wrangler asks for project name
   - Enter: `tunetrees-pwa`
   - Wait for deployment (1-2 minutes)

4. [x] **Get deployment URL:**

   - Wrangler outputs: `https://tunetrees-pwa.pages.dev`
   - Open in browser

5. [x] **Test deployed app:**
   - [x] Login works
   - [ ] Offline mode works
   - [x] Can install as PWA

---

## Post-Deployment Testing

### Critical Tests 🧪

- [ ] **Authentication:**

  - [ ] Login with email/password
  - [ ] OAuth login (if configured)
  - [ ] Logout works
  - [ ] Session persists on refresh

- [ ] **Offline Mode:**

  - [ ] Open DevTools → Application → Service Workers
  - [ ] Check "Offline" checkbox
  - [ ] Reload page → Should work
  - [ ] Navigate tabs → Should work
  - [ ] Create tune offline → Saves locally

- [ ] **Sync:**

  - [ ] Create tune online → Appears in Supabase
  - [ ] Go offline → Create tune → Go online
  - [ ] Wait 30 seconds → Check Supabase (should sync)
  - [ ] TopNav sync indicator shows status

- [ ] **PWA Installation:**

  - [ ] Chrome: Install icon in address bar
  - [ ] Click install → Opens as app
  - [ ] Safari iOS: Share → Add to Home Screen

- [ ] **Performance:**
  - [ ] Open DevTools → Lighthouse
  - [ ] Run audit
  - [ ] Target: 90+ on all metrics

---

## Troubleshooting Common Issues

### Build Fails

```bash
# Check TypeScript errors
npm run typecheck

# Check for linting issues
npm run check
```

### App Loads But Can't Login

- **Check:** Environment variables set correctly in Cloudflare
- **Fix:** Go to Settings → Environment Variables → Verify URLs

### 404 on Page Refresh

- **Check:** `public/_redirects` file exists
- **Fix:** Should contain `/*    /index.html   200`

### Service Worker Not Working

- **Check:** Deployed URL is HTTPS (Cloudflare provides this)
- **Fix:** Open DevTools → Application → Service Workers → Verify registered

### Sync Not Working

- **Check:** Supabase credentials correct
- **Check:** Browser console for errors
- **Fix:** Verify RLS policies in Supabase allow writes

---

## Rollback Plan (If Needed)

If deployment has critical issues:

1. **Immediate:** Don't panic - old app still running
2. **Investigate:** Check browser console, Cloudflare logs
3. **Fix:** Make changes locally, test, redeploy
4. **If stuck:** Rollback to previous deployment:
   ```bash
   npx wrangler pages deployment list
   # Note previous deployment ID
   # Cloudflare dashboard → Deployments → Rollback
   ```

---

## Next Steps After Successful Deploy

- [ ] **Announce to beta testers:**

  - Share URL: `https://tunetrees-pwa.pages.dev`
  - Request feedback on sync behavior
  - Monitor for errors

- [ ] **Set up monitoring:**

  - Cloudflare Analytics (free)
  - Browser error tracking
  - Sync queue performance

- [ ] **Plan custom domain:**

  - After testing, add `app.tunetrees.com`
  - Cloudflare makes this easy

- [ ] **Update migration plan:**
  - Document any issues found
  - Refine sync behavior
  - Prepare user migration guide

---

## Quick Command Reference

```bash
# Build locally
npm run build

# Preview build
npm run preview

# Deploy to production
npm run deploy

# Deploy preview version
npm run deploy:preview

# Check deployment status
npx wrangler pages deployment list

# View logs
npx wrangler pages deployment tail
```

---

## Support

If you get stuck:

- **Cloudflare Docs:** https://developers.cloudflare.com/pages/
- **Cloudflare Discord:** https://discord.gg/cloudflaredev
- **Deployment Guide:** See `CLOUDFLARE_DEPLOYMENT_GUIDE.md`

---

**Status:** Ready to deploy!  
**Estimated Time:** 30 minutes for first deploy  
**Last Updated:** January 12, 2025
