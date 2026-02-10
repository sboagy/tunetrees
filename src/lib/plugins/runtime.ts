import type { PluginFunctionName } from "./quickjs-worker";

export async function runPluginFunction(params: {
  script: string;
  functionName: PluginFunctionName;
  methodName?: "processFirstReview" | "processReview";
  payload: unknown;
  meta?: unknown;
  timeoutMs?: number;
  bridge?: {
    queryDb?: (sql: string) => Promise<unknown>;
    fsrsScheduler?: {
      processFirstReview: (payload: unknown) => Promise<unknown>;
      processReview: (payload: unknown) => Promise<unknown>;
    };
  };
}): Promise<unknown> {
  const { runQuickJsPlugin } = await import("./quickjs-host");
  return runQuickJsPlugin(params);
}