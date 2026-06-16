# Supabase Schema Promotion Runbook

This document is the standing reference for TuneTrees schema changes moving from local development to staging and production.

Use it when:

- writing or reviewing Supabase migrations;
- changing synced tables, views, RLS, triggers, or generated oosync contracts;
- deciding whether a release can be deployed in one step;
- running or debugging the staging-to-production deployment workflow.

## Core Rule

Every schema change promoted by the normal workflow must be compatible with the currently deployed production app and Worker until the new Worker and Pages deployment has completed.

This is a human and agent review gate. CI can prove that migrations apply and generated artifacts match; it cannot prove that old browser bundles, service workers, Workers, or sync code remain semantically safe.

When in doubt, use expand/contract.

## Promotion Flow

The intended flow for schema-changing releases is:

1. Local development
   - Add the Supabase migration.
   - Apply it to local Postgres.
   - Run schema codegen.
   - Commit generator-produced artifacts.
   - Run local tests.

2. Pull request CI
   - Validate the migration against local Supabase.
   - Verify generated artifacts and TypeScript.

3. Merge to `main`
   - Staging CI applies committed migrations to staging.
   - Staging Worker and Pages are deployed.
   - Staging data is refreshed from production and sanitized.
   - Generated-contract validation and staging smoke tests pass.
   - CI creates a successful GitHub Deployment record for environment `staging`, tied to the exact merge SHA.

4. Manual production promotion
   - Operator triggers `Deploy Production` with the exact SHA.
   - Verify the matching successful `staging` Deployment proof.
   - Run a production migration preflight.
   - Apply production migrations.
   - Deploy production Worker and Pages.
   - Run production-safe smoke tests.

Existing staging proofs created before the staging migration gate was added are valid only for app-only releases with no Supabase migrations.

## Required Commands

TuneTrees owns the app-level commands.

Production schema push:

```json
"db:production:schema:push": "FORCE_COLOR=1 op run --env-file=\".env.prod.template\" -- node scripts/run-supabase-schema-push.mjs --env production"
```

Staging schema push:

```json
"db:staging:schema:push": "FORCE_COLOR=1 op run --env-file=\".env.staging.template\" -- node scripts/run-supabase-schema-push.mjs --env staging"
```

`DATABASE_URL` must come from:

- production: `op://rhizome/shared-production/Supabase/DATABASE_URL`
- staging: `op://rhizome/shared-staging/Supabase/DATABASE_URL`

Remote schema pushes must use `scripts/run-supabase-schema-push.mjs`, which masks `DATABASE_URL`, checks the target environment, runs migration-list preflight, invokes pinned `supabase@2.98.2` with pgx `default_query_exec_mode=describe_exec` for Supabase pooler URLs, and records migration status in the GitHub job summary.

## Workflow Requirements

### Staging

The staging deploy job must run `npm run db:staging:schema:push` before:

- staging data refresh;
- generated-contract validation;
- staging smoke tests;
- successful `staging` Deployment proof creation.

The `staging` Deployment proof means this exact SHA passed against the migrated staging database.

Minimum contract validation after staging migration:

```sh
npm run codegen:schema:check
npm run typecheck
```

If `codegen:schema:check` cannot target staging directly, add an equivalent check that runs codegen against the migrated staging `DATABASE_URL` and fails on generated diff.

### Production

The production workflow must run migration steps after exact-SHA checkout and staging proof verification, but before Worker and Pages deploy.

Production migration steps must:

- mask `DATABASE_URL` before any command can log it;
- assert the target environment by parsing the resolved host/dbname;
- write only redacted or hashed target details to the job summary;
- run `supabase migration list --db-url "$DATABASE_URL"` before apply;
- apply migrations with `db:production:schema:push`;
- record whether migrations were applied, skipped, or failed;
- use `timeout-minutes: 30`;
- run inside the `production-promotion` concurrency group with `cancel-in-progress: false`.

The workflow must stop before Worker/Pages deploy if migration preflight or apply fails.

## Secret Handling

Do not put production Supabase database secrets directly in GitHub Actions unless a later constraint forces it.

Use:

- GitHub Environment `production`
- secret `OP_SERVICE_ACCOUNT_TOKEN`
- `.env.prod.template`
- 1Password paths under `op://rhizome/shared-production/...`

The 1Password service account token exposed to GitHub should be scoped to the minimum vault/items needed for production deployment.

Before remote schema commands, mask the resolved URL:

```sh
echo "::add-mask::$DATABASE_URL"
```

Never print the connection string. Job summaries may include a redacted host/dbname or a hash.

## Compatibility Review Checklist

For every schema-related PR, reviewers and agents must answer:

- Is this additive or potentially breaking?
- What old production app, Worker, browser bundle, or service worker behavior must still work during the deploy?
- Are generated artifacts regenerated from the migration source?
- Do synced-table changes require adapter, metadata, view, Worker, or E2E updates?
- Does PWA/service-worker overlap make old browser bundles a risk?
- Is expand/contract required?

