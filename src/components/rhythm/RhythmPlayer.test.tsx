import { cleanup, fireEvent, render, waitFor } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  RhythmPatternMetadata,
  RhythmService,
} from "@/lib/services/RhythmService";
import {
  getStructuredSectionLabel,
  RhythmPlayer,
  resolveStructuredDisplayNotehead,
  updateStructuredDisplayPartLabels,
} from "./RhythmPlayer";

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
      isPlaying: (): boolean => false,
      isPaused: (): boolean => false,
      isReady: () => false,
      isCountIn: (): boolean => false,
      countInPulse: (): number => 0,
      countInTotalPulses: (): number => 0,
      currentBeatIndex: () => 0,
      currentPulse: () => 0,
      currentMeasure: () => 0,
      error: () => null,
      loadPattern: loadPatternMock,
      play: vi.fn(async (_options) => undefined),
      stop: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(async () => undefined),
      restart: vi.fn(async (_options) => undefined),
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
    mocked.serviceStub.tempoQpm = () => 100;
    mocked.serviceStub.isPlaying = () => false;
    mocked.serviceStub.isPaused = () => false;
    mocked.serviceStub.isCountIn = () => false;
    mocked.serviceStub.countInPulse = () => 0;
    mocked.serviceStub.countInTotalPulses = () => 0;
    mocked.serviceStub.play = vi.fn(async (_options) => undefined);
    mocked.serviceStub.stop = vi.fn();
    mocked.serviceStub.pause = vi.fn();
    mocked.serviceStub.resume = vi.fn(async () => undefined);
    mocked.serviceStub.restart = vi.fn(async (_options) => undefined);
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

  it("maps repeated playback beats back onto the displayed repeated section line", () => {
    const makeNotehead = (lineIndex: number, id: string) => {
      const noteGroup = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "g"
      );
      noteGroup.setAttribute("class", `abcjs-note abcjs-l${lineIndex}`);

      const notehead = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path"
      );
      notehead.setAttribute("class", "abcjs-notehead");
      notehead.setAttribute("data-note-id", id);
      noteGroup.appendChild(notehead);
      return notehead;
    };

    const noteheads = [
      makeNotehead(0, "a1"),
      makeNotehead(0, "a2"),
      makeNotehead(0, "a3"),
      makeNotehead(0, "a4"),
      makeNotehead(1, "b1"),
      makeNotehead(1, "b2"),
      makeNotehead(1, "b3"),
      makeNotehead(1, "b4"),
    ];

    const sourceAbc = [
      "X:1",
      "M:4/4",
      "L:1/8",
      "K:clef=perc",
      "| A2 | A2 | B2 | B2 | C2 | C2 | D2 | D2 |",
    ].join("\n");

    expect(
      resolveStructuredDisplayNotehead(
        noteheads,
        sourceAbc,
        "A2A2B2B2",
        1
      )?.getAttribute("data-note-id")
    ).toBe("a1");
    expect(
      resolveStructuredDisplayNotehead(
        noteheads,
        sourceAbc,
        "A2A2B2B2",
        3
      )?.getAttribute("data-note-id")
    ).toBe("a1");
    expect(
      resolveStructuredDisplayNotehead(
        noteheads,
        sourceAbc,
        "A2A2B2B2",
        5
      )?.getAttribute("data-note-id")
    ).toBe("b1");
    expect(
      resolveStructuredDisplayNotehead(
        noteheads,
        sourceAbc,
        "A2A2B2B2",
        7
      )?.getAttribute("data-note-id")
    ).toBe("b1");
  });

  it("derives section pass labels like A2 and B2 from structured playback", () => {
    const sourceAbc = [
      "X:1",
      "M:4/4",
      "L:1/8",
      "K:clef=perc",
      "| A2 | A2 | B2 | B2 | C2 | C2 | D2 | D2 |",
    ].join("\n");

    expect(getStructuredSectionLabel(sourceAbc, "A2A2B2B2", 1)).toBe("A");
    expect(getStructuredSectionLabel(sourceAbc, "A2A2B2B2", 3)).toBe("A2");
    expect(getStructuredSectionLabel(sourceAbc, "A2A2B2B2", 5)).toBe("B");
    expect(getStructuredSectionLabel(sourceAbc, "A2A2B2B2", 7)).toBe("B2");
  });

  it("derives AABB section passes from already-expanded source ABC", () => {
    const sourceAbc = [
      "X:1",
      "M:4/4",
      "L:1/8",
      "K:clef=perc",
      `| ${[
        ...Array.from({ length: 8 }, () => "A2"),
        ...Array.from({ length: 8 }, () => "a2"),
        ...Array.from({ length: 8 }, () => "B2"),
        ...Array.from({ length: 8 }, () => "b2"),
      ].join(" | ")} |`,
    ].join("\n");

    expect(getStructuredSectionLabel(sourceAbc, "AABB", 1)).toBe("A");
    expect(getStructuredSectionLabel(sourceAbc, "AABB", 9)).toBe("A2");
    expect(getStructuredSectionLabel(sourceAbc, "AABB", 17)).toBe("B");
    expect(getStructuredSectionLabel(sourceAbc, "AABB", 25)).toBe("B2");
  });

  it("rewrites the rendered svg part labels for the active repeat pass", () => {
    const container = document.createElement("div");
    const makePartLabel = (lineIndex: number, label: string) => {
      const text = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text"
      );
      text.setAttribute("class", `abcjs-part abcjs-l${lineIndex}`);
      text.textContent = label;
      container.appendChild(text);
      return text;
    };

    const first = makePartLabel(0, "A");
    const second = makePartLabel(1, "B");
    const sourceAbc = [
      "X:1",
      "M:4/4",
      "L:1/8",
      "K:clef=perc",
      "| A2 | A2 | B2 | B2 | C2 | C2 | D2 | D2 |",
    ].join("\n");

    updateStructuredDisplayPartLabels(container, sourceAbc, "A2A2B2B2", 3);
    expect(first.textContent).toBe("A2");
    expect(second.textContent).toBe("B");

    updateStructuredDisplayPartLabels(container, sourceAbc, "A2A2B2B2", 7);
    expect(first.textContent).toBe("A");
    expect(second.textContent).toBe("B2");
  });

  it("uses expanded sample ABC for seed playback so timing does not depend on repeat playback", async () => {
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

    const playbackAbc = mocked.updateRhythmAbcMock.mock.calls.at(
      -1
    )?.[0] as string;
    expect(playbackAbc).toContain("M:4/4");
    expect(playbackAbc).toContain("L:1/8");
    expect(playbackAbc).toContain("K:clef=perc");
    expect(playbackAbc).toContain(
      "| C2 A2 C2 A2 | C2 A2 C2 A2 | C2 A2 C2 A2 | C2 A2 C2 A2 |"
    );
  });

  it("repeats structured seed sections in playback order", async () => {
    const seedAbc = [
      "X:1",
      "T:Seed Pattern",
      "M:4/4",
      "L:1/8",
      "K:clef=perc",
      "| A2 A2 A2 A2 | B2 B2 B2 B2 | C2 C2 C2 C2 | D2 D2 D2 D2 |",
    ].join("\n");

    mocked.loadPatternMock.mockResolvedValue({
      genreName: "Irish Traditional",
      tuneTypeName: "Reel",
      rhythmAbc: seedAbc,
      rhythmSignature: "4/4",
      patternType: "seed",
      tempoQpm: 115,
      sampleKit: "bodhran",
      premiumAudioUrl: null,
      premiumAudioTrimMs: 0,
      premiumAudioSource: null,
      premiumAudioSourceTempoQpm: null,
      source: "rhythm_patterns",
    });
    mocked.serviceStub.metadata = () => ({
      genreName: "Irish Traditional",
      tuneTypeName: "Reel",
      rhythmAbc: seedAbc,
      rhythmSignature: "4/4",
      patternType: "seed" as const,
      tempoQpm: 115,
      sampleKit: "bodhran",
      premiumAudioUrl: null,
      premiumAudioTrimMs: 0,
      premiumAudioSource: null,
      premiumAudioSourceTempoQpm: null,
      source: "rhythm_patterns" as const,
    });

    render(() => <RhythmPlayer tuneTypeName="Reel" structure="A2A2B2B2" />);

    await waitFor(() => {
      expect(mocked.updateRhythmAbcMock).toHaveBeenCalled();
    });

    const playbackAbc = mocked.updateRhythmAbcMock.mock.calls.at(
      -1
    )?.[0] as string;
    expect(playbackAbc).toContain(
      "| A2 A2 A2 A2 | B2 B2 B2 B2 | A2 A2 A2 A2 | B2 B2 B2 B2 | C2 C2 C2 C2 | D2 D2 D2 D2 | C2 C2 C2 C2 | D2 D2 D2 D2 |"
    );
    expect(playbackAbc).not.toContain("|:");
    expect(playbackAbc).not.toContain(":|");
  });

  it("preserves already-expanded seed playback order for AABB forms", async () => {
    const fullFormAbc = [
      "X:1",
      "T:Expanded Seed Pattern",
      "M:4/4",
      "L:1/8",
      "K:clef=perc",
      `| ${[
        ...Array.from({ length: 8 }, () => "A2"),
        ...Array.from({ length: 8 }, () => "a2"),
        ...Array.from({ length: 8 }, () => "B2"),
        ...Array.from({ length: 8 }, () => "b2"),
      ].join(" | ")} |`,
    ].join("\n");

    mocked.loadPatternMock.mockResolvedValue({
      genreName: "Irish Traditional",
      tuneTypeName: "Reel",
      rhythmAbc: fullFormAbc,
      rhythmSignature: "4/4",
      patternType: "seed",
      tempoQpm: 115,
      sampleKit: "bodhran",
      premiumAudioUrl: null,
      premiumAudioTrimMs: 0,
      premiumAudioSource: null,
      premiumAudioSourceTempoQpm: null,
      source: "rhythm_patterns",
    });
    mocked.serviceStub.metadata = () => ({
      genreName: "Irish Traditional",
      tuneTypeName: "Reel",
      rhythmAbc: fullFormAbc,
      rhythmSignature: "4/4",
      patternType: "seed" as const,
      tempoQpm: 115,
      sampleKit: "bodhran",
      premiumAudioUrl: null,
      premiumAudioTrimMs: 0,
      premiumAudioSource: null,
      premiumAudioSourceTempoQpm: null,
      source: "rhythm_patterns" as const,
    });

    render(() => <RhythmPlayer tuneTypeName="Reel" structure="AABB" />);

    await waitFor(() => {
      expect(mocked.updateRhythmAbcMock).toHaveBeenCalled();
    });

    expect(mocked.updateRhythmAbcMock.mock.calls.at(-1)?.[0]).toBe(fullFormAbc);
  });

  it("adds part labels to the displayed seed ABC for structured tunes", async () => {
    const seedAbc = [
      "X:1",
      "T:Seed Pattern",
      "M:6/8",
      "L:1/8",
      "K:clef=perc",
      "|: C2 c C c c :|",
    ].join("\n");

    mocked.loadPatternMock.mockResolvedValue({
      genreName: "Irish Traditional",
      tuneTypeName: "Jig",
      rhythmAbc: seedAbc,
      rhythmSignature: "6/8",
      patternType: "seed",
      tempoQpm: 115,
      sampleKit: "bodhran",
      premiumAudioUrl: null,
      premiumAudioTrimMs: 0,
      premiumAudioSource: null,
      premiumAudioSourceTempoQpm: null,
      source: "rhythm_patterns",
    });
    mocked.serviceStub.metadata = () => ({
      genreName: "Irish Traditional",
      tuneTypeName: "Jig",
      rhythmAbc: seedAbc,
      rhythmSignature: "6/8",
      patternType: "seed" as const,
      tempoQpm: 115,
      sampleKit: "bodhran",
      premiumAudioUrl: null,
      premiumAudioTrimMs: 0,
      premiumAudioSource: null,
      premiumAudioSourceTempoQpm: null,
      source: "rhythm_patterns" as const,
    });

    render(() => <RhythmPlayer tuneTypeName="JigD" structure="AABB" />);

    await waitFor(() => {
      expect(mocked.renderAbcMock).toHaveBeenCalled();
    });

    const displayAbc = mocked.renderAbcMock.mock.calls.at(-1)?.[1] as string;
    expect(displayAbc).toContain("P:A");
    expect(displayAbc).toContain("P:B");
  });

  it("shows the tune structure in the player header", async () => {
    const seedAbc = [
      "X:1",
      "T:Seed Pattern",
      "M:6/8",
      "L:1/8",
      "K:clef=perc",
      "|: C2 c C c c :|",
    ].join("\n");

    mocked.loadPatternMock.mockResolvedValue({
      genreName: "Irish Traditional",
      tuneTypeName: "Jig",
      rhythmAbc: seedAbc,
      rhythmSignature: "6/8",
      patternType: "seed",
      tempoQpm: 115,
      sampleKit: "bodhran",
      premiumAudioUrl: null,
      premiumAudioTrimMs: 0,
      premiumAudioSource: null,
      premiumAudioSourceTempoQpm: null,
      source: "rhythm_patterns",
    });
    mocked.serviceStub.metadata = () => ({
      genreName: "Irish Traditional",
      tuneTypeName: "Jig",
      rhythmAbc: seedAbc,
      rhythmSignature: "6/8",
      patternType: "seed" as const,
      tempoQpm: 115,
      sampleKit: "bodhran",
      premiumAudioUrl: null,
      premiumAudioTrimMs: 0,
      premiumAudioSource: null,
      premiumAudioSourceTempoQpm: null,
      source: "rhythm_patterns" as const,
    });

    const view = render(() => (
      <RhythmPlayer tuneTypeName="JigD" structure="AABB" />
    ));

    await waitFor(() => {
      expect(view.getByTestId("rhythm-player-structure").textContent).toContain(
        "AABB"
      );
    });
  });

  it("shows the current section badge next to the notation", async () => {
    const seedAbc = [
      "X:1",
      "T:Seed Pattern",
      "M:4/4",
      "L:1/8",
      "K:clef=perc",
      "| A2 | A2 | B2 | B2 | C2 | C2 | D2 | D2 |",
    ].join("\n");

    mocked.loadPatternMock.mockResolvedValue({
      genreName: "Irish Traditional",
      tuneTypeName: "Reel",
      rhythmAbc: seedAbc,
      rhythmSignature: "4/4",
      patternType: "seed",
      tempoQpm: 115,
      sampleKit: "bodhran",
      premiumAudioUrl: null,
      premiumAudioTrimMs: 0,
      premiumAudioSource: null,
      premiumAudioSourceTempoQpm: null,
      source: "rhythm_patterns",
    });
    mocked.serviceStub.metadata = () => ({
      genreName: "Irish Traditional",
      tuneTypeName: "Reel",
      rhythmAbc: seedAbc,
      rhythmSignature: "4/4",
      patternType: "seed" as const,
      tempoQpm: 115,
      sampleKit: "bodhran",
      premiumAudioUrl: null,
      premiumAudioTrimMs: 0,
      premiumAudioSource: null,
      premiumAudioSourceTempoQpm: null,
      source: "rhythm_patterns" as const,
    });
    mocked.serviceStub.currentBeatIndex = () => 3;

    const view = render(() => (
      <RhythmPlayer tuneTypeName="Reel" structure="A2A2B2B2" />
    ));

    await waitFor(() => {
      expect(
        view.getByTestId("rhythm-player-current-section-badge").textContent
      ).toContain("A2");
    });
  });

  it("shows a count-in indicator above the staff while the pre-roll is active", async () => {
    const seedAbc = [
      "X:1",
      "T:Seed Pattern",
      "M:4/4",
      "L:1/8",
      "K:clef=perc",
      "|: C2 A2 C2 A2 :|",
    ].join("\n");

    mocked.loadPatternMock.mockResolvedValue({
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
    mocked.serviceStub.isCountIn = () => true;
    mocked.serviceStub.countInPulse = () => 2;
    mocked.serviceStub.countInTotalPulses = () => 4;

    const view = render(() => <RhythmPlayer tuneTypeName="Reel" />);

    await waitFor(() => {
      expect(
        view.getByTestId("rhythm-player-count-in-indicator").textContent
      ).toContain("2 / 4");
    });
  });

  it("starts playback from the selected section", async () => {
    const seedAbc = [
      "X:1",
      "T:Seed Pattern",
      "M:4/4",
      "L:1/8",
      "K:clef=perc",
      "| A2 | A2 | B2 | B2 |",
    ].join("\n");

    mocked.loadPatternMock.mockResolvedValue({
      genreName: "Irish Traditional",
      tuneTypeName: "Reel",
      rhythmAbc: seedAbc,
      rhythmSignature: "4/4",
      patternType: "seed",
      tempoQpm: 120,
      sampleKit: "bodhran",
      premiumAudioUrl: null,
      premiumAudioTrimMs: 0,
      premiumAudioSource: null,
      premiumAudioSourceTempoQpm: null,
      source: "rhythm_patterns",
    });
    mocked.serviceStub.metadata = () => ({
      genreName: "Irish Traditional",
      tuneTypeName: "Reel",
      rhythmAbc: seedAbc,
      rhythmSignature: "4/4",
      patternType: "seed" as const,
      tempoQpm: 120,
      sampleKit: "bodhran",
      premiumAudioUrl: null,
      premiumAudioTrimMs: 0,
      premiumAudioSource: null,
      premiumAudioSourceTempoQpm: null,
      source: "rhythm_patterns" as const,
    });
    mocked.serviceStub.tempoQpm = () => 120;

    const view = render(() => (
      <RhythmPlayer tuneTypeName="Reel" structure="A1A1B1B1" />
    ));

    const playButton = view.getByTestId("rhythm-player-play-toggle");

    await waitFor(() => {
      expect(
        view.getByTestId("rhythm-player-start-section-select")
      ).toBeTruthy();
      expect(playButton.hasAttribute("disabled")).toBe(false);
    });

    fireEvent.change(view.getByTestId("rhythm-player-start-section-select"), {
      target: { value: "B2" },
    });
    fireEvent.click(playButton);

    expect(mocked.serviceStub.play).toHaveBeenCalledWith({
      startPositionMs: 0,
      startBeatIndex: 3,
      startMeasure: 3,
      playbackRhythmAbc: [
        "X:1",
        "T:Seed Pattern",
        "M:4/4",
        "L:1/8",
        "K:clef=perc",
        "| B2 | A2 | A2 | B2 |",
      ].join("\n"),
    });
  });

  it("uses stop on the main button while playback is active", async () => {
    const seedAbc = [
      "X:1",
      "T:Seed Pattern",
      "M:4/4",
      "L:1/8",
      "K:clef=perc",
      "| A2 | A2 |",
    ].join("\n");

    mocked.loadPatternMock.mockResolvedValue({
      genreName: "Irish Traditional",
      tuneTypeName: "Reel",
      rhythmAbc: seedAbc,
      rhythmSignature: "4/4",
      patternType: "seed",
      tempoQpm: 120,
      sampleKit: "bodhran",
      premiumAudioUrl: null,
      premiumAudioTrimMs: 0,
      premiumAudioSource: null,
      premiumAudioSourceTempoQpm: null,
      source: "rhythm_patterns",
    });
    mocked.serviceStub.metadata = () => ({
      genreName: "Irish Traditional",
      tuneTypeName: "Reel",
      rhythmAbc: seedAbc,
      rhythmSignature: "4/4",
      patternType: "seed" as const,
      tempoQpm: 120,
      sampleKit: "bodhran",
      premiumAudioUrl: null,
      premiumAudioTrimMs: 0,
      premiumAudioSource: null,
      premiumAudioSourceTempoQpm: null,
      source: "rhythm_patterns" as const,
    });
    mocked.serviceStub.isPlaying = () => true;

    const view = render(() => <RhythmPlayer tuneTypeName="Reel" />);

    await waitFor(() => {
      expect(
        view.getByTestId("rhythm-player-play-toggle").textContent
      ).toContain("Stop");
    });

    fireEvent.click(view.getByTestId("rhythm-player-play-toggle"));

    expect(mocked.serviceStub.stop).toHaveBeenCalledTimes(1);
  });

  it("keeps restart disabled until playback has been paused", async () => {
    const seedAbc = [
      "X:1",
      "T:Seed Pattern",
      "M:4/4",
      "L:1/8",
      "K:clef=perc",
      "| A2 | A2 |",
    ].join("\n");

    mocked.loadPatternMock.mockResolvedValue({
      genreName: "Irish Traditional",
      tuneTypeName: "Reel",
      rhythmAbc: seedAbc,
      rhythmSignature: "4/4",
      patternType: "seed",
      tempoQpm: 120,
      sampleKit: "bodhran",
      premiumAudioUrl: null,
      premiumAudioTrimMs: 0,
      premiumAudioSource: null,
      premiumAudioSourceTempoQpm: null,
      source: "rhythm_patterns",
    });
    mocked.serviceStub.metadata = () => ({
      genreName: "Irish Traditional",
      tuneTypeName: "Reel",
      rhythmAbc: seedAbc,
      rhythmSignature: "4/4",
      patternType: "seed" as const,
      tempoQpm: 120,
      sampleKit: "bodhran",
      premiumAudioUrl: null,
      premiumAudioTrimMs: 0,
      premiumAudioSource: null,
      premiumAudioSourceTempoQpm: null,
      source: "rhythm_patterns" as const,
    });

    const initialView = render(() => <RhythmPlayer tuneTypeName="Reel" />);
    const initialRestartButton = initialView.getByTestId(
      "rhythm-player-restart-button"
    );

    await waitFor(() => {
      expect(initialRestartButton.hasAttribute("disabled")).toBe(true);
    });

    cleanup();
    mocked.serviceStub.isPaused = () => true;

    const pausedView = render(() => <RhythmPlayer tuneTypeName="Reel" />);
    const pausedRestartButton = pausedView.getByTestId(
      "rhythm-player-restart-button"
    );
    const pausedPlayButton = pausedView.getByTestId(
      "rhythm-player-play-toggle"
    );

    await waitFor(() => {
      expect(pausedPlayButton.hasAttribute("disabled")).toBe(false);
      expect(pausedRestartButton.hasAttribute("disabled")).toBe(false);
    });
  });

  it("resets the paused position without starting playback when restart is pressed", async () => {
    const seedAbc = [
      "X:1",
      "T:Seed Pattern",
      "M:4/4",
      "L:1/8",
      "K:clef=perc",
      "| A2 | A2 | B2 | B2 |",
    ].join("\n");

    mocked.loadPatternMock.mockResolvedValue({
      genreName: "Irish Traditional",
      tuneTypeName: "Reel",
      rhythmAbc: seedAbc,
      rhythmSignature: "4/4",
      patternType: "seed",
      tempoQpm: 120,
      sampleKit: "bodhran",
      premiumAudioUrl: null,
      premiumAudioTrimMs: 0,
      premiumAudioSource: null,
      premiumAudioSourceTempoQpm: null,
      source: "rhythm_patterns",
    });
    mocked.serviceStub.metadata = () => ({
      genreName: "Irish Traditional",
      tuneTypeName: "Reel",
      rhythmAbc: seedAbc,
      rhythmSignature: "4/4",
      patternType: "seed" as const,
      tempoQpm: 120,
      sampleKit: "bodhran",
      premiumAudioUrl: null,
      premiumAudioTrimMs: 0,
      premiumAudioSource: null,
      premiumAudioSourceTempoQpm: null,
      source: "rhythm_patterns" as const,
    });
    mocked.serviceStub.tempoQpm = () => 120;
    mocked.serviceStub.isPaused = () => true;

    const view = render(() => (
      <RhythmPlayer tuneTypeName="Reel" structure="A1A1B1B1" />
    ));
    const restartButton = view.getByTestId("rhythm-player-restart-button");
    const playButton = view.getByTestId("rhythm-player-play-toggle");

    await waitFor(() => {
      expect(playButton.hasAttribute("disabled")).toBe(false);
      expect(restartButton.hasAttribute("disabled")).toBe(false);
    });

    fireEvent.change(view.getByTestId("rhythm-player-start-section-select"), {
      target: { value: "B2" },
    });
    fireEvent.click(restartButton);

    expect(mocked.serviceStub.restart).toHaveBeenCalledWith({
      startPositionMs: 0,
      startBeatIndex: 3,
      startMeasure: 3,
      playbackRhythmAbc: [
        "X:1",
        "T:Seed Pattern",
        "M:4/4",
        "L:1/8",
        "K:clef=perc",
        "| B2 | A2 | A2 | B2 |",
      ].join("\n"),
    });
    expect(mocked.serviceStub.play).not.toHaveBeenCalled();
  });

  it("pauses and resumes independently of the main play button", async () => {
    const seedAbc = [
      "X:1",
      "T:Seed Pattern",
      "M:4/4",
      "L:1/8",
      "K:clef=perc",
      "| A2 | A2 |",
    ].join("\n");

    mocked.loadPatternMock.mockResolvedValue({
      genreName: "Irish Traditional",
      tuneTypeName: "Reel",
      rhythmAbc: seedAbc,
      rhythmSignature: "4/4",
      patternType: "seed",
      tempoQpm: 120,
      sampleKit: "bodhran",
      premiumAudioUrl: null,
      premiumAudioTrimMs: 0,
      premiumAudioSource: null,
      premiumAudioSourceTempoQpm: null,
      source: "rhythm_patterns",
    });
    mocked.serviceStub.metadata = () => ({
      genreName: "Irish Traditional",
      tuneTypeName: "Reel",
      rhythmAbc: seedAbc,
      rhythmSignature: "4/4",
      patternType: "seed" as const,
      tempoQpm: 120,
      sampleKit: "bodhran",
      premiumAudioUrl: null,
      premiumAudioTrimMs: 0,
      premiumAudioSource: null,
      premiumAudioSourceTempoQpm: null,
      source: "rhythm_patterns" as const,
    });
    mocked.serviceStub.isPlaying = () => true;

    const playingView = render(() => <RhythmPlayer tuneTypeName="Reel" />);
    const pauseButton = playingView.getByTestId("rhythm-player-pause-button");

    await waitFor(() => {
      expect(pauseButton.textContent).toContain("Pause");
      expect(pauseButton.hasAttribute("disabled")).toBe(false);
    });

    fireEvent.click(pauseButton);
    expect(mocked.serviceStub.pause).toHaveBeenCalledTimes(1);

    cleanup();
    mocked.serviceStub.isPlaying = () => false;
    mocked.serviceStub.isPaused = () => true;

    const pausedView = render(() => <RhythmPlayer tuneTypeName="Reel" />);
    const resumeButton = pausedView.getByTestId("rhythm-player-pause-button");

    await waitFor(() => {
      expect(resumeButton.textContent).toContain("Resume");
      expect(resumeButton.hasAttribute("disabled")).toBe(false);
    });

    fireEvent.click(resumeButton);
    expect(mocked.serviceStub.resume).toHaveBeenCalledTimes(1);
  });

  it("expands compact full_track patterns to the structured playback form", async () => {
    const compactFullTrackBody = [
      ...Array.from({ length: 8 }, () => "C2 A2 C2 A2"),
      ...Array.from({ length: 8 }, () => "C2 c2 C2 c2"),
    ].join(" | ");
    const fullTrackAbc = [
      "X:1",
      "T:Full Track",
      "M:4/4",
      "L:1/8",
      "K:clef=perc",
      `| ${compactFullTrackBody} |`,
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

    render(() => <RhythmPlayer tuneTypeName="Reel" structure="AABB" />);

    await waitFor(() => {
      expect(mocked.updateRhythmAbcMock).toHaveBeenCalled();
    });

    expect(mocked.updateRhythmAbcMock.mock.calls.at(-1)?.[0]).toContain(
      `| ${[
        ...Array.from({ length: 16 }, () => "C2 A2 C2 A2"),
        ...Array.from({ length: 16 }, () => "C2 c2 C2 c2"),
      ].join(" | ")} |`
    );
  });

  it("keeps already-expanded full_track patterns exactly as written", async () => {
    const expandedFullTrackBody = [
      ...Array.from({ length: 16 }, () => "C2 A2 C2 A2"),
      ...Array.from({ length: 16 }, () => "C2 c2 C2 c2"),
    ].join(" | ");
    const fullTrackAbc = [
      "X:1",
      "T:Expanded Full Track",
      "M:4/4",
      "L:1/8",
      "K:clef=perc",
      `| ${expandedFullTrackBody} |`,
    ].join("\n");

    mocked.loadPatternMock.mockResolvedValue({
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

    render(() => <RhythmPlayer tuneTypeName="Reel" structure="AABB" />);

    await waitFor(() => {
      expect(mocked.updateRhythmAbcMock).toHaveBeenCalled();
    });

    expect(mocked.updateRhythmAbcMock.mock.calls.at(-1)?.[0]).toBe(
      fullTrackAbc
    );
  });

  it("shows the premium loop switch only when metadata exposes a premium audio URL", async () => {
    const metadata = {
      genreName: "Irish Traditional",
      tuneTypeName: "Reel",
      rhythmAbc: [
        "X:1",
        "T:Premium Loop",
        "M:4/4",
        "L:1/8",
        "K:clef=perc",
        "|: C2 A2 C2 A2 :|",
      ].join("\n"),
      rhythmSignature: "4/4",
      patternType: "seed" as const,
      tempoQpm: 112,
      sampleKit: "bodhran",
      premiumAudioUrl: "/custom/reel.mp3",
      premiumAudioTrimMs: 0,
      premiumAudioSource: "database" as const,
      premiumAudioSourceTempoQpm: 112,
      source: "rhythm_patterns" as const,
    };

    mocked.loadPatternMock.mockResolvedValue(metadata);
    mocked.serviceStub.metadata = () => metadata;

    const view = render(() => <RhythmPlayer tuneTypeName="Reel" />);

    await waitFor(() => {
      expect(
        view.queryByTestId("rhythm-player-premium-loop-switch")
      ).not.toBeNull();
    });
  });

  it("renders seed notation as expanded sample ABC built from the sample and structure", async () => {
    const seedAbc = [
      "X:1",
      "T:Seed Pattern",
      "M:6/8",
      "L:1/8",
      "K:clef=perc",
      "|: C2 c C c c :|",
    ].join("\n");

    mocked.loadPatternMock.mockResolvedValue({
      genreName: "Irish Traditional",
      tuneTypeName: "Jig",
      rhythmAbc: seedAbc,
      rhythmSignature: "6/8",
      patternType: "seed",
      tempoQpm: 112,
      sampleKit: "bodhran",
      premiumAudioUrl: null,
      premiumAudioTrimMs: 0,
      premiumAudioSource: null,
      premiumAudioSourceTempoQpm: null,
      source: "rhythm_patterns",
    });
    mocked.serviceStub.metadata = () => ({
      genreName: "Irish Traditional",
      tuneTypeName: "Jig",
      rhythmAbc: seedAbc,
      rhythmSignature: "6/8",
      patternType: "seed" as const,
      tempoQpm: 112,
      sampleKit: "bodhran",
      premiumAudioUrl: null,
      premiumAudioTrimMs: 0,
      premiumAudioSource: null,
      premiumAudioSourceTempoQpm: null,
      source: "rhythm_patterns" as const,
    });

    render(() => <RhythmPlayer tuneTypeName="Jig" structure="A A B B" />);

    await waitFor(() => {
      expect(mocked.renderAbcMock).toHaveBeenCalled();
    });

    const renderedAbc = mocked.renderAbcMock.mock.calls.at(-1)?.[1] as string;
    expect(renderedAbc).toContain("M:6/8");
    expect(renderedAbc).toContain("L:1/8");
    expect(renderedAbc).toContain("K:clef=perc");
    expect(renderedAbc).toContain(
      "|:C2 c C c c|C2 c C c c|C2 c C c c|C2 c C c c|C2 c C c c|C2 c C c c|C2 c C c c|C2 c C c c:|"
    );
    expect(renderedAbc).not.toContain("$");
    expect(renderedAbc).not.toContain("T:");
  });
});
