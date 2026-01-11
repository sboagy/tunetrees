import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(__dirname, "..", "..");

describe("Supabase auth configuration", () => {
  it("keeps anonymous sign-ins enabled in config.toml", () => {
    const configPath = path.join(projectRoot, "supabase", "config.toml");
    const configContents = fs.readFileSync(configPath, "utf8");

    expect(configContents).toMatch(/enable_anonymous_sign_ins\s*=\s*true/);
  });

  it("includes a migration that enforces anonymous sign-ins", () => {
    const migrationsDir = path.join(projectRoot, "supabase", "migrations");
    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"));

    const enablePattern =
      /UPDATE\s+auth\.config\s+SET\s+enable_anonymous_sign_ins\s*=\s*TRUE/i;

    let hasEnablingMigration = false;
    for (const file of migrationFiles) {
      const contents = fs.readFileSync(path.join(migrationsDir, file), "utf8");
      if (enablePattern.test(contents)) {
        hasEnablingMigration = true;
        break;
      }
    }

    expect(hasEnablingMigration).toBe(true);
  });
});
