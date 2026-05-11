import { cleanup, render, screen, waitFor } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

type RhythmMetadata = {
  rhythmAbc: string;
  rhythmSignature: string;
  tempoQpm: number;
  tuneStructure: string | null;
};

const mocks = vi.hoisted(() => ({
  renderAbcMock: vi.fn(
    (container: HTMLElement, _abc: string, _options?: unknown) => {
      container.innerHTML = `
        <svg viewBox="0 0 200 40" aria-label="Rhythm notation">
          <g class="abcjs-note" data-note="1">
            <path class="abcjs-notehead" d="M10 20 L20 20" />
          </g>
          <g class="abcjs-note" data-note="2">
            <path class="abcjs-notehead" d="M40 20 L50 20" />
          </g>
        </svg>
      `;

      return [{}];
    }
  ),
  rhythmService: null as unknown,
}));

vi.mock("abcjs", () => ({
  default: {
    renderAbc: mocks.renderAbcMock,
  },
}));

vi.mock("@/lib/auth/AuthContext", () => ({
  useAuth: () => ({
    localDb: () => ({ kind: "mock-db" }),
  }),
}));

vi.mock("@/lib/services/RhythmService", () => ({
  createRhythmService: () => mocks.rhythmService,
  expandRhythmAbc: (abc: string) => abc,
  parseStructureTotalBars: () => 0,
}));

let RhythmPlayer: typeof import("../../../src/components/rhythm/RhythmPlayer").RhythmPlayer;
let setBeatIndex: (value: number) => number;

beforeAll(async () => {
  ({ RhythmPlayer } = await import("../../../src/components/rhythm/RhythmPlayer"));
});

beforeEach(() => {
  const [metadata, setMetadata] = createSignal<RhythmMetadata | null>(null);
  const [beatIndex, updateBeatIndex] = createSignal(0);
  const [measure] = createSignal(0);
  const [tempoQpm, setTempoQpm] = createSignal(96);
  const [isReady] = createSignal(true);
  const [isPlaying, setIsPlaying] = createSignal(false);
  const [error] = createSignal<string | null>(null);

  setBeatIndex = updateBeatIndex;
  mocks.renderAbcMock.mockClear();

  mocks.rhythmService = {
    metadata,
    tempoQpm,
    isPlaying,
    isReady,
    currentBeatIndex: beatIndex,
    currentMeasure: measure,
    error,
    loadPattern: vi.fn(async () => {
      const nextMetadata: RhythmMetadata = {
        rhythmAbc: "X:1\nT:Mock Groove\nM:4/4\nK:clef=perc\n| z4 |",
        rhythmSignature: "4/4",
        tempoQpm: 96,
        tuneStructure: "AABB",
      };
      setMetadata(nextMetadata);
      return nextMetadata;
    }),
    play: vi.fn(async () => {
      setIsPlaying(true);
    }),
    pause: vi.fn(() => {
      setIsPlaying(false);
    }),
    togglePlayback: vi.fn(async () => {
      setIsPlaying((value) => !value);
    }),
    setTempoQpm: vi.fn(async (value: number) => {
      setTempoQpm(value);
    }),
    updateRhythmAbc: vi.fn(),
  };
});

afterEach(() => {
  cleanup();
});

describe("RhythmPlayer", () => {
  it("renders abcjs notation and moves the active note highlight with the beat index", async () => {
    render(() => (
      <RhythmPlayer
        tuneTypeName="Reel"
        structure="AABB"
        genreName="Irish Traditional"
      />
    ));

    await waitFor(() => {
      expect(mocks.renderAbcMock).toHaveBeenCalledTimes(1);
    });

    const notation = screen.getByTestId("rhythm-player-notation");
    await waitFor(() => {
      expect(notation.querySelector("svg")).not.toBeNull();
    });

    const noteheads = notation.querySelectorAll<SVGElement>(".abcjs-notehead");
    expect(noteheads).toHaveLength(2);

    setBeatIndex(2);

    await waitFor(() => {
      expect(noteheads[1]?.classList.contains("tnt-active-note")).toBe(true);
    });
    expect(noteheads[0]?.classList.contains("tnt-active-note")).toBe(false);

    setBeatIndex(1);

    await waitFor(() => {
      expect(noteheads[0]?.classList.contains("tnt-active-note")).toBe(true);
    });
    expect(noteheads[1]?.classList.contains("tnt-active-note")).toBe(false);
  });
});
