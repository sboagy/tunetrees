import type { PluginFunctionName } from "./quickjs-worker";

function extractPluginMeta(meta: unknown): {
  pluginId?: string;
  pluginName?: string;
} {
  if (!meta || typeof meta !== "object") return {};
  const record = meta as Record<string, unknown>;
  const pluginId =
    typeof record.pluginId === "string" ? record.pluginId : undefined;
  const pluginName =
    typeof record.pluginName === "string" ? record.pluginName : undefined;
  return { pluginId, pluginName };
}

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
  const startedAt = performance.now();
  const pluginMeta = extractPluginMeta(params.meta);
  const { runQuickJsPlugin } = await import("./quickjs-host");
  const importMs = performance.now() - startedAt;

  try {
    const result = await runQuickJsPlugin(params);
    const totalMs = performance.now() - startedAt;
    console.info("[QuickJS][runtime] runPluginFunction complete", {
      functionName: params.functionName,
      methodName: params.methodName,
      importMs,
      executeMs: totalMs - importMs,
      totalMs,
      ...pluginMeta,
    });
    return result;
  } catch (error) {
    const totalMs = performance.now() - startedAt;
    console.warn("[QuickJS][runtime] runPluginFunction failed", {
      functionName: params.functionName,
      methodName: params.methodName,
      importMs,
      executeMs: totalMs - importMs,
      totalMs,
      ...pluginMeta,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message }
          : { message: "Unknown plugin runtime error" },
    });
    throw error;
  }
}
