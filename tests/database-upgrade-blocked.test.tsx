import { cleanup, fireEvent, render, screen } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DatabaseUpgradeBlocked } from "../src/components/auth/DatabaseUpgradeBlocked";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("blocked database upgrade", () => {
  it("keeps the main landmark", () => {
    render(() => <DatabaseUpgradeBlocked reason="outbox" />);
    expect(screen.getByRole("main")).toBeDefined();
  });
  it("announces the reason in an alert", () => {
    render(() => <DatabaseUpgradeBlocked reason="outbox" />);
    expect(screen.getByRole("alert").textContent).toContain(
      "changes that have not finished syncing"
    );
  });
  it("warns against clearing site data", () => {
    render(() => <DatabaseUpgradeBlocked reason="outbox" />);
    expect(screen.getByText(/Do not clear site data/)).toBeDefined();
  });
  it("offers only the retry action", () => {
    render(() => <DatabaseUpgradeBlocked reason="outbox" />);
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
  it("explains a recovery backup", () => {
    render(() => <DatabaseUpgradeBlocked reason="backup" />);
    expect(screen.getByText(/saved recovery backup/)).toBeDefined();
  });
  it("explains an inspection failure", () => {
    render(() => <DatabaseUpgradeBlocked reason="inspection_failed" />);
    expect(screen.getByText(/could not verify/)).toBeDefined();
  });
  it("reloads when retry is clicked", () => {
    const reload = vi.fn();
    vi.stubGlobal("location", { reload });
    render(() => <DatabaseUpgradeBlocked reason="outbox" />);
    fireEvent.click(
      screen.getByRole("button", { name: "Retry after preserving local work" })
    );
    expect(reload).toHaveBeenCalledOnce();
  });
  it("explains that anonymous practice and upload drafts need preservation", () => {
    render(() => <DatabaseUpgradeBlocked reason="local_data" />);
    expect(
      screen.getByText(/anonymous practice or pending media uploads/)
    ).toBeDefined();
  });
});
