# PostgreSQL to SQLite Schema Converter

This script automates the conversion of Drizzle PostgreSQL schemas to SQLite schemas with appropriate type mappings.

## Purpose

When you make changes to the Supabase PostgreSQL schema (adding columns, tables, or relations), this script helps you:

1. **Automatically convert** PostgreSQL types to SQLite equivalents
2. **Maintain schema parity** between cloud (Supabase) and local (SQLite WASM)
3. **Save time** - no manual type conversions needed
4. **Reduce errors** - consistent, repeatable conversions

## When to Use

- ✅ Adding new columns to Supabase tables
- ✅ Adding new tables to Supabase
- ✅ Adding new foreign key relations
- ✅ Modifying column types in Supabase
- ✅ After running `npx drizzle-kit pull` to get latest Supabase schema

## Workflow

### Standard Workflow (Supabase → SQLite)

```bash
# 1. Make changes to Supabase PostgreSQL
#    (via Supabase SQL Editor or migrations)

# 2. Pull latest schema from Supabase
npx drizzle-kit pull

# 3. Run conversion script
npx tsx scripts/convert-postgres-to-sqlite-schema.ts

# 4. Review generated SQLite schema
code drizzle/schema-sqlite.ts

# 5. Apply to local SQLite database
npx drizzle-kit push --config=drizzle.config.sqlite.ts

# 6. Verify tables created
sqlite3 tunetrees_local.sqlite3 ".tables"
```

### Example: Adding a New Column

```bash
# 1. Add column in Supabase SQL Editor
ALTER TABLE tune ADD COLUMN complexity integer DEFAULT 1;

# 2. Pull schema
npx drizzle-kit pull
# → Updates drizzle/migrations/postgres/schema.ts

# 3. Convert
npx tsx scripts/convert-postgres-to-sqlite-schema.ts
# → Updates drizzle/schema-sqlite.ts
# → Creates backup: drizzle/schema-sqlite.ts.bak

# 4. Review changes
git diff drizzle/schema-sqlite.ts

# 5. Apply to SQLite
npx drizzle-kit push --config=drizzle.config.sqlite.ts

# 6. Verify
sqlite3 tunetrees_local.sqlite3 "PRAGMA table_info(tune);"
```

## Type Conversions

The script automatically handles these type mappings:

| PostgreSQL          | SQLite                                 | Example                                              |
| ------------------- | -------------------------------------- | ---------------------------------------------------- |
| `serial`            | `integer` (autoIncrement)              | `id: serial()` → `id: integer()`                     |
| `bigserial`         | `integer`                              | `id: bigserial()` → `id: integer()`                  |
| `integer`           | `integer`                              | 1:1 mapping                                          |
| `bigint`            | `integer`                              | `count: bigint()` → `count: integer()`               |
| `boolean`           | `integer` (0/1)                        | `deleted: boolean()` → `deleted: integer()`          |
| `text`              | `text`                                 | 1:1 mapping                                          |
| `varchar`           | `text`                                 | `name: varchar(255)` → `name: text()`                |
| `uuid`              | `text`                                 | `id: uuid()` → `id: text()`                          |
| `timestamp`         | `text` (ISO 8601)                      | `created_at: timestamp()` → `created_at: text()`     |
| `timestamp with tz` | `text` (ISO 8601 with tz)              | Same as timestamp                                    |
| `date`              | `text` (ISO 8601)                      | `birth_date: date()` → `birth_date: text()`          |
| `real`              | `real`                                 | 1:1 mapping                                          |
| `doublePrecision`   | `real`                                 | `stability: doublePrecision()` → `stability: real()` |
| `numeric`           | `real`                                 | `price: numeric()` → `price: real()`                 |
| `json`              | `text`                                 | `metadata: json()` → `metadata: text()`              |
| `jsonb`             | `text`                                 | `data: jsonb()` → `data: text()`                     |
| `.defaultNow()`     | `.$defaultFn(() => ISO)`               | Auto-converts to ISO 8601 string                     |
| `.primaryKey()`     | `.primaryKey({ autoIncrement: true })` | For `serial` types                                   |
| `foreignKey()`      | Same                                   | 1:1 mapping                                          |
| `unique()`          | Same                                   | 1:1 mapping                                          |
| `index()`           | Same                                   | 1:1 mapping                                          |

### Removed (PostgreSQL-Only)

These are automatically removed from SQLite schema:

- ❌ `pgPolicy()` - Row Level Security (RLS) policies
- ❌ `check()` - Check constraints
- ❌ Views (not exported by Drizzle)

## Output

The script generates:

