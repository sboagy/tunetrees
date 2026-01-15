# OAuth Authentication Testing Guide

This guide provides manual testing procedures for Google and GitHub OAuth authentication in TuneTrees.

## Prerequisites

Before testing OAuth, ensure:

1. **OAuth credentials configured**: Follow [OAuth Setup Guide](oauth-setup.md)
2. **Environment variables set**: `.env.local` has Google/GitHub client IDs and secrets
3. **Supabase running**: `supabase status` shows all services running
4. **Dev server running**: `npm run dev` at http://localhost:5173

## Test Scenarios

### Scenario 1: Google OAuth Sign In (New User)

**Objective**: Verify Google OAuth creates new user account and syncs data

**Steps**:
1. Navigate to http://localhost:5173/login
2. Click "Continue with Google" button
3. Sign in with Google account (use test account)
4. Authorize TuneTrees app
5. Verify redirect back to TuneTrees
6. Verify user is logged in (email appears in TopNav)
7. Verify initial sync completes (database status shows "Synced")
8. Navigate to Repertoire page
9. Verify can create playlist
10. Sign out

**Expected Results**:
- ✅ OAuth popup/redirect opens
- ✅ Google sign-in completes successfully
- ✅ Redirect to http://localhost:5173/auth/callback
- ✅ Final redirect to http://localhost:5173/practice or /repertoire
- ✅ User email visible in TopNav
- ✅ Database syncs within 5 seconds
- ✅ Can create and view playlists
- ✅ User record created in Supabase auth.users table

**Common Issues**:
- **"Unsupported provider"**: Google provider not enabled in config.toml
- **"redirect_uri_mismatch"**: Callback URL not whitelisted in Google Console
- **Popup blocked**: Allow popups for localhost:5173
- **"Invalid OAuth state"**: Clear cookies and try again

---

### Scenario 2: GitHub OAuth Sign In (New User)

**Objective**: Verify GitHub OAuth creates new user account

**Steps**:
1. Navigate to http://localhost:5173/login
2. Click "Continue with GitHub" button
3. Sign in with GitHub account (use test account)
4. Authorize TuneTrees app
5. Verify redirect back to TuneTrees
6. Verify user is logged in (username/email in TopNav)
7. Verify initial sync completes
8. Sign out

**Expected Results**:
- ✅ GitHub OAuth flow completes
- ✅ User authenticated and redirected
- ✅ Email/username visible in TopNav
- ✅ Database syncs successfully
- ✅ Can use all app features

---

### Scenario 3: Google OAuth Sign In (Existing User)

**Objective**: Verify returning Google OAuth user can sign in

**Steps**:
1. Complete Scenario 1 (new user)
2. Sign out
3. Clear browser cache/cookies
4. Navigate to http://localhost:5173/login
5. Click "Continue with Google"
6. Google should auto-sign in (or require brief re-auth)
7. Verify redirect to app
8. Verify user data persisted (playlists still exist)

**Expected Results**:
- ✅ OAuth completes faster (cached authorization)
- ✅ User data loaded from Supabase
- ✅ Previous playlists/tunes visible
- ✅ Practice history preserved

---

### Scenario 4: OAuth with Anonymous User Conversion

**Objective**: Verify anonymous user can link Google account

**Steps**:
1. Navigate to http://localhost:5173/login
2. Click "Use on this Device Only" (anonymous mode)
3. Create a playlist with some tunes
4. Add practice records
5. Click "Create Account" banner
6. Click "Continue with Google"
7. Complete Google OAuth
8. Verify data preserved after conversion

**Expected Results**:
- ✅ Anonymous user can complete OAuth
- ✅ User ID preserved (UUID stays same)
- ✅ Local playlists/tunes sync to cloud
- ✅ Practice history preserved
- ✅ User can now sign in from other devices

**Note**: This scenario tests the most complex auth flow - anonymous → OAuth conversion.

---

### Scenario 5: Multiple OAuth Providers (Same Email)

**Objective**: Verify user can link multiple providers

**Steps**:
1. Sign in with Google using email: test@example.com
2. Sign out
3. Navigate to login
4. Click "Continue with GitHub" using same email: test@example.com
5. Verify Supabase links accounts (or shows error)

**Expected Results**:
- If email matching enabled: Account linked, same user_id
- If email matching disabled: Error or separate account created
- Check Supabase Dashboard → Authentication → Users to verify

**Note**: Default Supabase behavior links accounts with same email.

---

## Automated Testing Considerations

### Why OAuth E2E is Challenging

OAuth flows involve third-party redirects that are difficult to automate:
- Google/GitHub sign-in pages are on different domains
- CAPTCHA challenges may appear
- OAuth state parameters expire quickly
- Popup windows require special Playwright handling

### Potential E2E Test Approaches

#### Option 1: Mock OAuth Provider (Not Recommended)
- Intercept OAuth requests
- Return fake tokens
- **Pro**: Fast, no external dependencies
- **Con**: Doesn't test real OAuth flow

#### Option 2: Supabase Test Helper Tokens
- Use Supabase admin API to create test sessions
- Skip OAuth flow entirely
- **Pro**: Reliable, tests auth state handling
- **Con**: Doesn't test OAuth integration

