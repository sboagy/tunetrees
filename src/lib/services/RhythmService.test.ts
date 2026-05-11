import Database from "better-sqlite3";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { createRoot } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SqliteDatabase } from "@/lib/db/client-sqlite";
import {
  createRhythmService,
  expandRhythmAbc,
  loadRhythmPatternMetadata,
} from "./RhythmService";

function createDb(sqlStatements: string[]): SqliteDatabase {
  const sqlite = new Database(":memory:");
  const db = drizzle(sqlite);

  for (const statement of sqlStatements) {
    db.run(sql.raw(statement));
  }

  return db as unknown as SqliteDatabase;
}

function createReferenceRhythmDb() {
  return createDb([
    "CREATE TABLE genre (id TEXT PRIMARY KEY, name TEXT)",
    "CREATE TABLE tune_type (id TEXT PRIMARY KEY, name TEXT, rhythm TEXT, description TEXT)",
    "CREATE TABLE genre_tune_type (genre_id TEXT NOT NULL, tune_type_id TEXT NOT NULL, tempo INTEGER, PRIMARY KEY (genre_id, tune_type_id))",
    "CREATE TABLE rhythm_patterns (id TEXT PRIMARY KEY, genre_id TEXT, tune_type_id TEXT NOT NULL, rhythm_abc TEXT, sample_kit TEXT, tune_structure TEXT)",
    "INSERT INTO genre (id, name) VALUES ('ITRAD', 'Irish Traditional')",
    "INSERT INTO tune_type (id, name, rhythm, description) VALUES ('Reel', 'Reel', '4/4', 'Reel rhythm')",
    "INSERT INTO tune_type (id, name, rhythm, description) VALUES ('JigD', 'Jig', '6/8', 'Double jig rhythm')",
    "INSERT INTO genre_tune_type (genre_id, tune_type_id, tempo) VALUES ('ITRAD', 'Reel', 112)",
    "INSERT INTO genre_tune_type (genre_id, tune_type_id, tempo) VALUES ('ITRAD', 'JigD', 108)",
    `INSERT INTO rhythm_patterns (id, genre_id, tune_type_id, rhythm_abc, sample_kit, tune_structure)
      VALUES ('rp-1', 'ITRAD', 'Reel', 'X:1
T:Reel Groove
M:4/4
L:1/8
K:clef=perc
|: C2 A2 C2 A2 :|', 'bodhran_bosone', 'AABB')`,
    `INSERT INTO rhythm_patterns (id, genre_id, tune_type_id, rhythm_abc, sample_kit, tune_structure)
      VALUES ('rp-2', 'ITRAD', 'JigD', 'X:1
T:Jig Groove
M:6/8
L:1/8
K:clef=perc
|: C2A A2A :|', 'bodhran_bosone', 'AABB')`,
  ]);
}

function createFallbackRhythmDb() {
  return createDb([
    "CREATE TABLE tune_type (id TEXT PRIMARY KEY, name TEXT, rhythm TEXT, description TEXT)",
    "INSERT INTO tune_type (id, name, rhythm, description) VALUES ('Reel', 'Reel', '4/4', 'Reel rhythm')",
  ]);
}

function createFallbackJigRhythmDb() {
  return createDb([
    "CREATE TABLE tune_type (id TEXT PRIMARY KEY, name TEXT, rhythm TEXT, description TEXT)",
    "INSERT INTO tune_type (id, name, rhythm, description) VALUES ('JigD', 'Jig', '6/8', 'Double jig rhythm')",
  ]);
}

const REEL_RHYTHM_ABC = [
  "X:1",
  "T:Reel Groove",
  "M:4/4",
  "L:1/8",
  "K:clef=perc",
  "|: C2 A2 C2 A2 :|",
].join("\n");

afterEach(() => {
  vi.restoreAllMocks();
});

