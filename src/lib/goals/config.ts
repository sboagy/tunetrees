/** Versioned, storage-independent goal definitions shared by seeds and runtime. */
export type LadderAction = "reset" | "back" | "stay" | "advance";
/** Shared explanation of ladder effects in settings and practice choice menus. */
export const LADDER_ACTION_LABELS: Record<LadderAction, string> = {
  reset: "Restart at the first interval",
  back: "Move back one interval",
  stay: "Repeat the current interval",
  advance: "Advance one interval (repeat the last at the end)",
};
export type EvaluationAction =
  | { kind: LadderAction }
  | { kind: "plugin"; actionId: string }
  | { kind: "fsrs"; rating: 1 | 2 | 3 | 4 };
export interface EvaluationChoice {
  id: string;
  label: string;
  description: string;
  action: EvaluationAction;
}
export interface DailyGoalSettings {
  minimum: number;
  maximum: number; // Zero means Unlimited, not disabled.
  autoNew: boolean;
  delinquencyDays: number;
}
export type GoalScheduler =
  | {
      id: "plugin";
      version: 1;
      pluginId: string;
      options: Record<string, unknown>;
    }
  | { id: "builtin:interval-ladder"; version: 1; intervalsDays: number[] }
  | {
      id: "builtin:fsrs6";
      version: 1;
      weights: number[];
      retention: number;
      maximumIntervalDays: number;
      learningStepsMinutes: number[];
      relearningStepsMinutes: number[];
      fuzz: boolean;
    };
export interface GoalConfig {
  version: 1;
  daily: DailyGoalSettings;
  scheduler: GoalScheduler;
  evaluations: EvaluationChoice[];
}
export interface GoalOverrides {
  version?: 1; // Empty {} is the database default: inherit everything.
  displayName?: string;
  description?: string;
  daily?: Partial<DailyGoalSettings>;
  scheduler?: GoalScheduler;
  evaluations?: EvaluationChoice[];
}
export const GOAL_CONFIG_BYTES = 64 * 1024;
export const SCHEDULER_STATE_BYTES = 16 * 1024;

function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function keys(value: Record<string, unknown>, allowed: string[]): void {
  requireValue(
    Object.keys(value).every((key) => allowed.includes(key)),
    "Unknown configuration property"
  );
}
function nonnegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function positive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
function label(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// PostgreSQL's JSON validation rejects NUL and unpaired UTF-16 surrogates.
// Iterate code points so valid surrogate pairs (such as emoji) remain accepted.
function storageJsonString(value: string): string {
  for (const character of value) {
    const point = character.codePointAt(0) ?? 0;
    requireValue(
      point !== 0 && (point < 0xd800 || point > 0xdfff),
      "JSON text contains NUL or an unpaired Unicode surrogate"
    );
  }
  return JSON.stringify(value);
}

/** Canonical JSON rejects lossy values instead of silently converting them. */
export function canonicalJson(
  value: unknown,
  maxBytes = GOAL_CONFIG_BYTES
): string {
  const ancestors = new Set<object>();
  const visit = (item: unknown): string => {
    if (typeof item === "string") return storageJsonString(item);
    if (item === null || typeof item === "boolean") return JSON.stringify(item);
    if (typeof item === "number") {
      requireValue(Number.isFinite(item), "JSON numbers must be finite");
      return JSON.stringify(item);
    }
    requireValue(
      object(item) || Array.isArray(item),
      "Value is not JSON serializable"
    );
    requireValue(!ancestors.has(item), "JSON must not contain cycles");
    requireValue(ancestors.size < 64, "JSON is too deeply nested");
    ancestors.add(item);
    let result: string;
    if (Array.isArray(item)) {
      requireValue(
        Reflect.ownKeys(item).length === item.length + 1 &&
          Array.from({ length: item.length }, (_, index) => index).every(
            (index) => Object.hasOwn(item, index)
          ),
        "Sparse or decorated arrays are not supported"
      );
      result = `[${item.map(visit).join(",")}]`;
    } else {
      requireValue(
        Object.getPrototypeOf(item) === Object.prototype ||
          Object.getPrototypeOf(item) === null,
        "JSON objects must be plain objects"
      );
      result = `{${Object.keys(item)
        // Canonical hashes use UTF-16 code-unit order, never locale collation.
        .sort((left, right) => {
          if (left < right) return -1;
          if (left > right) return 1;
          return 0;
        })
        .map((key) => `${storageJsonString(key)}:${visit(item[key])}`)
        .join(",")}}`;
    }
    ancestors.delete(item);
    requireValue(
      new TextEncoder().encode(result).length <= maxBytes,
      "JSON payload is too large"
    );
    return result;
  };
  const result = visit(value);
  requireValue(
    new TextEncoder().encode(result).length <= maxBytes,
    "JSON payload is too large"
  );
  return result;
}

/** Hash exactly the validated canonical bytes; callers retain their payload budget. */
export async function hashCanonicalJson(
  value: unknown,
  maxBytes = GOAL_CONFIG_BYTES
): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalJson(value, maxBytes))
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

