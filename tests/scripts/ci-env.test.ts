import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const runner = resolve("scripts/run-with-env.mjs");
const bootstrap = resolve("scripts/bootstrap-ci-env.mjs");
let directory: string;
let env: NodeJS.ProcessEnv;

beforeEach(() => {
  directory = realpathSync(mkdtempSync(join(tmpdir(), "tunetrees-ci-env-")));
  env = {
    PATH: `${directory}:${process.env.PATH}`,
    CI: "true",
    GITHUB_ENV: join(directory, "github-env"),
    OP_TEST_CALLS: join(directory, "calls"),
    OP_EXECUTABLE: join(directory, "op"),
  };
  // Any unexpected 1Password call fails without reaching the real CLI/API.
  writeFileSync(
    join(directory, "op"),
    '#!/bin/sh\necho unexpected-op >> "$OP_TEST_CALLS"\nexit 99\n',
    { mode: 0o755 }
  );
});
afterEach(() => rmSync(directory, { recursive: true, force: true }));

function run(script: string, args: string[], cwd = directory) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd,
    env,
    encoding: "utf8",
  });
}
function fakeOp() {
  writeFileSync(
    join(directory, "op"),
    `#!${process.execPath}
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.OP_TEST_CALLS, args[0] + '\\n');
if (args[0] === 'read') { process.stdout.write('fixture-password\\n'); }
else {
  const separator = args.indexOf('--');
  const child = spawnSync(args[separator + 1], args.slice(separator + 2), {
    stdio: 'inherit', env: { ...process.env, SECRET: 'fixture-secret', PUBLIC: 'literal' }
  });
  process.exit(child.status ?? 1);
}
`,
    { mode: 0o755 }
  );
}
function exportedEnv(): Record<string, string> {
  const output = readFileSync(env.GITHUB_ENV as string, "utf8");
  return Object.fromEntries(
    [...output.matchAll(/(\w+)<<([^\n]+)\n([\s\S]*?)\n\2\n/g)].map((match) => [
      match[1],
      match[3],
    ])
  );
}

describe("CI secret boundary", () => {
  it("runs nested commands with the inherited environment without op", () => {
    env.TUNETREES_LOADED_ENV = join(directory, ".env.local.template");
    env.SECRET = "inherited";
    const result = run(runner, [
      ".env.local.template",
      "--",
      process.execPath,
      runner,
      "./.env.local.template",
      "--",
      process.execPath,
      "-e",
      "console.log(process.env.SECRET)",
    ]);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.trim()).toBe("inherited");
  });
  it("refuses an unbootstrapped CI environment without calling op", () => {
    const result = run(runner, [
      ".env.local.template",
      "--",
      process.execPath,
      "-e",
      "process.exit(0)",
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("CI environment was not bootstrapped");
  });
  it("refuses to reuse staging secrets for production in CI", () => {
    env.TUNETREES_LOADED_ENV = join(directory, ".env.staging.template");
    const result = run(runner, [
      ".env.prod.template",
      "--",
      process.execPath,
      "-e",
      "process.exit(0)",
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("CI environment was not bootstrapped");
  });
  it("loads secrets once for nested local commands", () => {
    writeFileSync(join(directory, ".env.local.template"), "");
    fakeOp();
    delete env.CI;
    const result = run(runner, [
      ".env.local.template",
      "--",
      process.execPath,
      runner,
      "./.env.local.template",
      "--",
      process.execPath,
      "-e",
      "console.log(process.env.SECRET)",
    ]);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.trim()).toBe("fixture-secret");
    expect(readFileSync(env.OP_TEST_CALLS as string, "utf8")).toBe("run\n");
  });
  it("preserves the child exit code", () => {
    env.TUNETREES_LOADED_ENV = join(directory, ".env.local.template");
    expect(
      run(runner, [
        ".env.local.template",
        "--",
        process.execPath,
        "-e",
        "process.exit(7)",
      ]).status
    ).toBe(7);
  });
  it("reads one password and preserves runtime Supabase credentials", () => {
    fakeOp();
    writeFileSync(
      join(directory, ".env.local.template"),
      'ALICE_TEST_PASSWORD="op://fixture/test/password"\nSUPABASE_URL="op://fixture/db/url"\nPYTHONPATH=.\n'
    );
    env.SUPABASE_URL = "http://127.0.0.1:54321";
    const result = run(bootstrap, [".env.local.template"]);
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(env.OP_TEST_CALLS as string, "utf8")).toBe("read\n");
    expect(exportedEnv()).toEqual({
      ALICE_TEST_PASSWORD: "fixture-password",
      TEST_USER_PASSWORD: "fixture-password",
      PYTHONPATH: ".",
      VITE_WORKER_URL: "http://localhost:8787",
      TUNETREES_LOADED_ENV: join(directory, ".env.local.template"),
    });
    expect(result.stdout).toContain("::add-mask::fixture-password");
  });
  it("resolves a deployment template once and exports only its keys", () => {
    fakeOp();
    env.OP_SERVICE_ACCOUNT_TOKEN = "fixture-token";
    writeFileSync(
      join(directory, ".env.staging.template"),
      'SECRET="op://fixture/item/secret"\nPUBLIC=literal\n'
    );
    const result = run(bootstrap, [".env.staging.template"]);
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(env.OP_TEST_CALLS as string, "utf8")).toBe("run\n");
    expect(exportedEnv()).toEqual({
      SECRET: "fixture-secret",
      PUBLIC: "literal",
      TUNETREES_LOADED_ENV: join(directory, ".env.staging.template"),
    });
    expect(result.stdout).toContain("::add-mask::fixture-secret");
  });
  it("reuses the same template from a Worker subdirectory", () => {
    mkdirSync(join(directory, "worker"));
    env.TUNETREES_LOADED_ENV = join(directory, ".env.local.template");
    const result = run(
      runner,
      [
        "../.env.local.template",
        "--",
        process.execPath,
        "-e",
        "process.exit(0)",
      ],
      join(directory, "worker")
    );
    expect(result.status, result.stderr).toBe(0);
  });
  it("blocks direct op calls in later CI steps", () => {
    fakeOp();
    env.GITHUB_PATH = join(directory, "github-path");
    env.RUNNER_TEMP = directory;
    writeFileSync(
      join(directory, ".env.local.template"),
      'ALICE_TEST_PASSWORD="op://fixture/test/password"\n'
    );
    expect(run(bootstrap, [".env.local.template"]).status).toBe(0);
    const guardDirectory = readFileSync(env.GITHUB_PATH, "utf8").trim();
    const result = spawnSync("op", ["read", "op://fixture/test/password"], {
      env: { ...env, PATH: `${guardDirectory}:${env.PATH}` },
      encoding: "utf8",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("forbidden after CI bootstrap");
    expect(readFileSync(env.OP_TEST_CALLS as string, "utf8")).toBe("read\n");
  });
});
