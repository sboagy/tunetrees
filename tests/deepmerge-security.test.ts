import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

// Resolve the dependency actually used by Workbox's Rollup resolver.
const require = createRequire(import.meta.url);
const resolverRequire = createRequire(
  require.resolve("@rollup/plugin-node-resolve")
);
const { default: merge } = (await import(
  pathToFileURL(resolverRequire.resolve("deepmerge")).href
)) as { default: (target: object, source: object) => Record<string, unknown> };

describe("build-tool deepmerge security (CVE-2026-93753)", () => {
  it("rejects prototype injection when the target has a null prototype", () => {
    const source = JSON.parse('{"__proto__":{"isAdmin":true}}');
    const result = merge(Object.create(null), source);

    expect(result.isAdmin).toBeUndefined();
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
  });

  it("rejects prototype injection while cloning target properties", () => {
    const target = JSON.parse('{"__proto__":{"isAdmin":true}}');
    const result = merge(target, {});

    expect(result.isAdmin).toBeUndefined();
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
  });

  it("rejects prototype injection in nested objects", () => {
    const source = JSON.parse('{"config":{"__proto__":{"isAdmin":true}}}');
    const result = merge({ config: null }, source);

    expect(result.config).not.toHaveProperty("isAdmin");
    expect(Object.getPrototypeOf(result.config)).toBe(Object.prototype);
  });

  it("preserves nested configuration merging and array concatenation", () => {
    const target = { config: { enabled: true }, extensions: [".js"] };
    const source = { config: { mode: "production" }, extensions: [".mjs"] };

    expect(merge(target, source)).toEqual({
      config: { enabled: true, mode: "production" },
      extensions: [".js", ".mjs"],
    });
    expect(target).toEqual({ config: { enabled: true }, extensions: [".js"] });
  });
});
