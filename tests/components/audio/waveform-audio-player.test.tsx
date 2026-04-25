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
  resetMocks,
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
    updateMediaAssetByReferenceId.mockClear();
    toastError.mockClear();
    regionsPluginInstance.addRegion.mockClear();
    regionsPluginInstance.getRegions.mockClear();
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
    resetMocks,
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

vi.mock("@/lib/db/queries/media-assets", () => ({
  updateMediaAssetByReferenceId,
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

describe("WaveformAudioPlayer persistence", () => {
  beforeEach(() => {
    resetMocks();
    Object.defineProperty(globalThis, "Audio", {
      configurable: true,
      writable: true,
      value: MockAudioElement,
    });
  });

  afterEach(() => {
    cleanup();
    Object.defineProperty(globalThis, "Audio", {
      configurable: true,
      writable: true,
      value: originalAudio,
    });
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

    emitWaveEvent("ready");

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

    emitWaveEvent("ready");

    await fireEvent.click(screen.getByTestId("audio-player-play-toggle"));
    expect(waveSurferInstance.play).toHaveBeenCalled();

    view.unmount();

    expect(waveSurferInstance.pause).toHaveBeenCalled();
    expect(audioPauseMock).toHaveBeenCalled();
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

    emitWaveEvent("ready");

    await waitFor(() => {
      expect(waveSurferInstance.zoom).toHaveBeenCalledWith(80);
    });

    expect(waveSurferInstance.setPlaybackRate).toHaveBeenCalledWith(1.25, true);
    expect(screen.getByText("1.25x")).toBeDefined();
    expect(screen.getByTestId("audio-player-zoom-value").textContent).toBe(
      "80 px/s"
    );
    expect(
      screen.getByTestId("audio-player-loop-toggle").textContent
    ).toContain("Looping Selected Region");
    expect(screen.getByText("Beat 1")).toBeDefined();
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

    emitWaveEvent("ready");

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "b" }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "m" }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "s" }));

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
