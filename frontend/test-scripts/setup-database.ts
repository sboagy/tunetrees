import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// eslint-disable-next-line @typescript-eslint/naming-convention
const __filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = path.dirname(__filename);

const cleanDatabasePath = path.resolve(
  __dirname,
  "../../tunetrees_test_clean.sqlite3",
);
export const testDatabasePath = path.resolve(
  __dirname,
  "../../tunetrees_test.sqlite3",
);
export const tunetreesBackendDeployBaseDir = path.join(__dirname, "../..");

// Determine the virtual environment's bin directory
export const venvBinDir = path.resolve(
  tunetreesBackendDeployBaseDir,
  ".venv/bin",
);

// Determine the virtual environment's lib directory for PYTHONPATH
export const venvLibDir = path.resolve(
  tunetreesBackendDeployBaseDir,
  ".venv/lib/python3.12/site-packages",
);

export async function setupDatabase(): Promise<void> {
  try {
    console.log(
      "===> setup-database.ts:18 ~ cleanDatabasePath: ",
      cleanDatabasePath,
    );
    console.log(
      "===> setup-database.ts:29 ~ testDatabasePath: ",
      testDatabasePath,
    );
    await fs.copyFile(cleanDatabasePath, testDatabasePath);
    function sleep(ms: number): Promise<void> {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    await sleep(1000);
    console.log("Database setup complete.");
  } catch (error) {
    console.error("Error setting up database:", error);
  }
}

export async function teardownDatabase(): Promise<void> {
  try {
    console.log("Database teardown complete.");
    function sleep(ms: number): Promise<void> {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    await sleep(1);
  } catch (error) {
    console.error("Error tearing down database:", error);
  }
}
