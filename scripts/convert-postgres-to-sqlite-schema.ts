/**
 * PostgreSQL to SQLite Schema Converter
 *
 * ⚠️  WARNING: This script is incomplete and has known issues!
 *
 * TOFIX: The regex-based approach cannot reliably handle:
 * - Nested braces in pgPolicy({ as: "permissive", ... })
 * - Multi-line sql`` templates in check constraints
 * - Complex nested structures
 *
 * Better approaches:
 * 1. Use ts-morph or another AST parser to properly parse TypeScript
 * 2. Use Drizzle's introspect feature instead (reads from actual SQLite DB)
 * 3. Manually apply schema changes to both PostgreSQL and SQLite
 *
 * Current workflow that DOES work:
 * 1. Make changes in Supabase (PostgreSQL)
 * 2. npx drizzle-kit pull (get updated PostgreSQL schema)
 * 3. Manually apply same changes to SQLite database
 * 4. npx drizzle-kit introspect --config=drizzle.config.sqlite.ts
 * 5. cp drizzle/migrations/sqlite/schema.ts drizzle/schema-sqlite.ts
 *
 * This script was an attempt to automate step 3, but regex isn't the right tool.
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_FILE = path.join(
  __dirname,
  "../drizzle/migrations/postgres/schema.ts"
);
const OUTPUT_FILE = path.join(__dirname, "../drizzle/schema-sqlite.ts");
const BACKUP_FILE = path.join(__dirname, "../drizzle/schema-sqlite.backup.ts");

function convert(): void {
  console.log("🔄 PostgreSQL → SQLite Schema Converter (V3 - Full Text)\n");

  // Read input
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`❌ Error: Input file not found: ${INPUT_FILE}`);
    process.exit(1);
  }

  let content = fs.readFileSync(INPUT_FILE, "utf-8");
  console.log(`✅ Read: ${INPUT_FILE}`);

  // Backup
  if (fs.existsSync(OUTPUT_FILE)) {
    fs.copyFileSync(OUTPUT_FILE, BACKUP_FILE);
    console.log(`💾 Backup: ${BACKUP_FILE}`);
  }

  console.log("\n🔧 Applying transformations...\n");

  // 1. Remove imports we don't need
  console.log("  1. Cleaning imports...");
  content = content.replace(/import \{ sql \} from "drizzle-orm";\?/g, "");

  // 2. Remove pgView definitions (multi-line with sql templates)
  console.log("  2. Removing views...");
  content = content.replace(/export const \w+ = pgView\([^;]*\);?\n?/gs, "");

  // TOFIX: These regex patterns fail on nested structures
  // Problem: pgPolicy and check constraints have nested braces/parens
  // that simple regex patterns like [^}]* can't handle properly.
  //
  // Better approaches:
  // 1. Use a proper TypeScript AST parser (e.g., ts-morph)
  // 2. Use a multi-pass approach with brace counting
  // 3. Just manually edit or use simpler line-based removal
  //
  // Current regex attempts leave orphaned closing brackets like }),

  // 3. Remove pgPolicy calls (they can span multiple lines)
  console.log("  3. Removing RLS policies...");
  // TOFIX: This pattern stops at first } but policies have nested objects like { as: "permissive" }
  content = content.replace(/\s*pgPolicy\([^}]*\}\),?\s*\n?/gs, "");

  // 4. Remove check constraints (can span multiple lines with sql templates)
  console.log("  4. Removing check constraints...");
  // TOFIX: This pattern doesn't handle closing ) on separate lines properly
  content = content.replace(
    /\s*check\("[^"]*",\s*sql`[^`]*`\s*\),?\s*\n?/gs,
    ""
  );

  // 5. Transform imports
  console.log("  5. Converting imports...");
  content = content.replace(
    /from "drizzle-orm\/pg-core"/g,
    'from "drizzle-orm/sqlite-core"'
  );
  content = content.replace(/pgTable/g, "sqliteTable");
  content = content.replace(/, pgPolicy/g, "");
  content = content.replace(/, pgView/g, "");
  content = content.replace(/, check/g, "");

  // 6. Transform column types
  console.log("  6. Converting column types...");

  // serial
  content = content.replace(
    /(\w+): serial\("([^"]+)"\)\.primaryKey\(\)/g,
    '$1: integer("$2").primaryKey({ autoIncrement: true })'
  );
  content = content.replace(
    /(\w+): serial\(\)\.primaryKey\(\)/g,
    '$1: integer("$1").primaryKey({ autoIncrement: true })'
  );
  content = content.replace(/(\w+): serial\("([^"]+)"\)/g, '$1: integer("$2")');
  content = content.replace(/(\w+): serial\(\)/g, '$1: integer("$1")');

  // boolean
  content = content.replace(
    /(\w+): boolean\("([^"]+)"\)\.default\(true\)/g,
    '$1: integer("$2").default(1)'
  );
  content = content.replace(
    /(\w+): boolean\("([^"]+)"\)\.default\(false\)/g,
    '$1: integer("$2").default(0)'
  );
  content = content.replace(
    /(\w+): boolean\(\)\.default\(true\)/g,
    '$1: integer("$1").default(1)'
  );
  content = content.replace(
    /(\w+): boolean\(\)\.default\(false\)/g,
    '$1: integer("$1").default(0)'
  );
  content = content.replace(
    /(\w+): boolean\("([^"]+)"\)/g,
    '$1: integer("$2")'
  );
  content = content.replace(/(\w+): boolean\(\)/g, '$1: integer("$1")');

  // timestamp
  content = content.replace(/(\w+): timestamp\([^)]*\)/g, '$1: text("$1")');
  content = content.replace(
    /\.defaultNow\(\)/g,
    ".$defaultFn(() => new Date().toISOString())"
  );

  // uuid
  content = content.replace(/(\w+): uuid\("([^"]+)"\)/g, '$1: text("$2")');
  content = content.replace(/(\w+): uuid\(\)/g, '$1: text("$1")');

  // 7. Clean up indexes
  console.log("  7. Cleaning up indexes...");
  content = content.replace(/\.(asc|desc|nullsLast|nullsFirst)\(\)/g, "");
  content = content.replace(/\.op\("[^"]+"\)/g, "");
  content = content.replace(/\.using\("btree",\s*/g, ".on(");

  // 8. Add header
  console.log("  8. Adding header...");
  const header = `/**
 * TuneTrees SQLite WASM Schema (Local Offline Database)
 * 
 * This schema mirrors the PostgreSQL schema but uses SQLite-specific types.
 * It provides offline-first storage with bidirectional sync to Supabase.
 * 
 * Auto-generated by: scripts/convert-postgres-to-sqlite-schema-v3.ts
 * Source: drizzle/migrations/postgres/schema.ts
 * Generated: ${new Date().toISOString()}
 * 
 * Key differences from PostgreSQL schema:
 * - INTEGER for booleans (0/1 instead of true/false)
 * - INTEGER for primary keys with autoincrement
 * - TEXT for UUIDs (no native UUID type)
 * - TEXT for timestamps (ISO 8601 strings)
 * - REAL for floating-point numbers (same as PostgreSQL)
 */

`;

  // 9. Skip cleanup - the pre-cleanup version works fine
  // TOFIX: The cleanup filter was too aggressive and removed legitimate }),
  // closings from foreignKey statements. This step should either:
  // 1. Be smarter about what's an orphan vs legitimate syntax, OR
  // 2. Not exist at all if the regex patterns above work correctly
  console.log("  9. Skipping cleanup (causes more problems than it solves)...");

  content = header + content;

  // Write output
  fs.writeFileSync(OUTPUT_FILE, content, "utf-8");
  console.log("\nWritten: " + OUTPUT_FILE);

  console.log("\nConversion complete!");
  console.log("\nNext Steps:");
  console.log("   1. Review: drizzle/schema-sqlite.ts");
  console.log(
    "   2. Apply:  npx drizzle-kit push --config=drizzle.config.sqlite.ts"
  );
  console.log('   3. Verify: sqlite3 tunetrees_local.sqlite3 ".tables"');
}

// Run conversion
convert();
