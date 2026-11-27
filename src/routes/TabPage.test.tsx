import { cleanup, fireEvent, render, screen } from "@solidjs/testing-library";
import { createResource, createSignal, Show } from "solid-js";
import { afterEach, expect, it, vi } from "vitest";
import { TabPage } from "./TabPage";

const mocks = vi.hoisted(() => ({ loadDetails: vi.fn() }));

vi.mock("./practice", () => ({
  default: () => {
    const [detailsVisible, setDetailsVisible] = createSignal(false);
    const Details = () => {
      const [details] = createResource(mocks.loadDetails);
      return <p>{details()}</p>;
    };
    return (
      <section>
        <input aria-label="Grid Filter" />
        <button type="button" onClick={() => setDetailsVisible(true)}>
          Load Details
        </button>
        <Show when={detailsVisible()}>
          <Details />
        </Show>
      </section>
    );
  },
}));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it("keeps the mounted tab connected and focused while its data loads", async () => {
  let finish!: (value: string) => void;
  mocks.loadDetails.mockReturnValue(
    new Promise<string>((resolve) => {
      finish = resolve;
    })
  );
  render(() => <TabPage tab="practice" />);
  const filter = await screen.findByRole("textbox", { name: "Grid Filter" });
  fireEvent.input(filter, { target: { value: "Morrison" } });
  filter.focus();

  fireEvent.click(screen.getByRole("button", { name: "Load Details" }));
  expect(mocks.loadDetails).toHaveBeenCalledOnce();
  expect(filter.isConnected).toBe(true);
  expect(document.activeElement).toBe(filter);
  expect(screen.queryByText("Loading...")).toBeNull();

  finish("Details loaded");
  await screen.findByText("Details loaded");
  expect(screen.getByRole("textbox", { name: "Grid Filter" })).toBe(filter);
  expect((filter as HTMLInputElement).value).toBe("Morrison");
});
