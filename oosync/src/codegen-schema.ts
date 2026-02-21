import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_OUTPUT_SQLITE_SCHEMA_FILE = path.join(
  __dirname,
  "../../drizzle/schema-sqlite.generated.ts"
);

const DEFAULT_OUTPUT_TABLE_META_FILE = path.join(
  __dirname,
  "../../shared/generated/sync/table-meta.generated.ts"
);

const DEFAULT_OUTPUT_WORKER_PG_SCHEMA_FILE = path.join(
  __dirname,
  "../../worker/src/generated/schema-postgres.generated.ts"
);

const DEFAULT_OUTPUT_WORKER_CONFIG_FILE = path.join(
  __dirname,
  "../../worker/src/generated/worker-config.generated.ts"
);

const LOCAL_SUPABASE_DATABASE_URL =
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

function resolveBiomeBin(): string {
  const binDir = path.join(__dirname, "../../node_modules/.bin");
  const binName = process.platform === "win32" ? "biome.cmd" : "biome";
  const localBin = path.join(binDir, binName);
  return fs.existsSync(localBin) ? localBin : binName;
}

function formatWithBiome(targetPath: string, content: string): string {
  const biomeBin = resolveBiomeBin();
  const tempDir = fs.mkdtempSync(path.join(process.cwd(), ".codegen-biome-"));
  const tempFile = path.join(
    tempDir,
    `format${path.extname(targetPath) || ".ts"}`
  );

  try {
    fs.writeFileSync(tempFile, content, "utf8");
    const result = spawnSync(biomeBin, ["format", "--write", tempFile], {
      encoding: "utf8",
      stdio: "pipe",
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      const stderr = result.stderr ? String(result.stderr) : "";
      throw new Error(
        `Biome format failed for ${targetPath}: ${stderr || "unknown error"}`
      );
    }

    const formatted = fs.readFileSync(tempFile, "utf8");
    if (content.length > 0 && formatted.length === 0) {
      throw new Error(
        `Biome format produced empty output for ${targetPath} with non-empty input.`
      );
    }

    return formatted;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function isLocalSupabaseDatabaseUrl(databaseUrl: string): boolean {
  try {
    const url = new URL(databaseUrl);
    const hostname = url.hostname;
    const port = url.port;

    const isLocalHost = hostname === "127.0.0.1" || hostname === "localhost";
    return isLocalHost && port === "54322";
  } catch {
    return false;
  }
}

function getDefaultDatabaseUrl(): string {
  // Prefer an explicit env var to avoid accidentally introspecting a remote DB.
  const oosyncUrl = process.env.OOSYNC_DATABASE_URL;
  if (oosyncUrl) return oosyncUrl;

  // Only trust DATABASE_URL if it points at local Supabase.
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl && isLocalSupabaseDatabaseUrl(databaseUrl))
    return databaseUrl;

  return LOCAL_SUPABASE_DATABASE_URL;
}

const DEFAULT_DATABASE_URL = getDefaultDatabaseUrl();

interface IArgs {
  check: boolean;
  databaseUrl: string;
  schema: string;
  strict: boolean;
  configPath: string | null;
}

interface ITableMetaCore {
  primaryKey: string | string[];
  uniqueKeys: string[] | null;
  timestamps: string[];
  booleanColumns: string[];
  supportsIncremental: boolean;
  hasDeletedFlag: boolean;
}

type ChangeCategory = string | null;

interface ICodegenConfigFile {
  outputs?: {
    sqliteSchemaFile?: string;
    tableMetaFile?: string;
    /** Generates/overwrites shared/table-meta.ts (consumer-owned). */
    appTableMetaFile?: string;
    workerPgSchemaFile?: string;
    workerConfigFile?: string;
  };
  tableMeta?: {
    /** Legacy whitelist (prefer excludeTables). */
    syncableTables?: string[];
    /** Legacy full registry (prefer overrides). */
    tableRegistryCore?: Record<string, ITableMetaCore>;

    /** Opinionated default: all tables w/ PK are syncable unless excluded. */
    excludeTables?: string[];

    /** Per-table overrides layered over inferred metadata. */
    overrides?: Record<string, Partial<ITableMetaCore>>;

    /** UI-only hint; defaults to null. */
    changeCategoryByTable?: Record<string, ChangeCategory>;

    /** Optional datetime normalization per table (snake_case column names). */
    normalizeDatetimeByTable?: Record<string, string[]>;

    /** Override tableName -> schema key (camelCase) mapping. */
    tableToSchemaKeyOverrides?: Record<string, string>;

    /** Override dependency sort ordering for specific tables. */
    tableSyncOrderOverrides?: Record<string, number>;
  };
  worker?: {
    /**
     * Worker-only, application-specific rules.
     * This is intentionally opaque to `oosync` itself.
     */
    config?: unknown;
  };
}

interface IColumnRow {
  table_name: string;
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: "YES" | "NO";
  column_default: string | null;
  ordinal_position: number;
}

interface IConstraintColumnRow {
  table_name: string;
  constraint_name: string;
  column_name: string;
  position: number;
}

interface IIndexKeyRow {
  table_name: string;
  index_name: string;
  keydef: string;
  position: number;
}

interface IForeignKeyRow {
  table_name: string;
  constraint_name: string;
  column_name: string;
  ref_table_name: string;
  ref_column_name: string;
  position: number;
}

interface ITableCommentRow {
  table_name: string;
  comment: string | null;
}

interface IColumnCommentRow {
  table_name: string;
  column_name: string;
  comment: string | null;
}

interface IViewColumnCommentRow {
  view_name: string;
  column_name: string;
  comment: string | null;
}

function parseArgs(argv: string[]): IArgs {
  const check = argv.includes("--check");
  const strict = !argv.includes("--lenient");

  const schemaArg = argv.find((a) => a.startsWith("--schema="));
  const schema = schemaArg ? schemaArg.split("=", 2)[1] : "public";

  const urlArg = argv.find((a) => a.startsWith("--databaseUrl="));
  const databaseUrl = urlArg ? urlArg.split("=", 2)[1] : DEFAULT_DATABASE_URL;

  const configArg = argv.find((a) => a.startsWith("--config="));
  const configPath = configArg ? configArg.split("=", 2)[1] : null;

  return { check, databaseUrl, schema, strict, configPath };
}

function createHeader(params: { schema: string }): string {
  return `/**
 * AUTO-GENERATED FILE — DO NOT EDIT.
 *
 * Source: Postgres catalogs (schema: ${params.schema})
 * Generated by: oosync/src/codegen-schema.ts
 */\n\n`;
}

function createTableMetaHeader(params: { schema: string }): string {
  return `/**
 * AUTO-GENERATED FILE — DO NOT EDIT.
 *
 * Source: Postgres catalogs (schema: ${params.schema})
 * Generated by: oosync/src/codegen-schema.ts
 */\n\n`;
}

function toCamelCase(value: string): string {
  return value.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

function safeIdentifier(raw: string): string {
  const candidate = toCamelCase(raw);
  if (/^[a-zA-Z_$][\w$]*$/.test(candidate)) return candidate;
  return `t_${candidate.replace(/[^\w$]/g, "_")}`;
}

function normalizeType(params: { dataType: string; udtName: string }): string {
  const dt = params.dataType.toLowerCase();
  const udt = params.udtName.toLowerCase();

  if (dt === "user-defined") return udt; // enums and domains
  if (dt.startsWith("timestamp")) return "timestamp";
  if (dt === "timestamp with time zone") return "timestamptz";
  if (dt === "uuid") return "uuid";
  if (dt === "boolean") return "boolean";
  if (dt === "json" || dt === "jsonb") return dt;
  if (dt === "date") return "date";
  if (dt === "time without time zone") return "time";
  if (dt === "time with time zone") return "timetz";

  // numbers
  if (dt === "integer" || dt === "smallint" || dt === "bigint") return "int";
  if (dt === "real" || dt === "double precision") return "real";
  if (dt === "numeric" || dt === "decimal") return "numeric";

  // text-ish
  if (
    dt === "text" ||
    dt === "character varying" ||
    dt === "character" ||
    dt === "citext"
  ) {
    return "text";
  }

  return dt;
}

function sqliteBuilderForPgType(pgType: string): "text" | "integer" | "real" {
  switch (pgType) {
    case "uuid":
    case "timestamp":
    case "timestamptz":
    case "date":
    case "time":
    case "timetz":
    case "json":
    case "jsonb":
    case "text":
      return "text";
    case "boolean":
    case "int":
      return "integer";
    case "real":
    case "numeric":
      return "real";
    default:
      // enums and other user-defined types: store as TEXT
      return "text";
  }
}

function isKnownPgType(pgType: string): boolean {
  return new Set([
    "uuid",
    "timestamp",
    "timestamptz",
    "date",
    "time",
    "timetz",
    "json",
    "jsonb",
    "text",
    "boolean",
    "int",
    "real",
    "numeric",
  ]).has(pgType);
}

function isTimestampLikePgType(pgType: string): boolean {
  return (
    pgType === "timestamp" ||
    pgType === "timestamptz" ||
    pgType === "date" ||
    pgType === "time" ||
    pgType === "timetz"
  );
}

function parsePgDefault(params: {
  pgType: string;
  columnDefault: string | null;
}):
  | { kind: "default"; value: string }
  | { kind: "$defaultFn"; value: string }
  | null {
  const def = params.columnDefault;
  if (!def) return null;

  const trimmed = def.trim();

  // UUID defaults
  if (
    params.pgType === "uuid" &&
    /(gen_random_uuid\(\)|uuid_generate_v4\(\))/i.test(trimmed)
  ) {
    // Avoid any app imports in generated code.
    return { kind: "$defaultFn", value: "() => crypto.randomUUID()" };
  }

  // timestamp defaults
  if (
    (params.pgType === "timestamp" || params.pgType === "timestamptz") &&
    /^(now\(\)|current_timestamp)$/i.test(trimmed)
  ) {
    return { kind: "$defaultFn", value: "() => new Date().toISOString()" };
  }

  // boolean constants (often: false / 'false'::boolean)
  if (params.pgType === "boolean") {
    if (/^false(\b|::)/i.test(trimmed) || /^'false'::/i.test(trimmed)) {
      return { kind: "default", value: "false" };
    }
    if (/^true(\b|::)/i.test(trimmed) || /^'true'::/i.test(trimmed)) {
      return { kind: "default", value: "true" };
    }
    if (/^'f'::/i.test(trimmed)) return { kind: "default", value: "false" };
    if (/^'t'::/i.test(trimmed)) return { kind: "default", value: "true" };
  }

  // numeric constants with optional casts
  if (
    params.pgType === "int" ||
    params.pgType === "real" ||
    params.pgType === "numeric"
  ) {
    const m = trimmed.match(/^(-?\d+(?:\.\d+)?)(?:(?:::.*)|\b)?$/);
    if (m) return { kind: "default", value: m[1] };
  }

  // string literal constants with casts (e.g. 'recall'::text)
  if (params.pgType === "text" || params.pgType === "uuid") {
    const m = trimmed.match(/^'(.*)'(?:::.*)?$/);
    if (m) {
      const unescaped = m[1].replace(/''/g, "'");
      return { kind: "default", value: JSON.stringify(unescaped) };
    }
  }

  // Unknown/defaults we don't confidently map: skip.
  return null;
}

function parseIndexKeyToColumnName(keydef: string): string | null {
  // Typical outputs: "col", "col DESC", "col" COLLATE "C"
  const m = keydef.trim().match(/^"?([a-zA-Z_][\w$]*)"?/);
  if (!m) return null;
  return m[1];
}

function stableSort<T>(items: T[], key: (item: T) => string): T[] {
  return [...items].sort((a, b) => key(a).localeCompare(key(b)));
}

function resolveConfigPath(params: { cliPath: string | null }): string | null {
  if (params.cliPath) return params.cliPath;
  const envPath = process.env.OOSYNC_CODEGEN_CONFIG;
  if (envPath) return envPath;

  const defaultPath = path.join(process.cwd(), "oosync.codegen.config.json");
  if (fs.existsSync(defaultPath)) return defaultPath;

  return null;
}

function loadCodegenConfig(configPath: string | null): ICodegenConfigFile {
  if (!configPath) return {};
  const abs = path.isAbsolute(configPath)
    ? configPath
    : path.join(process.cwd(), configPath);
  const raw = fs.readFileSync(abs, "utf8");
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error(`Invalid config file (expected object): ${abs}`);
  }
  return parsed as ICodegenConfigFile;
}

function buildTableMetaTs(params: {
  schema: string;
  columns: IColumnRow[];
  primaryKeys: IConstraintColumnRow[];
  uniqueConstraints: IConstraintColumnRow[];
  strict: boolean;
  syncableTables: string[];
  tableRegistryCore: Record<string, ITableMetaCore>;
  columnDescriptionsByTable: Record<string, Record<string, string>>;
}): string {
  const colsByTable = groupByKey(params.columns, (c) => c.table_name);
  const uniqueByTableConstraint = groupByKey(
    params.uniqueConstraints,
    (r) => `${r.table_name}::${r.constraint_name}`
  );

  const availableTables = new Set(colsByTable.keys());
  const missingTables = params.syncableTables.filter(
    (t) => !availableTables.has(t)
  );
  if (params.strict && missingTables.length > 0) {
    throw new Error(
      `Missing tables for sync metadata: ${missingTables.join(", ")}`
    );
  }

  const lines: string[] = [];
  lines.push(createTableMetaHeader({ schema: params.schema }));

  lines.push("export interface TableMetaCore {");
  lines.push("  primaryKey: string | string[];");
  lines.push("  uniqueKeys: string[] | null;");
  lines.push("  timestamps: string[];");
  lines.push("  booleanColumns: string[];");
  lines.push("  supportsIncremental: boolean;");
  lines.push("  hasDeletedFlag: boolean;");
  lines.push("  columnDescriptions?: Record<string, string>;");
  lines.push("}");
  lines.push("");

  lines.push("export const SYNCABLE_TABLES = [");
  for (const t of params.syncableTables) {
    lines.push(`  ${JSON.stringify(t)},`);
  }
  lines.push("] as const;");
  lines.push("");
  lines.push(
    "export type SyncableTableName = (typeof SYNCABLE_TABLES)[number];"
  );
  lines.push("");

  lines.push(
    "export const TABLE_REGISTRY_CORE: Record<SyncableTableName, TableMetaCore> = {"
  );

  for (const tableName of params.syncableTables) {
    const core = params.tableRegistryCore[tableName];
    if (!core) {
      throw new Error(`Missing tableRegistryCore entry for ${tableName}`);
    }
    const tableCols = (colsByTable.get(tableName) ?? []).slice();
    const colSet = new Set(tableCols.map((c) => c.column_name));

    if (params.strict) {
      const pkCols = Array.isArray(core.primaryKey)
        ? core.primaryKey
        : [core.primaryKey];
      for (const c of pkCols) {
        if (!colSet.has(c)) {
          throw new Error(`Primary key column not found: ${tableName}.${c}`);
        }
      }
      if (core.uniqueKeys) {
        for (const c of core.uniqueKeys) {
          if (!colSet.has(c)) {
            throw new Error(`Unique key column not found: ${tableName}.${c}`);
          }
        }
      }
      for (const c of core.timestamps) {
        if (!colSet.has(c)) {
          throw new Error(`Timestamp column not found: ${tableName}.${c}`);
        }
      }
      for (const c of core.booleanColumns) {
        if (!colSet.has(c)) {
          throw new Error(`Boolean column not found: ${tableName}.${c}`);
        }
      }

      // If supportsIncremental is true, enforce presence of last_modified_at.
      if (core.supportsIncremental && !colSet.has("last_modified_at")) {
        throw new Error(
          `supportsIncremental=true but last_modified_at missing: ${tableName}.last_modified_at`
        );
      }

      // Validate uniqueKeys correspond to a UNIQUE constraint (or PK for composite).
      if (core.uniqueKeys) {
        const isCompositePk = Array.isArray(core.primaryKey);
        const uniqueCandidates = [...uniqueByTableConstraint.entries()]
          .filter(([k]) => k.startsWith(`${tableName}::`))
          .map(([, rows]) =>
            [...rows]
              .sort((a, b) => a.position - b.position)
              .map((r) => r.column_name)
          );
        const matchesUnique = uniqueCandidates.some(
          (cols) =>
            cols.length === core.uniqueKeys!.length &&
            cols.every((c, i) => c === core.uniqueKeys![i])
        );

        if (!matchesUnique) {
          // A composite PK is a valid conflict target.
          if (
            !isCompositePk ||
            core.uniqueKeys.length !== core.primaryKey.length ||
            !core.uniqueKeys.every(
              (c: string, i: number) => c === (core.primaryKey as string[])[i]
            )
          ) {
            throw new Error(
              `uniqueKeys for ${tableName} does not match any UNIQUE constraint: [${core.uniqueKeys.join(", ")}]`
            );
          }
        }
      }
    }

    const pkLiteral = Array.isArray(core.primaryKey)
      ? `[${core.primaryKey.map((c: string) => JSON.stringify(c)).join(", ")}]`
      : JSON.stringify(core.primaryKey);
    const uniqueLiteral = core.uniqueKeys
      ? `[${core.uniqueKeys.map((c: string) => JSON.stringify(c)).join(", ")}]`
      : "null";
    const tsLiteral = `[${core.timestamps
      .map((c: string) => JSON.stringify(c))
      .join(", ")}]`;
    const boolLiteral = `[${core.booleanColumns
      .map((c: string) => JSON.stringify(c))
      .join(", ")}]`;

    lines.push(`  ${JSON.stringify(tableName)}: {`);
    lines.push(`    primaryKey: ${pkLiteral},`);
    lines.push(`    uniqueKeys: ${uniqueLiteral},`);
    lines.push(`    timestamps: ${tsLiteral},`);
    lines.push(`    booleanColumns: ${boolLiteral},`);
    lines.push(
      `    supportsIncremental: ${core.supportsIncremental ? "true" : "false"},`
    );
    lines.push(
      `    hasDeletedFlag: ${core.hasDeletedFlag ? "true" : "false"},`
    );
    const columnDescriptions = params.columnDescriptionsByTable[tableName];
    if (columnDescriptions && Object.keys(columnDescriptions).length > 0) {
      const sortedDescriptions = Object.fromEntries(
        Object.entries(columnDescriptions).sort((a, b) =>
          a[0].localeCompare(b[0])
        )
      );
      lines.push(
        `    columnDescriptions: ${JSON.stringify(sortedDescriptions, null, 2)},`
      );
    }
    lines.push("  },");
  }

  lines.push("};");
  lines.push("");

  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}

async function introspect(params: {
  databaseUrl: string;
  schema: string;
}): Promise<{
  columns: IColumnRow[];
  primaryKeys: IConstraintColumnRow[];
  uniqueConstraints: IConstraintColumnRow[];
  indexes: IIndexKeyRow[];
  foreignKeys: IForeignKeyRow[];
  tableComments: ITableCommentRow[];
  columnComments: IColumnCommentRow[];
  viewColumnComments: IViewColumnCommentRow[];
}> {
  const sql = postgres(params.databaseUrl, {
    prepare: false,
    max: 1,
  });

  try {
    const columns = await sql<IColumnRow[]>`
      select
        c.table_name,
        c.column_name,
        c.data_type,
        c.udt_name,
        c.is_nullable,
        c.column_default,
        c.ordinal_position
      from information_schema.columns c
      join information_schema.tables t
        on t.table_schema = c.table_schema
        and t.table_name = c.table_name
      where c.table_schema = ${params.schema}
        and t.table_type = 'BASE TABLE'
      order by c.table_name, c.ordinal_position;
    `;

    const primaryKeys = await sql<IConstraintColumnRow[]>`
      select
        cl.relname as table_name,
        con.conname as constraint_name,
        a.attname as column_name,
        k.ordinality as position
      from pg_constraint con
      join pg_class cl on cl.oid = con.conrelid
      join pg_namespace n on n.oid = cl.relnamespace
      join unnest(con.conkey) with ordinality as k(attnum, ordinality) on true
      join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum
      where con.contype = 'p'
        and n.nspname = ${params.schema}
      order by cl.relname, con.conname, k.ordinality;
    `;

    const uniqueConstraints = await sql<IConstraintColumnRow[]>`
      select
        cl.relname as table_name,
        con.conname as constraint_name,
        a.attname as column_name,
        k.ordinality as position
      from pg_constraint con
      join pg_class cl on cl.oid = con.conrelid
      join pg_namespace n on n.oid = cl.relnamespace
      join unnest(con.conkey) with ordinality as k(attnum, ordinality) on true
      join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum
      where con.contype = 'u'
        and n.nspname = ${params.schema}
      order by cl.relname, con.conname, k.ordinality;
    `;

    const indexes = await sql<IIndexKeyRow[]>`
      select
        t.relname as table_name,
        ix.relname as index_name,
        pg_get_indexdef(i.indexrelid, k.n, true) as keydef,
        k.n as position
      from pg_index i
      join pg_class t on t.oid = i.indrelid
      join pg_namespace n on n.oid = t.relnamespace
      join pg_class ix on ix.oid = i.indexrelid
      join generate_series(1, i.indnkeyatts) as k(n) on true
      where n.nspname = ${params.schema}
        and i.indisprimary = false
        and i.indisunique = false
      order by t.relname, ix.relname, k.n;
    `;

    const foreignKeys = await sql<IForeignKeyRow[]>`
      select
        cl.relname as table_name,
        con.conname as constraint_name,
        src.attname as column_name,
        refcl.relname as ref_table_name,
        refatt.attname as ref_column_name,
        srccols.ordinality as position
      from pg_constraint con
      join pg_class cl on cl.oid = con.conrelid
      join pg_namespace n on n.oid = cl.relnamespace
      join pg_class refcl on refcl.oid = con.confrelid
      join unnest(con.conkey) with ordinality as srccols(attnum, ordinality) on true
      join pg_attribute src on src.attrelid = con.conrelid and src.attnum = srccols.attnum
      join unnest(con.confkey) with ordinality as refcols(attnum, ordinality) on refcols.ordinality = srccols.ordinality
      join pg_attribute refatt on refatt.attrelid = con.confrelid and refatt.attnum = refcols.attnum
      where con.contype = 'f'
        and n.nspname = ${params.schema}
      order by cl.relname, con.conname, srccols.ordinality;
    `;

    const tableComments = await sql<ITableCommentRow[]>`
      select
        cl.relname as table_name,
        d.description as comment
      from pg_class cl
      join pg_namespace n on n.oid = cl.relnamespace
      left join pg_description d
        on d.objoid = cl.oid
        and d.objsubid = 0
      where n.nspname = ${params.schema}
        and cl.relkind = 'r'
      order by cl.relname;
    `;

    const columnComments = await sql<IColumnCommentRow[]>`
      select
        cl.relname as table_name,
        a.attname as column_name,
        d.description as comment
      from pg_attribute a
      join pg_class cl on cl.oid = a.attrelid
      join pg_namespace n on n.oid = cl.relnamespace
      left join pg_description d
        on d.objoid = a.attrelid
        and d.objsubid = a.attnum
      where n.nspname = ${params.schema}
        and cl.relkind = 'r'
        and a.attnum > 0
        and not a.attisdropped
      order by cl.relname, a.attnum;
    `;

    const viewColumnComments = await sql<IViewColumnCommentRow[]>`
      select
        cl.relname as view_name,
        a.attname as column_name,
        d.description as comment
      from pg_attribute a
      join pg_class cl on cl.oid = a.attrelid
      join pg_namespace n on n.oid = cl.relnamespace
      left join pg_description d
        on d.objoid = a.attrelid
        and d.objsubid = a.attnum
      where n.nspname = ${params.schema}
        and cl.relkind in ('v', 'm')
        and a.attnum > 0
        and not a.attisdropped
      order by cl.relname, a.attnum;
    `;

    return {
      columns,
      primaryKeys,
      uniqueConstraints,
      indexes,
      foreignKeys,
      tableComments,
      columnComments,
      viewColumnComments,
    };
  } finally {
    await sql.end({ timeout: 5 });
  }
}

function groupByKey<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const arr = map.get(k);
    if (arr) arr.push(item);
    else map.set(k, [item]);
  }
  return map;
}

