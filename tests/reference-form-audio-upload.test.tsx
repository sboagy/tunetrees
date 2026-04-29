import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReferenceForm } from "../src/components/references/ReferenceForm";

const { toastError } = vi.hoisted(() => ({
  toastError: vi.fn(),
}));

vi.mock("solid-sonner", () => ({
  toast: {
    error: toastError,
  },
}));

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
  vi.restoreAllMocks();
  toastError.mockReset();
  delete (window as Window & { showOpenFilePicker?: unknown })
    .showOpenFilePicker;
  delete (window as Window & { __TT_ALLOW_DEBUG_FILE_PICKER__?: unknown })
    .__TT_ALLOW_DEBUG_FILE_PICKER__;
  Object.defineProperty(window.navigator, "webdriver", {
    configurable: true,
    value: undefined,
  });
  cleanup();
});

describe("ReferenceForm audio uploads", () => {
  it("opens the type options immediately for new references", async () => {
    render(() => (
      <ReferenceForm onSubmit={() => undefined} onCancel={() => undefined} />
    ));

    expect(
      await screen.findByTestId("reference-type-option-audio")
    ).toBeTruthy();
  });

  it("defaults new audio references to upload mode", async () => {
    render(() => (
      <ReferenceForm onSubmit={() => undefined} onCancel={() => undefined} />
    ));

    await fireEvent.click(screen.getByTestId("reference-type-option-audio"));

    expect(screen.getByTestId("reference-audio-dropzone")).toBeTruthy();
    expect(screen.queryByTestId("reference-url-input")).toBeNull();
  });

  it("disables save until the URL mode required fields are valid", async () => {
    const onSubmit = vi.fn();

    render(() => (
      <ReferenceForm onSubmit={onSubmit} onCancel={() => undefined} />
    ));

    const submitButton = screen.getByTestId(
      "reference-submit-button"
    ) as HTMLButtonElement;
    expect(submitButton.disabled).toBe(true);

    await fireEvent.input(screen.getByTestId("reference-url-input"), {
      target: { value: "not a valid url" },
    });
    expect(submitButton.disabled).toBe(true);

    await fireEvent.input(screen.getByTestId("reference-url-input"), {
      target: { value: "https://example.com/demo" },
    });
    expect(submitButton.disabled).toBe(false);
  });

  it("includes the sharing checkbox state in submitted URL references", async () => {
    const onSubmit = vi.fn();

    render(() => (
      <ReferenceForm onSubmit={onSubmit} onCancel={() => undefined} />
    ));

    await fireEvent.input(screen.getByTestId("reference-url-input"), {
      target: { value: "https://example.com/shared-reference" },
    });
    await fireEvent.click(screen.getByTestId("reference-public-checkbox"));
    await fireEvent.click(screen.getByTestId("reference-submit-button"));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://example.com/shared-reference",
        public: true,
        sourceMode: "url",
      })
    );
  });

  it("submits an uploaded audio file when audio upload mode is selected", async () => {
    const onSubmit = vi.fn();

    render(() => (
      <ReferenceForm onSubmit={onSubmit} onCancel={() => undefined} />
    ));

    await fireEvent.click(screen.getByTestId("reference-type-option-audio"));
    await fireEvent.click(
      screen.getByTestId("reference-audio-source-upload-button")
    );

    const submitButton = screen.getByTestId(
      "reference-submit-button"
    ) as HTMLButtonElement;
    expect(submitButton.disabled).toBe(true);

    const file = new File(["audio-bytes"], "banish-misfortune.mp3", {
      type: "audio/mpeg",
    });
    await fireEvent.change(screen.getByTestId("reference-audio-file-input"), {
      target: { files: [file] },
    });

    expect(submitButton.disabled).toBe(false);

    await fireEvent.click(submitButton);

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

  it("uses showOpenFilePicker when available outside webdriver", async () => {
    render(() => (
      <ReferenceForm onSubmit={() => undefined} onCancel={() => undefined} />
    ));

    await fireEvent.click(screen.getByTestId("reference-type-option-audio"));

    const file = new File(["audio-bytes"], "picker-audio.mp3", {
      type: "audio/mpeg",
    });
    const getFile = vi.fn().mockResolvedValue(file);
    const showOpenFilePicker = vi.fn().mockResolvedValue([{ getFile }]);
    (
      window as Window & { showOpenFilePicker?: typeof showOpenFilePicker }
    ).showOpenFilePicker = showOpenFilePicker;

    await fireEvent.click(
      screen.getByTestId("reference-audio-choose-file-button")
    );

    await waitFor(() => {
      expect(showOpenFilePicker).toHaveBeenCalledTimes(1);
    });
    expect(getFile).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(
        screen.getByTestId("reference-audio-selected-file").textContent
      ).toBe("picker-audio.mp3");
    });
  });

  it("shows a clear error instead of invoking blocked picker paths in webdriver-controlled browsers", async () => {
    Object.defineProperty(window.navigator, "webdriver", {
      configurable: true,
      value: true,
    });

    render(() => (
      <ReferenceForm onSubmit={() => undefined} onCancel={() => undefined} />
    ));

    await fireEvent.click(screen.getByTestId("reference-type-option-audio"));

    const showOpenFilePicker = vi.fn();
    (
      window as Window & { showOpenFilePicker?: typeof showOpenFilePicker }
    ).showOpenFilePicker = showOpenFilePicker;

    const fileInput = screen.getByTestId(
      "reference-audio-file-input"
    ) as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, "click");

    await fireEvent.click(
      screen.getByTestId("reference-audio-choose-file-button")
    );

    expect(showOpenFilePicker).not.toHaveBeenCalled();
    expect(clickSpy).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith(
      "File choosers are blocked in debugger-controlled Chrome sessions. Open TuneTrees in a normal Chrome window, or drag an audio file onto the references panel."
    );
  });

  it("falls back to native input click when the picker API is unavailable", async () => {
    render(() => (
      <ReferenceForm onSubmit={() => undefined} onCancel={() => undefined} />
    ));

    await fireEvent.click(screen.getByTestId("reference-type-option-audio"));

    const fileInput = screen.getByTestId(
      "reference-audio-file-input"
    ) as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, "click");

    await fireEvent.click(
      screen.getByTestId("reference-audio-choose-file-button")
    );

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("keeps save disabled in upload mode until a file is chosen", async () => {
    render(() => (
      <ReferenceForm onSubmit={() => undefined} onCancel={() => undefined} />
    ));

    await fireEvent.click(screen.getByTestId("reference-type-option-audio"));
    await fireEvent.click(
      screen.getByTestId("reference-audio-source-upload-button")
    );

    expect(
      (screen.getByTestId("reference-submit-button") as HTMLButtonElement)
        .disabled
    ).toBe(true);
  });

  it("seeds upload mode from initial audio draft data", async () => {
    const file = new File(["audio-bytes"], "banish-misfortune.mp3", {
      type: "audio/mpeg",
    });

    render(() => (
      <ReferenceForm
        onSubmit={() => undefined}
        onCancel={() => undefined}
        autoOpenTypeSelect={false}
        initialData={{
          refType: "audio",
          sourceMode: "upload",
          uploadFile: file,
          title: "banish-misfortune",
        }}
      />
    ));

    expect(
      screen.getByTestId("reference-audio-selected-file").textContent
    ).toBe("banish-misfortune.mp3");
    expect(
      (screen.getByTestId("reference-submit-button") as HTMLButtonElement)
        .disabled
    ).toBe(false);
  });
});
