// @vitest-environment node
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config, parse } from "dotenv";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let directory: string;
let path: string;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "tunetrees-dotenv-"));
  path = join(directory, ".env.local");
  // Do not let developer dotenv settings affect the compatibility contract.
  vi.stubEnv("DOTENV_CONFIG_OVERRIDE", "false");
  vi.stubEnv("DOTENV_OVERRIDE", "false");
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(directory, { recursive: true, force: true });
});

describe("dotenv compatibility for TuneTrees scripts", () => {
  it("parses quoted references, comments, multiline and empty values", () => {
    const fixture = [
      'SECRET="op://fixture/item/password"',
      "QUOTED='literal # value'",
      "PUBLIC=local # ignored comment",
      'MULTILINE="first\nsecond"',
      'ESCAPED="first\\nsecond"',
      "EMPTY=",
      "MISSING",
      "export EXPORTED=value",
    ].join("\n");
    expect(parse(Buffer.from(fixture))).toEqual({
      SECRET: "op://fixture/item/password",
      QUOTED: "literal # value",
      PUBLIC: "local",
      MULTILINE: "first\nsecond",
      ESCAPED: "first\nsecond",
      EMPTY: "",
      EXPORTED: "value",
    });
  });

  it("preserves inherited credentials and fills absent values by default", () => {
    writeFileSync(
      path,
      "DATABASE_URL=file-value\nPUBLIC=local\nEMPTY=fallback\n"
    );
    const processEnv = { DATABASE_URL: "inherited-value", EMPTY: "" };
    config({ path, processEnv, quiet: true });
    expect(processEnv).toEqual({
      DATABASE_URL: "inherited-value",
      EMPTY: "",
      PUBLIC: "local",
    });
  });

  it("honors the explicit override used by the RLS script", () => {
    writeFileSync(path, "DATABASE_URL=file-value\n");
    const processEnv = { DATABASE_URL: "inherited-value" };
    config({ path, processEnv, override: true, quiet: true });
    expect(processEnv).toEqual({ DATABASE_URL: "file-value" });
  });

  it("keeps inherited configuration when the optional local file is missing", () => {
    const processEnv = { DATABASE_URL: "inherited-value" };
    const result = config({ path, processEnv, quiet: true });
    expect(result.error).toMatchObject({ code: "ENOENT" });
    expect(processEnv).toEqual({ DATABASE_URL: "inherited-value" });
  });
});
