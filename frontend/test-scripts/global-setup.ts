import {
  testDatabasePath,
  tunetreesBackendDeployBaseDir,
  venvBinDir,
  venvLibDir,
} from "@/test-scripts/paths-for-tests";
import { setFastapiProcess } from "@/test-scripts/process-store";
import axios from "axios";
import { type ChildProcess, spawn } from "node:child_process";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import globalTeardown from "./global-teardown";
import { setupDatabase } from "./setup-database";

// eslint-disable-next-line @typescript-eslint/naming-convention
const __filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = path.dirname(__filename);

const pidFilePath = path.resolve(tunetreesBackendDeployBaseDir, "fastapi.pid");

const checkServer = async () => {
  try {
    const response = await axios.get("http://localhost:8000/hello/test");
    return response.status === 200;
  } catch {
    return false;
  }
};

async function globalSetup() {
  // Set default sitdown date for tests from env, if not already set
  if (!process.env.NEXT_PUBLIC_TT_SITDOWN_DATE_DEFAULT) {
    process.env.NEXT_PUBLIC_TT_SITDOWN_DATE_DEFAULT =
      // "1970-01-01T11:47:57.671465-00:00";
      "2024-07-08 12:27:08";
  }

  const serverPreUp = await checkServer();
  if (serverPreUp) {
    console.log("Server is already up and running.");
    return;
  }

  await setupDatabase();

  console.log("Database Path:", testDatabasePath);
  try {
    await fs.promises.access(testDatabasePath);
    console.log("Database file is accessible.");
  } catch (error) {
    console.error("Database file is not accessible:", error);
  }

  const testResultsDir = path.resolve(__dirname, "../test-results");
  if (!fs.existsSync(testResultsDir)) {
    fs.mkdirSync(testResultsDir, { recursive: true });
  }

  const fastAPILog = path.resolve(testResultsDir, "fastapi.log");

  console.log(`Backend logs will be written to ${fastAPILog}`);

  const timestamp = new Date().toISOString();
  await fs.promises.writeFile(fastAPILog, `Server started at: ${timestamp}\n`);

  const fastAPIFd = fs.openSync(fastAPILog, "a");

  const fastapiProcess: ChildProcess = spawn(
    path.join(venvBinDir, "uvicorn"),
    [
      "tunetrees.api.main:app",
      "--reload",
      "--host",
      "0.0.0.0",
      "--port",
      "8000",
    ],
    {
      env: {
        ...process.env,
        PATH: `${venvBinDir}:${process.env.PATH}`,
        PYTHONPATH: `${tunetreesBackendDeployBaseDir}:${venvLibDir}:${process.env.PYTHONPATH || ""}`,
        PYTHONDONTWRITEBYTECODE: "1",
        PYTHONUNBUFFERED: "1",
        TUNETREES_DB: process.env.TUNETREES_DB || `${testDatabasePath}`,
        TUNETREES_DEPLOY_BASE_DIR:
          process.env.TUNETREES_DEPLOY_BASE_DIR ||
          `${tunetreesBackendDeployBaseDir}`,
        LOGLEVEL: "DEBUG",
        // TT_REVIEW_SITDOWN_DATE is deprecated and no longer used
      },
      stdio: ["ignore", fastAPIFd, fastAPIFd],
    },
  );

  setFastapiProcess(fastapiProcess);

  if (fastapiProcess.pid) {
    await fs.promises.writeFile(pidFilePath, fastapiProcess.pid.toString());
  }

  fastapiProcess.on("close", (code) => {
    console.log(`child process exited with code ${code}`);
  });

  await new Promise((resolve) => setTimeout(resolve, 1000));

  let serverUp = false;
  for (let i = 0; i < 20; i++) {
    // Reduced from 30 to 20 attempts
    serverUp = await checkServer();
    if (serverUp) break;
    await new Promise((resolve) => setTimeout(resolve, 1500)); // Reduced from 2000ms to 1500ms
  }

  if (!serverUp) {
    console.error("Server did not start in time.");
    throw new Error("Server did not start in time.");
  }

  console.log("Server is up and running.");
}

export default globalSetup;

export const NO_PID = 0;
export const INVALID_PID = -1;

async function restartBackendHard() {
  console.warn(
    "Failed to update reloadTriggerFile. Attempting fallback strategy.",
  );
  await globalTeardown();
  // Make sure the server is down
  for (let i = 0; i < 10; i++) {
    const serverUp = await checkServer();
    if (!serverUp) break;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  await globalSetup();
}

export async function restartBackend() {
  // copy the clean database to the test database
  await setupDatabase();

  try {
    // This is an uber hacky way to restart the FastAPI server,
    // given it was started with --reload.
    // and CoPilot does not approve.  But I think it's massively simpler
    // for testing purposes than trying to make the signal handling work.
    const reloadTriggerFile = path.resolve(
      tunetreesBackendDeployBaseDir,
      "tunetrees/api/reload_trigger.py",
    );
    try {
      const dateNow = new Date();
      const timeNow = dateNow.getTime();

      await fsPromises.utimes(reloadTriggerFile, dateNow, dateNow);
      // Verify the change
      const stats = await fsPromises.stat(reloadTriggerFile);
      if (stats.mtime.getTime() !== timeNow) {
        // Fallback strategy implementation
        await restartBackendHard();
        return;
      }
    } catch {
      // Fallback strategy implementation
      await restartBackendHard();
      return;
    }
    // Increase wait time in CI environment and add health check
    const waitTime = process.env.CI ? 5000 : 2000;
    await new Promise((resolve) => setTimeout(resolve, waitTime));
    
    // Add health check to ensure server is actually ready
    let serverReady = false;
    for (let i = 0; i < 10; i++) {
      try {
        const response = await axios.get("http://localhost:8000/hello/test");
        if (response.status === 200) {
          serverReady = true;
          break;
        }
      } catch {
        // Server not ready yet, wait a bit more
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    
    if (!serverReady) {
      console.warn("FastAPI server may not be fully ready after restart");
    }
    
    console.log("FastAPI server hopefully reloaded (but not restarted).");
  } catch (error) {
    console.error("Error restarting FastAPI server:", error);
  }

  console.log("Global teardown complete.");
}
