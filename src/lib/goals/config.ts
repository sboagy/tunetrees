/** Versioned, storage-independent goal definitions shared by seeds and runtime. */
export type LadderAction = "reset" | "back" | "stay" | "advance";
export type EvaluationAction =
  | { kind: LadderAction }
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

/** Canonical JSON rejects lossy values instead of silently converting them. */
export function canonicalJson(
  value: unknown,
  maxBytes = GOAL_CONFIG_BYTES
): string {
  const ancestors = new Set<object>();
  const visit = (item: unknown): string => {
    if (item === null || typeof item === "string" || typeof item === "boolean")
      return JSON.stringify(item);
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
        Object.keys(item).length === item.length,
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
        .map((key) => `${JSON.stringify(key)}:${visit(item[key])}`)
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

export function validateIntervals(value: unknown): asserts value is number[] {
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
    requireValue(object(choice.action), "Evaluation needs an explicit action");
    if (choice.action.kind === "fsrs") {
      keys(choice.action, ["kind", "rating"]);
      requireValue(
        [1, 2, 3, 4].includes(Number(choice.action.rating)) &&
          typeof choice.action.rating === "number",
        "Invalid FSRS rating"
      );
    } else {
      keys(choice.action, ["kind"]);
      requireValue(
        ["reset", "back", "stay", "advance"].includes(
          String(choice.action.kind)
        ),
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
        (choice.action.kind === "fsrs") === (scheduler.id === "builtin:fsrs6")
    ),
    "Evaluation actions must match the selected scheduler"
  );
  // All fields have been checked above; the cast is confined to this boundary.
  return copy as unknown as GoalConfig;
}
export function parseGoalOverrides(value: unknown): GoalOverrides {
  const copy: unknown = JSON.parse(canonicalJson(value));
  requireValue(object(copy), "Overrides must be an object");
  keys(copy, ["version", "displayName", "daily", "scheduler", "evaluations"]);
  requireValue(
    copy.version === undefined || copy.version === 1,
    "Unsupported overrides version"
  );
  if ("displayName" in copy)
    requireValue(label(copy.displayName), "Display name must not be empty");
  if ("daily" in copy) validateDaily(copy.daily, true);
  if ("scheduler" in copy) validateScheduler(copy.scheduler);
  if ("evaluations" in copy) validateEvaluations(copy.evaluations);
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
  defaults: { displayName: string; config: GoalConfig },
  overrides: unknown = {}
): { displayName: string; config: GoalConfig } {
  requireValue(label(defaults.displayName), "Display name must not be empty");
  const custom = parseGoalOverrides(overrides);
  return {
    displayName: custom.displayName ?? defaults.displayName,
    config: resolveGoalConfig(defaults.config, custom),
  };
}
