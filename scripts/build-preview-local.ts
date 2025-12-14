import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const scriptsDir = resolve(fileURLToPath(new URL(".", import.meta.url)));
const repoRoot = resolve(scriptsDir, "..");

dotenv.config({ path: resolve(repoRoot, ".env.local") });

const requiredVars = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"] as const;

for (const key of requiredVars) {
  const value = process.env[key];
  if (!value || value.trim().length === 0) {
    throw new Error(
      `Missing ${key}. Expected it in ${resolve(repoRoot, ".env.local")} or in the shell environment.`
    );
  }
}

execSync("vite build", {
  cwd: repoRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    // Ensure these override any .env.production values during the build.
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
  },
});
