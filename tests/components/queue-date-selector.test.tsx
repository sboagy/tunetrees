import { cleanup, fireEvent, render, screen } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { createSignal } from "solid-js";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { QueueDateSelector } from "@/components/practice/QueueDateSelector";

// Kobalte restores scroll position when releasing its modal scroll lock.
beforeEach(() => vi.spyOn(window, "scrollTo").mockImplementation(() => {}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function setup() {
  render(() => {
    const [open, setOpen] = createSignal(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Choose queue
        </button>
        <QueueDateSelector
          isOpen={open()}
          currentDate={new Date()}
          latestQueueDate={null}
          recentQueueDates={[]}
          hasMoreRecentQueues={false}
          onSelectDate={() => {}}
          onReset={() => {}}
          onClose={() => setOpen(false)}
        />
      </>
    );
  });
}

it("focuses the dialog, contains Tab navigation, and restores the opener after Escape", async () => {
  const user = userEvent.setup();
  setup();
  const opener = screen.getByRole("button", { name: "Choose queue" });
  await user.click(opener);
  const close = screen.getByRole("button", { name: "Close dialog" });
  const resize = screen.getByRole("button", { name: "Resize dialog" });
  await vi.waitFor(() => expect(document.activeElement).toBe(close));
  await user.tab({ shift: true });
  expect(document.activeElement).toBe(resize);
  await user.tab();
  expect(document.activeElement).toBe(close);
  await user.keyboard("{Escape}");
  await vi.waitFor(() => {
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});

it("dismisses from the backdrop and restores focus", async () => {
  const user = userEvent.setup();
  setup();
  const opener = screen.getByRole("button", { name: "Choose queue" });
  await user.click(opener);
  fireEvent.pointerDown(screen.getByTestId("queue-date-selector-backdrop"), {
    pointerType: "mouse",
    button: 0,
  });
  await vi.waitFor(() => {
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});
