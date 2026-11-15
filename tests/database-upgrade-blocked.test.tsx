import { cleanup, render, screen } from "@solidjs/testing-library";
import { afterEach, describe, expect, it } from "vitest";
import { DatabaseUpgradeBlocked } from "../src/components/auth/DatabaseUpgradeBlocked";

afterEach(cleanup);
describe("blocked database upgrade", () => {
  it("explains unsent changes and safe recovery without a destructive action", () => {
    render(() => <DatabaseUpgradeBlocked reason="outbox" />);
    expect(screen.getByRole("alert")).toBeDefined();
    expect(
      screen.getByText(/changes that have not finished syncing/)
    ).toBeDefined();
    expect(screen.getByText(/Do not clear site data/)).toBeDefined();
    expect(
      screen.getByRole("button", { name: "Retry after preserving local work" })
    ).toBeDefined();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
  it("explains that anonymous practice and upload drafts need preservation", () => {
    render(() => <DatabaseUpgradeBlocked reason="local_data" />);
    expect(
      screen.getByText(/anonymous practice or pending media uploads/)
    ).toBeDefined();
  });
});
