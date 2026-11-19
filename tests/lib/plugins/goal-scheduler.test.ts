import {
  newQuickJSAsyncWASMModule,
  type QuickJSAsyncRuntime,
} from "quickjs-emscripten";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  calculateGoalPlugin,
  type GoalPluginInput,
  parseGoalPluginManifest,
  parseGoalPluginState,
} from "../../../src/lib/plugins/goal-scheduler";
import { executePlugin } from "../../../src/lib/plugins/quickjs-core";
import { runPluginFunction } from "../../../src/lib/plugins/runtime";

vi.mock("../../../src/lib/plugins/runtime", () => ({
  runPluginFunction: vi.fn(),
}));

const manifest = {
  apiVersion: 1,
  stateVersion: 2,
  compatibleStateVersions: [1, 2],
  actions: [
    {
      id: "advance",
      label: "Advance",
      description: "Practice again in six hours",
    },
  ],
};
const script = `
function describeGoalSchedulerV1() {
  return ${JSON.stringify(manifest)};
}
function scheduleGoalV1(input) {
  const previous = input.previousState;
  return {
    due: new Date(Date.parse(input.practiced) + 6 * 3600000).toISOString(),
    state: { count: previous ? previous.data.count + 1 : 1,
      evaluationId: input.evaluation.id, action: input.evaluation.actionId }
  };
}`;
function input(): GoalPluginInput {
  return {
    plugin: { id: "plugin-a", name: "My scheduler", version: 3, script },
    goalId: "goal-a",
    evaluation: { id: "smooth", actionId: "advance" },
    practiced: new Date("2026-11-18T12:00:00.000Z"),
    options: {},
    predecessor: null,
  };
}
function previous(overrides: Record<string, unknown> = {}) {
  return {
    goalId: "goal-a",
    schedulerId: "plugin:plugin-a",
    schedulerVersion: 1,
    schedulerState: JSON.stringify({
      version: 1,
      pluginId: "plugin-a",
      pluginVersion: 1,
      scriptHash: "a".repeat(64),
      stateVersion: 1,
      data: { count: 4 },
      ...overrides,
    }),
  };
}

