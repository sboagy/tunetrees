import { describe, expect, it } from "vitest";
import { SyncErrorLedger } from "../../e2e/helpers/sync-error-ledger";

describe("sync error recovery enforcement", () => {
  it("does not let successful sync hide an unretried RPC failure", () => {
    const ledger = new SyncErrorLedger();
    ledger.fail("rpc", "HTTP 502");
    ledger.completedSync();
    expect(ledger.problems()).toEqual(["HTTP 502"]);
  });

  it("does not accept a request started before the failure as recovery", () => {
    const ledger = new SyncErrorLedger();
    const oldRequest = ledger.startRequest();
    ledger.fail("sync", "HTTP 502");
    ledger.requestSucceeded("sync", oldRequest, ledger.requestFinished());
    ledger.completedSync();
    expect(ledger.problems()).toEqual(["HTTP 502"]);
  });

  it("requires completed application sync after a successful retry", () => {
    const ledger = new SyncErrorLedger();
    ledger.fail("sync", "HTTP 502");
    ledger.requestSucceeded(
      "sync",
      ledger.startRequest(),
      ledger.requestFinished()
    );
    expect(ledger.problems()).toEqual(["HTTP 502"]);
    ledger.completedSync();
    expect(ledger.problems()).toEqual([]);
  });

  it("accepts completion arriving before response-body inspection finishes", () => {
    const ledger = new SyncErrorLedger();
    ledger.fail("sync", "HTTP 502");
    const retry = ledger.startRequest();
    const finished = ledger.requestFinished();
    ledger.completedSync();
    ledger.requestSucceeded("sync", retry, finished);
    expect(ledger.problems()).toEqual([]);
  });

  it("does not let another endpoint's success clear a failure", () => {
    const ledger = new SyncErrorLedger();
    ledger.fail("rpc", "HTTP 502");
    ledger.requestSucceeded(
      "sync",
      ledger.startRequest(),
      ledger.requestFinished()
    );
    ledger.completedSync();
    expect(ledger.problems()).toEqual(["HTTP 502"]);
  });

  it("never forgives recovery after the deadline", () => {
    const ledger = new SyncErrorLedger(100);
    ledger.fail("sync", "HTTP 502", 0);
    ledger.requestSucceeded(
      "sync",
      ledger.startRequest(),
      ledger.requestFinished(),
      50
    );
    ledger.completedSync(101);
    expect(ledger.problems(101)).toEqual([
      "Recovery deadline exceeded: HTTP 502",
    ]);
  });

  it("repeated failures do not extend the recovery deadline", () => {
    const ledger = new SyncErrorLedger(100);
    ledger.fail("sync", "first failure", 0);
    ledger.fail("sync", "second failure", 90);
    expect(ledger.problems(101)).toEqual([
      "Recovery deadline exceeded: second failure",
    ]);
  });

  it("does not carry successful status forward to a later console error", () => {
    const ledger = new SyncErrorLedger();
    ledger.completedSync();
    ledger.fail("console", "Upload failed");
    expect(ledger.problems()).toEqual(["Upload failed"]);
  });
});

it("does not combine an older completion with a retry that had not finished", () => {
  const ledger = new SyncErrorLedger();
  ledger.fail("sync", "HTTP 502");
  const retry = ledger.startRequest();
  ledger.completedSync();
  ledger.requestSucceeded("sync", retry, ledger.requestFinished());
  expect(ledger.problems()).toEqual(["HTTP 502"]);
});
