// Wrangler entrypoint.
// The worker implementation lives in `oosync/worker/*` (future-extractable),
// but ALL generated artifacts live in this consumer package.

import createWorker from "@oosync-worker/index";
import { SYNCABLE_TABLES, TABLE_REGISTRY_CORE } from "@shared-generated/sync";
import { tables as schemaTables } from "./generated/schema-postgres.generated";
import { WORKER_SYNC_CONFIG } from "./generated/worker-config.generated";

export default createWorker({
  schemaTables,
  syncableTables: SYNCABLE_TABLES,
  tableRegistryCore: TABLE_REGISTRY_CORE,
  workerSyncConfig: WORKER_SYNC_CONFIG,
});
