# Security Policy

## Supported Versions

TuneTrees is currently in active development. Security updates are provided for the latest version on the main branch.

| Version | Supported                           |
| ------- | ----------------------------------- |
| main    | :white_check_mark:                  |
| feat/\* | :construction: Development branches |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability in TuneTrees, please report it privately:

### Preferred Method: GitHub Security Advisories

1. Go to https://github.com/sboagy/tunetrees/security/advisories
2. Click "Report a vulnerability"
3. Fill out the form with details about the vulnerability

### Alternative Method: Email

Contact the maintainer directly at: sboag@users.noreply.github.com

### What to Include

Please include the following information in your report:

- Type of vulnerability (e.g., XSS, SQL injection, authentication bypass)
- Full paths of source file(s) related to the vulnerability
- Location of the affected source code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the vulnerability

## Response Timeline

- **Initial Response**: Within 48 hours of report
- **Status Update**: Within 7 days with assessment of the vulnerability
- **Fix Timeline**: Critical vulnerabilities will be patched within 14 days
- **Disclosure**: After patch is released and users have had time to update

## Security Update Policy

Security patches are released as soon as they are available and announced via:

- GitHub Security Advisories
- Release notes with `[SECURITY]` tag
- Repository notifications

## Recognition

We appreciate the security community's efforts in responsibly disclosing vulnerabilities. With your permission, we will:

- Credit you in the security advisory
- Acknowledge you in release notes
- List you in our security hall of fame (if you wish)

If you prefer to remain anonymous, please let us know in your report.

## Scope

### In Scope

- Authentication and authorization issues
- Data exposure or leaks
- SQL injection vulnerabilities
- Cross-site scripting (XSS)
- Cross-site request forgery (CSRF)
- Server-side request forgery (SSRF)
- Remote code execution
- Privilege escalation

### Out of Scope

- Vulnerabilities in third-party dependencies with no TuneTrees exposure (report upstream; report affected TuneTrees usage here)
- Issues requiring significant social engineering
- Denial of service attacks
- Findings with no demonstrated exposure in TuneTrees runtime, development, build, or CI workflows

## Build Dependency Security Overrides

