import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseUpgradeBlocked } from "../src/components/auth/DatabaseUpgradeBlocked";

beforeEach(() => vi.stubGlobal("scrollTo", vi.fn()));

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
  it("warns against bypassing preservation", () => {
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
      screen.getByRole("button", { name: "Retry After Preserving Local Work" })
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

const openDiscard = () =>
  fireEvent.click(screen.getByTestId("discard-blocked-database"));

it("names the account/site and does not discard when opening or cancelling", async () => {
  const discard = vi.fn();
  render(() => (
    <DatabaseUpgradeBlocked
      reason="outbox"
      account="user@example.com"
      onDiscard={discard}
    />
  ));
  openDiscard();
  expect(screen.getByText(/user@example.com/).textContent).toContain(
    globalThis.location.host
  );
  expect(screen.getByText(/Server data remains intact/)).toBeDefined();
  const cancel = screen.getByRole("button", { name: "Cancel" });
  await waitFor(() => expect(document.activeElement).toBe(cancel));
  fireEvent.click(cancel);
  expect(discard).not.toHaveBeenCalled();
});

it("requires confirmation and prevents repeated discard or retry while resetting", async () => {
  const discard = vi.fn(() => new Promise<void>(() => {}));
  render(() => <DatabaseUpgradeBlocked reason="outbox" onDiscard={discard} />);
  openDiscard();
  const confirm = screen.getByTestId("confirm-discard-blocked-database");
  fireEvent.click(confirm);
  fireEvent.click(confirm);
  await waitFor(() => expect(discard).toHaveBeenCalledOnce());
  expect(confirm.hasAttribute("disabled")).toBe(true);
  expect(
    screen.getByTestId("retry-database-upgrade").hasAttribute("disabled")
  ).toBe(true);
});

it("keeps a failed reset visible and allows an explicit retry", async () => {
  const discard = vi
    .fn()
    .mockRejectedValueOnce(new Error("storage failed"))
    .mockResolvedValue(undefined);
  render(() => <DatabaseUpgradeBlocked reason="backup" onDiscard={discard} />);
  openDiscard();
  fireEvent.click(screen.getByTestId("confirm-discard-blocked-database"));
  await screen.findByText(/Local reset could not finish/);
  fireEvent.click(screen.getByTestId("confirm-discard-blocked-database"));
  expect(discard).toHaveBeenCalledTimes(2);
});

it("does not offer destructive recovery while offline", () => {
  vi.stubGlobal("navigator", { onLine: false });
  render(() => <DatabaseUpgradeBlocked reason="outbox" onDiscard={vi.fn()} />);
  expect(
    screen.getByTestId("discard-blocked-database").hasAttribute("disabled")
  ).toBe(true);
  expect(screen.getByText(/Connect to the internet/)).toBeDefined();
});