#### Option 3: OAuth Test Credentials (Current Approach)
- Use real test Google/GitHub accounts
- Automate browser through OAuth flow
- **Pro**: Tests real integration
- **Con**: Flaky, requires test account maintenance

### Recommended E2E Strategy

For CI/CD, focus on:
1. **Email/password auth** (stable, no external deps)
2. **Anonymous mode** (no auth required)
3. **Manual OAuth testing** (human QA before release)

Example test skeleton:
```typescript
// e2e/tests/auth-oauth.spec.ts (manual test, skip in CI)
import { test, expect } from '@playwright/test';

test.skip('OAuth sign-in with Google', async ({ page }) => {
  // This test requires:
  // 1. OAuth credentials configured
  // 2. Test Google account
  // 3. Manual approval (can't automate CAPTCHA)
  
  await page.goto('http://localhost:5173/login');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  
  // Wait for Google sign-in page
  await page.waitForURL(/accounts\.google\.com/);
  
  // MANUAL: Complete Google sign-in
  // Fill email, password, approve consent
  
  // Wait for redirect back to app
  await page.waitForURL(/localhost:5173/);
  
  // Verify logged in
  await expect(page.getByText(/test@example\.com/)).toBeVisible();
});
```

---

## Troubleshooting

### "Unsupported provider: provider is not enabled"

**Problem**: OAuth provider not configured in Supabase

**Debug Steps**:
1. Check `supabase/config.toml`:
   ```toml
   [auth.external.google]
   enabled = true
   ```
2. Verify environment variables set:
   ```bash
   echo $SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID
   ```
3. Restart Supabase:
   ```bash
   supabase stop && supabase start
   ```
4. Check Supabase logs:
   ```bash
   supabase logs --service auth
   ```

### "redirect_uri_mismatch"

**Problem**: OAuth callback URL doesn't match configured redirect URI

**Debug Steps**:
1. Check error details in browser console
2. Note the redirect_uri in error message
3. Compare with Google Cloud Console → Credentials → OAuth 2.0 Client ID
4. For local dev, should be: `http://localhost:54321/auth/v1/callback`
5. Update Google Console if mismatch
6. Wait 5 minutes for Google to propagate changes

### OAuth popup blocked

**Problem**: Browser blocks OAuth popup window

**Solutions**:
1. Allow popups for `localhost:5173` in browser settings
2. OAuth should fallback to redirect mode if popup fails
3. Check console for error messages
4. Try different browser (Chrome vs Firefox vs Safari)

### "Invalid OAuth state" or "PKCE verification failed"

**Problem**: OAuth state parameter expired or mismatched

**Solutions**:
1. Clear browser cookies: DevTools → Application → Cookies
2. Clear localStorage: `localStorage.clear()`
3. Hard refresh: Ctrl+Shift+R or Cmd+Shift+R
4. Restart dev server: `npm run dev`
5. For Google auth, try `skip_nonce_check = true` in config.toml

### User created but no data synced

**Problem**: OAuth succeeds but Supabase sync fails

**Debug Steps**:
1. Check browser console for sync errors
2. Check Supabase Dashboard → Table Editor → user_profile
3. Verify user_profile row created with correct supabase_user_id
4. Check sync logs in console (enable with VITE_SYNC_DEBUG=true)
5. Manually trigger sync via browser console (development only):
   ```javascript
   // NOTE: This debug function is only available in development builds
   // when the test API is enabled (e.g., in E2E tests)
   await window.__forceSyncDownForTest()
   ```

---

## Monitoring OAuth in Production

### Supabase Dashboard

Monitor OAuth usage:
1. **Authentication** → **Users**: See OAuth provider for each user
2. **Authentication** → **Logs**: View auth events (sign-in, sign-up)
3. **Settings** → **Auth**: Check provider configuration

### Key Metrics to Track

- OAuth sign-in success rate
- OAuth sign-in errors by provider (Google vs GitHub)
- Time to first sync after OAuth
- Anonymous → OAuth conversion rate

### Common Production Issues

1. **OAuth secrets expired**: Rotate secrets in Google/GitHub console
2. **Redirect URI changed**: Update production callback URLs
3. **Rate limiting**: Google/GitHub may throttle OAuth requests
4. **CORS errors**: Check Supabase CORS configuration

---

## Best Practices

### Development

- Use separate OAuth apps for dev/staging/prod
- Never commit OAuth secrets to git
- Test with multiple accounts (Google, GitHub, anonymous)
- Verify email verification flows if enabled

### Testing

- Manual smoke test before each release
- Test on mobile devices (iOS Safari, Android Chrome)
- Test popup vs redirect OAuth flows
- Verify data sync after OAuth sign-in

### Production

- Monitor OAuth error rates
- Set up alerts for auth failures
- Rotate OAuth secrets quarterly
- Keep OAuth apps' authorized domains updated

---

## See Also

- [OAuth Setup Guide](oauth-setup.md) - Configuration instructions
- [Supabase Auth Logs](https://supabase.com/docs/guides/auth) - Official docs
- [E2E Test Guide](../../e2e/README.md) - General testing guidelines
