import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveExecutable } from "../../scripts/resolve-executable.mjs";

let directory: string;
let executable: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "tunetrees-executable-"));
  executable = join(directory, "fixture-cli");
  writeFileSync(executable, "#!/bin/sh\nexit 0\n", { mode: 0o700 });
});
afterEach(() => rmSync(directory, { recursive: true, force: true }));

describe("absolute executable resolution", () => {
  it("pins a tool from an absolute installation directory", () => {
    expect(resolveExecutable("fixture-cli", undefined, directory)).toBe(
      executable
    );
  });
  it("ignores relative PATH entries", () => {
    expect(() =>
      resolveExecutable("fixture-cli", undefined, `.${delimiter}bin`)
    ).toThrow("trusted absolute PATH directory");
  });
  it("skips writable directories before trusted installations", () => {
    const writable = join(directory, "writable");
    mkdirSync(writable);
    writeFileSync(join(writable, "fixture-cli"), "#!/bin/sh\nexit 99\n", {
      mode: 0o700,
    });
    chmodSync(writable, 0o777);
    expect(
      resolveExecutable(
        "fixture-cli",
        undefined,
        `${writable}${delimiter}${directory}`
      )
    ).toBe(executable);
  });
  it("rejects group or world writable executables", () => {
    chmodSync(executable, 0o777);
    expect(() =>
      resolveExecutable("fixture-cli", undefined, directory)
    ).toThrow("trusted absolute PATH directory");
  });
  it("allows an explicit absolute installation without searching PATH", () => {
    expect(resolveExecutable("fixture-cli", executable, "")).toBe(executable);
  });
  it("rejects a relative override instead of falling back to PATH", () => {
    expect(() =>
      resolveExecutable("fixture-cli", "./fixture-cli", directory)
    ).toThrow("absolute executable file path");
  });
  it("rejects a non-executable override", () => {
    chmodSync(executable, 0o600);
    expect(() =>
      resolveExecutable("fixture-cli", executable, directory)
    ).toThrow("absolute executable file path");
  });
});