function getAllTableNames(columns: IColumnRow[]): string[] {
  return stableSort([...new Set(columns.map((c) => c.table_name))], (t) => t);
}

function getTableColumns(columns: IColumnRow[]): Map<string, IColumnRow[]> {
  const byTable = groupByKey(columns, (c) => c.table_name);
  for (const [t, cols] of byTable.entries()) {
    byTable.set(
      t,
      [...cols].sort((a, b) => a.ordinal_position - b.ordinal_position)
    );
  }
  return byTable;
}

function getPrimaryKeyByTable(
  primaryKeys: IConstraintColumnRow[]
): Map<string, string[]> {
  const byTable = groupByKey(primaryKeys, (r) => r.table_name);
  const result = new Map<string, string[]>();
  for (const [t, rows] of byTable.entries()) {
    result.set(
      t,
      [...rows]
        .sort((a, b) => a.position - b.position)
        .map((r) => r.column_name)
    );
  }
  return result;
}

function getUniqueConstraintsByTable(
  unique: IConstraintColumnRow[]
): Map<string, string[][]> {
  const byTableConstraint = groupByKey(
    unique,
    (r) => `${r.table_name}::${r.constraint_name}`
  );
  const keys = stableSort([...byTableConstraint.keys()], (k) => k);
  const byTable = new Map<string, string[][]>();
  for (const k of keys) {
    const tableName = k.split("::", 1)[0];
    const rows = byTableConstraint.get(k) ?? [];
    const cols = [...rows]
      .sort((a, b) => a.position - b.position)
      .map((r) => r.column_name);
    const arr = byTable.get(tableName);
    if (arr) arr.push(cols);
    else byTable.set(tableName, [cols]);
  }
  return byTable;
}

