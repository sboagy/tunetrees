import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load environment variables from .env.local (override any .env values)
loadEnv({ path: ".env.local", override: true });

/**
 * Drizzle Kit Configuration
 *
 * This config supports two database schemas:
 * 1. PostgreSQL (Supabase) - Cloud database for server sync
 * 2. SQLite (WASM) - Local offline database
 *
 * Environment variables required:
 * - VITE_SUPABASE_URL: Supabase project URL
 * - VITE_SUPABASE_ANON_KEY: Supabase anonymous key
 * - DATABASE_URL: PostgreSQL connection string (for migrations)
 *
 * Usage:
 * - Generate PostgreSQL migrations: npx drizzle-kit generate
 * - Generate SQLite migrations: npx drizzle-kit generate --config=drizzle.config.sqlite.ts
 * - Push to Supabase: npx drizzle-kit push
 * - Open Drizzle Studio: npx drizzle-kit studio
 */

export default defineConfig({
  // Schema files
  schema: "./drizzle/schema-postgres.ts",

  // Output directory for migrations
  out: "./drizzle/migrations/postgres",

  // Database driver
  dialect: "postgresql",

  // Database connection
  dbCredentials: {
    url: process.env.DATABASE_URL || "",
  },

  // Drizzle Studio configuration
  verbose: true,
  strict: true,

  // Migration configuration
  migrations: {
    table: "drizzle_migrations",
    schema: "public",
  },
});
