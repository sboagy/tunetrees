import {
  teardownDatabase,
  tunetreesBackendDeployBaseDir,
} from "@/scripts/setup-database";
import fs from "node:fs/promises";
import path from "node:path";

const pidFilePath = path.resolve(tunetreesBackendDeployBaseDir, "fastapi.pid");

async function globalTeardown() {
  console.log("Running global teardown...");

  // Teardown the database
  await teardownDatabase();

  // Read the PID from the file
  try {
    const pid = await fs.readFile(pidFilePath, "utf8");
    const pidInt = Number.parseInt(pid, 10);
    if (pidInt === 0) {
      console.log("FastAPI server was not started by test, leaving it be.");
      return;
    }
    process.kill(Number.parseInt(pid, 10));
    console.log("FastAPI server stopped.");
  } catch (error) {
    console.error("Error stopping FastAPI server:", error);
  }

  console.log("Global teardown complete.");
}

export default globalTeardown;
