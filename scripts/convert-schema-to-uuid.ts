/**
 * Script to convert schema-postgres.ts from integer IDs to UUID IDs
 *
 * This script performs a comprehensive conversion:
 * 1. serial("id") → uuid("id").primaryKey().$defaultFn(() => generateId())
 * 2. integer("*_ref") → uuid("*_ref") for foreign keys
 * 3. integer("*_id") → uuid("*_id") for foreign keys
 * 4. Adds generateId import
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const schemaPath = path.join(__dirname, "../drizzle/schema-postgres.ts");
let content = fs.readFileSync(schemaPath, "utf-8");

console.log("Converting schema-postgres.ts to UUID-based schema...\n");

// Track replacements
let replacements = 0;

// 1. Convert serial() primary keys to uuid()
const serialPatterns = [
  {
    from: /id: serial\("id"\)\.primaryKey\(\)/g,
    to: 'id: uuid("id").primaryKey().$defaultFn(() => generateId())',
  },
  {
    from: /playlistId: serial\("playlist_id"\)\.primaryKey\(\)/g,
    to: 'playlistId: uuid("playlist_id").primaryKey().$defaultFn(() => generateId())',
  },
  {
    from: /tagId: serial\("tag_id"\)\.primaryKey\(\)/g,
    to: 'tagId: uuid("tag_id").primaryKey().$defaultFn(() => generateId())',
  },
];

for (const pattern of serialPatterns) {
  const matches = content.match(pattern.from);
  if (matches) {
    content = content.replace(pattern.from, pattern.to);
    replacements += matches.length;
    console.log(`✓ Replaced ${matches.length} serial() PK with uuid()`);
  }
}

// 2. Convert integer foreign keys to uuid
const fkPatterns = [
  // User references
  { from: /integer\("user_ref"\)/g, to: 'uuid("user_ref")' },
  { from: /integer\("user_id"\)/g, to: 'uuid("user_id")' },
  { from: /integer\("private_for"\)/g, to: 'uuid("private_for")' },
  { from: /integer\("private_to_user"\)/g, to: 'uuid("private_to_user")' },

  // Tune references
  { from: /integer\("tune_ref"\)/g, to: 'uuid("tune_ref")' },
  { from: /integer\("tune_id"\)/g, to: 'uuid("tune_id")' },

  // Playlist references
  { from: /integer\("playlist_ref"\)/g, to: 'uuid("playlist_ref")' },
  { from: /integer\("playlist_id"\)/g, to: 'uuid("playlist_id")' },

  // Instrument reference
  { from: /integer\("instrument_ref"\)/g, to: 'uuid("instrument_ref")' },

  // Other ID fields
  { from: /integer\("current_tune"\)/g, to: 'uuid("current_tune")' },
];

for (const pattern of fkPatterns) {
  const matches = content.match(pattern.from);
  if (matches) {
    content = content.replace(pattern.from, pattern.to);
    replacements += matches.length;
    console.log(
      `✓ Replaced ${matches.length} integer("${
        pattern.from.source.match(/"([^"]+)"/)?.[1]
      }") with uuid()`
    );
  }
}

// 3. Verify generateId is imported (should already be there)
if (!content.includes("import { generateId }")) {
  console.error("❌ ERROR: generateId import not found!");
  process.exit(1);
}

console.log(`\n✓ Total replacements: ${replacements}`);

// 4. Write the updated content
fs.writeFileSync(schemaPath, content, "utf-8");

console.log(`✓ Schema file updated: ${schemaPath}`);
console.log("\nNext steps:");
console.log("1. Review the changes: git diff drizzle/schema-postgres.ts");
console.log("2. Check TypeScript errors: npm run typecheck");
console.log(
  "3. Push schema to Supabase: npx drizzle-kit push --config=drizzle.config.ts"
);
