import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { afterEach, expect, it, vi } from "vitest";
import CatalogPage from "@/routes/catalog";

const queries = vi.hoisted(() => ({
  tunes: vi.fn(),
  version: (): number => 0,
}));
const db = { select: () => ({ from: () => ({ all: () => [] }) }) };
vi.mock("@solidjs/router", () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: "/", search: "?tab=catalog" }),
  useSearchParams: () => [{ tab: "catalog" }, vi.fn()],
}));
vi.mock("@/lib/auth/AuthContext", () => ({
  useAuth: () => ({
    user: () => ({ id: "owner" }),
    localDb: () => db,
    catalogListChanged: () => queries.version(),
  }),
}));
vi.mock("@/lib/context/CurrentRepertoireContext", () => ({
  useCurrentRepertoire: () => ({ currentRepertoireId: () => "rep" }),
}));
vi.mock("@/lib/db/queries/tunes", () => ({
  getTunesForUser: (...args: unknown[]) => queries.tunes(...args),
}));
vi.mock("@/lib/db/queries/repertoires", () => ({
  getUserRepertoires: async () => [],
}));
vi.mock("@/components/grids", () => ({ TunesGridCatalog: () => null }));
vi.mock("@/components/ai/AIChatDrawer", () => ({ AIChatDrawer: () => null }));
vi.mock("@/components/catalog", () => ({
  CatalogToolbar: () => {
    // Model the toolbar-owned dialog/draft state: a remount would discard both.
    const [open, setOpen] = createSignal(false);
    const [draft, setDraft] = createSignal("");
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Add Tune
        </button>
        {open() && (
          <input
            aria-label="New tune title"
            value={draft()}
            onInput={(event) => setDraft(event.currentTarget.value)}
          />
        )}
      </>
    );
  },
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it("preserves an open toolbar dialog and its draft throughout a background refresh", async () => {
  const [version, setVersion] = createSignal(0);
  queries.version = version;
  queries.tunes.mockResolvedValueOnce([]);
  render(() => <CatalogPage />);
  await waitFor(() => expect(screen.getByText("Add Tune")).toBeTruthy());
  fireEvent.click(screen.getByText("Add Tune"));
  const title = screen.getByLabelText("New tune title") as HTMLInputElement;
  fireEvent.input(title, { target: { value: "Keep my unsaved tune" } });

  let finish!: (rows: never[]) => void;
  queries.tunes.mockImplementationOnce(
    () =>
      new Promise<never[]>((resolve) => {
        finish = resolve;
      })
  );
  setVersion(1);
  await waitFor(() => expect(queries.tunes).toHaveBeenCalledTimes(2));
  expect(screen.getByLabelText("New tune title")).toBe(title);
  expect(title.value).toBe("Keep my unsaved tune");
  finish([]);
  await waitFor(() =>
    expect(screen.getByLabelText("New tune title")).toBe(title)
  );
  expect(title.value).toBe("Keep my unsaved tune");
});
