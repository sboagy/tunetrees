# oosync

Schema-agnostic sync tooling for Postgres ↔ SQLite (WASM) style workflows.

## Design goals

- **Schema-agnostic:** nothing in `oosync/` should hard-code application tables/columns.
- **Artifact-driven:** Postgres introspection generates “facts” (schema + table meta + worker defaults) into consumer-owned paths.
- **Defaults-first:** minimal hand-authored configuration; use Postgres catalogs as the primary source of truth.
- **Policy is overridable:** consumers can override generated defaults via config and (optionally) Postgres table comments.

## Directory layout

- `oosync/src/`
  - Codegen entry: `oosync/src/codegen-schema.ts`
  - Shared schema-agnostic contracts (e.g. table metadata types)
- `oosync/worker/`
  - Schema-agnostic worker sync logic
  - Receives injected artifacts/config at runtime (no app-specific assumptions)

## Generated artifacts (consumer-owned)

`oosync/src/codegen-schema.ts` generates files into the **consumer project** (project root by default). This keeps the “npm-installed” mental model: `oosync` does not own your app artifacts.

Common generated outputs:

- SQLite Drizzle schema (for local/offline DB)
- Shared sync table metadata (core facts)
- App-facing `shared/table-meta.ts` (UI hints + ordering + schema-key mapping)
- Worker Postgres schema
- Worker config (defaults merged with overrides)

The default output locations are configurable via `oosync.codegen.config.json`.

## Running codegen

From your project root:

- Generate/update outputs: `tsx oosync/src/codegen-schema.ts`
- Check mode (CI-style): `tsx oosync/src/codegen-schema.ts --check`

### Environment variables

The codegen script prefers a safe local default.

- `OOSYNC_DATABASE_URL`: preferred. If set, will be used.
- `DATABASE_URL`: only used if it points to a local Supabase instance (`localhost|127.0.0.1:54322`).

### CLI flags

`tsx oosync/src/codegen-schema.ts` supports:

- `--check`: compare on-disk outputs to generated contents
- `--lenient`: skip some strict schema assertions
- `--schema=public`: which Postgres schema to introspect
- `--databaseUrl=postgresql://...`: override DB url
- `--config=path/to/oosync.codegen.config.json`: override config location

## `oosync.codegen.config.json` (developer-facing)

This file is **developer-authored**. It defines:

- where generated artifacts should be written
- small schema/policy overrides that cannot be reliably inferred
- worker push/pull policy overrides

The goal is that this config stays **small**, because Postgres introspection + defaults cover most cases.

### Top-level shape

```json
{
  "outputs": { ... },
  "tableMeta": { ... },
  "worker": { "config": { ... } }
}
```

### `outputs`

All paths are relative to your project root unless absolute.

- `outputs.sqliteSchemaFile`
  - Drizzle SQLite schema output.
- `outputs.tableMetaFile`
  - Generated shared core table facts consumed by app + worker.
- `outputs.appTableMetaFile`
  - Generates/overwrites your consumer-owned `shared/table-meta.ts`.
- `outputs.workerPgSchemaFile`
  - Drizzle Postgres schema used by the worker.
- `outputs.workerConfigFile`
  - Worker config output (defaults + overrides).

Example:

```json
{
  "outputs": {
    "sqliteSchemaFile": "drizzle/schema-sqlite.generated.ts",
    "tableMetaFile": "shared/generated/sync/table-meta.generated.ts",
    "appTableMetaFile": "shared/table-meta.ts",
    "workerPgSchemaFile": "worker/src/generated/schema-postgres.generated.ts",
    "workerConfigFile": "worker/src/generated/worker-config.generated.ts"
  }
}
```

### `tableMeta`

#### Syncable tables

By default, `oosync` treats **all tables with a primary key** as syncable, except:

- system tables (`schema_migrations`, `drizzle_migrations`)
- tables listed in `excludeTables`
- tables tagged with `@oosync.exclude` via Postgres comments

Fields:

- `tableMeta.excludeTables: string[]`
  - Blacklist of tables to exclude from sync.