function chooseUniqueKeys(params: {
  pkCols: string[];
  uniqueCandidates: string[][];
}): string[] | null {
  if (params.pkCols.length > 1) return params.pkCols;

  const candidates = params.uniqueCandidates
    .filter((cols) => cols.length >= 2)
    .sort((a, b) => {
      if (a.length !== b.length) return a.length - b.length;
      return a.join(",").localeCompare(b.join(","));
    });
  return candidates.length > 0 ? candidates[0] : null;
}

function inferTableMetaCore(params: {
  columnsByTable: Map<string, IColumnRow[]>;
  pkByTable: Map<string, string[]>;
  uniqueByTable: Map<string, string[][]>;
  overrides: Record<string, Partial<ITableMetaCore>>;
}): Record<string, ITableMetaCore> {
  const registry: Record<string, ITableMetaCore> = {};

  for (const [tableName, cols] of params.columnsByTable.entries()) {
    const pkCols = params.pkByTable.get(tableName) ?? [];
    if (pkCols.length === 0) continue;

    const normalizedCols = cols.map((c) => ({
      name: c.column_name,
      pgType: normalizeType({ dataType: c.data_type, udtName: c.udt_name }),
      nullable: c.is_nullable === "YES",
    }));

    const timestamps = normalizedCols
      .filter((c) => isTimestampLikePgType(c.pgType))
      .map((c) => c.name);

    const booleanColumns = normalizedCols
      .filter((c) => c.pgType === "boolean")
      .map((c) => c.name);

    const supportsIncremental = normalizedCols.some(
      (c) => c.name === "last_modified_at"
    );

    const hasDeletedFlag = normalizedCols.some(
      (c) => c.name === "deleted" && c.pgType === "boolean"
    );

    const uniqueCandidates = params.uniqueByTable.get(tableName) ?? [];
    const uniqueKeys = chooseUniqueKeys({ pkCols, uniqueCandidates });

    const core: ITableMetaCore = {
      primaryKey: pkCols.length === 1 ? pkCols[0] : pkCols,
      uniqueKeys,
      timestamps,
      booleanColumns,
      supportsIncremental,
      hasDeletedFlag,
    };

    const override = params.overrides[tableName] ?? {};
    registry[tableName] = { ...core, ...override };
  }

  return registry;
}