describe("loadRhythmPatternMetadata", () => {
  it("prefers rhythm_patterns and genre_tune_type.tempo when available", async () => {
    const db = createReferenceRhythmDb();

    const metadata = await loadRhythmPatternMetadata(db, {
      genreName: "Irish Traditional",
      tuneTypeName: "Reel",
    });

    expect(metadata).toMatchObject({
      genreName: "Irish Traditional",
      tuneTypeName: "Reel",
      tuneStructure: "AABB",
      tempoQpm: 112,
      sampleKit: "bodhran_bosone",
      source: "rhythm_patterns",
    });
    expect(metadata?.rhythmAbc).toContain("Reel Groove");
  });

  it("falls back to generated percussion ABC and default tempo when new tables are absent", async () => {
    const db = createFallbackRhythmDb();

    const metadata = await loadRhythmPatternMetadata(db, {
      tuneTypeName: "Reel",
    });

    expect(metadata).toMatchObject({
      genreName: null,
      tuneTypeName: "Reel",
      tuneStructure: null,
      tempoQpm: 100,
      source: "tune_type_fallback",
    });
    expect(metadata?.rhythmAbc).toContain("M:4/4");
    expect(metadata?.rhythmAbc).toContain("K:clef=perc");
  });

  it("matches tune type and genre lookups by id when the UI passes code-style labels", async () => {
    const db = createReferenceRhythmDb();

    const metadata = await loadRhythmPatternMetadata(db, {
      genreName: "ITRAD",
      tuneTypeName: "JigD",
    });

    expect(metadata).toMatchObject({
      genreName: "Irish Traditional",
      tuneTypeName: "Jig",
      tuneStructure: "AABB",
      tempoQpm: 108,
      sampleKit: "bodhran_bosone",
      source: "rhythm_patterns",
    });
    expect(metadata?.rhythmAbc).toContain("Jig Groove");
    expect(metadata?.rhythmSignature).toBe("6/8");
  });

  it("uses a denser compound-meter fallback when stored rhythm patterns are unavailable", async () => {
    const db = createFallbackJigRhythmDb();

    const metadata = await loadRhythmPatternMetadata(db, {
      tuneTypeName: "JigD",
    });

    expect(metadata).toMatchObject({
      tuneTypeName: "Jig",
      rhythmSignature: "6/8",
      source: "tune_type_fallback",
    });
    expect(metadata?.rhythmAbc).toContain("|: !accent!C A A C A A :|");
  });
});

describe("expandRhythmAbc", () => {
  it("wraps explicit AABB expansion into four-bar lines", () => {
    const expanded = expandRhythmAbc(REEL_RHYTHM_ABC, 16, 4, "AABB");
    const bodyLines = expanded.split("\n").filter((line) => line.includes("|"));

    expect(bodyLines).toHaveLength(8);
    expect(
      bodyLines[0]?.split("|").filter((part) => part.trim().length > 0)
    ).toHaveLength(4);
    expect(
      bodyLines[1]?.split("|").filter((part) => part.trim().length > 0)
    ).toHaveLength(4);
  });

  it("reuses unique section material when the source phrase covers A then B", () => {
    const expanded = expandRhythmAbc(
      [
        "X:1",
        "M:4/4",
        "L:1/8",
        "K:clef=perc",
        "A1 | A2 | A3 | A4 | A5 | A6 | A7 | A8 | B1 | B2 | B3 | B4 | B5 | B6 | B7 | B8 |",
      ].join("\n"),
      32,
      4,
      "AABB"
    );
    const bodyLines = expanded.split("\n").filter((line) => line.includes("|"));

    expect(bodyLines[0]).toContain("A1 | A2 | A3 | A4 |");
    expect(bodyLines[1]).toContain("A5 | A6 | A7 | A8 |");
    expect(bodyLines[4]).toContain("B1 | B2 | B3 | B4 |");
    expect(bodyLines[5]).toContain("B5 | B6 | B7 | B8 |");
  });
});

