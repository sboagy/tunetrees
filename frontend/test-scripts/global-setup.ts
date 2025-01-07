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
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setupDatabase } from "./setup-database";

// eslint-disable-next-line @typescript-eslint/naming-convention
const __filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = path.dirname(__filename);

const pidFilePath = path.resolve(tunetreesBackendDeployBaseDir, "fastapi.pid");

async function globalSetup() {
  const checkServer = async () => {
    try {
      const response = await axios.get("http://localhost:8000/hello/test");
      return response.status === 200;
    } catch {
      return false;
    }
  };

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
    ["tunetrees.api.main:app", "--host", "0.0.0.0", "--port", "8000"],
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
        TT_REVIEW_SITDOWN_DATE:
          process.env.TT_REVIEW_SITDOWN_DATE || "2024-07-08 12:27:08",
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
  for (let i = 0; i < 10; i++) {
    serverUp = await checkServer();
    if (serverUp) break;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  if (!serverUp) {
    console.error("Server did not start in time.");
    throw new Error("Server did not start in time.");
  }

  console.log("Server is up and running.");
}

export default globalSetup;
