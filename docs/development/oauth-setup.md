# OAuth Provider Setup Guide

This guide explains how to configure Google and GitHub OAuth providers for TuneTrees authentication.

## Overview

TuneTrees supports the following authentication methods:
- **Email/Password** - Built-in Supabase auth (enabled by default)
- **Google OAuth** - Sign in with Google account
- **GitHub OAuth** - Sign in with GitHub account
- **Anonymous** - Local-only usage without an account

OAuth providers require configuration in both the provider's developer console and your Supabase project.

## Google OAuth Setup

### 1. Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new project or select an existing one
3. Click **Create Credentials** → **OAuth 2.0 Client ID**
4. Configure the consent screen:
   - Application name: TuneTrees
   - User support email: your email
   - Authorized domains: your domain (e.g., `tunetrees.com`)
5. Create OAuth client ID:
   - Application type: **Web application**
   - Name: TuneTrees
   - Authorized JavaScript origins:
     - `http://localhost:5173` (for local dev)
     - `https://tunetrees.com` (for production)
   - Authorized redirect URIs:
     - `http://localhost:54321/auth/v1/callback` (for local Supabase)
     - `https://[your-project-ref].supabase.co/auth/v1/callback` (for production)
6. Copy the **Client ID** and **Client Secret**

### 2. Configure Environment Variables

Add to your `.env.local` or `.env` file:

```env
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=your-google-client-secret
```

### 3. Enable in Supabase Dashboard (Production)

For production deployments using hosted Supabase:

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Navigate to **Authentication** → **Providers**
3. Enable **Google** provider
4. Paste your Client ID and Client Secret
5. Save changes

For local development using `supabase start`, the configuration in `supabase/config.toml` is used instead.

---

## GitHub OAuth Setup

### 1. Create GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Fill in the application details:
   - Application name: TuneTrees
   - Homepage URL: `https://tunetrees.com` (or your domain)
   - Authorization callback URL:
     - Local dev: `http://localhost:54321/auth/v1/callback`
     - Production: `https://[your-project-ref].supabase.co/auth/v1/callback`
4. Click **Register application**
5. Generate a new client secret
6. Copy the **Client ID** and **Client Secret**

### 2. Configure Environment Variables

Add to your `.env.local` or `.env` file:

```env
SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID=your-github-client-id
SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET=your-github-client-secret
```

### 3. Enable in Supabase Dashboard (Production)

For production deployments:

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Navigate to **Authentication** → **Providers**
3. Enable **GitHub** provider
4. Paste your Client ID and Client Secret
5. Save changes

---

## Local Development with Supabase CLI

When using `supabase start` for local development:

1. OAuth configuration is read from `supabase/config.toml`
2. The config file uses environment variable substitution:
   ```toml
   [auth.external.google]
   enabled = true
   client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"
   secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"
   ```
3. Ensure your `.env` or `.env.local` file contains the credentials
4. Restart Supabase: `supabase stop && supabase start`

### Local OAuth Callback URLs

For local development, use:
- **Google**: `http://localhost:54321/auth/v1/callback`
- **GitHub**: `http://localhost:54321/auth/v1/callback`

Where `54321` is the default Supabase API port (configured in `supabase/config.toml`).

---

## Production Deployment

### Environment Variables

Set these in your deployment environment (e.g., Cloudflare Pages, Vercel, etc.):

```env
# These are only needed for local Supabase development
# Production uses Supabase Dashboard configuration instead
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=your-production-google-client-id
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=your-production-google-client-secret
SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID=your-production-github-client-id
SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET=your-production-github-client-secret
```

### Production Callback URLs

Update your OAuth app configurations with production URLs:

**Google Cloud Console:**
- Authorized redirect URI: `https://[your-project-ref].supabase.co/auth/v1/callback`

**GitHub OAuth App:**
- Authorization callback URL: `https://[your-project-ref].supabase.co/auth/v1/callback`

---

## Testing OAuth Flow

### Local Development

1. Start Supabase: `npx supabase start`
2. Start dev server: `npm run dev`
3. Navigate to `http://localhost:5173/login`
4. Click "Continue with Google" or "Continue with GitHub"
5. Complete OAuth flow in popup/redirect
6. Verify successful login and redirect to practice page

### Manual Browser Test

```bash
# 1. Ensure environment variables are set
cat .env.local | grep GOOGLE
cat .env.local | grep GITHUB

# 2. Restart Supabase to pick up new config
supabase stop
supabase start

# 3. Start dev server
npm run dev

# 4. Open browser to http://localhost:5173/login
# 5. Test OAuth login flows
```

---

## Troubleshooting

### "Unsupported provider: provider is not enabled"

**Cause:** OAuth provider not configured in Supabase

**Fix:**
1. Ensure `supabase/config.toml` has `enabled = true` for the provider
2. Verify environment variables are set: `echo $SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`
3. Restart Supabase: `supabase stop && supabase start`

### "redirect_uri_mismatch"

**Cause:** Callback URL mismatch between OAuth app and Supabase

**Fix:**
1. Check OAuth app callback URL matches: `http://localhost:54321/auth/v1/callback`
2. For production, use: `https://[your-ref].supabase.co/auth/v1/callback`
3. Update OAuth app settings in Google/GitHub console

### "Invalid OAuth state"

**Cause:** Session/cookie issues or nonce check failing

**Fix:**
1. Clear browser cookies and local storage
2. For local Google auth, you may need `skip_nonce_check = true` in `config.toml`
3. Ensure `site_url` in `config.toml` matches your dev server URL

### OAuth popup blocked

**Cause:** Browser blocking popup window

**Fix:**
1. Allow popups for `localhost:5173`
2. OAuth flow should still work via redirect if popup fails
3. Check browser console for errors

---

## Security Considerations

### Secrets Management

- **Never** commit OAuth secrets to git
- Use environment variable substitution: `secret = "env(VAR_NAME)"`
- Add secrets to `.gitignore` via `.env` files
- For production, use environment variables in hosting platform

### Redirect URI Validation

- Only whitelist trusted redirect URIs
- Use HTTPS for production callback URLs
- Verify `site_url` in Supabase config matches your domain

### OAuth Scopes

Default scopes requested:
- **Google**: `email`, `profile`
- **GitHub**: `user:email`, `read:user`

These are configured by Supabase and provide minimal necessary access.

---

## See Also

- [Supabase Auth Docs](https://supabase.com/docs/guides/auth/social-login)
- [Google OAuth 2.0 Guide](https://developers.google.com/identity/protocols/oauth2)
- [GitHub OAuth Apps Guide](https://docs.github.com/en/developers/apps/building-oauth-apps)
- [TuneTrees Setup Guide](../SETUP.md)
