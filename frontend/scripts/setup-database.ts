import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// eslint-disable-next-line @typescript-eslint/naming-convention
const __filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = path.dirname(__filename);

const cleanDatabasePath = path.join(__dirname, "tunetrees_clean.sqlite");
const testDatabasePath = path.join(__dirname, "tunetrees.sqlite");

export async function setupDatabase(): Promise<void> {
  try {
    await fs.copyFile(cleanDatabasePath, testDatabasePath);
    console.log("Database setup complete.");
  } catch (error) {
    console.error("Error setting up database:", error);
  }
}
