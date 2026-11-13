import { expect, it } from "vitest";
import { isTransientRemoteRead } from "@/test/remote-read";

it.each([0, 408, 429, 502, 503, 504])(
  "retries transient HTTP status %s",
  (status) => {
    expect(isTransientRemoteRead(status, "")).toBe(true);
  }
);
it.each(["PGRST000", "PGRST001", "PGRST002"])(
  "retries unavailable database %s",
  (code) => {
    expect(isTransientRemoteRead(503, code)).toBe(true);
  }
);
it.each([
  [401, ""],
  [403, "42501"],
  [400, "42703"],
  [404, "PGRST205"],
  [500, "XX000"],
  [503, "42703"],
] as const)("fails permanent HTTP %s code %s", (status, code) => {
  expect(isTransientRemoteRead(status, code)).toBe(false);
});
