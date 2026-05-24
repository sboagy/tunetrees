import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  resolveCurrentBeatNotehead,
  resolvePlaybackMarkerNotehead,
  resolveStructuredDisplayNotehead,
  updateStructuredDisplayPartLabels,
} from "@/lib/rhythm/structured-display-sync";
import { getStructuredSectionLabel } from "@/lib/rhythm/structured-playback-model";
import type {
  PlaybackEventMarker,
  RhythmPatternMetadata,
  RhythmService,
} from "@/lib/services/rhythm-service/RhythmService";
import { RhythmPlayer } from "./RhythmPlayer";

const mocked = vi.hoisted(() => {
  const renderAbcMock = vi.fn();
  const parseOnlyMock = vi.fn(() => [{}]);
  const loadPatternMock = vi.fn<RhythmService["loadPattern"]>(async () => null);
  const updateRhythmAbcMock = vi.fn<RhythmService["updateRhythmAbc"]>();
  const createEditableRhythmPatternMock = vi.fn(async () => ({
    id: "custom-user-pattern",
    genreId: "irish-traditional",
    tuneTypeId: "reel",
    name: "My Reel Pattern",
    abcString: [
      "X:1",
      "T:My Reel Pattern",
      "M:4/4",
      "L:1/8",
      "K:clef=perc",
      "|: C2 z2 C2 z2 :|",
    ].join("\n"),
    isDefault: 0,
    premiumAudioUrl: null,
    sampleKit: "generic_click",
    tuneId: "tune-42",
    userId: "auth-user-1",
    patternType: "seed",
    partTarget: "*",
    lastModifiedAt: "2024-01-01T00:00:00.000Z",
  }));
  const updateEditableRhythmPatternMock = vi.fn(async () => null);
  const deleteEditableRhythmPatternMock = vi.fn(async () => undefined);
  const getEditableRhythmPatternByIdMock = vi.fn(async () => null);

  return {
    renderAbcMock,
    parseOnlyMock,
    loadPatternMock,
    updateRhythmAbcMock,
    createEditableRhythmPatternMock,
    updateEditableRhythmPatternMock,
    deleteEditableRhythmPatternMock,
    getEditableRhythmPatternByIdMock,
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
      currentPlaybackMarker: () => null as PlaybackEventMarker | null,
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
    parseOnly: mocked.parseOnlyMock,
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

vi.mock("@/lib/services/rhythm-service/RhythmService", () => ({
  createRhythmService: () => mocked.serviceStub,
}));

vi.mock("@/lib/db/queries/rhythm-patterns", () => ({
  createEditableRhythmPattern: mocked.createEditableRhythmPatternMock,
  updateEditableRhythmPattern: mocked.updateEditableRhythmPatternMock,
  deleteEditableRhythmPattern: mocked.deleteEditableRhythmPatternMock,
  getEditableRhythmPatternById: mocked.getEditableRhythmPatternByIdMock,
}));

describe("RhythmPlayer", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    mocked.renderAbcMock.mockReset();
    mocked.renderAbcMock.mockReturnValue([]);
    mocked.parseOnlyMock.mockReset();
    mocked.parseOnlyMock.mockReturnValue([{}]);
    mocked.loadPatternMock.mockReset();
    mocked.loadPatternMock.mockResolvedValue(null);
    mocked.updateRhythmAbcMock.mockReset();
    mocked.createEditableRhythmPatternMock.mockClear();
    mocked.updateEditableRhythmPatternMock.mockClear();
    mocked.deleteEditableRhythmPatternMock.mockClear();
    mocked.getEditableRhythmPatternByIdMock.mockClear();
    mocked.serviceStub.metadata = () => null;
    mocked.serviceStub.tempoQpm = () => 100;
    mocked.serviceStub.isPlaying = () => false;
    mocked.serviceStub.isPaused = () => false;
    mocked.serviceStub.isCountIn = () => false;
    mocked.serviceStub.countInPulse = () => 0;
    mocked.serviceStub.countInTotalPulses = () => 0;
    mocked.serviceStub.currentPlaybackMarker = () => null;
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
        genreId: null,
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
      makeNotehead(1, "a3"),
      makeNotehead(1, "a4"),
      makeNotehead(2, "b1"),
      makeNotehead(2, "b2"),
      makeNotehead(3, "b3"),
      makeNotehead(3, "b4"),
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
    ).toBe("a3");
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
    ).toBe("b3");
  });

  it("maps compact full-track repeats by section when each section spans multiple staff lines", () => {
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
      makeNotehead(1, "a5"),
      makeNotehead(1, "a6"),
      makeNotehead(1, "a7"),
      makeNotehead(1, "a8"),
      makeNotehead(2, "b1"),
      makeNotehead(2, "b2"),
      makeNotehead(2, "b3"),
      makeNotehead(2, "b4"),
      makeNotehead(3, "b5"),
      makeNotehead(3, "b6"),
      makeNotehead(3, "b7"),
      makeNotehead(3, "b8"),
    ];

    const sourceAbc = [
      "X:1",
      "M:4/4",
      "L:1/4",
      "K:clef=perc",
      "|: A | B | C | D |",
      "E | F | G | A :|",
      "|: B | C | D | E |",
      "F | G | A | B :|",
    ].join("\n");

    expect(
      resolveStructuredDisplayNotehead(
        noteheads,
        sourceAbc,
        "AABB",
        1
      )?.getAttribute("data-note-id")
    ).toBe("a1");
    expect(
      resolveStructuredDisplayNotehead(
        noteheads,
        sourceAbc,
        "AABB",
        5
      )?.getAttribute("data-note-id")
    ).toBe("a5");
    expect(
      resolveStructuredDisplayNotehead(
        noteheads,
        sourceAbc,
        "AABB",
        9
      )?.getAttribute("data-note-id")
    ).toBe("a1");
    expect(
      resolveStructuredDisplayNotehead(
        noteheads,
        sourceAbc,
        "AABB",
        13
      )?.getAttribute("data-note-id")
    ).toBe("a5");
    expect(
      resolveStructuredDisplayNotehead(
        noteheads,
        sourceAbc,
        "AABB",
        17
      )?.getAttribute("data-note-id")
    ).toBe("b1");
    expect(
      resolveStructuredDisplayNotehead(
        noteheads,
        sourceAbc,
        "AABB",
        25
      )?.getAttribute("data-note-id")
    ).toBe("b1");
  });

  it("maps wrapped compact full-track sections using the rendered display lines", () => {
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
      makeNotehead(0, "a-1"),
      makeNotehead(0, "a-2"),
      makeNotehead(0, "a-3"),
      makeNotehead(0, "a-4"),
      makeNotehead(1, "a-5"),
      makeNotehead(1, "a-6"),
      makeNotehead(1, "a-7"),
      makeNotehead(1, "a-8"),
      makeNotehead(2, "b-1"),
      makeNotehead(2, "b-2"),
      makeNotehead(2, "b-3"),
      makeNotehead(2, "b-4"),
      makeNotehead(3, "b-5"),
      makeNotehead(3, "b-6"),
      makeNotehead(3, "b-7"),
      makeNotehead(3, "b-8"),
    ];

    const sourceAbc = [
      "X:1",
      "M:4/4",
      "L:1/4",
      "K:clef=perc",
      "P:A",
      `| ${Array.from({ length: 8 }, () => "A").join(" | ")} |`,
      "P:B",
      `| ${Array.from({ length: 8 }, () => "B").join(" | ")} |`,
    ].join("\n");
    const displayAbc = [
      "X:1",
      "M:4/4",
      "L:1/4",
      "K:clef=perc",
      "P:A",
      "| A | A | A | A |",
      "| A | A | A | A |",
      "P:B",
      "| B | B | B | B |",
      "| B | B | B | B |",
    ].join("\n");

    expect(
      resolveStructuredDisplayNotehead(
        noteheads,
        sourceAbc,
        "AABB",
        1,
        displayAbc
      )?.getAttribute("data-note-id")
    ).toBe("a-1");
    expect(
      resolveStructuredDisplayNotehead(
        noteheads,
        sourceAbc,
        "AABB",
        5,
        displayAbc
      )?.getAttribute("data-note-id")
    ).toBe("a-5");
    expect(
      resolveStructuredDisplayNotehead(
        noteheads,
        sourceAbc,
        "AABB",
        9,
        displayAbc
      )?.getAttribute("data-note-id")
    ).toBe("a-1");
    expect(
      resolveStructuredDisplayNotehead(
        noteheads,
        sourceAbc,
        "AABB",
        13,
        displayAbc
      )?.getAttribute("data-note-id")
    ).toBe("a-5");
    expect(
      resolveStructuredDisplayNotehead(
        noteheads,
        sourceAbc,
        "AABB",
        17,
        displayAbc
      )?.getAttribute("data-note-id")
    ).toBe("b-1");
    expect(
      resolveStructuredDisplayNotehead(
        noteheads,
        sourceAbc,
        "AABB",
        21,
        displayAbc
      )?.getAttribute("data-note-id")
    ).toBe("b-5");
  });

  it("maps expanded full-track repeats onto later displayed staff lines", () => {
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
      makeNotehead(0, "a1-1"),
      makeNotehead(0, "a1-2"),
      makeNotehead(0, "a1-3"),
      makeNotehead(0, "a1-4"),
      makeNotehead(1, "a1-5"),
      makeNotehead(1, "a1-6"),
      makeNotehead(1, "a1-7"),
      makeNotehead(1, "a1-8"),
      makeNotehead(2, "a2-1"),
      makeNotehead(2, "a2-2"),
      makeNotehead(2, "a2-3"),
      makeNotehead(2, "a2-4"),
      makeNotehead(3, "a2-5"),
      makeNotehead(3, "a2-6"),
      makeNotehead(3, "a2-7"),
      makeNotehead(3, "a2-8"),
      makeNotehead(4, "b1-1"),
      makeNotehead(4, "b1-2"),
      makeNotehead(4, "b1-3"),
      makeNotehead(4, "b1-4"),
      makeNotehead(5, "b1-5"),
      makeNotehead(5, "b1-6"),
      makeNotehead(5, "b1-7"),
      makeNotehead(5, "b1-8"),
      makeNotehead(6, "b2-1"),
      makeNotehead(6, "b2-2"),
      makeNotehead(6, "b2-3"),
      makeNotehead(6, "b2-4"),
      makeNotehead(7, "b2-5"),
      makeNotehead(7, "b2-6"),
      makeNotehead(7, "b2-7"),
      makeNotehead(7, "b2-8"),
    ];

    const sourceAbc = [
      "X:1",
      "M:4/4",
      "L:1/4",
      "K:clef=perc",
      `| ${[
        ...Array.from({ length: 8 }, () => "A"),
        ...Array.from({ length: 8 }, () => "a"),
        ...Array.from({ length: 8 }, () => "B"),
        ...Array.from({ length: 8 }, () => "b"),
      ].join(" | ")} |`,
    ].join("\n");
    const displayAbc = [
      "X:1",
      "M:4/4",
      "L:1/4",
      "K:clef=perc",
      "| A | A | A | A |",
      "| A | A | A | A |",
      "| a | a | a | a |",
      "| a | a | a | a |",
      "| B | B | B | B |",
      "| B | B | B | B |",
      "| b | b | b | b |",
      "| b | b | b | b |",
    ].join("\n");

    expect(
      resolveStructuredDisplayNotehead(
        noteheads,
        sourceAbc,
        "AABB",
        1,
        displayAbc
      )?.getAttribute("data-note-id")
    ).toBe("a1-1");
    expect(
      resolveStructuredDisplayNotehead(
        noteheads,
        sourceAbc,
        "AABB",
        9,
        displayAbc
      )?.getAttribute("data-note-id")
    ).toBe("a2-1");
    expect(
      resolveStructuredDisplayNotehead(
        noteheads,
        sourceAbc,
        "AABB",
        17,
        displayAbc
      )?.getAttribute("data-note-id")
    ).toBe("b1-1");
    expect(
      resolveStructuredDisplayNotehead(
        noteheads,
        sourceAbc,
        "AABB",
        25,
        displayAbc
      )?.getAttribute("data-note-id")
    ).toBe("b2-1");
  });

  it("uses rendered notehead order when expanded display ABC already matches the structured playback", () => {
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

    const linePattern = [
      0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 2, 3, 3, 3, 5, 5, 1, 1, 1, 1, 2, 2, 2, 2, 4,
      4, 4, 5, 5, 5, 5, 5,
    ];
    const noteheads = linePattern.map((lineIndex, index) =>
      makeNotehead(lineIndex, `n-${index + 1}`)
    );

    const sourceAbc = [
      "X:1",
      "M:4/4",
      "L:1/4",
      "K:clef=perc",
      "P:A",
      `| ${Array.from({ length: 8 }, () => "A").join(" | ")} |`,
      "P:B",
      `| ${Array.from({ length: 8 }, () => "B").join(" | ")} |`,
    ].join("\n");
    const displayAbc = [
      "X:1",
      "M:4/4",
      "L:1/4",
      "K:clef=perc",
      `| ${[
        ...Array.from({ length: 16 }, () => "A"),
        ...Array.from({ length: 16 }, () => "B"),
      ].join(" | ")} |`,
    ].join("\n");

    expect(
      resolveStructuredDisplayNotehead(
        noteheads,
        sourceAbc,
        "AABB",
        1,
        displayAbc
      )?.getAttribute("data-note-id")
    ).toBe("n-1");
    expect(
      resolveStructuredDisplayNotehead(
        noteheads,
        sourceAbc,
        "AABB",
        9,
        displayAbc
      )?.getAttribute("data-note-id")
    ).toBe("n-9");
    expect(
      resolveStructuredDisplayNotehead(
        noteheads,
        sourceAbc,
        "AABB",
        17,
        displayAbc
      )?.getAttribute("data-note-id")
    ).toBe("n-17");
    expect(
      resolveStructuredDisplayNotehead(
        noteheads,
        sourceAbc,
        "AABB",
        25,
        displayAbc
      )?.getAttribute("data-note-id")
    ).toBe("n-25");
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

  it("wraps AABB section passes after a later-section playback start", () => {
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

    expect(getStructuredSectionLabel(sourceAbc, "AABB", 33)).toBe("A");
    expect(getStructuredSectionLabel(sourceAbc, "AABB", 41)).toBe("A2");
    expect(getStructuredSectionLabel(sourceAbc, "AABB", 49)).toBe("B");
    expect(getStructuredSectionLabel(sourceAbc, "AABB", 57)).toBe("B2");
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

  it("resolves the displayed notehead from abcjs playback marker classes", () => {
    const container = document.createElement("div");
    const makeNote = (className: string, noteId: string) => {
      const noteGroup = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "g"
      );
      noteGroup.setAttribute("class", className);

      const notehead = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path"
      );
      notehead.setAttribute("class", "abcjs-notehead");
      notehead.setAttribute("data-note-id", noteId);
      noteGroup.appendChild(notehead);
      container.appendChild(noteGroup);
      return notehead;
    };

    makeNote("abcjs-note abcjs-mm8 abcjs-n0 abcjs-l2", "before");
    makeNote("abcjs-note abcjs-mm8 abcjs-n2 abcjs-l2", "target");

    expect(
      resolvePlaybackMarkerNotehead(container, {
        measureIndex: 8,
        noteIndex: 1,
      })?.getAttribute("data-note-id")
    ).toBe("target");
  });

  it("prefers the structured display notehead when the playback marker drifts into the next visible section", () => {
    const container = document.createElement("div");
    const makeNote = (
      className: string,
      noteId: string,
      parent: ParentNode = container
    ) => {
      const noteGroup = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "g"
      );
      noteGroup.setAttribute("class", className);

      const notehead = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path"
      );
      notehead.setAttribute("class", "abcjs-notehead");
      notehead.setAttribute("data-note-id", noteId);
      noteGroup.appendChild(notehead);
      parent.appendChild(noteGroup);
      return notehead;
    };

    const noteheads = [
      makeNote("abcjs-note abcjs-mm0 abcjs-n0 abcjs-l0", "a-1"),
      makeNote("abcjs-note abcjs-mm0 abcjs-n1 abcjs-l0", "a-2"),
      makeNote("abcjs-note abcjs-mm0 abcjs-n2 abcjs-l0", "a-3"),
      makeNote("abcjs-note abcjs-mm0 abcjs-n3 abcjs-l0", "a-4"),
      makeNote("abcjs-note abcjs-mm1 abcjs-n0 abcjs-l1", "a-5"),
      makeNote("abcjs-note abcjs-mm1 abcjs-n1 abcjs-l1", "a-6"),
      makeNote("abcjs-note abcjs-mm1 abcjs-n2 abcjs-l1", "a-7"),
      makeNote("abcjs-note abcjs-mm1 abcjs-n3 abcjs-l1", "a-8"),
      makeNote("abcjs-note abcjs-mm2 abcjs-n0 abcjs-l2", "b-1"),
      makeNote("abcjs-note abcjs-mm2 abcjs-n1 abcjs-l2", "b-2"),
      makeNote("abcjs-note abcjs-mm2 abcjs-n2 abcjs-l2", "b-3"),
      makeNote("abcjs-note abcjs-mm2 abcjs-n3 abcjs-l2", "b-4"),
      makeNote("abcjs-note abcjs-mm3 abcjs-n0 abcjs-l3", "b-5"),
      makeNote("abcjs-note abcjs-mm3 abcjs-n1 abcjs-l3", "b-6"),
      makeNote("abcjs-note abcjs-mm3 abcjs-n2 abcjs-l3", "b-7"),
      makeNote("abcjs-note abcjs-mm3 abcjs-n3 abcjs-l3", "b-8"),
    ];

    const sourceAbc = [
      "X:1",
      "M:4/4",
      "L:1/4",
      "K:clef=perc",
      "P:A",
      `| ${Array.from({ length: 8 }, () => "A").join(" | ")} |`,
      "P:B",
      `| ${Array.from({ length: 8 }, () => "B").join(" | ")} |`,
    ].join("\n");
    const displayAbc = [
      "X:1",
      "M:4/4",
      "L:1/4",
      "K:clef=perc",
      "| A | A | A | A |",
      "| A | A | A | A |",
      "| B | B | B | B |",
      "| B | B | B | B |",
    ].join("\n");

    expect(
      resolveCurrentBeatNotehead(
        container,
        noteheads,
        {
          measureIndex: 2,
          noteIndex: 0,
        },
        sourceAbc,
        "AABB",
        9,
        displayAbc
      )?.getAttribute("data-note-id")
    ).toBe("a-1");
  });

  it("maps full rendered lines with rests without wrapping back within the line", () => {
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
      ...Array.from({ length: 20 }, (_value, index) =>
        makeNotehead(0, `a1-${index + 1}`)
      ),
      ...Array.from({ length: 20 }, (_value, index) =>
        makeNotehead(1, `a2-${index + 1}`)
      ),
    ];

    const sourceAbc = [
      "X:1",
      "M:6/8",
      "L:1/8",
      "K:clef=perc",
      "P:A",
      "| =F,zD, F,=C,C, | =F,zD, F,=C,C, | =F,zD, F,=C,C, | =F,zD, F,=C,C, |",
      "| =F,zD, F,=C,C, | =F,zD, F,=C,C, | =F,zD, F,=C,C, | =F,zD, F,=C,C, |",
    ].join("\n");
    const displayAbc = [
      "X:1",
      "M:6/8",
      "L:1/8",
      "K:clef=perc",
      "| =F,zD, F,=C,C, | =F,zD, F,=C,C, | =F,zD, F,=C,C, | =F,zD, F,=C,C, |",
      "| =F,zD, F,=C,C, | =F,zD, F,=C,C, | =F,zD, F,=C,C, | =F,zD, F,=C,C, |",
    ].join("\n");

    expect(
      resolveStructuredDisplayNotehead(
        noteheads,
        sourceAbc,
        "A",
        20,
        displayAbc
      )?.getAttribute("data-note-id")
    ).toBe("a1-16");
    expect(
      resolveStructuredDisplayNotehead(
        noteheads,
        sourceAbc,
        "A",
        21,
        displayAbc
      )?.getAttribute("data-note-id")
    ).toBe("a1-17");
    expect(
      resolveStructuredDisplayNotehead(
        noteheads,
        sourceAbc,
        "A",
        24,
        displayAbc
      )?.getAttribute("data-note-id")
    ).toBe("a1-20");
    expect(
      resolveStructuredDisplayNotehead(
        noteheads,
        sourceAbc,
        "A",
        25,
        displayAbc
      )?.getAttribute("data-note-id")
    ).toBe("a2-1");
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
    expect(playbackAbc).toContain("P:A");
    expect(playbackAbc).toContain("P:B");
    expect(playbackAbc).toContain("| C2 A2 C2 A2 | C2 A2 C2 A2 |");
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
    expect(displayAbc).not.toContain("P:A");
    expect(displayAbc).not.toContain("P:B");
    expect(displayAbc).toContain(
      "|: C2 c C c c | C2 c C c c | C2 c C c c | C2 c C c c |"
    );
    expect(displayAbc).toContain(
      "| C2 c C c c | C2 c C c c | C2 c C c c | C2 c C c c :|"
    );
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

  it("shows the combined player title with the rhythm type", async () => {
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
      expect(view.getByTestId("rhythm-player-title").textContent).toContain(
        "Rhythm Player: JigD"
      );
    });
  });

  it("renders a close button when embedded in a dialog shell", async () => {
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

    const onClose = vi.fn();
    const view = render(() => (
      <RhythmPlayer tuneTypeName="JigD" structure="AABB" onClose={onClose} />
    ));

    await waitFor(() => {
      expect(view.getByTestId("rhythm-player-close-button")).toBeTruthy();
    });

    fireEvent.click(view.getByTestId("rhythm-player-close-button"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows a pattern selector when multiple pattern candidates are available", async () => {
    const defaultAbc = [
      "X:1",
      "T:System Default",
      "M:4/4",
      "L:1/8",
      "K:clef=perc",
      "|: C2 A2 C2 A2 :|",
    ].join("\n");
    const userAbc = [
      "X:1",
      "T:User Default",
      "M:4/4",
      "L:1/8",
      "K:clef=perc",
      "|: D2 A2 D2 A2 :|",
    ].join("\n");

    const patternCandidates = [
      {
        id: "system-default",
        name: "System Default",
        scope: "system_default" as const,
        patternType: "seed" as const,
        sampleKit: "bodhran",
        hasPremiumAudio: false,
      },
      {
        id: "user-default",
        name: "User Default",
        scope: "user_default" as const,
        patternType: "seed" as const,
        sampleKit: "generic_click",
        hasPremiumAudio: false,
      },
    ];
    let currentPatternId: "system-default" | "user-default" = "system-default";

    const buildMetadata = (
      patternId: "system-default" | "user-default"
    ): RhythmPatternMetadata => ({
      genreName: "Irish Traditional",
      tuneTypeName: "Reel",
      rhythmAbc: patternId === "user-default" ? userAbc : defaultAbc,
      rhythmSignature: "4/4",
      patternType: "seed",
      tempoQpm: 112,
      sampleKit: patternId === "user-default" ? "generic_click" : "bodhran",
      premiumAudioUrl: null,
      premiumAudioTrimMs: 0,
      premiumAudioSource: null,
      premiumAudioSourceTempoQpm: null,
      source: "rhythm_patterns",
      selectedPatternId: patternId,
      patternCandidates,
    });

    mocked.loadPatternMock.mockImplementation(async (request) => {
      currentPatternId =
        request.selectedPatternId === "user-default"
          ? "user-default"
          : "system-default";

      return buildMetadata(currentPatternId);
    });
    mocked.serviceStub.metadata = () => buildMetadata(currentPatternId);

    const view = render(() => <RhythmPlayer tuneTypeName="Reel" />);

    await waitFor(() => {
      expect(view.getByTestId("rhythm-player-pattern-select")).toBeTruthy();
    });

    const patternSelect = view.getByTestId(
      "rhythm-player-pattern-select"
    ) as HTMLSelectElement;
    expect(patternSelect.value).toBe("system-default");

    fireEvent.change(patternSelect, {
      target: { value: "user-default" },
    });

    await waitFor(() => {
      expect(mocked.loadPatternMock).toHaveBeenLastCalledWith({
        genreId: null,
        genreName: null,
        tuneTypeName: "Reel",
        tuneId: null,
        userId: "auth-user-1",
        selectedPatternId: "user-default",
      });
      expect(patternSelect.value).toBe("user-default");
    });
  });

  it("shows the loaded pattern when a selection request resolves to a different candidate", async () => {
    const defaultAbc = [
      "X:1",
      "T:System Default",
      "M:4/4",
      "L:1/8",
      "K:clef=perc",
      "|: C2 A2 C2 A2 :|",
    ].join("\n");
    const userAbc = [
      "X:1",
      "T:User Default",
      "M:4/4",
      "L:1/8",
      "K:clef=perc",
      "|: D2 A2 D2 A2 :|",
    ].join("\n");

    const patternCandidates = [
      {
        id: "system-default",
        name: "System Default",
        scope: "system_default" as const,
        patternType: "seed" as const,
        sampleKit: "bodhran",
        hasPremiumAudio: false,
      },
      {
        id: "user-default",
        name: "User Default",
        scope: "user_default" as const,
        patternType: "seed" as const,
        sampleKit: "generic_click",
        hasPremiumAudio: false,
      },
    ];
    let currentPatternId: "system-default" | "user-default" = "system-default";

    const buildMetadata = (
      patternId: "system-default" | "user-default"
    ): RhythmPatternMetadata => ({
      genreName: "Irish Traditional",
      tuneTypeName: "Reel",
      rhythmAbc: patternId === "user-default" ? userAbc : defaultAbc,
      rhythmSignature: "4/4",
      patternType: "seed",
      tempoQpm: 112,
      sampleKit: patternId === "user-default" ? "generic_click" : "bodhran",
      premiumAudioUrl: null,
      premiumAudioTrimMs: 0,
      premiumAudioSource: null,
      premiumAudioSourceTempoQpm: null,
      source: "rhythm_patterns",
      selectedPatternId: patternId,
      patternCandidates,
    });

    mocked.loadPatternMock.mockImplementation(async (request) => {
      currentPatternId =
        request.selectedPatternId === "user-default"
          ? "system-default"
          : "system-default";

      return buildMetadata(currentPatternId);
    });
    mocked.serviceStub.metadata = () => buildMetadata(currentPatternId);

    const view = render(() => <RhythmPlayer tuneTypeName="Reel" />);

    await waitFor(() => {
      expect(view.getByTestId("rhythm-player-pattern-select")).toBeTruthy();
    });

    const patternSelect = view.getByTestId(
      "rhythm-player-pattern-select"
    ) as HTMLSelectElement;
    expect(patternSelect.value).toBe("system-default");

    fireEvent.change(patternSelect, {
      target: { value: "user-default" },
    });

    await waitFor(() => {
      expect(mocked.loadPatternMock).toHaveBeenCalledTimes(2);
      expect(patternSelect.value).toBe("system-default");
    });
  });

  it("keeps the newer pattern selection when an older load resolves late", async () => {
    const defaultAbc = [
      "X:1",
      "T:System Default",
      "M:4/4",
      "L:1/8",
      "K:clef=perc",
      "|: C2 A2 C2 A2 :|",
    ].join("\n");
    const userAbc = [
      "X:1",
      "T:User Default",
      "M:4/4",
      "L:1/8",
      "K:clef=perc",
      "|: D2 A2 D2 A2 :|",
    ].join("\n");

    const patternCandidates = [
      {
        id: "system-default",
        name: "System Default",
        scope: "system_default" as const,
        patternType: "seed" as const,
        sampleKit: "bodhran",
        hasPremiumAudio: false,
      },
      {
        id: "user-default",
        name: "User Default",
        scope: "user_default" as const,
        patternType: "seed" as const,
        sampleKit: "generic_click",
        hasPremiumAudio: false,
      },
    ];

    const buildMetadata = (
      patternId: "system-default" | "user-default"
    ): RhythmPatternMetadata => ({
      genreName: "Irish Traditional",
      tuneTypeName: "Reel",
      rhythmAbc: patternId === "user-default" ? userAbc : defaultAbc,
      rhythmSignature: "4/4",
      patternType: "seed",
      tempoQpm: 112,
      sampleKit: patternId === "user-default" ? "generic_click" : "bodhran",
      premiumAudioUrl: null,
      premiumAudioTrimMs: 0,
      premiumAudioSource: null,
      premiumAudioSourceTempoQpm: null,
      source: "rhythm_patterns",
      selectedPatternId: patternId,
      patternCandidates,
    });

    let resolveInitialLoad: ((value: RhythmPatternMetadata) => void) | null =
      null;

    mocked.loadPatternMock.mockImplementation((request) => {
      if (!request.selectedPatternId) {
        return new Promise<RhythmPatternMetadata>((resolve) => {
          resolveInitialLoad = resolve;
        });
      }

      return Promise.resolve(buildMetadata("user-default"));
    });
    mocked.serviceStub.metadata = () => buildMetadata("system-default");

    const view = render(() => <RhythmPlayer tuneTypeName="Reel" />);
    const patternSelect = await view.findByTestId(
      "rhythm-player-pattern-select"
    );

    fireEvent.change(patternSelect, {
      target: { value: "user-default" },
    });

    await waitFor(() => {
      expect((patternSelect as HTMLSelectElement).value).toBe("user-default");
    });

    expect(resolveInitialLoad).not.toBeNull();
    resolveInitialLoad!(buildMetadata("system-default"));

    await waitFor(() => {
      expect((patternSelect as HTMLSelectElement).value).toBe("user-default");
      expect(mocked.updateRhythmAbcMock.mock.calls.at(-1)?.[0]).toContain(
        "D2 A2 D2 A2"
      );
    });
  });

  it("hides the pattern selector when only one pattern candidate is available", async () => {
    const seedAbc = [
      "X:1",
      "T:System Default",
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
      selectedPatternId: "system-default",
      patternCandidates: [
        {
          id: "system-default",
          name: "System Default",
          scope: "system_default" as const,
          patternType: "seed" as const,
          sampleKit: "bodhran",
          hasPremiumAudio: false,
        },
      ],
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
      selectedPatternId: "system-default",
      patternCandidates: [
        {
          id: "system-default",
          name: "System Default",
          scope: "system_default" as const,
          patternType: "seed" as const,
          sampleKit: "bodhran",
          hasPremiumAudio: false,
        },
      ],
    });

    const view = render(() => <RhythmPlayer tuneTypeName="Reel" />);

    await waitFor(() => {
      expect(mocked.loadPatternMock).toHaveBeenCalled();
    });

    expect(view.queryByTestId("rhythm-player-pattern-select")).toBeNull();
  });

  it("creates a custom rhythm pattern and reloads the player with it selected", async () => {
    const defaultAbc = [
      "X:1",
      "T:System Default",
      "M:4/4",
      "L:1/8",
      "K:clef=perc",
      "|: C2 A2 C2 A2 :|",
    ].join("\n");

    mocked.loadPatternMock.mockResolvedValue({
      genreName: "Irish Traditional Music",
      genreId: "ITRAD",
      tuneTypeName: "Jig",
      tuneTypeId: "JigD",
      rhythmAbc: defaultAbc,
      rhythmSignature: "6/8",
      patternType: "seed",
      tempoQpm: 115,
      sampleKit: "bodhran",
      premiumAudioUrl: null,
      premiumAudioTrimMs: 0,
      premiumAudioSource: null,
      premiumAudioSourceTempoQpm: null,
      source: "rhythm_patterns",
      selectedPatternId: "system-default",
      patternCandidates: [
        {
          id: "system-default",
          name: "System Default",
          scope: "system_default" as const,
          patternType: "seed" as const,
          sampleKit: "bodhran",
          hasPremiumAudio: false,
        },
      ],
    });
    mocked.serviceStub.metadata = () => ({
      genreName: "Irish Traditional Music",
      genreId: "ITRAD",
      tuneTypeName: "Jig",
      tuneTypeId: "JigD",
      rhythmAbc: defaultAbc,
      rhythmSignature: "6/8",
      patternType: "seed" as const,
      tempoQpm: 115,
      sampleKit: "bodhran",
      premiumAudioUrl: null,
      premiumAudioTrimMs: 0,
      premiumAudioSource: null,
      premiumAudioSourceTempoQpm: null,
      source: "rhythm_patterns" as const,
      selectedPatternId: "system-default",
      patternCandidates: [
        {
          id: "system-default",
          name: "System Default",
          scope: "system_default" as const,
          patternType: "seed" as const,
          sampleKit: "bodhran",
          hasPremiumAudio: false,
        },
      ],
    });

    const view = render(() => (
      <RhythmPlayer
        tuneTypeName="Jig"
        tuneId="tune-42"
        genreName="Irish Traditional Music"
      />
    ));

    await waitFor(() => {
      expect(
        view.getByTestId("rhythm-player-custom-pattern-open-button")
      ).toBeTruthy();
    });

    fireEvent.click(
      view.getByTestId("rhythm-player-custom-pattern-open-button")
    );

    fireEvent.input(
      screen.getByTestId("rhythm-player-custom-pattern-name-input"),
      {
        target: { value: "My Reel Pattern" },
      }
    );
    fireEvent.change(
      screen.getByTestId("rhythm-player-custom-pattern-sample-kit-select"),
      {
        target: { value: "generic_click" },
      }
    );
    fireEvent.input(
      screen.getByTestId("rhythm-player-custom-pattern-abc-input"),
      {
        target: {
          value: [
            "X:1",
            "T:My Reel Pattern",
            "M:4/4",
            "L:1/8",
            "K:clef=perc",
            "|: C2 z2 C2 z2 :|",
          ].join("\n"),
        },
      }
    );
    fireEvent.click(
      screen.getByTestId("rhythm-player-custom-pattern-save-button")
    );

    await waitFor(() => {
      expect(mocked.createEditableRhythmPatternMock).toHaveBeenCalledWith(
        { fake: true },
        {
          genreName: "Irish Traditional Music",
          genreId: "ITRAD",
          tuneTypeName: "Jig",
          tuneTypeId: "JigD",
          name: "My Reel Pattern",
          abcString: [
            "X:1",
            "T:My Reel Pattern",
            "M:4/4",
            "L:1/8",
            "K:clef=perc",
            "|: C2 z2 C2 z2 :|",
          ].join("\n"),
          sampleKit: "generic_click",
          patternType: "seed",
          userId: "auth-user-1",
          scope: "user_tune",
          tuneId: "tune-42",
        }
      );
      expect(mocked.loadPatternMock).toHaveBeenLastCalledWith({
        genreId: null,
        genreName: "Irish Traditional Music",
        tuneTypeName: "Jig",
        tuneId: "tune-42",
        userId: "auth-user-1",
        selectedPatternId: "custom-user-pattern",
      });
    });
  });

  it("shows a validation error for invalid custom ABC and skips the save", async () => {
    const defaultAbc = [
      "X:1",
      "T:System Default",
      "M:4/4",
      "L:1/8",
      "K:clef=perc",
      "|: C2 A2 C2 A2 :|",
    ].join("\n");

    mocked.parseOnlyMock.mockImplementation(() => {
      throw new Error("Bad ABC");
    });
    mocked.loadPatternMock.mockResolvedValue({
      genreName: "Irish Traditional",
      tuneTypeName: "Reel",
      rhythmAbc: defaultAbc,
      rhythmSignature: "4/4",
      patternType: "seed",
      tempoQpm: 112,
      sampleKit: "bodhran",
      premiumAudioUrl: null,
      premiumAudioTrimMs: 0,
      premiumAudioSource: null,
      premiumAudioSourceTempoQpm: null,
      source: "rhythm_patterns",
      selectedPatternId: "system-default",
      patternCandidates: [],
    });
    mocked.serviceStub.metadata = () => ({
      genreName: "Irish Traditional",
      tuneTypeName: "Reel",
      rhythmAbc: defaultAbc,
      rhythmSignature: "4/4",
      patternType: "seed" as const,
      tempoQpm: 112,
      sampleKit: "bodhran",
      premiumAudioUrl: null,
      premiumAudioTrimMs: 0,
      premiumAudioSource: null,
      premiumAudioSourceTempoQpm: null,
      source: "rhythm_patterns" as const,
      selectedPatternId: "system-default",
      patternCandidates: [],
    });

    const view = render(() => (
      <RhythmPlayer
        tuneTypeName="Reel"
        tuneId="tune-42"
        genreName="Irish Traditional"
      />
    ));

    await waitFor(() => {
      expect(
        view.getByTestId("rhythm-player-custom-pattern-open-button")
      ).toBeTruthy();
    });

    fireEvent.click(
      view.getByTestId("rhythm-player-custom-pattern-open-button")
    );
    fireEvent.input(
      screen.getByTestId("rhythm-player-custom-pattern-abc-input"),
      {
        target: {
          value: [
            "X:1",
            "T:Broken Pattern",
            "M:4/4",
            "L:1/8",
            "K:clef=perc",
            "not valid",
          ].join("\n"),
        },
      }
    );

    fireEvent.click(
      screen.getByTestId("rhythm-player-custom-pattern-save-button")
    );

    await waitFor(() => {
      expect(
        screen.getByTestId("rhythm-player-custom-pattern-error").textContent
      ).toContain("Bad ABC");
    });
    expect(mocked.createEditableRhythmPatternMock).not.toHaveBeenCalled();
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

  it("wraps the current section badge correctly after starting from a later AABB section", async () => {
    const seedAbc = [
      "X:1",
      "T:Seed Pattern",
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
    mocked.serviceStub.currentBeatIndex = () => 33;

    const view = render(() => (
      <RhythmPlayer tuneTypeName="Reel" structure="AABB" />
    ));

    await waitFor(() => {
      expect(
        view.getByTestId("rhythm-player-current-section-badge").textContent
      ).toContain("A");
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

  it("plays compact sectioned full_track ABC in tune structure order", async () => {
    const fullTrackAbc = [
      "X:1",
      "T:Sectioned Full Track",
      "M:4/4",
      "L:1/8",
      "K:clef=perc",
      "P:A",
      "|: A2 | A3 | A4 | A5 :|",
      "P:B",
      "|: B2 | B3 | B4 | B5 :|",
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

    const view = render(() => (
      <RhythmPlayer tuneTypeName="Reel" structure="AABB" />
    ));

    const playButton = view.getByTestId("rhythm-player-play-toggle");

    await waitFor(() => {
      expect(mocked.updateRhythmAbcMock).toHaveBeenCalled();
      expect(playButton.hasAttribute("disabled")).toBe(false);
    });

    fireEvent.change(view.getByTestId("rhythm-player-start-section-select"), {
      target: { value: "B1" },
    });
    fireEvent.click(playButton);

    expect(mocked.serviceStub.play).toHaveBeenCalledWith({
      startPositionMs: 0,
      startBeatIndex: 8,
      startMeasure: 8,
      playbackRhythmAbc: [
        "X:1",
        "T:Sectioned Full Track",
        "M:4/4",
        "L:1/8",
        "K:clef=perc",
        "| B2 | B3 | B4 | B5 | B2 | B3 | B4 | B5 | A2 | A3 | A4 | A5 | A2 | A3 | A4 | A5 |",
      ].join("\n"),
    });
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

  it("renders full_track notation without rewriting the tune body when no structure is provided", async () => {
    const fullTrackAbc = [
      "X:7",
      "T:Full Tune Display",
      "Q:1/4=112",
      "M:6/8",
      "L:1/8",
      "K:clef=perc",
      "P:A",
      "|: C2 E G | A2 c e :|",
      "P:B",
      "|: e2 c A | G2 E C :|",
    ].join("\n");

    mocked.loadPatternMock.mockResolvedValue({
      genreName: "Irish Traditional",
      tuneTypeName: "Jig",
      rhythmAbc: fullTrackAbc,
      rhythmSignature: "6/8",
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
      tuneTypeName: "Jig",
      rhythmAbc: fullTrackAbc,
      rhythmSignature: "6/8",
      patternType: "full_track" as const,
      tempoQpm: 112,
      sampleKit: "bodhran",
      premiumAudioUrl: null,
      premiumAudioTrimMs: 0,
      premiumAudioSource: null,
      premiumAudioSourceTempoQpm: null,
      source: "rhythm_patterns" as const,
    });

    render(() => <RhythmPlayer tuneTypeName="Jig" />);

    await waitFor(() => {
      expect(mocked.renderAbcMock).toHaveBeenCalled();
    });

    const renderedAbc = mocked.renderAbcMock.mock.calls.at(-1)?.[1] as string;
    expect(renderedAbc).toContain("X:1");
    expect(renderedAbc).toContain("M:6/8");
    expect(renderedAbc).toContain("L:1/8");
    expect(renderedAbc).toContain("K:clef=perc");
    expect(renderedAbc).not.toContain("P:A");
    expect(renderedAbc).toContain("|: C2 E G | A2 c e :|");
    expect(renderedAbc).not.toContain("P:B");
    expect(renderedAbc).toContain("|: e2 c A | G2 E C :|");
    expect(renderedAbc).not.toContain("T:Full Tune Display");
    expect(renderedAbc).not.toContain("Q:1/4=112");
  });

  it("renders compact full_track notation assembled in tune-structure repeats", async () => {
    const fullTrackAbc = [
      "X:1",
      "T:Compact Full Tune",
      "M:4/4",
      "L:1/8",
      "K:clef=perc",
      `P:A\n| ${Array.from({ length: 8 }, () => "C2 A2 C2 A2").join(" | ")} |`,
      `P:B\n| ${Array.from({ length: 8 }, () => "C2 c2 C2 c2").join(" | ")} |`,
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
      expect(mocked.renderAbcMock).toHaveBeenCalled();
    });

    const renderedAbc = mocked.renderAbcMock.mock.calls.at(-1)?.[1] as string;
    expect(renderedAbc).toContain("X:1");
    expect(renderedAbc).toContain("M:4/4");
    expect(renderedAbc).toContain("L:1/8");
    expect(renderedAbc).toContain("K:clef=perc");
    expect(renderedAbc).not.toContain("P:A");
    expect(renderedAbc).not.toContain("P:B");
    expect(renderedAbc).toContain(
      Array.from({ length: 4 }, () => "C2 A2 C2 A2").join(" | ")
    );
    expect(renderedAbc).toContain(
      Array.from({ length: 4 }, () => "C2 c2 C2 c2").join(" | ")
    );

    const renderedBodyBars = renderedAbc
      .split("\n")
      .filter((line) => !/^[A-Z]:/.test(line))
      .flatMap((line) =>
        line
          .replace(/^\s*\|:?\s*/, "")
          .replace(/\s*:?[|]\s*$/, "")
          .split("|")
          .map((segment) => segment.trim())
          .filter(Boolean)
      );

    expect(renderedBodyBars).toEqual([
      ...Array.from({ length: 8 }, () => "C2 A2 C2 A2"),
      ...Array.from({ length: 8 }, () => "C2 c2 C2 c2"),
    ]);
  });

  it("trims extra labeled accompaniment parts to the tune structure", async () => {
    const fullTrackAbc = [
      "X:1",
      "T:Three Part Pattern",
      "M:4/4",
      "L:1/8",
      "K:clef=perc",
      "P:A",
      "| A2 | A3 |",
      "P:B",
      "| B2 | B3 |",
      "P:C",
      "| C2 | C3 |",
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

    render(() => <RhythmPlayer tuneTypeName="Reel" structure="A2B2" />);

    await waitFor(() => {
      expect(mocked.updateRhythmAbcMock).toHaveBeenCalled();
    });

    expect(mocked.updateRhythmAbcMock.mock.calls.at(-1)?.[0]).toContain(
      "| A2 | A3 | B2 | B3 |"
    );
    expect(mocked.updateRhythmAbcMock.mock.calls.at(-1)?.[0]).not.toContain(
      "C2"
    );
  });

  it("wraps labeled accompaniment parts when the tune has more distinct sections", async () => {
    const fullTrackAbc = [
      "X:1",
      "T:Two Part Pattern",
      "M:4/4",
      "L:1/8",
      "K:clef=perc",
      "P:A",
      "| A2 |",
      "P:B",
      "| B2 |",
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

    render(() => <RhythmPlayer tuneTypeName="Reel" structure="A1B1C1D1E1" />);

    await waitFor(() => {
      expect(mocked.updateRhythmAbcMock).toHaveBeenCalled();
    });

    expect(mocked.updateRhythmAbcMock.mock.calls.at(-1)?.[0]).toContain(
      "| A2 | B2 | A2 | B2 | A2 |"
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
    expect(renderedAbc).not.toContain("P:A");
    expect(renderedAbc).not.toContain("P:B");
    expect(renderedAbc).toContain(
      "|: C2 c C c c | C2 c C c c | C2 c C c c | C2 c C c c |"
    );
    expect(renderedAbc).toContain(
      "| C2 c C c c | C2 c C c c | C2 c C c c | C2 c C c c :|"
    );
    expect(renderedAbc).not.toContain("$");
    expect(renderedAbc).not.toContain("T:");
  });
});
