/**
 * Conflict Detection and Resolution
 *
 * Handles conflicts when the same record is modified on multiple devices.
 * Uses sync_version and last_modified_at to detect and resolve conflicts.
 *
 * @module lib/sync/conflicts
 */

/**
 * Conflict resolution strategy
 */
export type ConflictStrategy =
  | "last-write-wins" // Newest last_modified_at wins (default)
  | "local-wins" // Local version always wins
  | "remote-wins" // Remote version always wins
  | "manual"; // Show conflict UI, let user choose

/**
 * Sync conflict record
 */
export interface SyncConflict {
  tableName: string;
  recordId: string;
  localVersion: number;
  remoteVersion: number;
  localTimestamp: string;
  remoteTimestamp: string;
  localData: Record<string, unknown>;
  remoteData: Record<string, unknown>;
  detectedAt: string;
}

/**
 * Conflict resolution result
 */
export interface ConflictResolution {
  winner: "local" | "remote";
  data: Record<string, unknown>;
  strategy: ConflictStrategy;
  timestamp: string;
}

/**
 * Detect if a conflict exists between local and remote records
 *
 * A conflict occurs when:
 * 1. Both local and remote have been modified since last sync
 * 2. sync_version differs between local and remote
 *
 * @param localRecord - Local database record
 * @param remoteRecord - Remote (Supabase) record
 * @returns True if conflict detected
 *
 * @example
 * ```typescript
 * const hasConflict = detectConflict(
 *   { id: 1, syncVersion: 5, lastModifiedAt: '2025-10-08T10:00:00Z' },
 *   { id: 1, syncVersion: 6, lastModifiedAt: '2025-10-08T11:00:00Z' }
 * ); // Returns true - different syncVersion
 * ```
 */
export function detectConflict(localRecord: any, remoteRecord: any): boolean {
  // No conflict if both versions match
  if (localRecord.syncVersion === remoteRecord.syncVersion) {
    return false;
  }

  // Conflict exists if versions differ
  // This means both were modified independently
  return true;
}

/**
 * Resolve a conflict using the specified strategy
 *
 * @param conflict - Conflict to resolve
 * @param strategy - Resolution strategy to use
 * @returns Resolution result
 *
 * @example
 * ```typescript
 * const resolution = resolveConflict(conflict, 'last-write-wins');
 * // Use resolution.data to update local/remote database
 * ```
 */
export function resolveConflict(
  conflict: SyncConflict,
  strategy: ConflictStrategy = "last-write-wins",
): ConflictResolution {
  const timestamp = new Date().toISOString();

  switch (strategy) {
    case "last-write-wins":
      return resolveLastWriteWins(conflict, timestamp);

    case "local-wins":
      return {
        winner: "local",
        data: conflict.localData,
        strategy,
        timestamp,
      };

    case "remote-wins":
      return {
        winner: "remote",
        data: conflict.remoteData,
        strategy,
        timestamp,
      };

    case "manual":
      throw new Error(
        "Manual conflict resolution requires user interaction. " +
          "Show conflict UI and call resolveConflict with chosen strategy.",
      );

    default:
      throw new Error(`Unknown conflict strategy: ${strategy}`);
  }
}

/**
 * Resolve conflict using last-write-wins strategy
 *
 * Compares last_modified_at timestamps:
 * - Newest timestamp wins
 * - If timestamps equal, remote wins (cloud is authoritative)
 *
 * @param conflict - Conflict to resolve
 * @param timestamp - Current timestamp
 * @returns Resolution result
 */
function resolveLastWriteWins(
  conflict: SyncConflict,
  timestamp: string,
): ConflictResolution {
  const localTime = new Date(conflict.localTimestamp).getTime();
  const remoteTime = new Date(conflict.remoteTimestamp).getTime();

  // Compare timestamps
  if (localTime > remoteTime) {
    // Local is newer
    return {
      winner: "local",
      data: conflict.localData,
      strategy: "last-write-wins",
      timestamp,
    };
  } else if (remoteTime > localTime) {
    // Remote is newer
    return {
      winner: "remote",
      data: conflict.remoteData,
      strategy: "last-write-wins",
      timestamp,
    };
  } else {
    // Same timestamp - remote wins (cloud is authoritative)
    return {
      winner: "remote",
      data: conflict.remoteData,
      strategy: "last-write-wins",
      timestamp,
    };
  }
}

/**
 * Create a conflict record from local and remote data
 *
 * @param tableName - Table name
 * @param recordId - Record ID
 * @param localRecord - Local record
 * @param remoteRecord - Remote record
 * @returns SyncConflict object
 */
export function createConflict(
  tableName: string,
  recordId: string,
  localRecord: any,
  remoteRecord: any,
): SyncConflict {
  return {
    tableName,
    recordId,
    localVersion: localRecord.syncVersion || 0,
    remoteVersion: remoteRecord.syncVersion || 0,
    localTimestamp: localRecord.lastModifiedAt || new Date().toISOString(),
    remoteTimestamp: remoteRecord.lastModifiedAt || new Date().toISOString(),
    localData: localRecord,
    remoteData: remoteRecord,
    detectedAt: new Date().toISOString(),
  };
}

/**
 * Merge non-conflicting fields from both records
 *
 * Advanced strategy (future): Merge fields that don't conflict.
 * For example:
 * - Local changed field A
 * - Remote changed field B
 * - Result: both changes applied
 *
 * @param conflict - Conflict to merge
 * @returns Merged record (union of both changes)
 */
export function mergeNonConflictingFields(
  conflict: SyncConflict,
): Record<string, unknown> {
  const merged = { ...conflict.remoteData }; // Start with remote (authoritative)

  // Compare each field
  for (const key of Object.keys(conflict.localData)) {
    const localValue = conflict.localData[key];
    const remoteValue = conflict.remoteData[key];

    // If remote doesn't have this field or it's unchanged, use local value
    if (!(key in conflict.remoteData) || remoteValue === localValue) {
      merged[key] = localValue;
    }
    // If values differ, keep remote (last-write-wins logic)
    // Could add more sophisticated comparison here
  }

  return merged;
}

/**
 * Log conflict for debugging/auditing
 *
 * @param conflict - Conflict to log
 * @param resolution - How it was resolved
 */
export function logConflict(
  conflict: SyncConflict,
  resolution: ConflictResolution,
): void {
  console.warn(
    `[Conflict] ${conflict.tableName}:${conflict.recordId}`,
    `\n  Local:  v${conflict.localVersion} @ ${conflict.localTimestamp}`,
    `\n  Remote: v${conflict.remoteVersion} @ ${conflict.remoteTimestamp}`,
    `\n  Winner: ${resolution.winner} (${resolution.strategy})`,
  );
}
