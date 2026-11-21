// Import and versioned goal entry points share transport, not scheduling semantics.
export type PluginFunctionName =
  | "parseImport"
  | "describeGoalSchedulerV1"
  | "scheduleGoalV1";

export interface InvokeRequest {
  type: "invoke";
  id: number;
  functionName: PluginFunctionName;
  script: string;
  payload: unknown;
  meta?: unknown;
}

export interface WorkerResponseOk {
  id: number;
  ok: true;
  result: unknown;
  timings?: Record<string, number>;
}

export interface WorkerResponseError {
  id: number;
  ok: false;
  error: {
    message: string;
    name?: string;
    stack?: string;
  };
  timings?: Record<string, number>;
}

export type WorkerResponse = WorkerResponseOk | WorkerResponseError;

export interface QueryRequest {
  type: "query";
  id: number;
  invokeId: number;
  sql: string;
}

export interface QueryResult {
  type: "queryResult";
  id: number;
  ok: boolean;
  result?: unknown;
  error?: { message: string };
}

export type AnyMessage = InvokeRequest | QueryResult;
export type WorkerMessage = WorkerResponse | QueryRequest;
export interface PluginBridge {
  queryDb?: (sql: string) => Promise<unknown>;
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function id(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
function reply(value: Record<string, unknown>) {
  return (
    value.ok === true ||
    (value.ok === false &&
      record(value.error) &&
      typeof value.error.message === "string")
  );
}
export function isWorkerInput(value: unknown): value is AnyMessage {
  if (!record(value) || !id(value.id)) return false;
  if (value.type === "invoke")
    return (
      typeof value.script === "string" &&
      (value.functionName === "parseImport" ||
        value.functionName === "describeGoalSchedulerV1" ||
        value.functionName === "scheduleGoalV1") &&
      value.methodName === undefined
    );
  return value.type === "queryResult" && reply(value);
}

export function isWorkerOutput(value: unknown): value is WorkerMessage {
  if (!record(value) || !id(value.id)) return false;
  if (value.type === "query")
    return id(value.invokeId) && typeof value.sql === "string";
  return value.type === undefined && reply(value);
}

export interface PluginInvocation {
  script: string;
  payload: unknown;
  meta?: unknown;
  functionName: PluginFunctionName;
}
