import { teardownDatabase } from "@/test-scripts/setup-database";
import fs from "node:fs/promises";
import path from "node:path";
import { tunetreesBackendDeployBaseDir } from "./paths-for-tests";

const pidFilePath = path.resolve(tunetreesBackendDeployBaseDir, "fastapi.pid");

// Maybe this code should move directly into the psuedo test file.
async function globalTeardown() {
  console.log("Running global teardown...");

  // Teardown the database
  await teardownDatabase();

  // Read the PID from the file
  let pidInt = -1;
  try {
    const pid = await fs.readFile(pidFilePath, "utf8");
    await fs.writeFile(pidFilePath, "0");
    pidInt = Number.parseInt(pid, 10);
    if (pidInt === 0) {
      console.log("FastAPI server was not started by test, leaving it be.");
      return;
    }
    process.kill(pidInt);
    // Wait a tiny bit for the server to stop, to make it safe to start another one.
    await new Promise((resolve) => setTimeout(resolve, 500));
    console.log("FastAPI server stopped.");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") {
      // This is sort of kind of OK?  It may occur if somehow the backend
      // was already killed, or maybe if a stale file floating around?
      console.log(
        `No process found with the given backend PID: ${pidInt}.  Maybe ok maybe not?`,
      );
    } else {
      console.error("Error stopping FastAPI server:", error);
    }
  }

  console.log("Global teardown complete.");
}

export default globalTeardown;
