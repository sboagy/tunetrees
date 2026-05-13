import { cleanup, render, waitFor } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  RhythmPatternMetadata,
  RhythmService,
} from "@/lib/services/RhythmService";
import { RhythmPlayer } from "./RhythmPlayer";

const mocked = vi.hoisted(() => {
  const renderAbcMock = vi.fn();
  const loadPatternMock = vi.fn<RhythmService["loadPattern"]>(async () => null);
  const updateRhythmAbcMock = vi.fn<RhythmService["updateRhythmAbc"]>();

  return {
    renderAbcMock,
    loadPatternMock,
    updateRhythmAbcMock,
    serviceStub: {
      metadata: () => null as RhythmPatternMetadata | null,
      tempoQpm: () => 100,
      isPlaying: () => false,
      isReady: () => false,
      currentBeatIndex: () => 0,
      currentMeasure: () => 0,
      error: () => null,
      loadPattern: loadPatternMock,
      play: vi.fn(async () => undefined),
      pause: vi.fn(),
      restart: vi.fn(async () => undefined),
      togglePlayback: vi.fn(async () => undefined),
      setTempoQpm: vi.fn(async () => undefined),
      updateRhythmAbc: updateRhythmAbcMock,
    } satisfies RhythmService,
  };
});

vi.mock("abcjs", () => ({
  default: {
    renderAbc: mocked.renderAbcMock,
  },
}));

vi.mock("solid-sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock("@/lib/auth/AuthContext", () => ({
  useAuth: () => ({
    localDb: () => ({ fake: true }),
    user: () => ({ id: "auth-user-1" }),
  }),
}));

vi.mock("@/lib/services/RhythmService", () => ({
  createRhythmService: () => mocked.serviceStub,
}));

describe("RhythmPlayer", () => {
  beforeEach(() => {
    mocked.renderAbcMock.mockReset();
    mocked.renderAbcMock.mockReturnValue([]);
    mocked.loadPatternMock.mockReset();
    mocked.loadPatternMock.mockResolvedValue(null);
    mocked.updateRhythmAbcMock.mockReset();
    mocked.serviceStub.metadata = () => null;
  });

  afterEach(() => {
    cleanup();
  });

  it("passes tuneId and current auth userId into loadPattern", async () => {
    render(() => (
      <RhythmPlayer
        tuneTypeName="Reel"
        genreName="Irish Traditional"
        tuneId="tune-42"
      />
    ));

    await waitFor(() => {
      expect(mocked.loadPatternMock).toHaveBeenCalledWith({
        genreName: "Irish Traditional",
        tuneTypeName: "Reel",
        tuneId: "tune-42",
        userId: "auth-user-1",
      });
    });
  });

  it("expands seed patterns to the requested structure before playback/rendering", async () => {
    const seedAbc = [
      "X:1",
      "T:Seed Pattern",
      "M:4/4",
      "L:1/8",
      "K:clef=perc",
      "|: C2 A2 C2 A2 :|",
    ].join("\n");

    mocked.loadPatternMock.mockImplementation(async () => {
      return {
        genreName: "Irish Traditional",
        tuneTypeName: "Reel",
        rhythmAbc: seedAbc,
        rhythmSignature: "4/4",
        patternType: "seed",
        tempoQpm: 112,
        sampleKit: "bodhran",
        premiumAudioUrl: null,
        premiumAudioTrimMs: 0,
        premiumAudioSource: null,
        premiumAudioSourceTempoQpm: null,
        source: "rhythm_patterns",
      };
    });
    mocked.serviceStub.metadata = () => ({
      genreName: "Irish Traditional",
      tuneTypeName: "Reel",
      rhythmAbc: seedAbc,
      rhythmSignature: "4/4",
      patternType: "seed" as const,
      tempoQpm: 112,
      sampleKit: "bodhran",
      premiumAudioUrl: null,
      premiumAudioTrimMs: 0,
      premiumAudioSource: null,
      premiumAudioSourceTempoQpm: null,
      source: "rhythm_patterns" as const,
    });

    render(() => <RhythmPlayer tuneTypeName="Reel" structure="A2 B2" />);

    await waitFor(() => {
      expect(mocked.updateRhythmAbcMock).toHaveBeenCalled();
    });

    const expandedAbc = mocked.updateRhythmAbcMock.mock.calls.at(
      -1
    )?.[0] as string;
    expect(expandedAbc).toContain(
      "| C2 A2 C2 A2 | C2 A2 C2 A2 | C2 A2 C2 A2 | C2 A2 C2 A2 |"
    );
  });

  it("keeps full_track patterns exactly as written", async () => {
    const fullTrackAbc = [
      "X:1",
      "T:Full Track",
      "M:4/4",
      "L:1/8",
      "K:clef=perc",
      "| C2 A2 C2 A2 | D2 A2 D2 A2 |",
    ].join("\n");

    mocked.loadPatternMock.mockImplementation(async () => {
      return {
        genreName: "Irish Traditional",
        tuneTypeName: "Reel",
        rhythmAbc: fullTrackAbc,
        rhythmSignature: "4/4",
        patternType: "full_track",
        tempoQpm: 112,
        sampleKit: "bodhran",
        premiumAudioUrl: null,
        premiumAudioTrimMs: 0,
        premiumAudioSource: null,
        premiumAudioSourceTempoQpm: null,
        source: "rhythm_patterns",
      };
    });
    mocked.serviceStub.metadata = () => ({
      genreName: "Irish Traditional",
      tuneTypeName: "Reel",
      rhythmAbc: fullTrackAbc,
      rhythmSignature: "4/4",
      patternType: "full_track" as const,
      tempoQpm: 112,
      sampleKit: "bodhran",
      premiumAudioUrl: null,
      premiumAudioTrimMs: 0,
      premiumAudioSource: null,
      premiumAudioSourceTempoQpm: null,
      source: "rhythm_patterns" as const,
    });

    render(() => <RhythmPlayer tuneTypeName="Reel" structure="A2 B2" />);

    await waitFor(() => {
      expect(mocked.updateRhythmAbcMock).toHaveBeenCalled();
    });

    expect(mocked.updateRhythmAbcMock.mock.calls.at(-1)?.[0]).toBe(
      fullTrackAbc
    );
  });
});
