import { describe, expect, it } from "vitest";
import {
  goalMigrationConnection,
  goalMigrationOptions,
} from "../../../scripts/lib/goal-cutover/command";

describe("goal migration command", () => {
  it("defaults to dry run", () => {
    expect(goalMigrationOptions([])).toEqual({ apply: false, local: false });
  });
  it("requires explicit apply", () => {
    expect(goalMigrationOptions(["--local", "--apply"])).toEqual({
      apply: true,
      local: true,
    });
  });
  it.each([["--aply"], ["--apply=false"], ["--apply", "--apply"]])(
    "rejects ambiguous arguments %j",
    (...args) => {
      expect(() => goalMigrationOptions(args)).toThrow(/Usage/);
    }
  );
  it("never silently falls back to local without a database URL", () => {
    expect(() => goalMigrationConnection(false)).toThrow(/DATABASE_URL/);
  });
  it("uses only the fixed local database when explicitly requested", () => {
    expect(
      goalMigrationConnection(true, "postgres://remote/other").target
    ).toBe("127.0.0.1:54322/postgres");
  });
  it("does not expose credentials or connection options in its target label", () => {
    expect(
      goalMigrationConnection(
        false,
        "postgres://name:secret@db.example:5432/postgres?password=hidden"
      ).target
    ).toBe("db.example:5432/postgres");
  });
  it.each(["host", "hostname", "port", "database", "db", "path", "%68ost"])(
    "rejects endpoint override %s without exposing its value",
    (key) => {
      expect(() =>
        goalMigrationConnection(
          false,
          `postgres://name:secret@staging.example/database?${key}=private-target`
        )
      ).toThrow(
        "DATABASE_URL must specify its endpoint only in the URL authority and path"
      );
    }
  );
  it("pins the default port so PGPORT cannot change the displayed endpoint", () => {
    const result = goalMigrationConnection(
      false,
      "postgres://db.example/database?sslmode=require"
    );
    expect(result.target).toBe("db.example:5432/database");
    expect(new URL(result.connection).port).toBe("5432");
    expect(new URL(result.connection).searchParams.get("sslmode")).toBe(
      "require"
    );
  });
  it.each([
    "not a URL",
    "https://name:secret@example.com/database",
    "postgres://example.com",
  ])("rejects invalid database targets without echoing them: %s", (url) => {
    expect(() => goalMigrationConnection(false, url)).toThrow(/^DATABASE_URL/);
  });
});