function inferSyncableTables(params: {
  allTables: string[];
  pkByTable: Map<string, string[]>;
  legacyWhitelist: string[] | null;
  excluded: Set<string>;
}): string[] {
  if (params.legacyWhitelist && params.legacyWhitelist.length > 0) {
    return stableSort([...params.legacyWhitelist], (t) => t);
  }

  return stableSort(
    params.allTables
      .filter((t) => !params.excluded.has(t))
      .filter((t) => (params.pkByTable.get(t) ?? []).length > 0),
    (t) => t
  );
}

function parseOosyncTableTags(comment: string | null): {
  exclude?: boolean;
  changeCategory?: ChangeCategory;
  normalizeDatetime?: string[];
  ownerColumn?: string;
} {
  if (!comment) return {};
  const exclude = /@oosync\.exclude\b/i.test(comment);

  const m = comment.match(/@oosync\.changeCategory\s*=\s*([^\s]+)/i);
  const changeCategory: ChangeCategory = m?.[1] ?? null;

  const nm = comment.match(/@oosync\.normalizeDatetime\s*=\s*([^\n\r]+)/i);
  const normalizeDatetime = nm
    ? nm[1]
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    : undefined;

  const om = comment.match(/@oosync\.ownerColumn\s*=\s*([^\s]+)/i);
  const ownerColumn = om?.[1] ?? undefined;

  return {
    exclude: exclude || undefined,
    changeCategory: m ? changeCategory : undefined,
    normalizeDatetime,
    ownerColumn,
  };
}

function buildTableToSchemaKeyMap(params: {
  tables: string[];
  overrides: Record<string, string>;
}): Record<string, string> {
  const result: Record<string, string> = {};
  for (const t of params.tables) {
    result[t] = params.overrides[t] ?? toCamelCase(t);
  }
  return result;
}

function buildTableSyncOrder(params: {
  tables: string[];
  foreignKeys: IForeignKeyRow[];
  overrides: Record<string, number>;
}): Record<string, number> {
  const tableSet = new Set(params.tables);
  const deps = new Map<string, Set<string>>();
  const reverse = new Map<string, Set<string>>();
  for (const t of params.tables) {
    deps.set(t, new Set());
    reverse.set(t, new Set());
  }

  for (const fk of params.foreignKeys) {
    if (!tableSet.has(fk.table_name) || !tableSet.has(fk.ref_table_name))
      continue;
    deps.get(fk.table_name)!.add(fk.ref_table_name);
    reverse.get(fk.ref_table_name)!.add(fk.table_name);
  }

  const inDegree = new Map<string, number>();
  for (const t of params.tables) {
    inDegree.set(t, deps.get(t)!.size);
  }

  const ready: string[] = params.tables
    .filter((t) => (inDegree.get(t) ?? 0) === 0)
    .sort((a, b) => a.localeCompare(b));

  const ordered: string[] = [];
  while (ready.length > 0) {
    const t = ready.shift()!;
    ordered.push(t);
    for (const child of reverse.get(t) ?? []) {
      inDegree.set(child, (inDegree.get(child) ?? 0) - 1);
      if ((inDegree.get(child) ?? 0) === 0) {
        ready.push(child);
        ready.sort((a, b) => a.localeCompare(b));
      }
    }
  }

  // Cycles/unresolved: append remaining deterministically.
  for (const t of stableSort(params.tables, (t) => t)) {
    if (!ordered.includes(t)) ordered.push(t);
  }

  const result: Record<string, number> = {};
  ordered.forEach((t, idx) => {
    result[t] = idx + 1;
  });
  for (const [t, v] of Object.entries(params.overrides)) {
    result[t] = v;
  }
  return result;
}

function buildAppTableMetaTs(params: {
  schema: string;
  syncableTables: string[];
  changeCategoryByTable: Record<string, ChangeCategory>;
  normalizeDatetimeByTable: Record<string, string[]>;
  tableSyncOrder: Record<string, number>;
  tableToSchemaKey: Record<string, string>;
  columnDescriptionsByTable: Record<string, Record<string, string>>;
}): string {
  const lines: string[] = [];
  lines.push(createHeader({ schema: params.schema }));

  lines.push(
    "import {" +
      "\n  type SyncableTableName as GeneratedSyncableTableName," +
      "\n  SYNCABLE_TABLES as SYNCABLE_TABLES_GENERATED," +
      "\n  TABLE_REGISTRY_CORE," +
      "\n  type TableMetaCore," +
      '\n} from "@shared-generated/sync";'
  );
  lines.push("");

  lines.push("export type ChangeCategory = string | null;");
  lines.push("export type SyncableTableName = GeneratedSyncableTableName;");
  lines.push("");

  lines.push("export interface TableMeta {");
  lines.push("  primaryKey: string | string[];");
  lines.push("  uniqueKeys: string[] | null;");
  lines.push("  timestamps: string[];");
  lines.push("  booleanColumns: string[];");
  lines.push("  supportsIncremental: boolean;");
  lines.push("  hasDeletedFlag: boolean;");
  lines.push("  changeCategory: ChangeCategory;");
  lines.push(
    "  normalize?: (row: Record<string, unknown>) => Record<string, unknown>;"
  );
  lines.push("  columnDescriptions?: Record<string, string>;");
  lines.push("}");
  lines.push("");

  lines.push("export const SYNCABLE_TABLES = SYNCABLE_TABLES_GENERATED;");
  lines.push("");

  lines.push(
    "function normalizeDatetimeFields(row: Record<string, unknown>, fields: string[]): Record<string, unknown> {"
  );
  lines.push("  const normalized = { ...row };");
  lines.push("  for (const field of fields) {");
  lines.push("    const value = normalized[field];");
  lines.push('    if (typeof value === "string") {');
  lines.push(
    '      let result = value.includes(" ") ? value.replace(" ", "T") : value;'
  );
  lines.push(
    "      if (/Z$/i.test(result) || /[+-]\\d{2}:?\\d{2}$/.test(result)) {"
  );
  lines.push("        normalized[field] = result;");
  lines.push("        continue;");
  lines.push("      }");
  lines.push(
    "      if (/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}/.test(result)) {"
  );
  lines.push("        result = `${" + "result}Z`;");
  lines.push("      }");
  lines.push("      normalized[field] = result;");
  lines.push("    }");
  lines.push("  }");
  lines.push("  return normalized;");
  lines.push("}");
  lines.push("");

  lines.push(
    'const TABLE_EXTRAS: Record<SyncableTableName, Pick<TableMeta, "changeCategory" | "normalize" | "columnDescriptions">> = {'
  );

  for (const t of params.syncableTables) {
    const category = params.changeCategoryByTable[t] ?? null;
    const datetimeFields = params.normalizeDatetimeByTable[t];
    const columnDescriptions = params.columnDescriptionsByTable[t];
    lines.push(`  ${JSON.stringify(t)}: {`);
    lines.push(
      `    changeCategory: ${category === null ? "null" : JSON.stringify(category)},`
    );
    if (datetimeFields && datetimeFields.length > 0) {
      const arr = `[${datetimeFields.map((c) => JSON.stringify(c)).join(", ")}]`;
      lines.push(
        `    normalize: (row) => normalizeDatetimeFields(row, ${arr}),`
      );
    }
    if (columnDescriptions && Object.keys(columnDescriptions).length > 0) {
      const sortedDescriptions = Object.fromEntries(
        Object.entries(columnDescriptions).sort((a, b) =>
          a[0].localeCompare(b[0])
        )
      );
      lines.push(
        `    columnDescriptions: ${JSON.stringify(sortedDescriptions, null, 2)},`
      );
    }
    lines.push("  },");
  }

  lines.push("};");
  lines.push("");

  lines.push(
    "export const TABLE_REGISTRY_MERGED: Record<SyncableTableName, TableMeta> = Object.fromEntries("
  );
  lines.push(
    "  Object.entries(TABLE_REGISTRY_CORE).map(([tableName, core]) => {"
  );
  lines.push(
    "    const extras = TABLE_EXTRAS[tableName as SyncableTableName];"
  );
  lines.push(
    "    return [tableName, { ...(core as TableMetaCore), ...extras }];"
  );
  lines.push("  })");
  lines.push(") as Record<SyncableTableName, TableMeta>;");
  lines.push("");

  lines.push(
    "export const TABLE_REGISTRY: Record<string, TableMeta> = TABLE_REGISTRY_MERGED;"
  );
  lines.push("");

  lines.push("function getRequiredMeta(tableName: string): TableMeta {");
  lines.push("  const meta = TABLE_REGISTRY[tableName];");
  lines.push("  if (!meta) {");
  lines.push("    throw new Error(`Unknown table: ${" + "tableName}`);");
  lines.push("  }");
  lines.push("  return meta;");
  lines.push("}");
  lines.push("");

  lines.push(
    "export const COMPOSITE_PK_TABLES: SyncableTableName[] = (() => {"
  );
  lines.push("  const tables: SyncableTableName[] = [];");
  lines.push("  for (const tableName of SYNCABLE_TABLES) {");
  lines.push("    const pk = TABLE_REGISTRY_MERGED[tableName].primaryKey;");
  lines.push("    if (Array.isArray(pk)) {");
  lines.push("      tables.push(tableName);");
  lines.push("    }");
  lines.push("  }");
  lines.push("  return tables;");
  lines.push("})();");
  lines.push("");

  lines.push(
    "export const NON_STANDARD_PK_TABLES: Partial<Record<SyncableTableName, string>> = (() => {"
  );
  lines.push("  const map: Partial<Record<SyncableTableName, string>> = {};");
  lines.push("  for (const tableName of SYNCABLE_TABLES) {");
  lines.push("    const pk = TABLE_REGISTRY_MERGED[tableName].primaryKey;");
  lines.push('    if (typeof pk === "string" && pk !== "id") {');
  lines.push("      map[tableName] = pk;");
  lines.push("    }");
  lines.push("  }");
  lines.push("  return map;");
  lines.push("})();");
  lines.push("");

  lines.push(
    "export function getPrimaryKey(tableName: string): string | string[] {"
  );
  lines.push("  const pk = getRequiredMeta(tableName).primaryKey;");
  lines.push("  return Array.isArray(pk) ? [...pk] : pk;");
  lines.push("}");
  lines.push("");

  lines.push(
    "export function getUniqueKeys(tableName: string): string[] | null {"
  );
  lines.push("  const uniqueKeys = getRequiredMeta(tableName).uniqueKeys;");
  lines.push("  return uniqueKeys ? [...uniqueKeys] : null;");
  lines.push("}");
  lines.push("");

  lines.push(
    "export function getConflictTarget(tableName: string): string[] {"
  );
  lines.push("  const meta = getRequiredMeta(tableName);");
  lines.push("  if (meta.uniqueKeys) return [...meta.uniqueKeys];");
  lines.push("");
  lines.push("  const pk = meta.primaryKey;");
  lines.push("  return Array.isArray(pk) ? [...pk] : [pk];");
  lines.push("}");
  lines.push("");

  lines.push(
    "export function supportsIncremental(tableName: string): boolean {"
  );
  lines.push(
    "  return TABLE_REGISTRY[tableName]?.supportsIncremental ?? false;"
  );
  lines.push("}");
  lines.push("");

  lines.push("export function hasDeletedFlag(tableName: string): boolean {");
  lines.push("  return TABLE_REGISTRY[tableName]?.hasDeletedFlag ?? false;");
  lines.push("}");
  lines.push("");

  lines.push(
    "export function getBooleanColumns(tableName: string): string[] {"
  );
  lines.push(
    "  return [...(TABLE_REGISTRY[tableName]?.booleanColumns ?? [])];"
  );
  lines.push("}");
  lines.push("");

  lines.push("export function getNormalizer(tableName: string):");
  lines.push(
    "  | ((row: Readonly<Record<string, unknown>>) => Record<string, unknown>)"
  );
  lines.push("  | undefined {");
  lines.push("  const normalize = TABLE_REGISTRY[tableName]?.normalize;");
  lines.push(
    "  return normalize ? (row) => normalize(row as Record<string, unknown>) : undefined;"
  );
  lines.push("}");
  lines.push("");

  lines.push("export function isRegisteredTable(tableName: string): boolean {");
  lines.push("  return tableName in TABLE_REGISTRY;");
  lines.push("}");
  lines.push("");

  lines.push("export function hasCompositePK(tableName: string): boolean {");
  lines.push("  return Array.isArray(TABLE_REGISTRY[tableName]?.primaryKey);");
  lines.push("}");
  lines.push("");

  lines.push("export function buildRowIdForOutbox(");
  lines.push("  tableName: string,");
  lines.push("  row: Readonly<Record<string, unknown>>");
  lines.push("): string {");
  lines.push("  const pk = getPrimaryKey(tableName);");
  lines.push("  if (Array.isArray(pk)) {");
  lines.push("    const keyObj: Record<string, unknown> = {};");
  lines.push("    for (const col of pk) {");
  lines.push("      keyObj[col] = row[col];");
  lines.push("    }");
  lines.push("    return JSON.stringify(keyObj);");
  lines.push("  }");
  lines.push("  return String(row[pk]);");
  lines.push("}");
  lines.push("");

  lines.push("export function parseOutboxRowId(");
  lines.push("  tableName: string,");
  lines.push("  rowId: string");
  lines.push("): Record<string, unknown> | string {");
  lines.push("  const pk = getPrimaryKey(tableName);");
  lines.push("  if (Array.isArray(pk)) {");
  lines.push("    try {");
  lines.push("      return JSON.parse(rowId) as Record<string, unknown>;");
  lines.push("    } catch {");
  lines.push(
    "      throw new Error(`Invalid JSON row_id for composite key table ${" +
      "tableName}: ${" +
      "rowId}`);"
  );
  lines.push("    }");
  lines.push("  }");
  lines.push("  return rowId;");
  lines.push("}");
  lines.push("");

  lines.push("export const TABLE_SYNC_ORDER: Record<string, number> = {");
  for (const [t, v] of Object.entries(params.tableSyncOrder).sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    lines.push(`  ${JSON.stringify(t)}: ${v},`);
  }
  lines.push("};");
  lines.push("");

  lines.push("export const TABLE_TO_SCHEMA_KEY: Record<string, string> = {");
  for (const [t, v] of Object.entries(params.tableToSchemaKey).sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    lines.push(`  ${JSON.stringify(t)}: ${JSON.stringify(v)},`);
  }
  lines.push("};");
  lines.push("");

  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}

