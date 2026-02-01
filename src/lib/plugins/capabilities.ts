/**
 * Plugin capability helpers
 *
 * Capabilities are stored as JSON in the plugin table.
 * Supports either an object (preferred) or array of strings.
 */

export type PluginCapability = "parseImport" | "scheduleGoal";

export interface ParsedCapabilities {
  parseImport?: boolean;
  scheduleGoal?: boolean;
}

const CAPABILITY_KEYS: PluginCapability[] = ["parseImport", "scheduleGoal"];

export function parseCapabilities(raw: string | null): ParsedCapabilities {
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      const result: ParsedCapabilities = {};
      for (const item of parsed) {
        if (typeof item !== "string") continue;
        if (CAPABILITY_KEYS.includes(item as PluginCapability)) {
          result[item as PluginCapability] = true;
        }
      }
      return result;
    }

    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      return {
        parseImport: Boolean(obj.parseImport ?? obj.parse_import),
        scheduleGoal: Boolean(obj.scheduleGoal ?? obj.schedule_goal),
      };
    }
  } catch {
    return {};
  }

  return {};
}

export function hasCapability(
  raw: string | null,
  capability: PluginCapability
): boolean {
  return Boolean(parseCapabilities(raw)[capability]);
}

export function serializeCapabilities(input: ParsedCapabilities): string {
  return JSON.stringify({
    parseImport: Boolean(input.parseImport),
    scheduleGoal: Boolean(input.scheduleGoal),
  });
}
