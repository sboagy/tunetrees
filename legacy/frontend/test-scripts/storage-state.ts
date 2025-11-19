import * as fs from "node:fs";
import path from "node:path";
import { frontendDirPath } from "@/test-scripts/paths-for-tests";

// Internal mutable types to allow url-based cookies during CI adaptation
type IMutableCookie = {
  name: string;
  value: string;
  domain?: string;
  url?: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "Strict" | "Lax" | "None";
};

type IMutableStorageState = {
  cookies: IMutableCookie[];
  origins: Array<{
    origin: string;
    localStorage: Array<{
      name: string;
      value: string;
    }>;
  }>;
};

type StorageStateType = string;

export function getStorageState(storageStateVarName: string): StorageStateType {
  let storageStateContent = "";
  const storageStateVarValue = process.env[storageStateVarName];
  // console.log(
  //   "===> storage-state.ts:31 ~ storageStateVarValue",
  //   storageStateVarValue,
  // );
  if (!storageStateVarValue) {
    throw new Error(`Environment variable ${storageStateVarName} is not set`);
  }

  // Debugging: Log the first few characters of the environment variable
  const isFileInput = storageStateVarValue.startsWith(
    "test-scripts/storageState",
  );
  if (isFileInput) {
    // console.log("===> storage-state.ts:42 ~ processing storage state case 1");
    const storageStatePath = path.resolve(
      frontendDirPath,
      storageStateVarValue,
    );
    storageStateContent = fs.readFileSync(storageStatePath, "utf8");
    // Debugging: Log the first few characters of the file content
  } else {
    // console.log("===> storage-state.ts:50 ~  processing storage state case 2");
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
  const storageStateParsed: IMutableStorageState | string =
    JSON.parse(storageStateContent);

  // Always ensure cookies have valid schema for Playwright (path or url must be present)
  if (typeof storageStateParsed !== "string") {
    for (const c of storageStateParsed.cookies ?? []) {
      // Ensure every cookie has at least a path property for Playwright validation
      c.path = c.path || "/";
    }
  }

  // Always return a file path to satisfy Playwright type expectations for storageState
  // Write the (possibly adapted) storage state JSON to a generated file
  const outDir = path.resolve(
    frontendDirPath,
    "test-scripts/.generated-storage-states",
  );
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const safeName = `${storageStateVarName.toLowerCase()}-${process.env.CI === "true" ? "ci" : "local"}.json`;
  const outPath = path.resolve(outDir, safeName);
  const toWrite =
    typeof storageStateParsed === "string"
      ? storageStateParsed
      : JSON.stringify(storageStateParsed, null, 2);

  // Debug: Log the first cookie to see its structure
  if (process.env.CI === "true" && typeof storageStateParsed !== "string") {
    const firstCookie = storageStateParsed.cookies?.[0];
    console.log(
      "===> First cookie after adaptation:",
      JSON.stringify(firstCookie, null, 2),
    );
  }

  fs.writeFileSync(outPath, toWrite, "utf8");
  return outPath;
}
