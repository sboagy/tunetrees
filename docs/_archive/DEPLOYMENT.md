# TuneTrees Deployment Guide

**Last Updated:** October 15, 2025  
**Consolidated from:** CLOUDFLARE_DEPLOYMENT_GUIDE.md, CLOUDFLARE_DEPLOYMENT_SETUP.md, DEPLOYMENT_CHECKLIST.md, DEPLOYMENT_SETUP_SUMMARY.md

---

## Deployment Overview

TuneTrees PWA deploys to **Cloudflare Pages** as a static site with edge caching.

### Architecture

```
User → Cloudflare Pages (Static SolidJS App)
              ↓
        Supabase (Auth + PostgreSQL + Realtime)
```

---

## Prerequisites

- Cloudflare account
- GitHub repository connected to Cloudflare Pages
- Supabase project configured
- Environment variables ready

---

## Cloudflare Pages Setup

### 1. Create Pages Project

1. Log into Cloudflare dashboard
2. Go to Pages
3. Connect GitHub repository
4. Select `tunetrees` repo and `feat/pwa1` branch

### 2. Build Configuration

**Framework preset:** None (Vite)
**Build command:** `npm run build`
**Build output directory:** `dist`
**Root directory:** `/`

### 3. Environment Variables

Add in Cloudflare Pages settings:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Deploy

- Push to `feat/pwa1` branch
- Cloudflare auto-deploys
- Preview URL: `tunetrees-pwa.pages.dev`

---

## Production Deployment Checklist

### Pre-Deployment

- [ ] All tests passing locally (`npm run test:e2e`)
- [ ] TypeScript errors resolved (`npm run typecheck`)
- [ ] Production build succeeds (`npm run build`)
- [ ] Environment variables configured in Cloudflare
- [ ] Supabase production database ready
- [ ] Database schema synchronized (Drizzle migrations applied)

### Deployment

- [ ] Merge to main branch (or configured production branch)
- [ ] Cloudflare auto-deploys
- [ ] Verify deployment succeeded
- [ ] Check production site loads
- [ ] Test authentication flow
- [ ] Test offline functionality (service worker)
- [ ] Verify sync to Supabase works

### Post-Deployment

- [ ] Monitor error logs (Cloudflare dashboard)
- [ ] Check Supabase usage metrics
- [ ] Test on mobile devices
- [ ] Verify PWA install works
- [ ] Check Core Web Vitals (Lighthouse)

---

## Custom Domain Setup

### 1. Add Domain in Cloudflare

1. Pages → Custom Domains
2. Add `tunetrees.app` (or your domain)
3. Configure DNS records (Cloudflare provides instructions)

### 2. Update Supabase Redirect URLs

In Supabase dashboard:
- Authentication → URL Configuration
- Add production domain to allowed redirect URLs

### 3. Update Environment Variables

- No changes needed (VITE_SUPABASE_* stays same)

---

## Rollback Procedure

If deployment fails:

1. Go to Cloudflare Pages → Deployments
2. Find last working deployment
3. Click "Rollback to this deployment"
4. Verify rollback succeeded

---

## Monitoring

### Cloudflare Analytics

- Pages → Analytics
- Monitor page views, bandwidth, requests

### Supabase Monitoring

- Supabase Dashboard → Database → Usage
- Monitor connections, queries, storage

### Error Tracking

- Cloudflare → Pages → Logs
- Check for 404s, 500s, build errors

---

## TODO: Content to Add

- [ ] Extract Cloudflare setup details from CLOUDFLARE_DEPLOYMENT_GUIDE.md
- [ ] Extract deployment checklist from DEPLOYMENT_CHECKLIST.md
- [ ] Add environment-specific configurations
- [ ] Add CI/CD pipeline configuration
- [ ] Add monitoring and alerting setup
- [ ] Add rollback procedures
- [ ] Add performance optimization tips

---

**See Also:**
- [Setup Guide](SETUP.md)
- [Database Migration Guide](DATABASE_MIGRATION.md)
