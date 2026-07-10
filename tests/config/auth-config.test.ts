import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(__dirname, "..", "..");
const migrationsDir = path.join(projectRoot, "supabase", "migrations");

// biome-ignore lint/suspicious/noExportsInTest: exported for future callers that need to scan migration SQL files with scoped _archive filtering
export function getSqlFilesRecursively(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const sqlFiles: string[] = [];

  // Only exclude _archive directories when scanning within the supabase/migrations
  // tree. Other callers should not silently skip directories starting with _archive.
  const isMigrationsDir =
    dir === migrationsDir || dir.startsWith(migrationsDir + path.sep);

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (isMigrationsDir && entry.name.startsWith("_archive")) continue;
      sqlFiles.push(...getSqlFilesRecursively(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".sql")) {
      sqlFiles.push(fullPath);
    }
  }

  return sqlFiles;
}

describe("Supabase auth configuration", () => {
  it("keeps anonymous sign-ins enabled in config.toml", () => {
    const configPath = path.join(projectRoot, "supabase", "config.toml");
    const configContents = fs.readFileSync(configPath, "utf8");

    expect(configContents).toMatch(/enable_anonymous_sign_ins\s*=\s*true/);
  });
});