describe("versioned goal plugin execution", () => {
  let runtime: QuickJSAsyncRuntime;
  beforeEach(async () => {
    runtime = (await newQuickJSAsyncWASMModule()).newRuntime();
    vi.mocked(runPluginFunction).mockImplementation((params) =>
      executePlugin(
        runtime,
        {
          ...params,
          type: "invoke",
          id: 1,
        },
        {}
      )
    );
  });
  afterEach(() => {
    runtime.dispose();
    vi.resetAllMocks();
    vi.unstubAllEnvs();
  });

  it("preserves a future due instant in New York's repeated DST hour", async () => {
    vi.stubEnv("TZ", "America/New_York");
    const request = input();
    request.practiced = new Date("2017-11-05T06:00:00.000Z");
    expect(request.practiced.getTimezoneOffset()).toBe(300);
    request.plugin.script += `
      function scheduleGoalV1() {
        return { due: "2017-11-05T06:30:00.999Z", state: {} };
      }
    `;
    const result = await calculateGoalPlugin(request);
    expect(result.due).toBe("2017-11-05T06:30:00.000Z");
    expect(result.intervalDays).toBe(1 / 48);
  });

  it("returns fractional days and plugin-owned state without fabricated FSRS fields", async () => {
    const result = await calculateGoalPlugin(input());
    expect(result).toMatchObject({
      schedulerId: "plugin:plugin-a",
      schedulerVersion: 1,
      due: "2026-11-18T18:00:00.000Z",
      intervalDays: 0.25,
      continued: false,
    });
    expect(
      parseGoalPluginState(JSON.parse(result.schedulerState))
    ).toMatchObject({
      pluginVersion: 3,
      stateVersion: 2,
      data: { count: 1, evaluationId: "smooth", action: "advance" },
    });
  });
  it("continues explicitly compatible earlier state after a script/code version change", async () => {
    const result = await calculateGoalPlugin({
      ...input(),
      predecessor: previous(),
    });
    expect(result.continued).toBe(true);
    expect(
      parseGoalPluginState(JSON.parse(result.schedulerState))
    ).toMatchObject({
      pluginVersion: 3,
      stateVersion: 2,
      data: { count: 5 },
    });
  });
  it("starts fresh when the latest practice belongs to a different goal", async () => {
    const result = await calculateGoalPlugin({
      ...input(),
      predecessor: { ...previous(), goalId: "goal-b" },
    });
    expect(result.continued).toBe(false);
    expect(JSON.parse(result.schedulerState).data.count).toBe(1);
  });
  it("does not reuse another plugin's state", async () => {
    const result = await calculateGoalPlugin({
      ...input(),
      predecessor: { ...previous(), schedulerId: "plugin:plugin-b" },
    });
    expect(result.continued).toBe(false);
  });
  it("starts fresh for an undeclared state version without changing its predecessor", async () => {
    const predecessor = previous({ stateVersion: 3 });
    const original = { ...predecessor };
    const result = await calculateGoalPlugin({ ...input(), predecessor });
    expect(result.continued).toBe(false);
    expect(predecessor).toEqual(original);
  });
  it("rejects corrupt matching state instead of treating it as a fresh practice", async () => {
    await expect(
      calculateGoalPlugin({ ...input(), predecessor: previous({ data: null }) })
    ).rejects.toThrow("Invalid goal plugin state");
  });
  it("rejects a mismatched identity inside the state envelope", async () => {
    await expect(
      calculateGoalPlugin({
        ...input(),
        predecessor: previous({ pluginId: "plugin-b" }),
      })
    ).rejects.toThrow("identity mismatch");
  });
  it("retains one script snapshot while the caller edits the plugin", async () => {
    const request = input();
    const pending = calculateGoalPlugin(request);
    request.plugin.script = "throw new Error('edited')";
    request.plugin.version = 4;
    const result = await pending;
    expect(JSON.parse(result.schedulerState).pluginVersion).toBe(3);
  });
  it("propagates script errors without generating a fallback result", async () => {
    const request = input();
    request.plugin.script +=
      "\nfunction scheduleGoalV1() { throw new Error('Cannot schedule'); }";
    await expect(calculateGoalPlugin(request)).rejects.toThrow(
      "Cannot schedule"
    );
  });
  it("rejects a removed action before invoking the scheduling function", async () => {
    const request = input();
    request.evaluation.actionId = "removed-action";
    await expect(calculateGoalPlugin(request)).rejects.toThrow(
      "selected scheduling action is unavailable"
    );
    expect(runPluginFunction).toHaveBeenCalledTimes(1);
  });
  it.each([
    ["null", "Invalid goal plugin contract object"],
    ['{ due: "2026-11-17T12:00:00.000Z", state: {} }', "precedes practice"],
    ['{ due: "2026-02-30T12:00:00.000Z", state: {} }', "ISO UTC"],
    ['{ due: "tomorrow", state: {} }', "ISO UTC"],
    [
      '{ due: "2026-11-19T12:00:00.000Z", state: { value: "x".repeat(17000) } }',
      "JSON payload is too large",
    ],
  ])("rejects invalid scheduler result %s", async (output, error) => {
    const request = input();
    request.plugin.script += `\nfunction scheduleGoalV1() { return ${output}; }`;
    await expect(calculateGoalPlugin(request)).rejects.toThrow(error);
  });
});

it.each([
  { ...manifest, compatibleStateVersions: [1] },
  { ...manifest, compatibleStateVersions: [1, 2, 3] },
  { ...manifest, compatibleStateVersions: [1, 2, 2] },
  { ...manifest, stateVersion: 1.5 },
  { ...manifest, apiVersion: 2 },
  { ...manifest, actions: [] },
  { ...manifest, actions: [manifest.actions[0], manifest.actions[0]] },
  { ...manifest, actions: [{ id: "advance", label: "", description: "" }] },
])("rejects invalid state compatibility declaration %j", (value) => {
  expect(() => parseGoalPluginManifest(value)).toThrow();
});
