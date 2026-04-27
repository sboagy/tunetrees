import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WaveformAudioPlayer from "../../../src/components/audio/WaveformAudioPlayer";

type MockRegion = {
  id: string;
  start: number;
  end?: number | null;
  color?: string | null;
  content?: string;
  remove: () => void;
};

  const {
    audioPauseMock,
    emitWaveEvent,
    getMediaVaultBlob,
    resetMocks,
    revokeObjectUrlMock,
    createObjectUrlMock,
    waveSurferInstance,
    regionsPluginInstance,
    updateMediaAssetByReferenceId,
    toastError,
  } = vi.hoisted(() => {
  const waveHandlers = new Map<string, Array<(...args: unknown[]) => void>>();
  const regionHandlers = new Map<string, Array<(...args: unknown[]) => void>>();
  let mockRegions: MockRegion[] = [];

  const registerHandler = (
    registry: Map<string, Array<(...args: unknown[]) => void>>,
    event: string,
    handler: (...args: unknown[]) => void
  ) => {
    const handlers = registry.get(event) || [];
    handlers.push(handler);
    registry.set(event, handlers);
    return () => {
      const nextHandlers = (registry.get(event) || []).filter(
        (candidate) => candidate !== handler
      );
      registry.set(event, nextHandlers);
    };
  };

  const emit = (
    registry: Map<string, Array<(...args: unknown[]) => void>>,
    event: string,
    ...args: unknown[]
  ) => {
    for (const handler of registry.get(event) || []) {
      handler(...args);
    }
  };

    const audioPauseMock = vi.fn();
    const updateMediaAssetByReferenceId = vi.fn(async () => undefined);
    const toastError = vi.fn();
    const getMediaVaultBlob = vi.fn(async () => null);
    const createObjectUrlMock = vi.fn(() => "blob:pinned-audio");
    const revokeObjectUrlMock = vi.fn();

  const regionsPluginInstance = {
    addRegion: vi.fn(
      (config: {
        id: string;
        start: number;
        end?: number;
        color?: string;
        content?: string;
      }) => {
        const region: MockRegion = {
          id: config.id,
          start: config.start,
          end: config.end ?? null,
          color: config.color ?? null,
          content: config.content,
          remove: () => {
            mockRegions = mockRegions.filter(
              (candidate) => candidate !== region
            );
            emit(regionHandlers, "region-removed", region);
          },
        };

        mockRegions.push(region);
        emit(regionHandlers, "region-created", region);
        return region;
      }
    ),
    getRegions: vi.fn(() => mockRegions),
    clearRegions: vi.fn(() => {
      mockRegions = [];
    }),
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) =>
      registerHandler(regionHandlers, event, handler)
    ),
  };

  const waveSurferInstance = {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) =>
      registerHandler(waveHandlers, event, handler)
    ),
    setPlaybackRate: vi.fn(),
    setTime: vi.fn(),
    play: vi.fn(async () => undefined),
    pause: vi.fn(),
    zoom: vi.fn(),
    getDuration: vi.fn(() => 180),
    isPlaying: vi.fn(() => false),
    destroy: vi.fn(),
  };

  const resetMocks = () => {
    waveHandlers.clear();
    regionHandlers.clear();
    mockRegions = [];

      audioPauseMock.mockClear();
      getMediaVaultBlob.mockClear();
      getMediaVaultBlob.mockResolvedValue(null);
      createObjectUrlMock.mockClear();
      revokeObjectUrlMock.mockClear();
      updateMediaAssetByReferenceId.mockClear();
      toastError.mockClear();
    regionsPluginInstance.addRegion.mockClear();
    regionsPluginInstance.getRegions.mockClear();
    regionsPluginInstance.getRegions.mockImplementation(() => mockRegions);
    regionsPluginInstance.clearRegions.mockClear();
    regionsPluginInstance.on.mockClear();
    waveSurferInstance.on.mockClear();
    waveSurferInstance.setPlaybackRate.mockClear();
    waveSurferInstance.setTime.mockClear();
    waveSurferInstance.play.mockClear();
    waveSurferInstance.pause.mockClear();
    waveSurferInstance.zoom.mockClear();
    waveSurferInstance.getDuration.mockClear();
    waveSurferInstance.isPlaying.mockClear();
    waveSurferInstance.destroy.mockClear();
  };

  return {
      audioPauseMock,
      emitWaveEvent: (event: string, ...args: unknown[]) =>
        emit(waveHandlers, event, ...args),
      getMediaVaultBlob,
      resetMocks,
      revokeObjectUrlMock,
      createObjectUrlMock,
      waveSurferInstance,
      regionsPluginInstance,
      updateMediaAssetByReferenceId,
      toastError,
    };
});

