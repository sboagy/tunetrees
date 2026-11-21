import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@solidjs/testing-library";
import { afterEach, expect, it, vi } from "vitest";
import { getFsrsRetentionCurve } from "@/lib/db/queries/analysis";
import { FsrsRetentionChart } from "./FsrsRetentionChart";

vi.mock("@/lib/db/client-sqlite", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/db/queries/analysis", () => ({
  getFsrsRetentionCurve: vi.fn(),
}));
vi.mock("@/components/ui/charts", () => ({ LineChart: () => <canvas /> }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it("provides the chart's rounded estimates as a readable data table", async () => {
  vi.mocked(getFsrsRetentionCurve).mockResolvedValue([
    { day: 0, retention: 1 },
    { day: 7, retention: 0.846 },
  ]);
  render(() => <FsrsRetentionChart repertoireId="rep" />);
  const table = await screen.findByTestId("retention-estimate-data");
  expect(table.textContent).toContain("100%");
  expect(table.textContent).toContain("85%");
  expect(screen.getByText("View retention estimate data")).toBeTruthy();
});

it("retries failed local data loading and replaces the error with the estimate", async () => {
  vi.mocked(getFsrsRetentionCurve).mockRejectedValueOnce(
    new Error("unavailable")
  );
  vi.mocked(getFsrsRetentionCurve).mockResolvedValueOnce([
    { day: 0, retention: 1 },
  ]);
  render(() => <FsrsRetentionChart repertoireId="rep" />);
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Could not load"
  );
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  expect(await screen.findByTestId("retention-estimate-data")).toBeTruthy();
});
