# GitHub Actions Secret Setup for Playwright Tests

## Required Secret

For Playwright E2E tests to run in CI, you need to set the following GitHub repository secret:

### `ALICE_TEST_PASSWORD`

**Value:** `SomePasswordForTesting`

**Purpose:** Password for the Alice test user in Playwright E2E tests

---

## How to Add the Secret

### Via GitHub Web UI

1. Go to your repository on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `ALICE_TEST_PASSWORD`
5. Secret: `SomePasswordForTesting`
6. Click **Add secret**

### Via GitHub CLI

```bash
gh secret set ALICE_TEST_PASSWORD --body "SomePasswordForTesting"
```

---

## Usage in GitHub Actions Workflow

The secret will be automatically available as an environment variable:

```yaml
- name: Run Playwright tests
  env:
    ALICE_TEST_PASSWORD: ${{ secrets.ALICE_TEST_PASSWORD }}
  run: npx playwright test
```

---

## Local Development

For local development, the password is stored in `.env.local` (gitignored):

```bash
# .env.local
ALICE_TEST_PASSWORD=SomePasswordForTesting
```

Copy `.env.local.example` to `.env.local` if you don't have it yet:

```bash
cp .env.local.example .env.local
```

---

## Security Notes

- ✅ `.env.local` is gitignored and will never be committed
- ✅ The password is for a **local-only test database** (Supabase local)
- ✅ The test users only exist in local development, never in production
- ✅ GitHub secrets are encrypted and only accessible during workflow runs
- ✅ No hardcoded passwords in source code

---

## Related Files

- `e2e/setup/auth.setup.ts` - Uses `process.env.ALICE_TEST_PASSWORD`
- `e2e/tests/auth-001-signin.spec.ts` - Uses `process.env.ALICE_TEST_PASSWORD`
- `.env.local` - Local development (gitignored)
- `.env.local.example` - Template for new developers