vi.mock("solid-sonner", () => ({
  toast: {
    error: toastError,
  },
}));

vi.mock("@/lib/auth/AuthContext", () => ({
  useAuth: () => ({
    session: () => ({ access_token: "test-token" }),
    localDb: () => ({ kind: "mock-db" }),
  }),
}));

vi.mock("@/lib/db/client-sqlite", () => ({
  getDb: () => ({ kind: "fallback-db" }),
}));

vi.mock("@/lib/db/queries/media-assets", () => ({
  updateMediaAssetByReferenceId,
}));

vi.mock("@/lib/media/media-vault", () => ({
  getMediaVaultBlob,
}));

vi.mock("wavesurfer.js", () => ({
  default: {
    create: vi.fn(() => waveSurferInstance),
  },
}));

vi.mock("wavesurfer.js/dist/plugins/regions.esm.js", () => ({
  default: {
    create: vi.fn(() => regionsPluginInstance),
  },
}));

class MockAudioElement {
  src: string;
  preload = "";
  crossOrigin: string | null = null;
  duration = 180;
  pause = audioPauseMock;
  preservesPitch?: boolean;
  mozPreservesPitch?: boolean;
  webkitPreservesPitch?: boolean;

  constructor(src: string) {
    this.src = src;
  }
}

const originalAudio = globalThis.Audio;
const originalPrompt = window.prompt;
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;
const promptMock =
  vi.fn<(message?: string, defaultValue?: string) => string | null>();

function getLastPersistCall(): {
  referenceId: string;
  payload: { regionsJson: string; durationSeconds?: number | null };
} {
  const call = updateMediaAssetByReferenceId.mock.calls.at(-1);
  expect(call).toBeDefined();

  if (!call || call.length < 3) {
    throw new Error("Expected a persisted media asset update");
  }

  const referenceId = call.at(1);
  const payload = call.at(2);
  if (typeof referenceId !== "string") {
    throw new Error(
      "Expected persisted media asset call to include a reference id"
    );
  }

  if (!payload || typeof payload !== "object" || !("regionsJson" in payload)) {
    throw new Error(
      "Expected persisted media asset call to include regionsJson"
    );
  }

  return {
    referenceId,
    payload: payload as {
      regionsJson: string;
      durationSeconds?: number | null;
    },
  };
}

async function emitReadyAfterInit() {
  await waitFor(() => {
    expect(waveSurferInstance.on).toHaveBeenCalled();
  });

  await Promise.resolve();
  emitWaveEvent("ready");
  await Promise.resolve();
}

