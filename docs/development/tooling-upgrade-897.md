# Playwright, Cloudflare, and Supabase tooling (#897)

## Adopted versions

Validated on Node 24.22.2 on 2026-11-05:

| Tool | Previous | Adopted |
| --- | --- | --- |
| Playwright | 1.62.1 | 1.65.0 |
| Wrangler (root / Worker) | 4.151.1 / 4.156.1 | 4.158.0 |
| Cloudflare Worker types (both) | 5.20261102.1 | 5.20261106.1 |
| Supabase CLI (npm) | 2.121.0 | 2.122.1 |
| Supabase CLI (CI download / schema preflight) | 2.106.0 / 2.98.2 | 2.122.1 |

Supabase 3 is now available, but its migration is outside this maintenance PR.
The [v2.122.1 release](https://github.com/supabase/cli/releases/tag/v2.122.1)
retains v2.122.0 behavior and introduces the maintained v2 install channel.
Its [v2.122.0 notes](https://github.com/supabase/cli/releases/tag/v2.122.0)
cover config diagnostics, TLS handling, and stack fixes. Revisit v3 separately;
v2 now receives only security and critical functionality fixes.

## Compatibility review

- Reviewed Playwright [1.63](https://github.com/microsoft/playwright/releases/tag/v1.63.0),
  [1.64](https://github.com/microsoft/playwright/releases/tag/v1.64.0),
  [1.64.1](https://github.com/microsoft/playwright/releases/tag/v1.64.1), and
  [1.65](https://github.com/microsoft/playwright/releases/tag/v1.65.0).
  Device screen emulation, class-field initialization, inert-element actionability,
  cookie matching, and accessible-name changes warrant interaction checks.
  Existing page objects and selected desktop/mobile tests need no adaptations.
  Chromium and FFmpeg were installed with the upgraded local Playwright CLI.
  CI already invokes that CLI after installation and keys browser caches by
  `package-lock.json`; no Playwright installer pin needs changing.
- [Wrangler 4.158.0](https://github.com/cloudflare/workers-sdk/releases/tag/wrangler%404.158.0)
  updates Miniflare/workerd and bundled security dependencies. Root and Worker
  now use the same Wrangler and Worker types. Existing compatibility date,
  bindings, deployment targets, and secret-loading behavior remain unchanged.
- Supabase CI downloads and Docker image cache keys now use 2.122.1. The Linux
  release archive was checked for both `supabase` and `supabase-go`, as required
  by the existing installer. The schema-preflight CLI pin is aligned too;
  application migration execution and target checks are unchanged.
- Installed Rhizome and oosync manifests, plus the adjacent repository manifests,
  were inspected. Rhizome's Supabase JS SDK is independent of the CLI. oosync's
  `@cloudflare/workers-types` development range (`^5.20261028.1`) accepts the
  adopted types; it imposes no consumer peer constraint. Neither package needs
  a change or additional worktree. Their lockfile references are unchanged.
- No schema, query, generated-contract, or browser sync-protocol changes are
  included. Existing deployed app/Worker queries and older PWA bundles retain
  the same schema contract. `ARCHITECTURE.md` remains accurate.

## Validation

Passed:

- Root and Worker `npm ci --ignore-scripts`.
- `npm run typecheck`, `npm run format:check`, `npm run lint`.
- `npm run test:unit`: 71 files, 778 tests.
- `node --test worker/scripts/run-wrangler-dev.test.mjs`: five tests.
- `npm run build:production`, including SQLite WASM asset verification.
- Worker `wrangler deploy --dry-run` from `worker/`; no deployment performed.
- Eight Playwright cases, including auth setup, using Wrangler 4.158.0:

  ```sh
  npm run test:e2e -- \
    e2e/tests/auth-001-signin.spec.ts \
    e2e/tests/sync-001-queue-stable-on-reload.spec.ts \
    e2e/tests/sync-003-fresh-device-uses-synced-queue.spec.ts \
    --project=chromium-auth --project=chromium \
    --project='Mobile Chrome' --workers=1
  ```

- Supabase 2.122.1 reads the existing Rhizome stack's status JSON with the API,
  auth, and database keys expected by CI. In a temporary project and disposable
  local database: `init`, migration dry-run, apply, list, row verification, and
  a second dry-run with no pending migrations all passed. The test database was
  removed afterward. The existing stack has a collation-version mismatch in
  `template1`; the disposable database used `template0` to avoid altering it.

The full Linux CI workflow and a fresh Supabase stack startup were not run
locally. The existing shared stack was not reset. Normal CI and staging smoke
checks remain necessary before production promotion.

Audit snapshot: root full audit has four moderate findings in the existing
`drizzle-kit` / `@esbuild-kit` / `esbuild` chain. Root production-only audit and
both Worker audits have zero findings. Build-time exposure and remediation
remain tracked in #534; this PR introduces no audit overrides.
