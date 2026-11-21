import codegenConfig from "../../../oosync.codegen.config.json";

// Use the same source as the generated browser SQLite storage configuration.
export const LAST_SYNC_TIMESTAMP_KEY_PREFIX =
  codegenConfig.browserSqlite.lastSyncTimestampKeyPrefix;
export const lastSyncTimestampKey = (userId: string): string =>
  `${LAST_SYNC_TIMESTAMP_KEY_PREFIX}_${userId}`;
