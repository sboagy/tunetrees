import fs from "node:fs/promises";
import path from "node:path";
import { frontendDirPath, testDatabasePath } from "./paths-for-tests";

const cleanDatabasePath = path.resolve(
  frontendDirPath,
  "../tunetrees_test_clean.sqlite3",
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
    function sleep(ms: number): Promise<void> {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }
    // Remove any leftover WAL/SHM files from a previous run to avoid locking surprises
    const walPath = `${testDatabasePath}-wal`;
    const shmPath = `${testDatabasePath}-shm`;
    for (const p of [walPath, shmPath]) {
      try {
        await fs.unlink(p);
        console.log(`Removed leftover ${p}`);
      } catch {
        // ignore if not present
      }
    }

    // Atomic replace: copy to a temp file in the same directory, then rename over the destination
    const destDir = path.dirname(testDatabasePath);
    const tmpName = `.tmp.${path.basename(testDatabasePath)}.${Date.now()}.${Math.random()
      .toString(36)
      .slice(2)}`;
    const tmpPath = path.join(destDir, tmpName);

    try {
      console.log(
        `Copying test DB from ${cleanDatabasePath} to temp ${tmpPath}`,
      );
      await fs.copyFile(cleanDatabasePath, tmpPath);
      await fs.rename(tmpPath, testDatabasePath); // POSIX atomic replace
      console.log(`Replaced ${testDatabasePath} atomically`);
    } catch (error) {
      // Best-effort cleanup of temp file on failure
      try {
        await fs.unlink(tmpPath);
      } catch {
        // ignore
      }
      throw error;
    }

    // Verify the copy by checking the file sizes (simple, robust check)
    const srcStats = await fs.stat(cleanDatabasePath);

    // tiny retry in case of immediate stat after rename
    let destStats: import("node:fs").Stats | null = null;
    for (let i = 0; i < 5; i++) {
      try {
        destStats = await fs.stat(testDatabasePath);
        break;
      } catch {
        await sleep(50);
      }
    }
    if (!destStats) {
      throw new Error("Destination DB stat failed after atomic replace.");
    }
    if (srcStats.size !== destStats.size) {
      throw new Error("File copy incomplete: size mismatch.");
    }
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