function buildDefaultWorkerConfig(params: {
  syncableTables: string[];
  columnsByTable: Map<string, IColumnRow[]>;
  foreignKeys: IForeignKeyRow[];
  tableRegistryCore: Record<string, ITableMetaCore>;
  ownerColumnOverrideByTable: Record<string, string>;
}): unknown {
  const collections: Record<
    string,
    { table: string; idColumn: string; ownerColumn: string }
  > = {};
  const pullRules: Record<
    string,
    | { kind: "eqUserId"; column: string }
    | { kind: "orNullEqUserId"; column: string }
    | { kind: "inCollection"; column: string; collection: string }
    | {
        kind: "rpc";
        functionName: string;
        paramMap: Record<
          string,
          | { source: "authUserId" }
          | { source: "collection"; collection: string }
          | { source: "lastSyncAt" }
          | { source: "pageLimit" }
          | { source: "pageOffset" }
          | { source: "literal"; value: unknown }
          | { source: "requestOverride"; key?: string }
        >;
      }
  > = {};
  const pushRules: Record<
    string,
    {
      denyDelete?: boolean;
      sanitize?: {
        coerceNumericProps?: Array<{ prop: string; kind: "int" | "float" }>;
      };
    }
  > = {};

  const ownerCandidates = [
    "user_ref",
    "user_id",
    "private_to_user",
    "private_for",
  ] as const;

  const tableOwnerColumn = new Map<
    string,
    { column: string; kind: "eqUserId" | "orNullEqUserId" }
  >();

  for (const tableName of params.syncableTables) {
    const cols = params.columnsByTable.get(tableName) ?? [];
    const colByName = new Map(cols.map((c) => [c.column_name, c] as const));

    const numericProps: Array<{ prop: string; kind: "int" | "float" }> = [];
    for (const c of cols) {
      const pgType = normalizeType({
        dataType: c.data_type,
        udtName: c.udt_name,
      });
      if (pgType === "int") {
        numericProps.push({ prop: toCamelCase(c.column_name), kind: "int" });
      } else if (pgType === "real" || pgType === "numeric") {
        numericProps.push({ prop: toCamelCase(c.column_name), kind: "float" });
      }
    }
    numericProps.sort((a, b) =>
      `${a.kind}::${a.prop}`.localeCompare(`${b.kind}::${b.prop}`)
    );

    const overrideOwnerColumn = params.ownerColumnOverrideByTable[tableName];
    if (overrideOwnerColumn) {
      const c = colByName.get(overrideOwnerColumn);
      if (c) {
        const nullable = c.is_nullable === "YES";
        const isPrivate =
          overrideOwnerColumn === "private_to_user" ||
          overrideOwnerColumn === "private_for";
        const kind = isPrivate || nullable ? "orNullEqUserId" : "eqUserId";
        tableOwnerColumn.set(tableName, {
          column: overrideOwnerColumn,
          kind,
        });
      }
    }

    if (!tableOwnerColumn.has(tableName)) {
      for (const cand of ownerCandidates) {
        const c = colByName.get(cand);
        if (!c) continue;
        const nullable = c.is_nullable === "YES";
        const isPrivate = cand === "private_to_user" || cand === "private_for";
        const kind = isPrivate || nullable ? "orNullEqUserId" : "eqUserId";
        tableOwnerColumn.set(tableName, { column: cand, kind });
        break;
      }
    }

    const core = params.tableRegistryCore[tableName];
    const nextPushRule: {
      denyDelete?: boolean;
      sanitize?: {
        coerceNumericProps?: Array<{ prop: string; kind: "int" | "float" }>;
      };
    } = {};

    if (core && !core.hasDeletedFlag) {
      // Opinionated safety: deny hard deletes unless table has a deleted flag.
      nextPushRule.denyDelete = true;
    }
    if (numericProps.length > 0) {
      nextPushRule.sanitize = { coerceNumericProps: numericProps };
    }
    if (Object.keys(nextPushRule).length > 0) {
      pushRules[tableName] = nextPushRule;
    }
  }

  // Collections: one per owned table with a single-column PK.
  for (const [tableName, owner] of stableSort(
    [...tableOwnerColumn.entries()],
    ([t]) => t
  )) {
    const core = params.tableRegistryCore[tableName];
    if (!core) continue;
    if (Array.isArray(core.primaryKey)) continue;
    const collectionName = `${toCamelCase(tableName)}Ids`;
    collections[collectionName] = {
      table: tableName,
      idColumn: core.primaryKey,
      ownerColumn: owner.column,
    };
  }

  // Pull rules: explicit owner filtering, else derive inCollection from FK to owned parent.
  const fksByTable = groupByKey(params.foreignKeys, (fk) => fk.table_name);

  for (const tableName of params.syncableTables) {
    const owner = tableOwnerColumn.get(tableName);
    if (owner) {
      pullRules[tableName] = { kind: owner.kind, column: owner.column };
      continue;
    }

    const fks = fksByTable.get(tableName) ?? [];
    const candidates: Array<{ column: string; collection: string }> = [];
    for (const fk of fks) {
      const parentOwner = tableOwnerColumn.get(fk.ref_table_name);
      const parentCore = params.tableRegistryCore[fk.ref_table_name];
      if (!parentOwner || !parentCore) continue;
      if (Array.isArray(parentCore.primaryKey)) continue;
      const collection = `${toCamelCase(fk.ref_table_name)}Ids`;
      if (!(collection in collections)) continue;
      candidates.push({ column: fk.column_name, collection });
    }
    candidates.sort((a, b) =>
      `${a.collection}::${a.column}`.localeCompare(
        `${b.collection}::${b.column}`
      )
    );
    if (candidates.length > 0) {
      pullRules[tableName] = {
        kind: "inCollection",
        column: candidates[0].column,
        collection: candidates[0].collection,
      };
    }
  }

  return {
    collections,
    pull: { tableRules: pullRules },
    push: { tableRules: pushRules },
  } as const;
}

