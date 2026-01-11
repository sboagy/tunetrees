# OAuth Setup Checklist

Quick reference for enabling Google and GitHub OAuth in TuneTrees.

## Prerequisites
- [ ] Supabase account created
- [ ] TuneTrees repository cloned
- [ ] Node.js and npm installed

## Step 1: Google OAuth Setup

### Create OAuth Credentials
- [ ] Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
- [ ] Create new project or select existing project
- [ ] Click **Create Credentials** → **OAuth 2.0 Client ID**
- [ ] Configure consent screen (if first time)
- [ ] Choose **Web application** type
- [ ] Add authorized redirect URI:
  - Local: `http://localhost:54321/auth/v1/callback`
  - Production: `https://[your-project-ref].supabase.co/auth/v1/callback`
- [ ] Copy **Client ID** and **Client Secret**

### Configure Environment
- [ ] Add to `.env.local` (create if doesn't exist):
  ```
  SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
  SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=your-client-secret-here
  ```

## Step 2: GitHub OAuth Setup

### Create OAuth App
- [ ] Go to [GitHub Developer Settings](https://github.com/settings/developers)
- [ ] Click **New OAuth App**
- [ ] Fill in application details:
  - Application name: TuneTrees (or your fork name)
  - Homepage URL: `https://tunetrees.com` (or your domain)
  - Authorization callback URL:
    - Local: `http://localhost:54321/auth/v1/callback`
    - Production: `https://[your-project-ref].supabase.co/auth/v1/callback`
- [ ] Click **Register application**
- [ ] Generate new client secret
- [ ] Copy **Client ID** and **Client Secret**

### Configure Environment
- [ ] Add to `.env.local`:
  ```
  SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID=your-github-client-id
  SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET=your-github-client-secret
  ```

## Step 3: Verify Configuration

- [ ] Run verification script:
  ```bash
  node scripts/verify-oauth-config.js
  ```
- [ ] Should show ✓ for all checks (warnings for env vars are OK before adding credentials)

## Step 4: Local Testing

- [ ] Start Supabase:
  ```bash
  npx supabase start
  ```
- [ ] Start dev server:
  ```bash
  npm run dev
  ```
- [ ] Navigate to http://localhost:5173/login
- [ ] Test Google OAuth:
  - [ ] Click "Continue with Google"
  - [ ] Sign in with Google account
  - [ ] Verify redirect back to app
  - [ ] Verify logged in (email in TopNav)
  - [ ] Verify data syncs
- [ ] Test GitHub OAuth:
  - [ ] Sign out
  - [ ] Click "Continue with GitHub"
  - [ ] Sign in with GitHub account
  - [ ] Verify redirect and login works

## Step 5: Production Deployment

### For Hosted Supabase (Recommended)
- [ ] Go to [Supabase Dashboard](https://app.supabase.com)
- [ ] Navigate to Authentication → Providers
- [ ] Enable **Google** provider:
  - [ ] Paste Client ID
  - [ ] Paste Client Secret
  - [ ] Save
- [ ] Enable **GitHub** provider:
  - [ ] Paste Client ID
  - [ ] Paste Client Secret
  - [ ] Save
- [ ] Update OAuth apps with production callback URL:
  - [ ] Google: `https://[your-project-ref].supabase.co/auth/v1/callback`
  - [ ] GitHub: `https://[your-project-ref].supabase.co/auth/v1/callback`

### For Self-Hosted Supabase
- [ ] Ensure `.env` or hosting platform has OAuth credentials set:
  ```
  SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=...
  SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=...
  SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID=...
  SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET=...
  ```
- [ ] Restart Supabase containers to pick up new configuration

## Troubleshooting

### "Unsupported provider: provider is not enabled"
- [ ] Verify `supabase/config.toml` has `enabled = true` for provider
- [ ] Restart Supabase: `npx supabase stop && npx supabase start`
- [ ] Check environment variables are set: `echo $SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`

### "redirect_uri_mismatch"
- [ ] Verify callback URL in OAuth app matches: `http://localhost:54321/auth/v1/callback`
- [ ] Check for typos (http vs https, port number, path)
- [ ] Wait 5 minutes after updating Google OAuth app (propagation delay)

### OAuth popup blocked
- [ ] Allow popups for `localhost:5173` in browser settings
- [ ] OAuth should fallback to redirect if popup blocked

### "Invalid OAuth state"
- [ ] Clear browser cookies and localStorage
- [ ] Hard refresh page (Ctrl+Shift+R)
- [ ] Try different browser

## Documentation

For detailed instructions, see:
- **Setup Guide**: [docs/development/oauth-setup.md](docs/development/oauth-setup.md)
- **Testing Guide**: [docs/development/oauth-testing.md](docs/development/oauth-testing.md)
- **Implementation Summary**: [OAUTH_FIX_SUMMARY.md](OAUTH_FIX_SUMMARY.md)

## Support

If you encounter issues:
1. Check [OAuth Testing Guide](docs/development/oauth-testing.md) troubleshooting section
2. Run verification script: `node scripts/verify-oauth-config.js`
3. Check Supabase logs: `npx supabase logs --service auth`
4. Open issue on GitHub with error details