Legacy (supported, but avoid for new usage):

- `tableMeta.syncableTables: string[]`
  - A whitelist; if provided, it wins.

#### Core metadata overrides

Core table metadata is inferred from Postgres catalogs (PKs, unique constraints, column types).

- `tableMeta.overrides: Record<tableName, Partial<TableMetaCore>>`
  - Override inferred core facts.

Legacy (supported, but avoid for new usage):

- `tableMeta.tableRegistryCore: Record<tableName, TableMetaCore>`
  - Full replacement map.

#### App/UI hints

These are *consumer-layer concerns*, so they remain configurable.

- `tableMeta.changeCategoryByTable: Record<string, string | null>`
  - Optional category label used for UI signaling.
  - Schema-agnostic: any string labels are allowed.

- `tableMeta.normalizeDatetimeByTable: Record<string, string[]>`
  - Snake_case column names to normalize to consistent ISO-ish strings.

#### App wiring helpers

- `tableMeta.tableToSchemaKeyOverrides: Record<string, string>`
  - Override the default snake_case → camelCase table key mapping.

- `tableMeta.tableSyncOrderOverrides: Record<string, number>`
  - Override dependency-derived ordering used for sync iteration.

### `worker.config` (policy overrides)

This is intentionally treated as an opaque blob from the perspective of `oosync`.

The generator produces **opinionated defaults** based on schema heuristics, then merges your overrides:

- `collections`: shallow-merged by key
- `pull.tableRules`: shallow-merged by table name
- `push.tableRules`: deep-merged per table name
  - `sanitize.nullIfEmptyStringProps`: union/dedup
  - `sanitize.coerceNumericProps`: union/dedup by `(prop, kind)`
  - other fields: override wins

Important detail: worker sanitization rules operate on **payload prop names** (camelCase), not raw DB column names.

Example (override only what you need):

```json
{
  "worker": {
    "config": {
      "push": {
        "tableRules": {
          "practice_record": {
            "upsert": {
              "omitSetProps": ["id"],
              "retryMinimalPayloadKeepProps": ["id", "playlistRef", "tuneRef"]
            },
            "sanitize": {
              "ensureSyncProps": true,
              "nullIfEmptyStringProps": ["practiced", "due"]
            }
          }
        }
      }
    }
  }
}
```

## Postgres comment tags (optional overrides)

`oosync` can also read lightweight override tags from **table comments**.

Add them with Postgres `COMMENT ON TABLE ...`.

Supported tags:

- `@oosync.exclude`
  - Excludes the table from sync.

- `@oosync.changeCategory=<value>`
  - Sets `changeCategory` for that table (any string).

- `@oosync.normalizeDatetime=col1,col2,...`
  - Sets datetime normalization fields (snake_case column names).

- `@oosync.ownerColumn=<column_name>`
  - Overrides owner-column inference for worker pull defaults.

Examples:

```sql
comment on table public.playlist is '@oosync.changeCategory=repertoire';
comment on table public.internal_debug is '@oosync.exclude';
comment on table public.practice_record is '@oosync.normalizeDatetime=practiced,due,backup_practiced';
comment on table public.playlist_tune is '@oosync.ownerColumn=user_ref';
```

Notes:

- Multiple tags can be combined in one comment.
- Config values still apply; comment tags layer on top for the supported features.

## Defaults you should expect

- **Syncable tables:** all tables with a PK, minus excluded.
- **Conflict target:** unique keys if present, else PK.
- **Incremental:** inferred from presence of `last_modified_at`.
- **Soft delete:** inferred from presence of boolean `deleted`.
- **Worker push delete safety:** defaults to `denyDelete: true` on tables without a soft-delete flag.
- **Worker numeric coercion:** default `sanitize.coerceNumericProps` inferred from Postgres numeric column types.

## Where to look next

- Codegen logic: `oosync/src/codegen-schema.ts`
- Schema-agnostic table meta contract: `oosync/src/shared/table-meta.ts`
- Worker sync schema + sanitization: `oosync/worker/src/sync-schema.ts`