function mergeWorkerConfigs(defaults: unknown, overrides: unknown): unknown {
  const d = (defaults ?? {}) as any;
  const o = (overrides ?? {}) as any;

  function uniqStrings(values: unknown): string[] {
    if (!Array.isArray(values)) return [];
    const out: string[] = [];
    const seen = new Set<string>();
    for (const v of values) {
      if (typeof v !== "string") continue;
      if (seen.has(v)) continue;
      seen.add(v);
      out.push(v);
    }
    return out;
  }

  type NumericCoercion = { prop: string; kind: "int" | "float" };
  function mergeNumericCoercions(
    base: unknown,
    extra: unknown
  ): NumericCoercion[] | undefined {
    const b = Array.isArray(base) ? (base as unknown[]) : [];
    const e = Array.isArray(extra) ? (extra as unknown[]) : [];
    const merged: NumericCoercion[] = [];
    const seen = new Set<string>();
    for (const v of [...b, ...e]) {
      if (!v || typeof v !== "object") continue;
      const prop = (v as any).prop;
      const kind = (v as any).kind;
      if (typeof prop !== "string") continue;
      if (kind !== "int" && kind !== "float") continue;
      const key = `${prop}::${kind}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push({ prop, kind });
    }
    return merged.length > 0 ? merged : undefined;
  }

  function mergePushTableRules(
    dRules: unknown,
    oRules: unknown
  ): Record<string, unknown> {
    const dObj = (dRules ?? {}) as Record<string, unknown>;
    const oObj = (oRules ?? {}) as Record<string, unknown>;
    const keys = new Set<string>([...Object.keys(dObj), ...Object.keys(oObj)]);
    const out: Record<string, unknown> = {};
    for (const tableName of [...keys].sort((a, b) => a.localeCompare(b))) {
      const base = (dObj as any)[tableName];
      const over = (oObj as any)[tableName];
      if (!base) {
        out[tableName] = over;
        continue;
      }
      if (!over) {
        out[tableName] = base;
        continue;
      }
      const baseSan = (base as any).sanitize;
      const overSan = (over as any).sanitize;
      const mergedSanitize =
        baseSan || overSan
          ? {
              ...(baseSan ?? {}),
              ...(overSan ?? {}),
              nullIfEmptyStringProps: uniqStrings([
                ...uniqStrings(baseSan?.nullIfEmptyStringProps),
                ...uniqStrings(overSan?.nullIfEmptyStringProps),
              ]),
              coerceNumericProps: mergeNumericCoercions(
                baseSan?.coerceNumericProps,
                overSan?.coerceNumericProps
              ),
            }
          : undefined;
      if (
        mergedSanitize &&
        (mergedSanitize as any).nullIfEmptyStringProps?.length === 0
      ) {
        delete (mergedSanitize as any).nullIfEmptyStringProps;
      }
      if (mergedSanitize && !(mergedSanitize as any).coerceNumericProps) {
        delete (mergedSanitize as any).coerceNumericProps;
      }

      out[tableName] = {
        ...(base as any),
        ...(over as any),
        sanitize: mergedSanitize,
      };
    }
    return out;
  }

  return {
    ...d,
    ...o,
    collections: { ...(d.collections ?? {}), ...(o.collections ?? {}) },
    pull: {
      ...(d.pull ?? {}),
      ...(o.pull ?? {}),
      tableRules: {
        ...(d.pull?.tableRules ?? {}),
        ...(o.pull?.tableRules ?? {}),
      },
    },
    push: {
      ...(d.push ?? {}),
      ...(o.push ?? {}),
      tableRules: mergePushTableRules(d.push?.tableRules, o.push?.tableRules),
    },
  };
}

function buildSchemaTs(params: {
  schema: string;
  columns: IColumnRow[];
  primaryKeys: IConstraintColumnRow[];
  uniqueConstraints: IConstraintColumnRow[];
  indexes: IIndexKeyRow[];
  foreignKeys: IForeignKeyRow[];
  strict: boolean;
}): string {
  const ignoredTables = new Set<string>([
    "schema_migrations",
    "drizzle_migrations",
  ]);

  const colsByTable = groupByKey(params.columns, (c) => c.table_name);

  const pkByTable = groupByKey(params.primaryKeys, (r) => r.table_name);
  const uniqueByTableConstraint = groupByKey(
    params.uniqueConstraints,
    (r) => `${r.table_name}::${r.constraint_name}`
  );
  const idxByTableIndex = groupByKey(
    params.indexes,
    (r) => `${r.table_name}::${r.index_name}`
  );
  const fkByTableConstraint = groupByKey(
    params.foreignKeys,
    (r) => `${r.table_name}::${r.constraint_name}`
  );

  const tables = stableSort([...colsByTable.keys()], (t) => t).filter(
    (t) => !ignoredTables.has(t)
  );

  // Deterministic, globally stable table identifiers.
  const tableIdentByName = new Map<string, string>();
  const usedIdents = new Set<string>();
  for (const tableName of tables) {
    let ident = safeIdentifier(tableName);
    while (usedIdents.has(ident)) ident = `${ident}_`; // deterministic collision resolver
    usedIdents.add(ident);
    tableIdentByName.set(tableName, ident);
  }

  const lines: string[] = [];
  lines.push(createHeader({ schema: params.schema }));

  const sqliteCoreImport =
    'import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";';
  lines.push(sqliteCoreImport);

  lines.push('import { sqliteSyncColumns } from "./sync-columns";');
  lines.push("");

  // Precompute FK mapping per (table,col)
  const fkByTableCol = new Map<string, IForeignKeyRow>();
  for (const [key, rows] of fkByTableConstraint.entries()) {
    if (rows.length !== 1) {
      if (params.strict) {
        throw new Error(
          `Unsupported composite foreign key: ${key} (${rows.length} columns). Use --lenient to skip.`
        );
      }
      continue;
    }
    const one = rows[0];
    fkByTableCol.set(`${one.table_name}::${one.column_name}`, one);
  }

  for (const tableName of tables) {
    const ident = tableIdentByName.get(tableName);
    if (!ident) continue;

    const tableColumns = (colsByTable.get(tableName) ?? []).slice();
    tableColumns.sort((a, b) => a.ordinal_position - b.ordinal_position);

    const pkCols = (pkByTable.get(tableName) ?? []).slice();
    pkCols.sort((a, b) => a.position - b.position);

    const hasSyncCols =
      tableColumns.some((c) => c.column_name === "sync_version") &&
      tableColumns.some((c) => c.column_name === "last_modified_at") &&
      tableColumns.some((c) => c.column_name === "device_id");

    const columnsToEmit = hasSyncCols
      ? tableColumns.filter(
          (c) =>
            c.column_name !== "sync_version" &&
            c.column_name !== "last_modified_at" &&
            c.column_name !== "device_id"
        )
      : tableColumns;

    // Column pk lookup
    const pkSet = new Set(pkCols.map((r) => r.column_name));
    const isSinglePk = pkCols.length === 1;

    lines.push(`export const ${ident} = sqliteTable("${tableName}", {`);

    for (const col of columnsToEmit) {
      const propName = safeIdentifier(col.column_name);
      const pgType = normalizeType({
        dataType: col.data_type,
        udtName: col.udt_name,
      });

      // Strict type safety: only allow explicit mappings (plus enums/domains stored as TEXT).
      if (params.strict && col.data_type.toLowerCase() !== "user-defined") {
        if (!isKnownPgType(pgType)) {
          throw new Error(
            `Unmappable Postgres type for ${tableName}.${col.column_name}: data_type=${col.data_type} udt_name=${col.udt_name} (normalized=${pgType}).`
          );
        }
      }
      const builder = sqliteBuilderForPgType(pgType);

      const pieces: string[] = [`${builder}("${col.column_name}")`];

      if (col.is_nullable === "NO") pieces.push("notNull()");

      // Foreign key (single-column only)
      const fk = fkByTableCol.get(`${tableName}::${col.column_name}`);
      if (fk) {
        const refTableIdent = tableIdentByName.get(fk.ref_table_name);
        const refColProp = safeIdentifier(fk.ref_column_name);
        if (refTableIdent) {
          pieces.push(`references(() => ${refTableIdent}.${refColProp})`);
        }
      }

      // PK
      if (pkSet.has(col.column_name) && isSinglePk) {
        pieces.push("primaryKey()");
      }

      // Defaults
      const parsedDefault = parsePgDefault({
        pgType,
        columnDefault: col.column_default,
      });
      if (parsedDefault) {
        if (parsedDefault.kind === "default") {
          let defaultValue = parsedDefault.value;
          // SQLite integer columns need numeric defaults, not boolean literals
          if (builder === "integer" && pgType === "boolean") {
            defaultValue = parsedDefault.value === "true" ? "1" : "0";
          }
          pieces.push(`default(${defaultValue})`);
        } else {
          pieces.push(`$defaultFn(${parsedDefault.value})`);
        }
      } else if (params.strict && col.column_default) {
        // We saw a default but couldn't map it deterministically.
        throw new Error(
          `Unsupported default for ${tableName}.${col.column_name}: ${col.column_default}. Use --lenient to skip.`
        );
      }

      const chain = pieces.map((p, idx) => (idx === 0 ? p : `.${p}`)).join("");

      lines.push(`  ${propName}: ${chain},`);
    }

    if (hasSyncCols) {
      lines.push("  ...sqliteSyncColumns,");
    }

    lines.push("}");

    const configItems: string[] = [];

    // Composite PK
    if (pkCols.length > 1) {
      const pkProps = pkCols
        .map((r) => `t.${safeIdentifier(r.column_name)}`)
        .join(", ");
      configItems.push(`primaryKey({ columns: [${pkProps}] })`);
    }

    // Unique constraints
    const uniqueForTable = [...uniqueByTableConstraint.entries()]
      .filter(([k]) => k.startsWith(`${tableName}::`))
      .map(([, rows]) => rows);

    for (const rows of uniqueForTable) {
      const sorted = [...rows].sort((a, b) => a.position - b.position);
      const name = sorted[0]?.constraint_name;
      if (!name) continue;
      const cols = sorted
        .map((r) => `t.${safeIdentifier(r.column_name)}`)
        .join(", ");
      configItems.push(`uniqueIndex("${name}").on(${cols})`);
    }

    // Non-unique indexes
    const indexesForTable = [...idxByTableIndex.entries()]
      .filter(([k]) => k.startsWith(`${tableName}::`))
      .map(([, rows]) => rows);

    for (const rows of indexesForTable) {
      const sorted = [...rows].sort((a, b) => a.position - b.position);
      const indexName = sorted[0]?.index_name;
      if (!indexName) continue;

      const colRefs: string[] = [];
      for (const r of sorted) {
        const colName = parseIndexKeyToColumnName(r.keydef);
        if (!colName) {
          if (params.strict) {
            throw new Error(
              `Unsupported index key for ${tableName}.${indexName}: ${r.keydef}. Use --lenient to skip.`
            );
          }
          colRefs.length = 0;
          break;
        }
        colRefs.push(`t.${safeIdentifier(colName)}`);
      }
      if (colRefs.length === 0) continue;
      configItems.push(`index("${indexName}").on(${colRefs.join(", ")})`);
    }

    if (configItems.length > 0) {
      lines.push(", (t) => [");
      for (const item of configItems) {
        lines.push(`  ${item},`);
      }
      lines.push("]");
      lines.push(");");
    } else {
      lines.push(");");
    }

    lines.push("");
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}

function pgBuilderForPgType(
  pgType: string
): "text" | "integer" | "real" | "boolean" | "jsonb" | "uuid" {
  // IMPORTANT: the worker stores timestamp-like values as TEXT (ISO strings)
  // for consistency with the client-side SQLite schema.
  // UUIDs should remain UUID-typed in Postgres worker schema for correct SQL operators.
  switch (pgType) {
    case "uuid":
      return "uuid";
    case "timestamp":
    case "timestamptz":
    case "date":
    case "time":
    case "timetz":
    case "text":
      return "text";
    case "boolean":
      return "boolean";
    case "int":
      return "integer";
    case "real":
    case "numeric":
      return "real";
    case "json":
    case "jsonb":
      return "jsonb";
    default:
      return "text";
  }
}

function buildPgSchemaTs(params: {
  schema: string;
  columns: IColumnRow[];
  primaryKeys: IConstraintColumnRow[];
  strict: boolean;
}): string {
  const ignoredTables = new Set<string>([
    "schema_migrations",
    "drizzle_migrations",
  ]);

  const colsByTable = groupByKey(params.columns, (c) => c.table_name);
  const pkByTable = groupByKey(params.primaryKeys, (r) => r.table_name);

  const tables = stableSort([...colsByTable.keys()], (t) => t).filter(
    (t) => !ignoredTables.has(t)
  );

  // Deterministic identifiers.
  const tableIdentByName = new Map<string, string>();
  const usedIdents = new Set<string>();
  for (const tableName of tables) {
    let ident = safeIdentifier(tableName);
    while (usedIdents.has(ident)) ident = `${ident}_`;
    usedIdents.add(ident);
    tableIdentByName.set(tableName, ident);
  }

  const lines: string[] = [];
  lines.push(createHeader({ schema: params.schema }));

  // Collect actually-used type builders to generate minimal imports
  const usedBuilders = new Set<string>();

  // First pass: collect all used type builders
  for (const tableName of tables) {
    const tableColumns = (colsByTable.get(tableName) ?? []).slice();
    for (const col of tableColumns) {
      const pgType = normalizeType({
        dataType: col.data_type,
        udtName: col.udt_name,
      });
      const builder = pgBuilderForPgType(pgType);
      usedBuilders.add(builder);
    }
  }

  // Generate import statement with only used types (sorted alphabetically)
  const importTypes = [...Array.from(usedBuilders), "pgTable"].sort();
  lines.push(
    `import { ${importTypes.join(", ")} } from "drizzle-orm/pg-core";`
  );
  lines.push("");

  for (const tableName of tables) {
    const ident = tableIdentByName.get(tableName);
    if (!ident) continue;

    const tableColumns = (colsByTable.get(tableName) ?? []).slice();
    tableColumns.sort((a, b) => a.ordinal_position - b.ordinal_position);

    const pkCols = (pkByTable.get(tableName) ?? []).slice();
    pkCols.sort((a, b) => a.position - b.position);
    const pkSet = new Set(pkCols.map((r) => r.column_name));
    const isSinglePk = pkCols.length === 1;

    lines.push(`export const ${ident} = pgTable("${tableName}", {`);
    for (const col of tableColumns) {
      const propName = safeIdentifier(col.column_name);
      const pgType = normalizeType({
        dataType: col.data_type,
        udtName: col.udt_name,
      });

      if (params.strict && col.data_type.toLowerCase() !== "user-defined") {
        if (!isKnownPgType(pgType)) {
          throw new Error(
            `Unmappable Postgres type for ${tableName}.${col.column_name}: data_type=${col.data_type} udt_name=${col.udt_name} (normalized=${pgType}).`
          );
        }
      }

      const builder = pgBuilderForPgType(pgType);
      const pieces: string[] = [`${builder}("${col.column_name}")`];
      if (col.is_nullable === "NO") pieces.push("notNull()");
      if (pkSet.has(col.column_name) && isSinglePk) pieces.push("primaryKey()");

      const parsedDefault = parsePgDefault({
        pgType,
        columnDefault: col.column_default,
      });
      if (parsedDefault) {
        if (parsedDefault.kind === "default") {
          pieces.push(`default(${parsedDefault.value})`);
        } else {
          pieces.push(`$defaultFn(${parsedDefault.value})`);
        }
      } else if (params.strict && col.column_default) {
        throw new Error(
          `Unsupported default for ${tableName}.${col.column_name}: ${col.column_default}. Use --lenient to skip.`
        );
      }

      const chain = pieces.map((p, idx) => (idx === 0 ? p : `.${p}`)).join("");
      lines.push(`  ${propName}: ${chain},`);
    }
    lines.push("});");
    lines.push("");
  }

  lines.push("export const tables = {");
  for (const tableName of tables) {
    const ident = tableIdentByName.get(tableName);
    if (!ident) continue;
    lines.push(`  ${JSON.stringify(tableName)}: ${ident},`);
  }
  lines.push("} as const;");
  lines.push("");

  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}

function buildWorkerConfigTs(params: {
  schema: string;
  config: unknown;
}): string {
  const lines: string[] = [];
  lines.push(createHeader({ schema: params.schema }));
  lines.push("export const WORKER_SYNC_CONFIG = ");
  lines.push(`${JSON.stringify(params.config ?? {}, null, 2)} as const;`);
  lines.push("");
  return lines.join("\n");
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const configPath = resolveConfigPath({ cliPath: args.configPath });
  const config = loadCodegenConfig(configPath);

  const outputSchemaFile = config.outputs?.sqliteSchemaFile
    ? path.isAbsolute(config.outputs.sqliteSchemaFile)
      ? config.outputs.sqliteSchemaFile
      : path.join(process.cwd(), config.outputs.sqliteSchemaFile)
    : DEFAULT_OUTPUT_SQLITE_SCHEMA_FILE;

  const outputTableMetaFile = config.outputs?.tableMetaFile
    ? path.isAbsolute(config.outputs.tableMetaFile)
      ? config.outputs.tableMetaFile
      : path.join(process.cwd(), config.outputs.tableMetaFile)
    : DEFAULT_OUTPUT_TABLE_META_FILE;

  const outputAppTableMetaFile = config.outputs?.appTableMetaFile
    ? path.isAbsolute(config.outputs.appTableMetaFile)
      ? config.outputs.appTableMetaFile
      : path.join(process.cwd(), config.outputs.appTableMetaFile)
    : path.join(__dirname, "../../shared/table-meta.ts");

  const outputWorkerPgSchemaFile = config.outputs?.workerPgSchemaFile
    ? path.isAbsolute(config.outputs.workerPgSchemaFile)
      ? config.outputs.workerPgSchemaFile
      : path.join(process.cwd(), config.outputs.workerPgSchemaFile)
    : DEFAULT_OUTPUT_WORKER_PG_SCHEMA_FILE;

  const outputWorkerConfigFile = config.outputs?.workerConfigFile
    ? path.isAbsolute(config.outputs.workerConfigFile)
      ? config.outputs.workerConfigFile
      : path.join(process.cwd(), config.outputs.workerConfigFile)
    : DEFAULT_OUTPUT_WORKER_CONFIG_FILE;

  const {
    columns,
    primaryKeys,
    uniqueConstraints,
    indexes,
    foreignKeys,
    tableComments,
    columnComments,
  } = await introspect({ databaseUrl: args.databaseUrl, schema: args.schema });

  const next = buildSchemaTs({
    schema: args.schema,
    columns,
    primaryKeys,
    uniqueConstraints,
    indexes,
    foreignKeys,
    strict: args.strict,
  });

  const allTables = getAllTableNames(columns);
  const columnsByTable = getTableColumns(columns);
  const pkByTable = getPrimaryKeyByTable(primaryKeys);
  const uniqueByTable = getUniqueConstraintsByTable(uniqueConstraints);

  const legacyWhitelist =
    Array.isArray(config.tableMeta?.syncableTables) &&
    config.tableMeta?.syncableTables.length > 0
      ? [...(config.tableMeta?.syncableTables ?? [])]
      : null;

  const excluded = new Set<string>(["schema_migrations", "drizzle_migrations"]);
  for (const t of config.tableMeta?.excludeTables ?? []) excluded.add(t);
  for (const row of tableComments) {
    const tags = parseOosyncTableTags(row.comment);
    if (tags.exclude) excluded.add(row.table_name);
  }

  const syncableTables = inferSyncableTables({
    allTables,
    pkByTable,
    legacyWhitelist,
    excluded,
  });

  const inferredRegistry = inferTableMetaCore({
    columnsByTable,
    pkByTable,
    uniqueByTable,
    overrides: config.tableMeta?.overrides ?? {},
  });

  // Legacy full registry still supported as an override layer.
  const tableRegistryCore: Record<string, ITableMetaCore> = {
    ...inferredRegistry,
    ...(config.tableMeta?.tableRegistryCore ?? {}),
  };

  const columnDescriptionsByTable: Record<string, Record<string, string>> = {};
  for (const row of columnComments) {
    if (!row.comment) continue;
    if (!columnDescriptionsByTable[row.table_name]) {
      columnDescriptionsByTable[row.table_name] = {};
    }
    columnDescriptionsByTable[row.table_name][row.column_name] = row.comment;
  }

  const nextTableMeta = buildTableMetaTs({
    schema: args.schema,
    columns,
    primaryKeys,
    uniqueConstraints,
    strict: args.strict,
    syncableTables,
    tableRegistryCore,
    columnDescriptionsByTable,
  });

  const changeCategoryByTable: Record<string, ChangeCategory> = {
    ...(config.tableMeta?.changeCategoryByTable ?? {}),
  };
  for (const row of tableComments) {
    const tags = parseOosyncTableTags(row.comment);
    if (typeof tags.changeCategory !== "undefined") {
      changeCategoryByTable[row.table_name] = tags.changeCategory;
    }
  }

  const normalizeDatetimeByTable: Record<string, string[]> = {
    ...(config.tableMeta?.normalizeDatetimeByTable ?? {}),
  };
  for (const row of tableComments) {
    const tags = parseOosyncTableTags(row.comment);
    if (tags.normalizeDatetime && tags.normalizeDatetime.length > 0) {
      normalizeDatetimeByTable[row.table_name] = tags.normalizeDatetime;
    }
  }

  const ownerColumnOverrideByTable: Record<string, string> = {};
  for (const row of tableComments) {
    const tags = parseOosyncTableTags(row.comment);
    if (tags.ownerColumn)
      ownerColumnOverrideByTable[row.table_name] = tags.ownerColumn;
  }

  const tableSyncOrder = buildTableSyncOrder({
    tables: syncableTables,
    foreignKeys,
    overrides: config.tableMeta?.tableSyncOrderOverrides ?? {},
  });

  const tableToSchemaKey = buildTableToSchemaKeyMap({
    tables: syncableTables,
    overrides: config.tableMeta?.tableToSchemaKeyOverrides ?? {},
  });

  const nextAppTableMeta = buildAppTableMetaTs({
    schema: args.schema,
    syncableTables,
    changeCategoryByTable,
    normalizeDatetimeByTable,
    tableSyncOrder,
    tableToSchemaKey,
    columnDescriptionsByTable,
  });

  const nextWorkerPgSchema = buildPgSchemaTs({
    schema: args.schema,
    columns,
    primaryKeys,
    strict: args.strict,
  });

  const defaultWorkerConfig = buildDefaultWorkerConfig({
    syncableTables,
    columnsByTable,
    foreignKeys,
    tableRegistryCore,
    ownerColumnOverrideByTable,
  });
  const mergedWorkerConfig = mergeWorkerConfigs(
    defaultWorkerConfig,
    config.worker?.config ?? {}
  );
  const nextWorkerConfig = buildWorkerConfigTs({
    schema: args.schema,
    config: mergedWorkerConfig,
  });

  const formattedSchema = formatWithBiome(outputSchemaFile, next);
  const formattedTableMeta = formatWithBiome(
    outputTableMetaFile,
    nextTableMeta
  );
  const formattedAppTableMeta = formatWithBiome(
    outputAppTableMetaFile,
    nextAppTableMeta
  );
  const formattedWorkerPgSchema = formatWithBiome(
    outputWorkerPgSchemaFile,
    nextWorkerPgSchema
  );
  const formattedWorkerConfig = formatWithBiome(
    outputWorkerConfigFile,
    nextWorkerConfig
  );

  if (args.check) {
    const current = fs.existsSync(outputSchemaFile)
      ? fs.readFileSync(outputSchemaFile, "utf8")
      : "";
    if (current !== formattedSchema) {
      throw new Error(
        `SQLite schema is out of date. Run: npm run codegen:schema (output: ${outputSchemaFile})`
      );
    }

    {
      const currentMeta = fs.existsSync(outputTableMetaFile)
        ? fs.readFileSync(outputTableMetaFile, "utf8")
        : "";
      if (currentMeta !== formattedTableMeta) {
        throw new Error(
          `Shared table metadata is out of date. Run: npm run codegen:schema (output: ${outputTableMetaFile})`
        );
      }
    }

    {
      const currentAppMeta = fs.existsSync(outputAppTableMetaFile)
        ? fs.readFileSync(outputAppTableMetaFile, "utf8")
        : "";
      if (currentAppMeta !== formattedAppTableMeta) {
        throw new Error(
          `App table metadata is out of date. Run: npm run codegen:schema (output: ${outputAppTableMetaFile})`
        );
      }
    }

    const currentWorkerSchema = fs.existsSync(outputWorkerPgSchemaFile)
      ? fs.readFileSync(outputWorkerPgSchemaFile, "utf8")
      : "";
    if (currentWorkerSchema !== formattedWorkerPgSchema) {
      throw new Error(
        `Worker Postgres schema is out of date. Run: npm run codegen:schema (output: ${outputWorkerPgSchemaFile})`
      );
    }

    const currentWorkerConfig = fs.existsSync(outputWorkerConfigFile)
      ? fs.readFileSync(outputWorkerConfigFile, "utf8")
      : "";
    if (currentWorkerConfig !== formattedWorkerConfig) {
      throw new Error(
        `Worker config is out of date. Run: npm run codegen:schema (output: ${outputWorkerConfigFile})`
      );
    }
    // eslint-disable-next-line no-console
    console.log(
      "✅ Schemas + metadata are up to date (via Postgres introspection)."
    );
    return;
  }

  fs.writeFileSync(outputSchemaFile, formattedSchema, "utf8");
  fs.mkdirSync(path.dirname(outputTableMetaFile), { recursive: true });
  fs.writeFileSync(outputTableMetaFile, formattedTableMeta, "utf8");

  fs.mkdirSync(path.dirname(outputAppTableMetaFile), { recursive: true });
  fs.writeFileSync(outputAppTableMetaFile, formattedAppTableMeta, "utf8");

  fs.mkdirSync(path.dirname(outputWorkerPgSchemaFile), { recursive: true });
  fs.writeFileSync(outputWorkerPgSchemaFile, formattedWorkerPgSchema, "utf8");

  fs.mkdirSync(path.dirname(outputWorkerConfigFile), { recursive: true });
  fs.writeFileSync(outputWorkerConfigFile, formattedWorkerConfig, "utf8");
  // eslint-disable-next-line no-console
  console.log(
    `✅ Wrote ${path.relative(process.cwd(), outputSchemaFile)}, ${path.relative(
      process.cwd(),
      outputTableMetaFile
    )}, and ${path.relative(process.cwd(), outputAppTableMetaFile)} (plus worker artifacts)`
  );
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
