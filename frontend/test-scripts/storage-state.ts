import { frontendDirPath } from "@/test-scripts/paths-for-tests";
import * as fs from "node:fs";
import path from "node:path";

type StorageStateType =
  | string
  | {
      cookies: Array<{
        name: string;
        value: string;
        domain: string;
        path: string;
        expires: number;
        httpOnly: boolean;
        secure: boolean;
        sameSite: "Strict" | "Lax" | "None";
      }>;
      origins: Array<{
        origin: string;
        localStorage: Array<{
          name: string;
          value: string;
        }>;
      }>;
    };

export function getStorageState(storageStateVarName: string): StorageStateType {
  let storageStateContent = "";
  const storageStateVarValue = process.env[storageStateVarName];
  if (!storageStateVarValue) {
    throw new Error(`Environment variable ${storageStateVarName} is not set`);
  }

  // Debugging: Log the first few characters of the environment variable

  if (storageStateVarValue.startsWith("test-scripts/storageState")) {
    const storageStatePath = path.resolve(
      frontendDirPath,
      storageStateVarValue,
    );
    storageStateContent = fs.readFileSync(storageStatePath, "utf8");
    // Debugging: Log the first few characters of the file content
  } else {
    // Assume it's coming from a secret and the value is already JSON
    storageStateContent = Buffer.from(storageStateVarValue, "base64").toString(
      "utf8",
    );

    // console.log(
    //   `Storage state environment variable first 100 (${storageStateVarName}): ${storageStateContent.slice(0, 100)}...`,
    // );
    // console.log(
    //   `Storage state environment variable last 100 (${storageStateVarName}) end: ${storageStateContent.slice(-100)}...`,
    // );
  }
  const storageState: StorageStateType = JSON.parse(storageStateContent);
  return storageState;
}
