import { describe, expect, it } from "vitest";
import { WORKER_SYNC_CONFIG } from "../../../worker/src/generated/worker-config.generated";

describe("worker delete policy overrides", () => {
  it("allows hard deletes for daily_practice_queue", () => {
    expect(
      WORKER_SYNC_CONFIG.push.tableRules.daily_practice_queue?.denyDelete
    ).toBe(false);
  });
});
