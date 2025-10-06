/**
 * Apply RLS Policies to Supabase PostgreSQL
 *
 * This script reads the RLS policies SQL file and executes it against Supabase.
 */

import { readFileSync } from "node:fs";
import { config as loadEnv } from "dotenv";
import postgres from "postgres";

// Load environment variables
loadEnv({ path: ".env.local", override: true });

async function applyRLSPolicies() {
  // Read the SQL file
  const sqlContent = readFileSync(
    "drizzle/migrations/postgres/0001_rls_policies.sql",
    "utf-8",
  );

  // Validate DATABASE_URL
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  // Connect to Supabase PostgreSQL
  const sql = postgres(process.env.DATABASE_URL, {
    max: 1,
    onnotice: () => {}, // Suppress NOTICE messages
  });

  console.log("🔐 Applying RLS policies to Supabase...\n");

  try {
    // Execute the SQL file
    await sql.unsafe(sqlContent);

    console.log("✅ RLS policies applied successfully!\n");
    console.log("Summary:");
    console.log("  - 16 user-owned tables protected");
    console.log("  - 3 reference tables (read-only for authenticated users)");
    console.log("  - ~60 policies created\n");

    await sql.end();
  } catch (error) {
    console.error("❌ Error applying RLS policies:");
    console.error(error);
    await sql.end();
    process.exit(1);
  }
}

applyRLSPolicies();
