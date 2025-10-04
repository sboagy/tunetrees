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

// Dynamically determine the virtual environment's lib directory for PYTHONPATH
function getVenvLibDir(): string {
  const venvLibPath = path.resolve(tunetreesBackendDeployBaseDir, ".venv/lib");

  if (!fs.existsSync(venvLibPath)) {
    throw new Error(
      `Virtual environment lib directory not found: ${venvLibPath}`,
    );
  }

  // Find the python directory (e.g., python3.12, python3.11, etc.)
  const libEntries = fs.readdirSync(venvLibPath);
  const pythonDir = libEntries.find((entry) => entry.startsWith("python3."));

  if (!pythonDir) {
    throw new Error(
      `No python3.x directory found in ${venvLibPath}. Available entries: ${libEntries.join(", ")}`,
    );
  }

  return path.resolve(venvLibPath, pythonDir, "site-packages");
}

export const venvLibDir = getVenvLibDir();

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
