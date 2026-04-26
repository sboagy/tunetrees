import { cleanup, fireEvent, render, screen } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AboutDialog } from "../../../src/components/layout/AboutDialog";

vi.mock("@/lib/hooks/usePWAUpdate", () => ({
  usePWAUpdate: () => ({
    needRefresh: () => false,
    updateServiceWorker: vi.fn(),
    checkForUpdate: vi.fn(),
  }),
}));

describe("AboutDialog", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the credits section with required open-source projects", () => {
    render(() => <AboutDialog isOpen={true} onClose={() => {}} />);

    expect(screen.getByText("Check for Update")).toBeDefined();
    expect(screen.getByText("Credits & Open Source")).toBeDefined();
    expect(screen.getByTestId("about-credits-scroll")).toBeDefined();
    expect(screen.getByTestId("about-credits-fade")).toBeDefined();
    expect(screen.getByText("wavesurfer.js")).toBeDefined();
    expect(screen.getByText("ts-fsrs")).toBeDefined();
    expect(screen.getByText("abcjs")).toBeDefined();
    expect(screen.getByText("chart.js")).toBeDefined();
    expect(screen.getByText("Jodit")).toBeDefined();
  });

  it("shows the wavesurfer.js license inside a collapsible details element", async () => {
    render(() => <AboutDialog isOpen={true} onClose={() => {}} />);

    const details = screen.getByTestId("about-license-wavesurfer-js");
    expect(details.hasAttribute("open")).toBe(false);

    await fireEvent.click(screen.getByText("View BSD 3-Clause License"));

    expect(details.hasAttribute("open")).toBe(true);
    expect(
      screen.getByText(/Redistribution and use in source and binary forms/)
    ).toBeDefined();
  });
});