If no backward-compatible solution is obvious, stop and call it out. Do not quietly generate a destructive migration.

## Compatibility Patterns

### Usually Safe In One Release

- New table unused by old code.
- Nullable column.
- Column with a safe default.
- Non-breaking index.
- View or function that old code ignores.
- Non-breaking triggers that preserve old behavior.

### Requires Care

Adding a `NOT NULL` column is safe only if the migration gives existing rows a safe value and old code can continue writing.

Prefer:

1. Add nullable column.
2. Backfill.
3. Deploy code that writes it.
4. Later enforce `NOT NULL`.

Adding constraints, unique indexes, foreign keys, or stricter checks requires production data validation or backfill first. For large tables, prefer `NOT VALID` plus later `VALIDATE CONSTRAINT` when available.

### Potentially Breaking

Treat these as breaking unless explicitly proven compatible:

- changing a column type;
- renaming a column;
- changing column meaning;
- tightening nullability;
- changing primary keys;
- changing RLS;
- changing trigger behavior;
- changing generated sync metadata;
- changing pull/push ownership rules;
- removing enum values.

### Never One Release

Do not drop these in the same release that removes their final code use:

- columns;
- tables;
- views;
- functions;
- compatibility triggers;
- generated metadata relied on by old clients;
- sync protocol fields.

Use expand/contract.

## Expand/Contract

Use this sequence for destructive or behavioral schema changes.

### Release A: Expand

Add the new schema while the old schema still works.

Examples:

- add `content` while keeping `body`;
- add `size_int` while keeping `size`;
- add compatibility view or trigger;
- backfill new fields from old fields.

Old code must keep working after this release.

### Release B: Switch

Deploy app, Worker, and generated-contract changes that use the new shape.

Keep old columns, views, triggers, and compatibility paths in place for rollback and old browser bundles/service workers.

### Release C: Contract

Only after old clients/workers are no longer expected to use the old shape, remove old schema and compatibility code.

## Concrete Examples

Adding a nullable column:

```sql
alter table public.note add column summary text;
```

Safe if old code ignores it.

Adding a required column:

```sql
alter table public.note add column summary text;
update public.note set summary = '' where summary is null;
alter table public.note alter column summary set not null;
```

This can be acceptable if old code can still insert rows. If old code cannot provide the value and no default exists, split it.

Renaming a column:

1. Add new column.
2. Backfill.
3. Dual-read or dual-write where needed.
4. Deploy code using new column.
5. Later drop old column.

Changing a type:

1. Add new typed column.
2. Backfill with validated casts.
3. Deploy code using new typed column.
4. Later remove old column.

Deleting a column:

1. Remove code reads/writes.
2. Deploy and wait for old clients/service workers to age out.
3. Drop column in a later deploy.

Tightening RLS:

1. Add tests proving browser and Worker paths still work.
2. Validate against staging data refreshed from production.
3. Avoid combining unproven RLS tightening with unrelated schema changes.

## PWA And Service Worker Overlap

TuneTrees is a PWA. Old browser bundles and service workers can survive briefly after production deploy.

A cache/service-worker invalidation plan is required for migrations that:

- remove or rename browser-query columns/tables/views;
- change generated sync metadata in a way old clients cannot tolerate;
- change the sync protocol;
- remove compatibility triggers/views/functions.

Minimum acceptable strategies:

- prove old clients remain compatible until the contract phase;
- bump an explicit app/service-worker version used by the update flow;
- force a Workbox update/activation path with `skipWaiting()` and coordinated `clients.claim()`;
- show a user-visible reload prompt before relying on new-only schema.

## Failure And Recovery

If production migration fails or times out:

1. Stop before Worker/Pages deploy.
2. Inspect applied state:

```sh
case "$DATABASE_URL" in
  *\?*) DB_URL="${DATABASE_URL}&default_query_exec_mode=describe_exec" ;;
  *) DB_URL="${DATABASE_URL}?default_query_exec_mode=describe_exec" ;;
esac
npx supabase@2.98.2 migration list --db-url "$DB_URL"
```

3. Inspect affected database objects directly if needed.
4. Decide whether to roll forward with a corrective migration or manually reverse. Prefer roll-forward fixes unless reversal is clearly safer and tested.
5. Record the decision and action in the deployment-audit issue or workflow summary.
6. Do not blindly retry the workflow.

`db:production:schema:push` is expected to be idempotent only when previous migrations were fully applied and recorded. After partial failure, inspect first.

## Agent Guidance

Agents must:

- avoid generating destructive migrations by default;
- flag non-compatible schema changes during review;
- suggest expand/contract alternatives;
- alert the developer when no compatible solution is apparent;
- keep generated files generator-produced only.

This runbook is the durable reference for the root `AGENTS.md` Schema Compatibility Gate.
