export type PluginFunctionName = "parseImport" | "createScheduler";

export interface InvokeRequest {
  type: "invoke";
  id: number;
  functionName: PluginFunctionName;
  methodName?: "processFirstReview" | "processReview";
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

export interface FsrsRequest {
  type: "fsrs";
  id: number;
  invokeId: number;
  method: "processFirstReview" | "processReview";
  payload: unknown;
}

export interface FsrsResult {
  type: "fsrsResult";
  id: number;
  ok: boolean;
  result?: unknown;
  error?: { message: string };
}

export type AnyMessage = InvokeRequest | QueryResult | FsrsResult;

export type WorkerMessage = WorkerResponse | QueryRequest | FsrsRequest;
export interface PluginBridge {
  queryDb?: (sql: string) => Promise<unknown>;
  fsrsScheduler?: Record<
    "processFirstReview" | "processReview",
    (payload: unknown) => Promise<unknown>
  >;
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function id(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
function method(value: unknown) {
  return value === "processFirstReview" || value === "processReview";
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
      ((value.functionName === "parseImport" &&
        value.methodName === undefined) ||
        (value.functionName === "createScheduler" && method(value.methodName)))
    );
  return (
    (value.type === "queryResult" || value.type === "fsrsResult") &&
    reply(value)
  );
}
export function isWorkerOutput(value: unknown): value is WorkerMessage {
  if (!record(value) || !id(value.id)) return false;
  if (value.type === "query")
    return id(value.invokeId) && typeof value.sql === "string";
  if (value.type === "fsrs") return id(value.invokeId) && method(value.method);
  return value.type === undefined && reply(value);
}

export type PluginInvocation = {
  script: string;
  payload: unknown;
  meta?: unknown;
} & (
  | { functionName: "parseImport"; methodName?: never }
  | {
      functionName: "createScheduler";
      methodName: "processFirstReview" | "processReview";
    }
);
