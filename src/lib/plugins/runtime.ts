import type { PluginFunctionName } from "./quickjs-worker";

export async function runPluginFunction(params: {
  script: string;
  functionName: PluginFunctionName;
  payload: unknown;
  meta?: unknown;
  timeoutMs?: number;
}): Promise<unknown> {
  const { runQuickJsPlugin } = await import("./quickjs-host");
  return runQuickJsPlugin(params);
}