describe("WaveformAudioPlayer persistence", () => {
  beforeEach(() => {
    resetMocks();
    Object.defineProperty(globalThis, "Audio", {
      configurable: true,
      writable: true,
      value: MockAudioElement,
    });
    Object.defineProperty(window, "prompt", {
      configurable: true,
      writable: true,
      value: promptMock,
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: createObjectUrlMock,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: revokeObjectUrlMock,
    });
    promptMock.mockReset();
    promptMock.mockReturnValue(null);
  });

  afterEach(() => {
    cleanup();
    Object.defineProperty(globalThis, "Audio", {
      configurable: true,
      writable: true,
      value: originalAudio,
    });
    Object.defineProperty(window, "prompt", {
      configurable: true,
      writable: true,
      value: originalPrompt,
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: originalCreateObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: originalRevokeObjectURL,
    });
  });

  it("loads pinned audio from the media vault before falling back to the network URL", async () => {
    getMediaVaultBlob.mockResolvedValue(
      new Blob(["audio-bytes"], { type: "audio/mpeg" })
    );

    const view = render(() => (
      <WaveformAudioPlayer
        track={{
          referenceId: "ref-1",
          referenceTitle: "Chief O'Neill's Favorite",
          url: "http://localhost:8787/api/media/view?key=users%2Fabc%2Faudio%2Ffile.mp3",
        }}
      />
    ));

    await waitFor(() => {
      expect(getMediaVaultBlob).toHaveBeenCalledWith(
        "http://localhost:8787/api/media/view?key=users%2Fabc%2Faudio%2Ffile.mp3"
      );
      expect(createObjectUrlMock).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("audio-player-source-status").textContent).toBe(
        "Playing from pinned offline audio."
      );
    });

    await emitReadyAfterInit();
    view.unmount();

    expect(revokeObjectUrlMock).toHaveBeenCalledWith("blob:pinned-audio");
  });

  it("flushes pending annotation and setting changes when the player closes", async () => {
    const view = render(() => (
      <WaveformAudioPlayer
        track={{
          referenceId: "ref-1",
          referenceTitle: "Chief O'Neill's Favorite",
          url: "http://localhost:8787/api/media/view?key=users%2Fabc%2Faudio%2Ffile.mp3",
        }}
      />
    ));

    await emitReadyAfterInit();

    await fireEvent.click(screen.getByTestId("audio-player-add-region-button"));
    await fireEvent.input(screen.getByTestId("audio-player-tempo-slider"), {
      target: { value: "1.25" },
    });
    await fireEvent.input(screen.getByTestId("audio-player-zoom-slider"), {
      target: { value: "80" },
    });
    await fireEvent.click(screen.getByTestId("audio-player-loop-toggle"));

    view.unmount();

    await waitFor(() => {
      expect(updateMediaAssetByReferenceId).toHaveBeenCalled();
    });

    const { referenceId, payload } = getLastPersistCall();

    expect(referenceId).toBe("ref-1");

    const storedState = JSON.parse(payload.regionsJson) as {
      version: number;
      regions: Array<{ kind: string; label: string }>;
      settings: {
        playbackRate: number;
        zoomLevel: number;
        loopEnabled: boolean;
      };
    };

    expect(storedState.version).toBe(2);
    expect(storedState.settings).toEqual({
      playbackRate: 1.25,
      zoomLevel: 80,
      loopEnabled: true,
    });
    expect(storedState.regions).toHaveLength(1);
    expect(storedState.regions[0]).toMatchObject({
      kind: "loop",
      label: "Loop 1",
    });
  });

  it("stops audio playback when the player closes", async () => {
    const view = render(() => (
      <WaveformAudioPlayer
        track={{
          referenceId: "ref-stop",
          referenceTitle: "Stop Audio",
          url: "http://localhost:8787/api/media/view?key=users%2Fabc%2Faudio%2Fstop.mp3",
        }}
      />
    ));

    await emitReadyAfterInit();

    await fireEvent.click(screen.getByTestId("audio-player-play-toggle"));
    expect(waveSurferInstance.play).toHaveBeenCalled();

    view.unmount();

    expect(waveSurferInstance.pause).toHaveBeenCalled();
    expect(audioPauseMock).toHaveBeenCalled();
  });

  it("disables looping until a loop region is selected", async () => {
    render(() => (
      <WaveformAudioPlayer
        track={{
          referenceId: "ref-loop",
          referenceTitle: "Loop Toggle",
          url: "http://localhost:8787/api/media/view?key=users%2Fabc%2Faudio%2Floop.wav",
        }}
      />
    ));

    await emitReadyAfterInit();

    const loopToggle = screen.getByTestId(
      "audio-player-loop-toggle"
    ) as HTMLInputElement;
    expect(loopToggle.disabled).toBe(true);

    await fireEvent.click(screen.getByTestId("audio-player-add-beat-button"));
    expect(loopToggle.disabled).toBe(true);

    await fireEvent.click(screen.getByTestId("audio-player-add-region-button"));
    expect(loopToggle.disabled).toBe(false);

    await fireEvent.click(loopToggle);
    expect(loopToggle.checked).toBe(true);
  });

  it("restores saved settings and annotations from persisted state", async () => {
    render(() => (
      <WaveformAudioPlayer
        track={{
          referenceId: "ref-2",
          referenceTitle: "Saved Audio",
          url: "http://localhost:8787/api/media/view?key=users%2Fabc%2Faudio%2Fsaved.mp3",
          regionsJson: JSON.stringify({
            version: 2,
            regions: [
              {
                id: "beat-1",
                start: 3.5,
                kind: "beat",
                label: "Beat 1",
                color: "rgba(16, 185, 129, 0.26)",
              },
            ],
            settings: {
              playbackRate: 1.25,
              zoomLevel: 80,
              loopEnabled: true,
            },
          }),
        }}
      />
    ));

    await emitReadyAfterInit();

    await waitFor(() => {
      expect(waveSurferInstance.zoom).toHaveBeenCalledWith(80);
    });

    expect(waveSurferInstance.setPlaybackRate).toHaveBeenCalledWith(1.25, true);
    expect(screen.getByText("1.25x")).toBeDefined();
    expect(screen.getByTestId("audio-player-zoom-value").textContent).toBe(
      "80 px/s"
    );
    expect(
      (screen.getByTestId("audio-player-loop-toggle") as HTMLInputElement)
        .disabled
    ).toBe(true);
    expect(screen.getByText("Beat 1")).toBeDefined();
  });

  it("renders saved marks and regions sorted by time occurrence", async () => {
    render(() => (
      <WaveformAudioPlayer
        track={{
          referenceId: "ref-sorted",
          referenceTitle: "Sorted Regions",
          url: "http://localhost:8787/api/media/view?key=users%2Fabc%2Faudio%2Fsorted.mp3",
          regionsJson: JSON.stringify({
            version: 2,
            regions: [
              { id: "beat-late", start: 18, kind: "beat", label: "Late" },
              {
                id: "measure-early",
                start: 4,
                kind: "measure",
                label: "Early",
              },
              {
                id: "section-mid",
                start: 11,
                kind: "section",
                label: "Middle",
              },
            ],
            settings: {
              playbackRate: 1,
              zoomLevel: 0,
              loopEnabled: false,
            },
          }),
        }}
      />
    ));

    await emitReadyAfterInit();

    const renderedIds = Array.from(
      screen
        .getByTestId("audio-player-region-list")
        .querySelectorAll('[role="option"]')
    ).map((row) => row.getAttribute("data-testid"));

    expect(renderedIds).toEqual([
      "audio-player-region-measure-early",
      "audio-player-region-section-mid",
      "audio-player-region-beat-late",
    ]);
  });

  it("updates point annotation kinds from the list control and persists them", async () => {
    const view = render(() => (
      <WaveformAudioPlayer
        track={{
          referenceId: "ref-type",
          referenceTitle: "Type Change",
          url: "http://localhost:8787/api/media/view?key=users%2Fabc%2Faudio%2Ftype.wav",
        }}
      />
    ));

    await emitReadyAfterInit();

    await fireEvent.click(screen.getByTestId("audio-player-add-beat-button"));

    const typeSelect = view.container.querySelector(
      '[data-testid^="audio-player-region-type-"]'
    ) as HTMLSelectElement | null;
    expect(typeSelect).toBeTruthy();

    await fireEvent.change(typeSelect!, {
      target: { value: "measure" },
    });

    view.unmount();

    await waitFor(() => {
      expect(updateMediaAssetByReferenceId).toHaveBeenCalled();
    });

    const { payload } = getLastPersistCall();
    const storedState = JSON.parse(payload.regionsJson) as {
      regions: Array<{ kind: string; label: string }>;
    };

    expect(storedState.regions).toMatchObject([
      { kind: "measure", label: "Measure 1" },
    ]);
  });

  it("renames saved marks from the list action and persists the new label", async () => {
    const view = render(() => (
      <WaveformAudioPlayer
        track={{
          referenceId: "ref-rename",
          referenceTitle: "Rename Mark",
          url: "http://localhost:8787/api/media/view?key=users%2Fabc%2Faudio%2Frename.mp3",
          regionsJson: JSON.stringify({
            version: 2,
            regions: [
              { id: "beat-1", start: 3.5, kind: "beat", label: "Beat 1" },
            ],
            settings: {
              playbackRate: 1,
              zoomLevel: 0,
              loopEnabled: false,
            },
          }),
        }}
      />
    ));

    await emitReadyAfterInit();
    promptMock.mockReturnValueOnce("Pickup Beat");

    await fireEvent.click(
      screen.getByTestId("audio-player-region-rename-beat-1")
    );

    expect(promptMock).toHaveBeenCalledWith("Rename mark or region", "Beat 1");
    expect(screen.getByText("Pickup Beat")).toBeDefined();

    view.unmount();

    await waitFor(() => {
      expect(updateMediaAssetByReferenceId).toHaveBeenCalled();
    });

    const { payload } = getLastPersistCall();
    const storedState = JSON.parse(payload.regionsJson) as {
      regions: Array<{ id: string; label: string }>;
    };

    expect(storedState.regions).toMatchObject([
      { id: "beat-1", label: "Pickup Beat" },
    ]);
  });

  it("persists the region list from signal state even if the plugin stops returning regions at save time", async () => {
    const view = render(() => (
      <WaveformAudioPlayer
        track={{
          referenceId: "ref-plugin-mismatch",
          referenceTitle: "Plugin Mismatch",
          url: "http://localhost:8787/api/media/view?key=users%2Fabc%2Faudio%2Fplugin-mismatch.wav",
        }}
      />
    ));

    await emitReadyAfterInit();

    await fireEvent.click(screen.getByTestId("audio-player-add-region-button"));
    await fireEvent.click(screen.getByTestId("audio-player-add-beat-button"));

    regionsPluginInstance.getRegions.mockImplementation(() => []);

    await fireEvent.input(screen.getByTestId("audio-player-tempo-slider"), {
      target: { value: "1.25" },
    });

    view.unmount();

    await waitFor(() => {
      expect(updateMediaAssetByReferenceId).toHaveBeenCalled();
    });

    const { payload } = getLastPersistCall();
    const storedState = JSON.parse(payload.regionsJson) as {
      regions: Array<{ kind: string; label: string }>;
      settings: { playbackRate: number };
    };

    expect(storedState.settings.playbackRate).toBe(1.25);
    expect(storedState.regions).toMatchObject([
      { kind: "loop", label: "Loop 1" },
      { kind: "beat", label: "Beat 1" },
    ]);
  });

  it("does not let destroy-time region removals overwrite the final saved regions", async () => {
    const view = render(() => (
      <WaveformAudioPlayer
        track={{
          referenceId: "ref-destroy-overwrite",
          referenceTitle: "Destroy Overwrite",
          url: "http://localhost:8787/api/media/view?key=users%2Fabc%2Faudio%2Fdestroy-overwrite.wav",
        }}
      />
    ));

    await emitReadyAfterInit();

    await fireEvent.click(screen.getByTestId("audio-player-add-region-button"));
    await fireEvent.click(screen.getByTestId("audio-player-add-beat-button"));
    await fireEvent.input(screen.getByTestId("audio-player-tempo-slider"), {
      target: { value: "1.25" },
    });

    waveSurferInstance.destroy.mockImplementationOnce(() => {
      for (const region of [...regionsPluginInstance.getRegions()]) {
        region.remove();
      }
    });

    view.unmount();

    await waitFor(() => {
      expect(updateMediaAssetByReferenceId).toHaveBeenCalled();
    });

    const { payload } = getLastPersistCall();
    const storedState = JSON.parse(payload.regionsJson) as {
      regions: Array<{ kind: string; label: string }>;
      settings: { playbackRate: number };
    };

    expect(storedState.settings.playbackRate).toBe(1.25);
    expect(storedState.regions).toMatchObject([
      { kind: "loop", label: "Loop 1" },
      { kind: "beat", label: "Beat 1" },
    ]);
  });

  it("keeps range multi-selection when clicking label text in the list", async () => {
    const view = render(() => (
      <WaveformAudioPlayer
        track={{
          referenceId: "ref-multi",
          referenceTitle: "Multi Select",
          url: "http://localhost:8787/api/media/view?key=users%2Fabc%2Faudio%2Fmulti.wav",
          regionsJson: JSON.stringify({
            version: 2,
            regions: [
              { id: "beat-1", start: 1, kind: "beat", label: "Beat 1" },
              { id: "beat-2", start: 2, kind: "beat", label: "Beat 2" },
              { id: "beat-3", start: 3, kind: "beat", label: "Beat 3" },
            ],
            settings: {
              playbackRate: 1,
              zoomLevel: 0,
              loopEnabled: false,
            },
          }),
        }}
      />
    ));

    await emitReadyAfterInit();

    await fireEvent.click(screen.getByText("Beat 1"));
    await fireEvent.click(screen.getByText("Beat 2"), {
      shiftKey: true,
    });

    expect(
      screen.getByTestId("audio-player-region-beat-1").className
    ).toContain("border-blue-500");
    expect(
      screen.getByTestId("audio-player-region-beat-2").className
    ).toContain("border-blue-500");

    await fireEvent.click(
      screen.getByTestId("audio-player-remove-region-button")
    );

    await waitFor(() => {
      expect(screen.queryByTestId("audio-player-region-beat-1")).toBeNull();
      expect(screen.queryByTestId("audio-player-region-beat-2")).toBeNull();
    });

    expect(screen.getByTestId("audio-player-region-beat-3")).toBeDefined();

    view.unmount();
  });

  it("shows a clear-selection control and clears the current selection", async () => {
    render(() => (
      <WaveformAudioPlayer
        track={{
          referenceId: "ref-clear-selection",
          referenceTitle: "Clear Selection",
          url: "http://localhost:8787/api/media/view?key=users%2Fabc%2Faudio%2Fclear-selection.wav",
          regionsJson: JSON.stringify({
            version: 2,
            regions: [
              { id: "beat-1", start: 1, kind: "beat", label: "Beat 1" },
            ],
            settings: {
              playbackRate: 1,
              zoomLevel: 0,
              loopEnabled: false,
            },
          }),
        }}
      />
    ));

    await emitReadyAfterInit();

    expect(
      screen.queryByTestId("audio-player-clear-selection-button")
    ).toBeNull();

    await fireEvent.click(screen.getByText("Beat 1"));

    expect(
      screen
        .getByTestId("audio-player-region-beat-1")
        .getAttribute("aria-selected")
    ).toBe("true");

    await fireEvent.click(
      screen.getByTestId("audio-player-clear-selection-button")
    );

    expect(
      screen
        .getByTestId("audio-player-region-beat-1")
        .getAttribute("aria-selected")
    ).toBe("false");
    expect(
      screen.queryByTestId("audio-player-clear-selection-button")
    ).toBeNull();
  });

  it("adds beat, measure, and section marks from keyboard shortcuts", async () => {
    const view = render(() => (
      <WaveformAudioPlayer
        track={{
          referenceId: "ref-3",
          referenceTitle: "Shortcut Audio",
          url: "http://localhost:8787/api/media/view?key=users%2Fabc%2Faudio%2Fshortcut.mp3",
        }}
      />
    ));

    await emitReadyAfterInit();

    await fireEvent.click(screen.getByTestId("audio-player-panel"));

    await fireEvent.keyDown(document.body, {
      key: "b",
      code: "KeyB",
      bubbles: true,
    });
    await fireEvent.keyDown(document.body, {
      key: "m",
      code: "KeyM",
      bubbles: true,
    });
    await fireEvent.keyDown(document.body, {
      key: "s",
      code: "KeyS",
      bubbles: true,
    });

    view.unmount();

    await waitFor(() => {
      expect(updateMediaAssetByReferenceId).toHaveBeenCalled();
    });

    const { payload } = getLastPersistCall();

    const storedState = JSON.parse(payload.regionsJson) as {
      regions: Array<{
        kind: string;
        label: string;
        end?: number | null;
      }>;
    };

    expect(storedState.regions).toMatchObject([
      { kind: "beat", label: "Beat 1", end: null },
      { kind: "measure", label: "Measure 1", end: null },
      { kind: "section", label: "Section 1", end: null },
    ]);
  });
});
