import path from "node:path";
import { fileURLToPath } from "node:url";

// eslint-disable-next-line @typescript-eslint/naming-convention
const __filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = path.dirname(__filename);

export const frontendDirPath = path.resolve(__dirname, "..");
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