describe("createRhythmService", () => {
  it("plays mapped bodhran samples and restarts timing callbacks when tempo changes", async () => {
    const db = createReferenceRhythmDb();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "content-type" ? "audio/mpeg" : null,
      },
      arrayBuffer: async () => new ArrayBuffer(16),
    }));

    const bufferSources: Array<{
      buffer: AudioBuffer | null;
      connect: ReturnType<typeof vi.fn>;
      start: ReturnType<typeof vi.fn>;
    }> = [];

    class FakeAudioContext {
      state: AudioContextState = "suspended";
      currentTime = 0;
      destination = {};
      resume = vi.fn(async () => {
        this.state = "running";
      });
      decodeAudioData = vi.fn(async () => ({
        duration: 0.25,
        length: 1,
        numberOfChannels: 1,
        sampleRate: 44_100,
      })) as unknown as typeof AudioContext.prototype.decodeAudioData;
      createBufferSource = vi.fn(() => {
        const source = {
          buffer: null as AudioBuffer | null,
          connect: vi.fn(),
          start: vi.fn(),
        };
        bufferSources.push(source);
        return source as unknown as AudioBufferSourceNode;
      });
      createGain = vi.fn(
        () =>
          ({
            gain: {
              value: 1,
              setValueAtTime: vi.fn(),
              exponentialRampToValueAtTime: vi.fn(),
            },
            connect: vi.fn(),
          }) as unknown as GainNode
      );
      createOscillator = vi.fn(() => {
        const osc = {
          type: "sine" as OscillatorType,
          frequency: { value: 800 },
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        };
        return osc as unknown as OscillatorNode;
      });
      close = vi.fn(async () => {
        this.state = "closed";
      });
    }

    class FakeTimingCallbacks {
      static instances: FakeTimingCallbacks[] = [];
      startedWith: Array<{ position?: number; units?: string }> = [];
      paused = false;
      stopped = false;
      currentPositionMs = 0;
      readonly options: {
        qpm?: number;
        beatCallback?: (beatNumber: number) => void;
        eventCallback?: (event: {
          type: "event";
          measureStart: boolean;
          measureNumber: number;
          midiPitches: Array<{ pitch: number }>;
          elements: HTMLElement[][];
        }) => void;
      };

      constructor(
        _visualObj: unknown,
        options: {
          qpm?: number;
          beatCallback?: (beatNumber: number) => void;
          eventCallback?: (event: {
            type: "event";
            measureStart: boolean;
            measureNumber: number;
            midiPitches: Array<{ pitch: number }>;
            elements: HTMLElement[][];
          }) => void;
        }
      ) {
        this.options = options;
        FakeTimingCallbacks.instances.push(this);
      }

      start(position?: number, units?: string) {
        this.startedWith.push({ position, units });
        this.currentPositionMs = (position ?? 0) * 1000;
        this.options.beatCallback?.(1);
        this.options.eventCallback?.({
          type: "event",
          measureStart: true,
          measureNumber: 1,
          midiPitches: [{ pitch: 60 }, { pitch: 69 }],
          elements: [[]],
        });
      }

      pause() {
        this.paused = true;
      }

      reset() {}

      stop() {
        this.stopped = true;
      }

      currentMillisecond() {
        return this.currentPositionMs;
      }
    }

    const fakeAbcjs = {
      renderAbc: vi.fn(
        () => [{}] as unknown as ReturnType<typeof import("abcjs").renderAbc>
      ),
      TimingCallbacks:
        FakeTimingCallbacks as unknown as typeof import("abcjs").TimingCallbacks,
    };

    const audioContext = new FakeAudioContext() as unknown as AudioContext;

    let dispose = () => {};
    const service = createRoot((nextDispose) => {
      dispose = nextDispose;
      return createRhythmService({
        db,
        abcjsModule: fakeAbcjs,
        audioContext,
        fetchImpl: fetchMock as unknown as typeof fetch,
      });
    });

    const metadata = await service.loadPattern({
      genreName: "Irish Traditional",
      tuneTypeName: "Reel",
    });

    expect(metadata?.tempoQpm).toBe(112);

    await service.play();

    expect(service.isPlaying()).toBe(true);
    expect(service.isReady()).toBe(true);
    expect(service.currentBeatIndex()).toBe(1);
    expect(service.currentMeasure()).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(bufferSources).toHaveLength(2);
    expect(bufferSources[0]?.start).toHaveBeenCalledTimes(1);
    expect(bufferSources[1]?.start).toHaveBeenCalledTimes(1);
    expect(FakeTimingCallbacks.instances[0]?.options.qpm).toBe(112);

    FakeTimingCallbacks.instances[0]!.currentPositionMs = 1500;
    await service.setTempoQpm(132);

    expect(service.tempoQpm()).toBe(132);
    expect(FakeTimingCallbacks.instances).toHaveLength(2);
    expect(FakeTimingCallbacks.instances[1]?.options.qpm).toBe(132);
    expect(FakeTimingCallbacks.instances[1]?.startedWith[0]).toMatchObject({
      position: 1.5,
      units: "seconds",
    });

    service.pause();

    expect(service.isPlaying()).toBe(false);
    expect(FakeTimingCallbacks.instances[1]?.paused).toBe(true);

    dispose();
  });

  it("reports a detailed error when rhythm samples resolve to non-audio content", async () => {
    const db = createReferenceRhythmDb();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    class FakeAudioContext {
      state: AudioContextState = "suspended";
      currentTime = 0;
      destination = {};
      resume = vi.fn(async () => {
        this.state = "running";
      });
      decodeAudioData = vi.fn(async () => ({
        duration: 0.25,
        length: 1,
        numberOfChannels: 1,
        sampleRate: 44_100,
      })) as unknown as typeof AudioContext.prototype.decodeAudioData;
      createBufferSource = vi.fn();
      createGain = vi.fn();
      close = vi.fn(async () => {
        this.state = "closed";
      });
    }

    class FakeTimingCallbacks {
      start() {}
      pause() {}
      reset() {}
      stop() {}
      currentMillisecond() {
        return 0;
      }
    }

    const fakeAbcjs = {
      renderAbc: vi.fn(
        () => [{}] as unknown as ReturnType<typeof import("abcjs").renderAbc>
      ),
      TimingCallbacks:
        FakeTimingCallbacks as unknown as typeof import("abcjs").TimingCallbacks,
    };

    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "content-type" ? "text/html" : null,
      },
      arrayBuffer: async () => new ArrayBuffer(16),
    }));

    let dispose = () => {};
    const service = createRoot((nextDispose) => {
      dispose = nextDispose;
      return createRhythmService({
        db,
        abcjsModule: fakeAbcjs,
        audioContext: new FakeAudioContext() as unknown as AudioContext,
        fetchImpl: fetchMock as unknown as typeof fetch,
        sampleUrlBuilder: (sampleKit, fileName) =>
          `http://localhost:8787/api/rhythm-samples/view?kit=${sampleKit}&file=${fileName}`,
      });
    });

    await service.loadPattern({
      genreName: "Irish Traditional",
      tuneTypeName: "Reel",
    });

    await service.play();

    expect(service.error()).toContain(
      'Failed to load rhythm samples for kit "bodhran_bosone".'
    );
    expect(service.error()).toContain(
      "Received non-audio response while loading rhythm sample from http://localhost:8787/api/rhythm-samples/view?kit=bodhran_bosone&file=bass.mp3"
    );
    expect(consoleError).toHaveBeenCalledWith(
      "[RhythmService] start rhythm playback failed",
      expect.objectContaining({
        sampleKit: "bodhran_bosone",
        tuneTypeName: "Reel",
      })
    );

    dispose();
  });

  it("plays percussion events by parsing the ABC slice when midiPitches are empty", async () => {
    const db = createReferenceRhythmDb();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "content-type" ? "audio/mpeg" : null,
      },
      arrayBuffer: async () => new ArrayBuffer(16),
    }));
    const bufferSources: Array<{
      start: ReturnType<typeof vi.fn>;
    }> = [];
    const firstKickStart = REEL_RHYTHM_ABC.indexOf("C2");
    const firstRimStart = REEL_RHYTHM_ABC.indexOf("A2");

    class FakeAudioContext {
      state: AudioContextState = "running";
      currentTime = 0;
      destination = {};
      resume = vi.fn(async () => {
        this.state = "running";
      });
      decodeAudioData = vi.fn(async () => ({
        duration: 0.25,
        length: 1,
        numberOfChannels: 1,
        sampleRate: 44_100,
      })) as unknown as typeof AudioContext.prototype.decodeAudioData;
      createBufferSource = vi.fn(() => {
        const source = {
          buffer: null as AudioBuffer | null,
          connect: vi.fn(),
          start: vi.fn(),
        };
        bufferSources.push(source);
        return source as unknown as AudioBufferSourceNode;
      });
      createGain = vi.fn(
        () =>
          ({
            gain: {
              value: 1,
              setValueAtTime: vi.fn(),
              exponentialRampToValueAtTime: vi.fn(),
            },
            connect: vi.fn(),
          }) as unknown as GainNode
      );
      createOscillator = vi.fn(() => {
        const osc = {
          type: "sine" as OscillatorType,
          frequency: { value: 800 },
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        };
        return osc as unknown as OscillatorNode;
      });
      close = vi.fn(async () => {
        this.state = "closed";
      });
    }

    class FakeTimingCallbacks {
      private readonly options: {
        eventCallback?: (event: {
          type: "event";
          measureStart?: boolean;
          measureNumber?: number;
          midiPitches: Array<{ pitch: number }>;
          startChar: number;
          endChar: number;
          elements: HTMLElement[][];
        }) => void;
      };

      constructor(
        _visualObj: unknown,
        options: {
          eventCallback?: (event: {
            type: "event";
            measureStart?: boolean;
            measureNumber?: number;
            midiPitches: Array<{ pitch: number }>;
            startChar: number;
            endChar: number;
            elements: HTMLElement[][];
          }) => void;
        }
      ) {
        this.options = options;
      }

      start() {
        this.options.eventCallback?.({
          type: "event",
          measureStart: true,
          measureNumber: 1,
          midiPitches: [],
          startChar: firstKickStart,
          endChar: firstKickStart + 2,
          elements: [[]],
        });
        this.options.eventCallback?.({
          type: "event",
          measureStart: false,
          measureNumber: 1,
          midiPitches: [],
          startChar: firstRimStart,
          endChar: firstRimStart + 2,
          elements: [[]],
        });
      }

      pause() {}
      reset() {}
      stop() {}
      currentMillisecond() {
        return 0;
      }
    }

    const fakeAbcjs = {
      renderAbc: vi.fn(
        () => [{}] as unknown as ReturnType<typeof import("abcjs").renderAbc>
      ),
      TimingCallbacks:
        FakeTimingCallbacks as unknown as typeof import("abcjs").TimingCallbacks,
    };

    let dispose = () => {};
    const service = createRoot((nextDispose) => {
      dispose = nextDispose;
      return createRhythmService({
        db,
        abcjsModule: fakeAbcjs,
        audioContext: new FakeAudioContext() as unknown as AudioContext,
        fetchImpl: fetchMock as unknown as typeof fetch,
      });
    });

    await service.loadPattern({
      genreName: "Irish Traditional",
      tuneTypeName: "Reel",
    });

    await service.play();

    expect(bufferSources).toHaveLength(2);
    expect(bufferSources[0]?.start).toHaveBeenCalledTimes(1);
    expect(bufferSources[1]?.start).toHaveBeenCalledTimes(1);

    dispose();
  });

  it("uses a custom rhythm sample URL builder when loading samples", async () => {
    const db = createReferenceRhythmDb();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "content-type" ? "audio/mpeg" : null,
      },
      arrayBuffer: async () => new ArrayBuffer(16),
    }));

    class FakeAudioContext {
      state: AudioContextState = "suspended";
      currentTime = 0;
      destination = {};
      resume = vi.fn(async () => {
        this.state = "running";
      });
      decodeAudioData = vi.fn(async () => ({
        duration: 0.25,
        length: 1,
        numberOfChannels: 1,
        sampleRate: 44_100,
      })) as unknown as typeof AudioContext.prototype.decodeAudioData;
      createBufferSource = vi.fn(
        () =>
          ({
            buffer: null,
            connect: vi.fn(),
            start: vi.fn(),
          }) as unknown as AudioBufferSourceNode
      );
      createGain = vi.fn(
        () =>
          ({
            gain: {
              value: 1,
              setValueAtTime: vi.fn(),
              exponentialRampToValueAtTime: vi.fn(),
            },
            connect: vi.fn(),
          }) as unknown as GainNode
      );
      createOscillator = vi.fn(() => {
        const osc = {
          type: "sine" as OscillatorType,
          frequency: { value: 800 },
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        };
        return osc as unknown as OscillatorNode;
      });
      close = vi.fn(async () => {
        this.state = "closed";
      });
    }

    class FakeTimingCallbacks {
      start() {}
      pause() {}
      reset() {}
      stop() {}
      currentMillisecond() {
        return 0;
      }
    }

    const fakeAbcjs = {
      renderAbc: vi.fn(
        () => [{}] as unknown as ReturnType<typeof import("abcjs").renderAbc>
      ),
      TimingCallbacks:
        FakeTimingCallbacks as unknown as typeof import("abcjs").TimingCallbacks,
    };

    let dispose = () => {};
    const service = createRoot((nextDispose) => {
      dispose = nextDispose;
      return createRhythmService({
        db,
        abcjsModule: fakeAbcjs,
        audioContext: new FakeAudioContext() as unknown as AudioContext,
        fetchImpl: fetchMock as unknown as typeof fetch,
        sampleUrlBuilder: (sampleKit, fileName) =>
          `http://localhost:8787/api/rhythm-samples/view?kit=${sampleKit}&file=${fileName}`,
      });
    });

    await service.loadPattern({
      genreName: "Irish Traditional",
      tuneTypeName: "Reel",
    });

    await service.play();

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8787/api/rhythm-samples/view?kit=bodhran_bosone&file=bass.mp3",
      { cache: "reload" }
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8787/api/rhythm-samples/view?kit=bodhran_bosone&file=rim.mp3",
      { cache: "reload" }
    );

    dispose();
  });
});