/** Shared snapshot serialization keeps settings validation and practice in sync. */
export function serializeEvaluationSnapshot(
  goalLabel: string,
  choice: { label: string; description: string; action: unknown }
): string {
  return canonicalJson(
    {
      version: 1,
      goalLabel,
      choiceLabel: choice.label,
      choiceDescription: choice.description,
      action: choice.action,
    },
    SCHEDULER_STATE_BYTES
  );
}

// ECMAScript Date supports +/- 100,000,000 days from the epoch. With no
// practiced time yet, reject durations impossible even from its earliest date.
export const MAX_DATE_MS = 8_640_000_000_000_000;
export function validateIntervals(
  value: unknown,
  practicedMs = -MAX_DATE_MS
): asserts value is number[] {
  requireValue(
    Array.isArray(value) && value.length > 0,
    "A ladder needs at least one interval"
  );
  requireValue(
    value.every(
      (entry, index) =>
        positive(entry) && (index === 0 || entry > value[index - 1])
    ),
    "Ladder intervals must be finite, positive and strictly increasing"
  );
  requireValue(
    value.every((entry) => {
      const seconds = Math.round(entry * 86400);
      return seconds >= 1 && seconds * 1000 <= MAX_DATE_MS - practicedMs;
    }),
    "Ladder intervals must fit second precision and the supported Date range"
  );
}
function validateDaily(value: unknown, partial = false): void {
  requireValue(object(value), "Daily settings must be an object");
  keys(value, ["minimum", "maximum", "autoNew", "delinquencyDays"]);
  for (const key of ["minimum", "maximum", "delinquencyDays"]) {
    if (partial && !(key in value)) continue;
    requireValue(
      nonnegativeInteger(value[key]),
      `${key} must be a nonnegative integer`
    );
  }
  if (!partial || "autoNew" in value)
    requireValue(typeof value.autoNew === "boolean", "autoNew must be boolean");
  if (
    typeof value.maximum === "number" &&
    value.maximum > 0 &&
    typeof value.minimum === "number"
  ) {
    requireValue(
      value.minimum <= value.maximum,
      "Minimum must not exceed a finite maximum"
    );
  }
}
function validateScheduler(value: unknown): asserts value is GoalScheduler {
  requireValue(
    object(value) && value.version === 1,
    "Unsupported scheduler version"
  );
  if (value.id === "plugin") {
    keys(value, ["id", "version", "pluginId", "options"]);
    requireValue(label(value.pluginId), "A plugin must be selected");
    requireValue(object(value.options), "Plugin options must be an object");
    return;
  }
  if (value.id === "builtin:interval-ladder") {
    keys(value, ["id", "version", "intervalsDays"]);
    validateIntervals(value.intervalsDays);
    return;
  }
  requireValue(value.id === "builtin:fsrs6", "Unsupported scheduler");
  keys(value, [
    "id",
    "version",
    "weights",
    "retention",
    "maximumIntervalDays",
    "learningStepsMinutes",
    "relearningStepsMinutes",
    "fuzz",
  ]);
  requireValue(
    Array.isArray(value.weights) &&
      [17, 19, 21].includes(value.weights.length) &&
      value.weights.every(
        (entry) => typeof entry === "number" && Number.isFinite(entry)
      ),
    "Invalid FSRS-6 weights"
  );
  requireValue(
    positive(value.retention) && value.retention < 1,
    "Retention must be between zero and one"
  );
  requireValue(
    nonnegativeInteger(value.maximumIntervalDays) &&
      value.maximumIntervalDays > 0,
    "FSRS maximum interval must be a positive integer"
  );
  for (const key of ["learningStepsMinutes", "relearningStepsMinutes"]) {
    requireValue(
      Array.isArray(value[key]) && value[key].every(positive),
      "Learning steps must be positive minutes"
    );
  }
  requireValue(typeof value.fuzz === "boolean", "Fuzz must be boolean");
}
function validateEvaluations(
  value: unknown
): asserts value is EvaluationChoice[] {
  requireValue(
    Array.isArray(value) && value.length > 0,
    "At least one evaluation is required"
  );
  const ids = new Set<string>();
  for (const choice of value) {
    requireValue(object(choice), "Invalid evaluation");
    keys(choice, ["id", "label", "description", "action"]);
    requireValue(
      label(choice.id) && !ids.has(choice.id),
      "Evaluation IDs must be nonempty and unique"
    );
    ids.add(choice.id);
    requireValue(
      label(choice.label) && typeof choice.description === "string",
      "Invalid evaluation label or description"
    );
    serializeEvaluationSnapshot("", {
      label: choice.label,
      description: choice.description,
      action: choice.action,
    });
    requireValue(object(choice.action), "Evaluation needs an explicit action");
    if (choice.action.kind === "fsrs") {
      keys(choice.action, ["kind", "rating"]);
      requireValue(
        [1, 2, 3, 4].includes(Number(choice.action.rating)) &&
          typeof choice.action.rating === "number",
        "Invalid FSRS rating"
      );
    } else if (choice.action.kind === "plugin") {
      keys(choice.action, ["kind", "actionId"]);
      requireValue(
        label(choice.action.actionId),
        "A named plugin action is required"
      );
    } else {
      keys(choice.action, ["kind"]);
      requireValue(
        typeof choice.action.kind === "string" &&
          ["reset", "back", "stay", "advance"].includes(choice.action.kind),
        "Unknown ladder action"
      );
    }
  }
}
export function parseGoalConfig(value: unknown): GoalConfig {
  // Clone after validating JSON so returned configurations never share state.
  const copy: unknown = JSON.parse(canonicalJson(value));
  requireValue(
    object(copy) && copy.version === 1,
    "Unsupported goal configuration version"
  );
  keys(copy, ["version", "daily", "scheduler", "evaluations"]);
  validateDaily(copy.daily);
  validateScheduler(copy.scheduler);
  validateEvaluations(copy.evaluations);
  const scheduler = copy.scheduler;
  requireValue(
    copy.evaluations.every(
      (choice) =>
        (choice.action.kind === "fsrs") ===
          (scheduler.id === "builtin:fsrs6") &&
        (choice.action.kind === "plugin") === (scheduler.id === "plugin")
    ),
    "Evaluation actions must match the selected scheduler"
  );
  // All fields have been checked above; the cast is confined to this boundary.
  return copy as unknown as GoalConfig;
}
export function parseGoalOverrides(value: unknown): GoalOverrides {
  const copy: unknown = JSON.parse(canonicalJson(value));
  requireValue(object(copy), "Overrides must be an object");
  keys(copy, [
    "version",
    "displayName",
    "description",
    "daily",
    "scheduler",
    "evaluations",
  ]);
  requireValue(
    copy.version === undefined || copy.version === 1,
    "Unsupported overrides version"
  );
  if ("displayName" in copy)
    requireValue(label(copy.displayName), "Display name must not be empty");
  if ("description" in copy)
    requireValue(
      typeof copy.description === "string",
      "Description must be text"
    );
  if ("daily" in copy) validateDaily(copy.daily, true);
  if ("scheduler" in copy) validateScheduler(copy.scheduler);
  if (typeof copy.displayName === "string") {
    serializeEvaluationSnapshot(copy.displayName, {
      label: "",
      description: "",
      action: {},
    });
  }
  if ("evaluations" in copy) {
    validateEvaluations(copy.evaluations);
    if (typeof copy.displayName === "string") {
      for (const choice of copy.evaluations)
        serializeEvaluationSnapshot(copy.displayName, choice);
    }
  }
  return copy;
}
export function resolveGoalConfig(
  defaults: GoalConfig,
  overrides: unknown = {}
): GoalConfig {
  const base = parseGoalConfig(defaults);
  const custom = parseGoalOverrides(overrides);
  return parseGoalConfig({
    ...base,
    daily: { ...base.daily, ...custom.daily },
    scheduler: custom.scheduler ?? base.scheduler,
    evaluations: custom.evaluations ?? base.evaluations,
  });
}

export function resolveGoalDefinition(
  defaults: { displayName: string; description: string; config: GoalConfig },
  overrides: unknown = {}
): { displayName: string; description: string; config: GoalConfig } {
  requireValue(label(defaults.displayName), "Display name must not be empty");
  const custom = parseGoalOverrides(overrides);
  const displayName = custom.displayName ?? defaults.displayName;
  const config = resolveGoalConfig(defaults.config, custom);
  // Inherited names/evaluations can each fit separately but exceed the budget together.
  for (const choice of config.evaluations)
    serializeEvaluationSnapshot(displayName, choice);
  return {
    displayName,
    description: custom.description ?? defaults.description,
    config,
  };
}
