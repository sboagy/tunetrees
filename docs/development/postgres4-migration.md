# Postgres.js 4 migration (#900)

## Scope and compatibility

Adopt Postgres.js 4.1.0 in TuneTrees root scripts, the Worker package, and
oosync's generator/Worker dependency. The root and Worker manifests alone are
insufficient: oosync's previous `^3.4.9` dependency installs a nested v3 copy
after the root upgrade. TypeScript path aliases can conceal that runtime split.

This is a driver migration, with no SQL schema, RLS, generated-contract, or
sync-protocol changes. Existing browser bundles and service workers continue
to send the same requests. No expand/contract migration is needed.

The Worker now uses compatibility date `2024-09-23` with `nodejs_compat`.
The previous `2024-04-01` date fails to bundle v4's Node API imports. Check
the Wrangler output for the driver's `src/cf.js` entry and Cloudflare sockets,
and for the absence of a nested postgres 3 implementation.

## Migration review

- v4 delegates parameter typing to Postgres by default. Worker RPCs already
  provide explicit UUID-array, timestamp, and integer casts. Drizzle supplies
  column encoders and its own timestamp/JSON serializers; local integration
  checks cover these together with a non-UTC session timezone.
- No `sql.array()` use was found in the generator, generic Worker or root
  migration/view scripts. Those scripts use tagged queries or `unsafe()`.
- The Worker retains request-scoped connections, `max: 1`, `prepare: false`,
  and explicit close. No global connection cache or pooling change is added.
- v4 rejects rolled-back transactions and use of released transaction clients
  more strictly. The Worker awaits its transaction and uses nested savepoints
  for configured upsert retries. Integration checks cover savepoint recovery,
  rollback of writes and subsequent connection reuse.
- Codegen catalog queries use bound schema-name strings. The drift check with
  v4 produces no generated changes.
- v4.1 also fixes v4.0 connection/cancellation behavior and restores Node 18
  support. TuneTrees validation uses its supported Node 24.22.2 runtime.

Upstream references:
[v4 migration guide](https://github.com/porsager/postgres#upgrading-from-v3),
[v4.1 release notes](https://github.com/porsager/postgres/releases/tag/v4.1.0),
[Cloudflare Node compatibility](https://developers.cloudflare.com/workers/runtime-apis/nodejs/).

## Validation and promotion

TuneTrees pins oosync to merge revision
`b48a3c3a09370bebb201cc0e039bcda1366d2193` from
[oosync PR #70](https://github.com/sboagy/oosync/pull/70), using
`npm_config_ignore_scripts=true npm run deps:oosync:update -- <sha>`.
Clean `npm ci --ignore-scripts` installs succeed at the root and in `worker/`.
The installed root, Worker, and oosync dependency graphs all resolve postgres
4.1.0; no local package overlay or nested v3 dependency remains.

Required checks: oosync typecheck/lint/tests and `npm run test:postgres`;
TuneTrees formatting, lint, typecheck, unit tests, production build, schema
drift check, Worker dry-run bundle, and focused RPC/genre and fresh-device sync
Playwright cases. Local Worker tests do not certify the remote Hyperdrive
service; retain the normal staging sync smoke check before production promotion.

Local results after clean installation of the pinned oosync revision: all four
driver integration tests, 778 TuneTrees unit tests, and six Playwright cases
(including auth setup) passed. Typechecking, lint, TuneTrees formatting, the
production build, schema drift check and Worker dry-run also passed. Both
configured oosync tests passed during upstream validation. oosync's
full `check` still reports pre-existing missing final newlines in
`src/AGENTS.md` and `worker/AGENTS.md`; its new integration test passes Biome.
The local Postgres instance emits an existing collation-version warning.

Audit snapshot (2026-11-05): TuneTrees has four moderate development findings
in the drizzle-kit/esbuild chain and zero production-only findings. The Worker
installation and oosync's full/production audits report zero findings. Audit
remediation remains separate (#534).
