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
    await fs.copyFile(cleanDatabasePath, testDatabasePath);
    function sleep(ms: number): Promise<void> {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    await sleep(1000);
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
