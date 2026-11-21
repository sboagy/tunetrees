import { canonicalJson } from "../../src/lib/goals/config.ts";

export function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

export function same(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

export function uniqueEntries(entries, key) {
  requireValue(Array.isArray(entries), "Invalid cutover plan entries");
  const ids = entries.map((entry) => entry?.[key]);
  requireValue(
    ids.every((id) => typeof id === "string") &&
      new Set(ids).size === ids.length,
    "Duplicate or invalid cutover identity"
  );
}
