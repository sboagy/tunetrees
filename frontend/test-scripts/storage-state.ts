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
  console.log(
    "===> storage-state.ts:31 ~ storageStateVarValue",
    storageStateVarValue,
  );
  if (!storageStateVarValue) {
    throw new Error(`Environment variable ${storageStateVarName} is not set`);
  }

  // Debugging: Log the first few characters of the environment variable

  if (storageStateVarValue.startsWith("test-scripts/storageState")) {
    console.log("===> storage-state.ts:42 ~ processing storage state case 1");
    const storageStatePath = path.resolve(
      frontendDirPath,
      storageStateVarValue,
    );
    storageStateContent = fs.readFileSync(storageStatePath, "utf8");
    // Debugging: Log the first few characters of the file content
  } else {
    console.log("===> storage-state.ts:50 ~  processing storage state case 2");
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
  // In CI, adapt storage state created under https://localhost:3000 so it matches
  // http://127.0.0.1:3000. This fixes cookie/origin mismatches without re-generating secrets.
  if (process.env.CI === "true" && typeof storageState !== "string") {
    try {
      const targetHost = "127.0.0.1";
      const targetOrigin = `http://${targetHost}:3000`;

      // Rewrite cookies: domain localhost -> 127.0.0.1, secure -> false
      // Also adjust callback-url cookie value if it encodes https://localhost:3000
      for (const c of storageState.cookies ?? []) {
        if (c.domain === "localhost") {
          c.domain = targetHost;
        }
        // For HTTP in CI, ensure cookies can be sent
        if (c.secure) {
          c.secure = false;
        }
        if (
          c.name === "__Secure-authjs.callback-url" &&
          c.value.includes("https%3A%2F%2Flocalhost%3A3000")
        ) {
          c.value = c.value.replace(
            "https%3A%2F%2Flocalhost%3A3000",
            encodeURIComponent(targetOrigin),
          );
        }
      }

      // Rewrite origins array from https://localhost:3000 -> http://127.0.0.1:3000
      for (const o of storageState.origins ?? []) {
        if (o.origin === "https://localhost:3000") {
          o.origin = targetOrigin;
        }
      }
    } catch (error) {
      console.warn(
        "storage-state.ts: CI adaptation skipped due to error:",
        error,
      );
    }
  }
  return storageState;
}
