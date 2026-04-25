import { cleanup, fireEvent, render, screen } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReferenceForm } from "../src/components/references/ReferenceForm";

vi.mock("@/lib/context/UIPreferencesContext", () => ({
  useUIPreferences: () => ({
    sidebarFontSize: () => "medium",
  }),
  getSidebarFontClasses: () => ({
    text: "text-sm",
    textSmall: "text-xs",
    iconSmall: "h-4 w-4",
  }),
}));

afterEach(() => {
  cleanup();
});

describe("ReferenceForm audio uploads", () => {
  it("submits an uploaded audio file when audio upload mode is selected", async () => {
    const onSubmit = vi.fn();

    render(() => (
      <ReferenceForm onSubmit={onSubmit} onCancel={() => undefined} />
    ));

    await fireEvent.change(screen.getByTestId("reference-type-select"), {
      target: { value: "audio" },
    });
    await fireEvent.click(
      screen.getByTestId("reference-audio-source-upload-button")
    );

    const file = new File(["audio-bytes"], "banish-misfortune.mp3", {
      type: "audio/mpeg",
    });
    await fireEvent.change(screen.getByTestId("reference-audio-file-input"), {
      target: { files: [file] },
    });

    await fireEvent.click(screen.getByTestId("reference-submit-button"));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        refType: "audio",
        sourceMode: "upload",
        uploadFile: file,
        title: "banish-misfortune",
        url: "",
      })
    );
  });

  it("shows a validation message when upload mode is submitted without a file", async () => {
    const onSubmit = vi.fn();

    render(() => (
      <ReferenceForm onSubmit={onSubmit} onCancel={() => undefined} />
    ));

    await fireEvent.change(screen.getByTestId("reference-type-select"), {
      target: { value: "audio" },
    });
    await fireEvent.click(
      screen.getByTestId("reference-audio-source-upload-button")
    );
    await fireEvent.click(screen.getByTestId("reference-submit-button"));

    expect(screen.getByText("Audio file is required")).toBeDefined();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
