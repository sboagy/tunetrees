import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// eslint-disable-next-line @typescript-eslint/naming-convention
const __filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = path.dirname(__filename);

export const frontendDirPath = path.resolve(__dirname, "..");
export const testResultsDirPath = path.resolve(frontendDirPath, "test-results");
export const outputDir = path.resolve(testResultsDirPath, "playwright");

export const tunetreesBackendDeployBaseDir = path.resolve(__dirname, "../..");
export const backendDirPath = tunetreesBackendDeployBaseDir;

export const testDatabasePath = path.resolve(
  backendDirPath,
  "tunetrees_test.sqlite3",
);

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

export const playwrightTestResulsDir = path.join(
  testResultsDirPath,
  "playwright",
);

export const videoDir = path.join(playwrightTestResulsDir, "videos");
if (!fs.existsSync(videoDir)) {
  fs.mkdirSync(videoDir, { recursive: true });
}
export const screenShotDir = path.join(playwrightTestResulsDir, "screenshots");
if (!fs.existsSync(screenShotDir)) {
  fs.mkdirSync(screenShotDir, { recursive: true });
}

export const initialPageLoadTimeout = process.env.CI === "true" ? 80000 : 30000; // 50s if CI, otherwise 30s
