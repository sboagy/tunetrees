import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import initSqlJs from "sql.js";

type SqlJsModule = Awaited<ReturnType<typeof initSqlJs>>;

let sqlJsPromise: Promise<SqlJsModule> | null = null;

function loadSqlWasmBinary(): Uint8Array {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const wasmPath = join(
    currentDir,
    "../../../node_modules/sql.js/dist/sql-wasm.wasm"
  );
  return readFileSync(wasmPath);
}

export async function getTestSqlJs(): Promise<SqlJsModule> {
  if (!sqlJsPromise) {
    const wasmBinary = loadSqlWasmBinary();
    sqlJsPromise = initSqlJs({
      wasmBinary,
    });
  }

  return sqlJsPromise;
}