1. **Updated SQLite schema**: `drizzle/schema-sqlite.ts`
2. **Backup of old schema**: `drizzle/schema-sqlite.ts.bak`
3. **Conversion statistics**:

   ```
   📊 Conversion Statistics:
      Tables:       19
      Columns:      214
      Foreign Keys: 28
      Indexes:      17

   🔄 Type Conversions:
      serial → integer:    19
      boolean → integer:   12
      timestamp → text:    32
      uuid → text:         4
   ```

## Manual Adjustments

After running the script, you may need to manually adjust:

### 1. Sync Columns

If adding new user-editable tables, add sync columns:

```typescript
import { sqliteSyncColumns } from "../drizzle/sync-columns";

export const myNewTable = sqliteTable("my_new_table", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name"),

  // Add sync columns
  ...sqliteSyncColumns,
});
```

### 2. Special SQLite Features

Add SQLite-specific optimizations:

```typescript
export const tune = sqliteTable(
  "tune",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title"),
    deleted: integer("deleted").default(0).notNull(),
  },
  (t) => [
    // Partial index (SQLite-specific optimization)
    index("idx_active_tunes")
      .on(t.id)
      .where(sql`deleted = 0`),
  ]
);
```

### 3. Reference Data Tables

Tables like `genre`, `tune_type` don't need sync columns:

```typescript
// ❌ Don't add sync columns to reference tables
export const genre = sqliteTable("genre", {
  id: text("id").primaryKey(),
  name: text("name"),
  // NO sync columns - this is system data
});
```

## Troubleshooting

### Script Fails

```bash
# Error: Input file not found
# Solution: Run drizzle-kit pull first
npx drizzle-kit pull

# Error: TypeScript compilation error
# Solution: Install tsx if missing
npm install -D tsx
```

### Type Conversion Issues

If you see unexpected conversions:

1. **Check source schema**: `drizzle/migrations/postgres/schema.ts`
2. **Review conversion logic**: `scripts/convert-postgres-to-sqlite-schema.ts`
3. **Manual override**: Edit `drizzle/schema-sqlite.ts` directly

### Schema Drift

If SQLite and PostgreSQL schemas diverge:

```bash
# Re-pull from Supabase
npx drizzle-kit pull

# Re-convert
npx tsx scripts/convert-postgres-to-sqlite-schema.ts

# Compare with backup
diff drizzle/schema-sqlite.ts.bak drizzle/schema-sqlite.ts
```

## Integration with Git

Recommended `.gitignore` entry:

```gitignore
# Keep backups out of version control
drizzle/schema-sqlite.ts.bak
```

Commit workflow:

```bash
# After conversion
git add drizzle/schema-sqlite.ts
git commit -m "sync: Update SQLite schema from Supabase changes"
```

## Testing

After conversion, always test:

```bash
# 1. Push to SQLite
npx drizzle-kit push --config=drizzle.config.sqlite.ts

# 2. Verify tables
sqlite3 tunetrees_local.sqlite3 ".schema tune"

# 3. Check column types
sqlite3 tunetrees_local.sqlite3 "PRAGMA table_info(tune);"

# 4. Run unit tests
npm run test

# 5. Run E2E tests
npm run test:e2e
```

## Advanced Usage

### Dry Run (Preview Only)

```bash
# Just show what would change (doesn't write file)
npx tsx scripts/convert-postgres-to-sqlite-schema.ts --dry-run
```

### Custom Input/Output

Edit script to use different paths:

```typescript
const INPUT_FILE = path.join(__dirname, "../custom-schema.ts");
const OUTPUT_FILE = path.join(__dirname, "../output-schema.ts");
```

### Exclude Tables

Filter out specific tables:

```typescript
function convertTables(input: string, stats: ConversionStats): string {
  let output = input;

  // Remove specific table (example)
  output = output.replace(/export const sync_queue = [\s\S]*?\);/g, "");

  // ... rest of conversion
}
```

## FAQ

**Q: Do I need to run this every time?**  
A: Only when you make schema changes in Supabase.

**Q: Can I edit the generated SQLite schema?**  
A: Yes! The script creates a starting point. Manual tweaks are fine.

**Q: What if I add a table only in SQLite?**  
A: That's fine! SQLite can have tables that don't exist in PostgreSQL (e.g., `sync_queue`).

**Q: Does this sync data?**  
A: No! This only syncs schema structure. Use the sync engine for data.

**Q: Can I reverse the process (SQLite → PostgreSQL)?**  
A: Not with this script. Schema changes should originate in Supabase.

## Related

- **Schema Documentation**: `drizzle/README_SCHEMA_CHANGE_WORKFLOW.md`
- **Data Migration**: `scripts/migrate-production-to-supabase.ts`
- **Sync Engine**: `src/lib/sync/` (Phase 8 Task 3)

## Version History

- **v1.0.0** (2025-10-08): Initial version
  - PostgreSQL → SQLite conversion
  - All type mappings
  - Automatic backup
  - Statistics output
