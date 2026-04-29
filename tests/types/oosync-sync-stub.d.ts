export type SyncableTable = any;
export type SyncOperation = any;
export type SyncResult = any;
export type SyncStatus = any;
export type SyncRuntime = any;

export declare const clearOldOutboxItems: any;
export declare const clearSyncOutbox: any;
export declare const getFailedOutboxItems: any;
export declare const getOutboxStats: any;
export declare const retryOutboxItem: any;
export declare const startSyncWorker: any;
export declare const setSyncRuntime: any;
export declare const applyRemoteChangesToLocalDb: any;

export declare const createAdapter: any;
export declare const getAdapter: any;
export declare const clearAdapterCache: any;
export declare const getAllAdapters: any;
export declare const batchToLocal: any;
export declare const batchToRemote: any;
export declare const getRegisteredTables: any;
export declare const hasAdapter: any;

export declare const camelToSnake: any;
export declare const snakeToCamel: any;
export declare const convertKeysToCamel: any;
export declare const convertKeysToSnake: any;
export declare const COMMON_KEYS_CAMEL_TO_SNAKE: Record<string, string>;
export declare const COMMON_KEYS_SNAKE_TO_CAMEL: Record<string, string>;
export declare const camelizeKeys: any;
export declare const camelizeKeysFast: any;
export declare const snakifyKeys: any;
export declare const snakifyKeysFast: any;
export declare const toCamelCase: any;
export declare const toSnakeCase: any;

export class RealtimeManager {
  [key: string]: any;
}

export class SyncEngine {
  [key: string]: any;
}

export class SyncService {
  [key: string]: any;
}

export class WorkerClient {
  constructor(...args: any[]);
  [key: string]: any;
}

export class SyncInProgressError extends Error {}
