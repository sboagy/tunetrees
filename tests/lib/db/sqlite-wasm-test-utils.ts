import type { SqliteRawDatabase } from "oosync/runtime/browser-sqlite";
import {
  createSqliteWasmDatabase,
  initSqliteWasm,
} from "oosync/runtime/sqlite-wasm-adapter";

type TestSqliteModule = {
  createDatabase: (data?: Uint8Array | ArrayBuffer) => SqliteRawDatabase;
};

let sqlitePromise: Promise<TestSqliteModule> | null = null;

export async function getTestSqlite(): Promise<TestSqliteModule> {
  if (!sqlitePromise) {
    sqlitePromise = initSqliteWasm().then((sqlite3) => ({
      createDatabase: (data?: Uint8Array | ArrayBuffer) =>
        createSqliteWasmDatabase(
          sqlite3,
          data instanceof ArrayBuffer ? new Uint8Array(data) : data
        ),
    }));
  }

  return await sqlitePromise;
}
