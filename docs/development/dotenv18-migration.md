# dotenv 18 migration (#901)

Upgrade the root development dependency from 17.4.2 to 18.0.9. The lockfile
changes only dotenv; no application, Worker, schema, or deployment changes
are required. The CI secret-loading architecture remains as documented in
`ARCHITECTURE.md`.

## Usage and compatibility review

- `scripts/bootstrap-ci-env.mjs` uses `parse` for environment templates.
  `e2e/setup/auth.setup.ts` parses templates and injected values and uses
  `config` for the optional local file.
- Playwright configuration, the local preview builder, database maintenance
  scripts, the Worker debug script, and top500 ingestion use `config`.
  Existing environment values win by default. `apply-rls-policies.ts` retains
  its explicit `override: true` behavior.
- No active dotenv vault, decryption, internal-module imports, or preload
  commands were found. The v18 removal of vault support does not affect these
  callers. The new CLI and opt-in fast parser are not adopted.
- The injection message moves from stdout to stderr. Existing quiet callers
  remain quiet; other callers retain their informational logging. No caller
  consumes that message as structured output.
- Rhizome and oosync have no direct dotenv dependency or usage in their local
  sources or the installed packages. The installed root graph contains only
  dotenv 18.0.9; the Worker graph contains none. No shared-library worktree,
  dependency override, or upstream release is required.

References: [upstream changelog](https://github.com/motdotla/dotenv/blob/v18.0.9/CHANGELOG.md)
and [config/parse API](https://github.com/motdotla/dotenv/blob/v18.0.9/README.md).

## Regression coverage

`tests/scripts/dotenv-compatibility.test.ts` checks quoted references, comments,
literal and escaped multiline values, empty/missing values, inherited values,
explicit overrides, and missing optional local files using temporary fixtures.

`tests/scripts/ci-env.test.ts` exercises the actual bootstrap and command runner
with a fake 1Password executable. It covers local, staging, and production
templates, single secret resolution, nested/Worker environment reuse, rejection
of unresolved deployment values, and prevention of later CI secret reads.
No real secrets, production access, or deployment are needed for these tests.

Validation uses Node 24.22.2 and script-free dependency installation. Run
`npm run format:check`, `npm run lint`, `npm run typecheck`, and
`npm run test:unit`; the focused tests are included in the unit suite.

Audit snapshot (2026-11-06): root full audit reports four moderate findings in
the existing drizzle-kit/esbuild chain; root production-only and both Worker
audits report zero. The remaining development-tool exposure is tracked by
#534; this dotenv upgrade does not remediate or dismiss those findings.
