// @vitest-environment node
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import os from "node:os";
import path from "node:path";
import {
  build,
  type Connect,
  type ResolvedConfig,
  type ViteDevServer,
} from "vite";
import { afterEach, beforeEach, expect, test } from "vitest";
import { sqliteMigrations } from "../scripts/vite-sqlite-migrations";

let root: string;
let directory: string;
const sql = "CREATE TABLE example (id INTEGER PRIMARY KEY);\n";

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "tunetrees-migrations-"));
  directory = path.join(root, "drizzle/migrations/sqlite");
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "0001_example.sql"), sql);
  await writeFile(path.join(directory, "README.md"), "Not a migration");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

// Invoke the registered middleware without starting a development server.
function request(url: string, method = "GET", base = "/") {
  const plugin = sqliteMigrations();
  const configure = plugin.configResolved as (config: ResolvedConfig) => void;
  configure({ root, base } as ResolvedConfig);
  let middleware: Connect.NextHandleFunction;
  const register = plugin.configureServer as (server: ViteDevServer) => void;
  register({
    middlewares: {
      use(handler: Connect.NextHandleFunction) {
        middleware = handler;
      },
    },
  } as unknown as ViteDevServer);
  return new Promise<{
    body?: string;
    headers: Record<string, string | number>;
    passedThrough: boolean;
  }>((resolve, reject) => {
    const headers: Record<string, string | number> = {};
    const response = {
      setHeader(name: string, value: string | number) {
        headers[name] = value;
      },
      end(body?: Buffer) {
        resolve({ body: body?.toString(), headers, passedThrough: false });
      },
    };
    middleware(
      { url, method } as IncomingMessage,
      response as unknown as ServerResponse,
      (error?: unknown) => {
        if (error) reject(error);
        else resolve({ headers, passedThrough: true });
      }
    );
  });
}

test("emits migration SQL unchanged at its root URL in production", async () => {
  await writeFile(path.join(root, "entry.js"), "export const example = 1;");
  await build({
    configFile: false,
    root,
    logLevel: "silent",
    publicDir: false,
    plugins: [sqliteMigrations()],
    build: { lib: { entry: path.join(root, "entry.js"), formats: ["es"] } },
  });
  expect(await readFile(path.join(root, "dist/0001_example.sql"), "utf8")).toBe(
    sql
  );
  await expect(readFile(path.join(root, "dist/README.md"))).rejects.toThrow();
});

test("serves migration contents with a cache-busting query", async () => {
  expect((await request("/0001_example.sql?v=2")).body).toBe(sql);
});

test("serves HEAD with content length and no body", async () => {
  expect(await request("/0001_example.sql", "HEAD")).toEqual({
    body: undefined,
    headers: {
      "Content-Type": "application/sql",
      "Content-Length": Buffer.byteLength(sql),
      "Cache-Control": "no-cache",
    },
    passedThrough: false,
  });
});

test("reads updated migration contents on the next request", async () => {
  await request("/0001_example.sql");
  await writeFile(path.join(directory, "0001_example.sql"), "SELECT 2;");
  expect((await request("/0001_example.sql")).body).toBe("SELECT 2;");
});

test("serves migrations under the configured base", async () => {
  expect((await request("/app/0001_example.sql", "GET", "/app/")).body).toBe(
    sql
  );
});

test.each([
  "/missing.sql",
  "/README.md",
  "/../secret.sql",
  "/%2e%2e%2fsecret.sql",
])("passes through requests outside the migration files: %s", async (url) => {
  await writeFile(path.join(root, "secret.sql"), "private");
  expect((await request(url)).passedThrough).toBe(true);
});

test("does not handle POST requests", async () => {
  expect((await request("/0001_example.sql", "POST")).passedThrough).toBe(true);
});
