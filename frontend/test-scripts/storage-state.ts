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

export async function getStorageState(
  storageStateVarName: string,
): Promise<StorageStateType> {
  let storageStateContent = "";
  const storageStateVarValue = process.env[storageStateVarName];
  if (!storageStateVarValue) {
    throw new Error(`Environment variable ${storageStateVarName} is not set`);
  }
  if (storageStateVarValue.startsWith("test-scripts/storageState")) {
    const storageStatePath = path.resolve(
      frontendDirPath,
      storageStateVarValue,
    );
    storageStateContent = await fs.promises.readFile(storageStatePath, "utf8");
  } else {
    // Assume it's coming from a secret and the value is already JSON
    storageStateContent = storageStateVarValue;
  }
  const storageState: StorageStateType = JSON.parse(storageStateContent);
  return storageState;
}