Dependabot alerts [#251](https://github.com/sboagy/tunetrees/security/dependabot/251)
([CVE-2026-118773](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4)) and
[#252](https://github.com/sboagy/tunetrees/security/dependabot/252)
([CVE-2026-118764](https://github.com/advisories/GHSA-g3hv-75wg-m249)) affect
`glob` and `minimatch` pulled in by `vite-plugin-pwa` → `workbox-build`.
Root overrides require `glob@^14.0.2` and `minimatch@^11.0.1`, including the
older `minimatch` used by Workbox's `ejs` → `jake` → `filelist` dependency chain.
These versions fix cancellation bypass and pattern amplification, respectively.

Remove these overrides once upstream dependencies require patched versions.
When changing them, verify Workbox service-worker generation and FileList glob
expansion: these overrides cross major versions of the upstream requirements.

Dependabot alert [#248](https://github.com/sboagy/tunetrees/security/dependabot/248)
([CVE-2026-93753](https://github.com/advisories/GHSA-gcqx-w48m-w2h4)) affects
`deepmerge@4.3.1`, used through `vite-plugin-pwa` → `workbox-build` →
`@rollup/plugin-node-resolve`. Upstream has no patched release as of November 3,
2026. The root package override replaces this resolver's `deepmerge` with the
exact version `npm:@stackline/deepmerge@1.1.0`, a compatible replacement that
rejects `__proto__` keys, including while cloning target properties. It requires
no installation scripts. Regression coverage is in
`tests/deepmerge-security.test.ts`.

Remove this override when the resolver uses a fixed upstream dependency or no
longer depends on `deepmerge`; rerun the security tests and verify Workbox
service-worker generation when changing the replacement.

## Dependency Audit Policy

Review both lockfiles and both full and production-only dependency graphs for
dependency changes. Development dependencies can execute in builds and CI with
access to source code, credentials, and release artifacts; a clean production
audit does not establish that those workflows are safe.

Run all four commands independently from the repository root using Node 24:

```bash
npm run audit:summary
npm run audit:prod
npm run audit:worker
npm run audit:worker:prod
```

These commands preserve npm's exit status, including failures to contact the
registry. `audit:summary` reports the full root graph and intentionally exits
nonzero while the documented finding below remains. No command silently filters
accepted findings. These are review commands, not an automatically enforced CI
allowlist. The unused `audit-resolve.json` was removed; this document is the
source of truth for deferrals.

New or changed findings require an exposure assessment before merge, including
development and CI execution. Prefer compatible parent upgrades. Do not use
`npm audit fix --force`, downgrade tooling, or add untested major overrides just
to clear the report. Each deferral must identify its dependency path, affected
behavior, mitigation, owner, and revisit condition. An audit service failure is
not a clean result. Preserve script-free installs (`npm ci --ignore-scripts`).

### Reconciled snapshot — November 7, 2026

Reviewed the lockfiles at `674d68faee19ba56536b72d6accd52b566629dcb`
after the dependency upgrades in epic [#903](https://github.com/sboagy/tunetrees/issues/903).

| Graph | Audit result |
| --- | --- |
| Root, all dependencies | 4 moderate package findings, all from the single esbuild advisory below |
| Root, production only | 0 findings |
| Worker, all dependencies | 0 findings |
| Worker, production only | 0 findings |

The four reported packages are `drizzle-kit`, `@esbuild-kit/esm-loader`,
`@esbuild-kit/core-utils`, and its nested `esbuild`; they are not four independent
vulnerabilities. Counts are a dated registry snapshot, not a permanent guarantee.

Earlier findings were reconciled as follows:

- `shadcn-solid` and `valibot` are absent from the current installed graph and
  lockfiles; there is no remaining CLI dependency to remove for #534.
- PWA is now `vite-plugin-pwa@2.0.0` with `workbox-build@7.4.1`. The previously
  affected Workbox paths resolve to `glob@14.0.3`, `minimatch@11.0.4`, and the
  `@stackline/deepmerge@1.1.0` replacement. Their existing overrides remain in
  place; upgrading PWA alone did not resolve those advisories.
- Registry inspection still shows Workbox 7.4.1 requesting `glob@^11.0.1` and
  node-resolve 16.0.3 requesting `deepmerge@^4.2.2`. Retain the targeted fixes
  described above until upstream requirements and a regenerated lockfile remove
  the affected paths. Track [Workbox releases](https://github.com/GoogleChrome/workbox/releases)
  and [Rollup plugin releases](https://github.com/rollup/plugins/releases).
- The former `serialize-javascript` finding is absent from the current audit.
  Existing overrides are not removed solely because the overridden graph audits
  cleanly; removal requires checking the replacement graph and affected tooling.

### Deferred: Drizzle Kit's nested esbuild

- **Advisory:** [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99),
  moderate; esbuild versions through 0.24.2, patched in 0.25.0.
- **Path:** `drizzle-kit@0.31.11` → `@esbuild-kit/esm-loader@2.6.5` →
  `@esbuild-kit/core-utils@3.3.2` → `esbuild@0.18.20`.
- **Exposure:** the advisory concerns esbuild's HTTP serve API permitting
  cross-origin reads, including from malicious websites accessing localhost.
  The inspected core-utils implementation calls `transform`/`transformSync`,
  not the serve API. Repository scripts do not start that nested esbuild server.
  Root Vite/tsx/Wrangler resolve esbuild 0.28.2; Drizzle Kit's direct esbuild is
  0.25.12. This assessment is specific to the nested loader path, not a blanket
  assurance about Drizzle Studio or development tools.
- **Mitigation:** do not use the vulnerable nested package's serve API. Binding
  to localhost alone would not mitigate this advisory. Reassess before adding
  any server workflow using that package, and review build/CI exposure whenever
  the dependency path or advisory changes.
- **Reason for deferral:** the latest stable Drizzle Kit is still 0.31.11 at
  review and still includes the deprecated loader. Core-utils requires esbuild
  `~0.18.20`; forcing a newer major-minor API range is not a validated fix.
  npm's proposed Drizzle Kit 0.18.1 downgrade is not an acceptable remediation.
  Adopting a Drizzle prerelease requires a separate compatibility evaluation.
- **Owner and tracking:** TuneTrees maintainer; reconciliation issue
  [#534](https://github.com/sboagy/tunetrees/issues/534),
  [Drizzle releases](https://github.com/drizzle-team/drizzle-orm/releases), and
  the advisory above. Retain Drizzle Kit while `drizzle.config.sqlite.ts` imports
  it and local schema tooling uses it.
- **Revisit:** at the next Drizzle Kit upgrade or by December 7, 2026, whichever
  comes first; immediately if serve usage, exposure, or advisory severity changes.
  Remove the deferral when a compatible stable parent removes the loader or
  selects patched esbuild, after validating schema tooling/codegen and rerunning
  all four audits. This is a tracked compatibility deferral, not a suppression.

## Additional Information

TuneTrees is a Progressive Web App (PWA) for practicing traditional music using spaced repetition. The application:

- Uses SolidJS for the frontend
- Stores data locally in SQLite WASM
- Syncs with Supabase for cloud backup
- Implements Supabase Auth for authentication

For general questions about security practices, please open a discussion in the repository.
