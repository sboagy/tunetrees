import { setFastapiProcess } from "@/scripts/process-store";
import {
  fastAPILog,
  setupDatabase,
  testDatabasePath,
  tunetreesBackendDeployBaseDir,
  venvBinDir,
  venvLibDir,
} from "@/scripts/setup-database";
import { test } from "@playwright/test";
import axios from "axios";
import { type ChildProcess, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// const execPromise = util.promisify(exec);

const pidFilePath = path.resolve(tunetreesBackendDeployBaseDir, "fastapi.pid");

test("setup", async () => {
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
    await fs.promises.writeFile(pidFilePath, "0");
    return;
  }

  // Setup the database
  await setupDatabase();

  // Verify database path
  console.log("Database Path:", testDatabasePath);
  try {
    await fs.promises.access(testDatabasePath);
    console.log("Database file is accessible.");
  } catch (error) {
    console.error("Database file is not accessible:", error);
  }

  // Create a write stream for logging
  const logFile = fs.createWriteStream(fastAPILog, {
    flags: "a",
  });

  // Start the FastAPI server
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
        TUNETREES_DB: `${testDatabasePath}`,
        TUNETREES_DEPLOY_BASE_DIR: `${tunetreesBackendDeployBaseDir}`,
        LOGLEVEL: "DEBUG",
        TT_REVIEW_SITDOWN_DATE: "2024-07-08 12:27:08",
      },
      stdio: ["pipe", "pipe", "pipe"], // Use pipe for stdio
    },
  );

  // Store the fastapiProcess in the shared module
  setFastapiProcess(fastapiProcess);

  // Write the PID to a file
  if (fastapiProcess.pid) {
    await fs.promises.writeFile(pidFilePath, fastapiProcess.pid.toString());
  }

  // Redirect stdout and stderr to the log file
  if (fastapiProcess.stdout) fastapiProcess.stdout.pipe(logFile);
  if (fastapiProcess.stderr) fastapiProcess.stderr.pipe(logFile);

  fastapiProcess.on("close", (code) => {
    console.log(`child process exited with code ${code}`);
  });

  // Wait for a few seconds to ensure the server has started
  await new Promise((resolve) => setTimeout(resolve, 1000));

  let serverUp = false;
  for (let i = 0; i < 10; i++) {
    // Try for 20 seconds
    serverUp = await checkServer();
    if (serverUp) break;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  if (!serverUp) {
    console.error("Server did not start in time.");
    throw new Error("Server did not start in time.");
  }

  console.log("Server is up and running.");

  console.log("Server should be started? ===> database.setup.ts:62 ~ ");
});
