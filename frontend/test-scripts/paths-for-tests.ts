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

// Use local .venv for development, CI path for CI environment
export const venvBinDir =
  process.env.CI === "true"
    ? "/home/runner/.local/bin"
    : path.resolve(backendDirPath, ".venv", "bin");

// Use the global Python installation lib directory for PYTHONPATH
export const venvLibDir: string = "";

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
