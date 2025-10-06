import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit Configuration for SQLite WASM
 *
 * This config is for the local offline SQLite database.
 * Use this when generating migrations for the client-side database.
 *
 * Usage:
 * - Generate migrations: npx drizzle-kit generate --config=drizzle.config.sqlite.ts
 * - Push to local DB: npx drizzle-kit push --config=drizzle.config.sqlite.ts
 * - Open Studio: npx drizzle-kit studio --config=drizzle.config.sqlite.ts
 */

export default defineConfig({
  // Schema files
  schema: "./drizzle/schema-sqlite.ts",

  // Output directory for migrations
  out: "./drizzle/migrations/sqlite",

  // Database driver
  dialect: "sqlite",

  // Database connection
  dbCredentials: {
    url: "./tunetrees_local.sqlite3",
  },

  // Migration configuration
  verbose: true,
  strict: true,
});
