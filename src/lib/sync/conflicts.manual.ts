/**
 * Conflict Resolution Manual Tests
 *
 * Manual test scenarios for sync conflict detection and resolution strategies.
 *
 * NOTE: Install vitest to run these as automated tests:
 * ```
 * npm install -D vitest
 * npm run test
 * ```
 *
 * For now, use this as a reference for manual testing in browser console.
 */

import {
  detectConflict,
  resolveConflict,
  type SyncConflict,
} from "./conflicts";

// Manual Test 1: Conflict Detection
export function testConflictDetection() {
  console.log("=== Test: Conflict Detection ===");

  const local = { id: 1, sync_version: 5, last_modified_at: "2024-01-01" };
  const remote = { id: 1, sync_version: 6, last_modified_at: "2024-01-02" };

  const hasConflict = detectConflict(local, remote);

  console.log("Local:", local);
  console.log("Remote:", remote);
  console.log("Has conflict:", hasConflict);
  console.log("Expected: true");
  console.log("✅ Test passed:", hasConflict === true);
}

// Manual Test 2: Last-Write-Wins (Remote Newer)
export function testLastWriteWinsRemote() {
  console.log("\n=== Test: Last-Write-Wins (Remote Newer) ===");

  const conflict: SyncConflict = {
    tableName: "tune",
    recordId: "1",
    localVersion: 5,
    remoteVersion: 6,
    localTimestamp: "2024-01-01T10:00:00Z",
    remoteTimestamp: "2024-01-02T11:00:00Z",
    localData: { id: 1, title: "Local" },
    remoteData: { id: 1, title: "Remote" },
    detectedAt: new Date().toISOString(),
  };

  const resolution = resolveConflict(conflict, "last-write-wins");

  console.log("Conflict:", conflict);
  console.log("Resolution:", resolution);
  console.log("Expected winner: remote");
  console.log("✅ Test passed:", resolution.winner === "remote");
}

// Manual Test 3: Last-Write-Wins (Local Newer)
export function testLastWriteWinsLocal() {
  console.log("\n=== Test: Last-Write-Wins (Local Newer) ===");

  const conflict: SyncConflict = {
    tableName: "tune",
    recordId: "1",
    localVersion: 5,
    remoteVersion: 6,
    localTimestamp: "2024-01-02T11:00:00Z",
    remoteTimestamp: "2024-01-01T10:00:00Z",
    localData: { id: 1, title: "Local" },
    remoteData: { id: 1, title: "Remote" },
    detectedAt: new Date().toISOString(),
  };

  const resolution = resolveConflict(conflict, "last-write-wins");

  console.log("Conflict:", conflict);
  console.log("Resolution:", resolution);
  console.log("Expected winner: local");
  console.log("✅ Test passed:", resolution.winner === "local");
}

// Manual Test 4: Local-Wins Strategy
export function testLocalWins() {
  console.log("\n=== Test: Local-Wins Strategy ===");

  const conflict: SyncConflict = {
    tableName: "tune",
    recordId: "1",
    localVersion: 5,
    remoteVersion: 6,
    localTimestamp: "2024-01-01T10:00:00Z",
    remoteTimestamp: "2024-01-02T11:00:00Z",
    localData: { id: 1, title: "Local" },
    remoteData: { id: 1, title: "Remote" },
    detectedAt: new Date().toISOString(),
  };

  const resolution = resolveConflict(conflict, "local-wins");

  console.log("Conflict:", conflict);
  console.log("Resolution:", resolution);
  console.log("Expected winner: local (always)");
  console.log("✅ Test passed:", resolution.winner === "local");
}

// Manual Test 5: Remote-Wins Strategy
export function testRemoteWins() {
  console.log("\n=== Test: Remote-Wins Strategy ===");

  const conflict: SyncConflict = {
    tableName: "tune",
    recordId: "1",
    localVersion: 5,
    remoteVersion: 6,
    localTimestamp: "2024-01-02T11:00:00Z",
    remoteTimestamp: "2024-01-01T10:00:00Z",
    localData: { id: 1, title: "Local" },
    remoteData: { id: 1, title: "Remote" },
    detectedAt: new Date().toISOString(),
  };

  const resolution = resolveConflict(conflict, "remote-wins");

  console.log("Conflict:", conflict);
  console.log("Resolution:", resolution);
  console.log("Expected winner: remote (always)");
  console.log("✅ Test passed:", resolution.winner === "remote");
}

// Run all tests
export function runAllConflictTests() {
  console.log("🧪 Running Conflict Resolution Manual Tests\n");

  testConflictDetection();
  testLastWriteWinsRemote();
  testLastWriteWinsLocal();
  testLocalWins();
  testRemoteWins();

  console.log("\n✅ All manual tests completed!");
  console.log(
    "Run in browser console: import { runAllConflictTests } from '@/lib/sync/conflicts.test'; runAllConflictTests();",
  );
}
