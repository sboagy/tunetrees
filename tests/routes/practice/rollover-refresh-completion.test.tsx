import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { afterEach, expect, it, vi } from "vitest";
import {
  MobileControlBarProvider,
  useMobileControlBar,
} from "@/components/layout/MobileControlBarContext";
import { PracticeControlBanner } from "@/components/practice/PracticeControlBanner";

const layout = vi.hoisted(() => ({ mobile: false }));
vi.mock("@/lib/hooks/useIsMobile", () => ({
  createIsMobile: () => () => layout.mobile,
}));
vi.mock("@/lib/auth/AuthContext", () => ({
  useAuth: () => ({ incrementPracticeListStagedChanged: vi.fn() }),
}));
vi.mock("@/components/practice/QueueDateSelector", () => ({
  QueueDateSelector: () => null,
}));
vi.mock("@/components/practice/AddTunesDialog", () => ({
  AddTunesDialog: () => null,
}));
vi.mock("@/components/tune-sets/TuneSetFilterDialog", () => ({
  TuneSetFilterDialog: () => null,
}));

afterEach(cleanup);

function MobileToolbar() {
  const { mobileContent } = useMobileControlBar();
  return <>{mobileContent()}</>;
}

it.each([false, true])(
  "keeps Refresh visible and disabled until persistence finishes (mobile=%s)",
  async (mobile) => {
    layout.mobile = mobile;
    let finishSaving!: () => void;
    const saving = new Promise<void>((resolve) => {
      finishSaving = resolve;
    });
    const [pending, setPending] = createSignal(true);
    const refresh = vi.fn(async () => {
      // Sync can publish today's date while IndexedDB persistence is still pending.
      setPending(false);
      await saving;
    });
    render(() => (
      <MobileControlBarProvider>
        <PracticeControlBanner
          rolloverPending={pending()}
          onPracticeDateRefresh={refresh}
        />
        <MobileToolbar />
      </MobileControlBarProvider>
    ));
    const button = screen.getByTestId("date-rollover-refresh-button");
    fireEvent.click(button);
    expect(refresh).toHaveBeenCalledOnce();
    expect(
      screen
        .getByTestId("date-rollover-refresh-button")
        .hasAttribute("disabled")
    ).toBe(true);
    finishSaving();
    await waitFor(() =>
      expect(screen.queryByTestId("date-rollover-refresh-button")).toBeNull()
    );
  }
);
