/** Validated goal-plugin boundary. The caller owns selection, DB snapshots and
 * staging; this module never writes records or substitutes another scheduler. */
import {
  canonicalJson,
  hashCanonicalJson,
  SCHEDULER_STATE_BYTES,
} from "../goals/config";
import { parseStateJson } from "../goals/state";
import { runPluginFunction } from "./runtime";

export interface GoalPluginManifest {
  apiVersion: 1;
  stateVersion: number;
  compatibleStateVersions: number[];
  actions: GoalPluginAction[];
}

export interface GoalPluginAction {
  id: string;
  label: string;
  description: string;
}

export interface GoalPluginState {
  version: 1;
  pluginId: string;
  pluginVersion: number;
  scriptHash: string;
  stateVersion: number;
  data: Record<string, unknown>;
}

export interface GoalPluginInput {
  plugin: { id: string; name: string; version: number; script: string };
  goalId: string;
  evaluation: { id: string; actionId: string };
  practiced: Date;
  options: Record<string, unknown>;
  /** Supply the latest submitted event overall, never an older matching goal. */
  predecessor: {
    goalId: string | null;
    schedulerId: string | null;
    schedulerVersion: number | null;
    schedulerState: string | null;
  } | null;
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function exactObject(value: unknown, fields: string[]) {
  // Validate and detach at the boundary: plugin payloads must be lossless JSON.
  const copy: unknown = JSON.parse(canonicalJson(value, SCHEDULER_STATE_BYTES));
  if (!object(copy) || Object.keys(copy).some((key) => !fields.includes(key)))
    throw new Error("Invalid goal plugin contract object");
  return copy;
}

export function parseGoalPluginManifest(value: unknown): GoalPluginManifest {
  const row = exactObject(value, [
    "apiVersion",
    "stateVersion",
    "compatibleStateVersions",
    "actions",
  ]);
  const versions = row.compatibleStateVersions;
  if (
    row.apiVersion !== 1 ||
    !positiveInteger(row.stateVersion) ||
    !Array.isArray(versions) ||
    !versions.every(positiveInteger) ||
    !versions.includes(row.stateVersion) ||
    new Set(versions).size !== versions.length ||
    versions.some((version) => version > Number(row.stateVersion))
  )
    throw new Error("Invalid goal plugin state compatibility declaration");
  return {
    apiVersion: 1,
    stateVersion: row.stateVersion,
    compatibleStateVersions: versions,
    actions: parseActions(row.actions),
  };
}

function parseActions(value: unknown): GoalPluginAction[] {
  if (!Array.isArray(value) || value.length === 0)
    throw new Error("Goal plugin must declare named scheduling actions");
  const ids = new Set<string>();
  return value.map((item) => {
    const row = exactObject(item, ["id", "label", "description"]);
    if (
      typeof row.id !== "string" ||
      !row.id.trim() ||
      ids.has(row.id) ||
      typeof row.label !== "string" ||
      !row.label.trim() ||
      typeof row.description !== "string"
    )
      throw new Error("Invalid goal plugin action declaration");
    ids.add(row.id);
    return { id: row.id, label: row.label, description: row.description };
  });
}

export function parseGoalPluginState(value: unknown): GoalPluginState {
  const row = exactObject(value, [
    "version",
    "pluginId",
    "pluginVersion",
    "scriptHash",
    "stateVersion",
    "data",
  ]);
  if (
    row.version !== 1 ||
    typeof row.pluginId !== "string" ||
    !row.pluginId.trim() ||
    !positiveInteger(row.pluginVersion) ||
    !positiveInteger(row.stateVersion) ||
    typeof row.scriptHash !== "string" ||
    !/^[a-f0-9]{64}$/.test(row.scriptHash) ||
    !object(row.data)
  )
    throw new Error("Invalid goal plugin state");
  return {
    version: 1,
    pluginId: row.pluginId,
    pluginVersion: row.pluginVersion,
    scriptHash: row.scriptHash,
    stateVersion: row.stateVersion,
    data: row.data,
  };
}

function previousState(input: GoalPluginInput, manifest: GoalPluginManifest) {
  const row = input.predecessor;
  if (
    row?.goalId !== input.goalId ||
    row.schedulerId !== `plugin:${input.plugin.id}`
  )
    return null;
  if (row.schedulerVersion !== 1)
    throw new Error("Unsupported goal plugin API version");
  const state = parseGoalPluginState(parseStateJson(row.schedulerState));
  if (state.pluginId !== input.plugin.id)
    throw new Error("Goal plugin state identity mismatch");
  return manifest.compatibleStateVersions.includes(state.stateVersion)
    ? state
    : null;
}

function scheduledResult(value: unknown, practiced: Date) {
  const row = exactObject(value, ["due", "state"]);
  if (typeof row.due !== "string" || !object(row.state))
    throw new Error("Goal plugin must return a due timestamp and state object");
  const due = new Date(row.due);
  // Require an unambiguous UTC instant; Date's permissive rollover/parser must
  // not silently repair plugin mistakes. Event precision remains whole seconds.
  if (!Number.isFinite(due.getTime()) || due.toISOString() !== row.due)
    throw new Error("Goal plugin due must be an ISO UTC timestamp");
  // Local setters can choose the earlier occurrence of a repeated DST hour.
  due.setUTCMilliseconds(0);
  const intervalDays = (due.getTime() - practiced.getTime()) / 86400000;
  if (intervalDays < 0)
    throw new Error("Goal plugin due precedes practice time");
  return { due: due.toISOString(), intervalDays, data: row.state };
}

export async function calculateGoalPlugin(input: GoalPluginInput) {
  // Capture before the first await so script edits or caller mutation cannot mix
  // two definitions within one preview. The staging caller must recheck its DB
  // snapshot including the exact script before accepting the result.
  const practiced = new Date(
    Math.floor(input.practiced.getTime() / 1000) * 1000
  );
  if (!Number.isFinite(practiced.getTime()))
    throw new Error("Invalid practiced time");
  // canonicalJson rejects lossy values, so this clone preserves the typed input
  // except for the Date deliberately replaced with an ISO string for transport.
  const serialized = JSON.parse(
    canonicalJson({ ...input, practiced: practiced.toISOString() }, 1024 * 1024)
  ) as Omit<GoalPluginInput, "practiced"> & { practiced: string };
  const snapshot: GoalPluginInput = { ...serialized, practiced };
  const { plugin } = snapshot;
  if (
    !plugin.id.trim() ||
    !positiveInteger(plugin.version) ||
    !snapshot.goalId.trim() ||
    !snapshot.evaluation.id.trim()
  )
    throw new Error("Missing goal plugin identity or evaluation");
  const meta = { pluginId: plugin.id, pluginName: plugin.name };
  const invoke = (
    functionName: "describeGoalSchedulerV1" | "scheduleGoalV1",
    payload: unknown
  ) =>
    runPluginFunction({ functionName, script: plugin.script, payload, meta });
  const manifest = parseGoalPluginManifest(
    await invoke("describeGoalSchedulerV1", null)
  );
  if (
    !manifest.actions.some(
      (action) => action.id === snapshot.evaluation.actionId
    )
  )
    throw new Error(
      "The selected scheduling action is unavailable; update this goal's evaluation choices"
    );
  const previous = previousState(snapshot, manifest);
  const result = scheduledResult(
    await invoke("scheduleGoalV1", {
      apiVersion: 1,
      goalId: snapshot.goalId,
      evaluation: snapshot.evaluation,
      practiced: practiced.toISOString(),
      options: snapshot.options,
      stateVersion: manifest.stateVersion,
      previousState:
        previous === null
          ? null
          : { version: previous.stateVersion, data: previous.data },
    }),
    practiced
  );
  const state = parseGoalPluginState({
    version: 1,
    pluginId: plugin.id,
    pluginVersion: plugin.version,
    scriptHash: await hashCanonicalJson(plugin.script, 1024 * 1024),
    stateVersion: manifest.stateVersion,
    data: result.data,
  });
  return {
    schedulerId: `plugin:${plugin.id}`,
    schedulerVersion: 1,
    practiced: practiced.toISOString(),
    due: result.due,
    intervalDays: result.intervalDays,
    schedulerState: canonicalJson(state, SCHEDULER_STATE_BYTES),
    continued: previous !== null,
    manifest,
  };
}
