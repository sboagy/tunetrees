import Database from "better-sqlite3";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { createRoot } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SqliteDatabase } from "@/lib/db/client-sqlite";
import {
  createRhythmService,
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

function createPremiumLoopRhythmDb() {
  return createDb([
    "CREATE TABLE genre (id TEXT PRIMARY KEY, name TEXT)",
    "CREATE TABLE tune_type (id TEXT PRIMARY KEY, name TEXT, rhythm TEXT, description TEXT)",
    "CREATE TABLE genre_tune_type (genre_id TEXT NOT NULL, tune_type_id TEXT NOT NULL, default_bpm INTEGER, PRIMARY KEY (genre_id, tune_type_id))",
    "CREATE TABLE rhythm_patterns (id TEXT PRIMARY KEY, genre_id TEXT, tune_type_id TEXT NOT NULL, name TEXT NOT NULL, part_target TEXT DEFAULT '*', abc_string TEXT NOT NULL, is_default INTEGER NOT NULL DEFAULT 0, premium_audio_url TEXT, sample_kit TEXT NOT NULL DEFAULT 'bodhran')",
    "INSERT INTO genre (id, name) VALUES ('ITRAD', 'Irish Traditional')",
    "INSERT INTO tune_type (id, name, rhythm, description) VALUES ('Reel', 'Reel', '4/4', 'Reel rhythm')",
    "INSERT INTO genre_tune_type (genre_id, tune_type_id, default_bpm) VALUES ('ITRAD', 'Reel', 112)",
    `INSERT INTO rhythm_patterns (id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit)
      VALUES ('rp-1', 'ITRAD', 'Reel', 'Basic Rolling', '*', 'X:1
T:Reel Groove
M:4/4
L:1/8
K:clef=perc
|: C2 A2 C2 A2 :|', 1, NULL, 'bodhran')`,
  ]);
}

function createSampleKitRhythmDb() {
  return createDb([
    "CREATE TABLE genre (id TEXT PRIMARY KEY, name TEXT)",
    "CREATE TABLE tune_type (id TEXT PRIMARY KEY, name TEXT, rhythm TEXT, description TEXT)",
    "CREATE TABLE genre_tune_type (genre_id TEXT NOT NULL, tune_type_id TEXT NOT NULL, default_bpm INTEGER, PRIMARY KEY (genre_id, tune_type_id))",
    "CREATE TABLE rhythm_patterns (id TEXT PRIMARY KEY, genre_id TEXT, tune_type_id TEXT NOT NULL, name TEXT NOT NULL, part_target TEXT DEFAULT '*', abc_string TEXT NOT NULL, is_default INTEGER NOT NULL DEFAULT 0, premium_audio_url TEXT, sample_kit TEXT NOT NULL DEFAULT 'bodhran')",
    "INSERT INTO genre (id, name) VALUES ('TEST', 'Session Test')",
    "INSERT INTO tune_type (id, name, rhythm, description) VALUES ('Reel', 'Reel', '4/4', 'Reel rhythm')",
    "INSERT INTO genre_tune_type (genre_id, tune_type_id, default_bpm) VALUES ('TEST', 'Reel', 112)",
    `INSERT INTO rhythm_patterns (id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit)
      VALUES ('rp-1', 'TEST', 'Reel', 'Basic Rolling', '*', 'X:1
T:Reel Groove
M:4/4
L:1/8
K:clef=perc
|: C2 A2 C2 A2 :|', 1, NULL, 'bodhran')`,
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
    "CREATE TABLE genre (id TEXT PRIMARY KEY, name TEXT)",
    "CREATE TABLE tune_type (id TEXT PRIMARY KEY, name TEXT, rhythm TEXT, description TEXT)",
    "CREATE TABLE genre_tune_type (genre_id TEXT NOT NULL, tune_type_id TEXT NOT NULL, default_bpm INTEGER, PRIMARY KEY (genre_id, tune_type_id))",
    "INSERT INTO genre (id, name) VALUES ('ITRAD', 'Irish Traditional')",
    "INSERT INTO tune_type (id, name, rhythm, description) VALUES ('Jig', 'Jig', '6/8', 'Jig rhythm')",
    "INSERT INTO genre_tune_type (genre_id, tune_type_id, default_bpm) VALUES ('ITRAD', 'Jig', 115)",
  ]);
}

function createFallbackPolkaRhythmDb() {
  return createDb([
    "CREATE TABLE genre (id TEXT PRIMARY KEY, name TEXT)",
    "CREATE TABLE tune_type (id TEXT PRIMARY KEY, name TEXT, rhythm TEXT, description TEXT)",
    "CREATE TABLE genre_tune_type (genre_id TEXT NOT NULL, tune_type_id TEXT NOT NULL, default_bpm INTEGER, PRIMARY KEY (genre_id, tune_type_id))",
    "INSERT INTO genre (id, name) VALUES ('ITRAD', 'Irish Traditional')",
    "INSERT INTO tune_type (id, name, rhythm, description) VALUES ('Polka', 'Polka', '2/4', 'Polka rhythm')",
    "INSERT INTO genre_tune_type (genre_id, tune_type_id, default_bpm) VALUES ('ITRAD', 'Polka', 120)",
  ]);
}

function createRhythmDbWithoutPatternRow() {
  return createDb([
    "CREATE TABLE genre (id TEXT PRIMARY KEY, name TEXT)",
    "CREATE TABLE tune_type (id TEXT PRIMARY KEY, name TEXT, rhythm TEXT, description TEXT)",
    "CREATE TABLE genre_tune_type (genre_id TEXT NOT NULL, tune_type_id TEXT NOT NULL, default_bpm INTEGER, PRIMARY KEY (genre_id, tune_type_id))",
    "CREATE TABLE rhythm_patterns (id TEXT PRIMARY KEY, genre_id TEXT, tune_type_id TEXT NOT NULL, name TEXT NOT NULL, part_target TEXT DEFAULT '*', abc_string TEXT NOT NULL, is_default INTEGER NOT NULL DEFAULT 0, premium_audio_url TEXT, sample_kit TEXT NOT NULL DEFAULT 'bodhran')",
    "INSERT INTO genre (id, name) VALUES ('ITRAD', 'Irish Traditional')",
    "INSERT INTO tune_type (id, name, rhythm, description) VALUES ('Reel', 'Reel', '4/4', 'Reel rhythm')",
    "INSERT INTO genre_tune_type (genre_id, tune_type_id, default_bpm) VALUES ('ITRAD', 'Reel', 112)",
  ]);
}

function createRhythmDbWithLegacyPatternColumns() {
  return createDb([
    "CREATE TABLE genre (id TEXT PRIMARY KEY, name TEXT)",
    "CREATE TABLE tune_type (id TEXT PRIMARY KEY, name TEXT, rhythm TEXT, description TEXT)",
    "CREATE TABLE genre_tune_type (genre_id TEXT NOT NULL, tune_type_id TEXT NOT NULL, default_bpm INTEGER, PRIMARY KEY (genre_id, tune_type_id))",
    "CREATE TABLE rhythm_patterns (id TEXT PRIMARY KEY, tune_type_id TEXT NOT NULL, abc_string TEXT NOT NULL)",
    "INSERT INTO genre (id, name) VALUES ('ITRAD', 'Irish Traditional')",
    "INSERT INTO tune_type (id, name, rhythm, description) VALUES ('Reel', 'Reel', '4/4', 'Reel rhythm')",
    "INSERT INTO genre_tune_type (genre_id, tune_type_id, default_bpm) VALUES ('ITRAD', 'Reel', 112)",
  ]);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("loadRhythmPatternMetadata", () => {
  it("prefers rhythm_patterns and genre_tune_type.default_bpm when available", async () => {
    const db = createPremiumLoopRhythmDb();

    const metadata = await loadRhythmPatternMetadata(
      db,
      {
        genreName: "Irish Traditional",
        tuneTypeName: "Reel",
      },
      {
        sampleBaseUrl: "",
      }
    );

    expect(metadata).toMatchObject({
      genreName: "Irish Traditional",
      tuneTypeName: "Reel",
      tempoQpm: 112,
      sampleKit: "bodhran",
      premiumAudioSource: "registry",
      premiumAudioSourceTempoQpm: 110,
      source: "rhythm_patterns",
    });
    expect(metadata?.rhythmAbc).toContain("Reel Groove");
    expect(metadata?.premiumAudioUrl).toBe(
      "/audio/loops/ITRAD/bodhran/santigaitero/A4.mp3"
    );
  });

  it("falls back to generated ABC when rhythm_patterns has no matching row", async () => {
    const db = createRhythmDbWithoutPatternRow();

    const metadata = await loadRhythmPatternMetadata(
      db,
      {
        genreName: "Irish Traditional",
        tuneTypeName: "Reel",
      },
      {
        sampleBaseUrl: "",
      }
    );

    expect(metadata).toMatchObject({
      genreName: "Irish Traditional",
      tuneTypeName: "Reel",
      tempoQpm: 112,
      sampleKit: "generic_click",
      premiumAudioSource: "registry",
      premiumAudioSourceTempoQpm: 110,
      source: "tune_type_fallback",
    });
    expect(metadata?.rhythmAbc).toContain("M:4/4");
    expect(metadata?.premiumAudioUrl).toBe(
      "/audio/loops/ITRAD/bodhran/santigaitero/A4.mp3"
    );
  });

  it("falls back when rhythm_patterns exists with an older partial schema", async () => {
    const db = createRhythmDbWithLegacyPatternColumns();

    const metadata = await loadRhythmPatternMetadata(
      db,
      {
        genreName: "Irish Traditional",
        tuneTypeName: "Reel",
      },
      {
        sampleBaseUrl: "",
      }
    );

    expect(metadata).toMatchObject({
      genreName: "Irish Traditional",
      tuneTypeName: "Reel",
      tempoQpm: 112,
      sampleKit: "generic_click",
      premiumAudioSource: "registry",
      premiumAudioSourceTempoQpm: 110,
      source: "tune_type_fallback",
    });
    expect(metadata?.rhythmAbc).toContain("M:4/4");
    expect(metadata?.premiumAudioUrl).toBe(
      "/audio/loops/ITRAD/bodhran/santigaitero/A4.mp3"
    );
  });

  it("resolves the nearest uploaded jig premium loop from the registry", async () => {
    const db = createFallbackJigRhythmDb();

    const metadata = await loadRhythmPatternMetadata(
      db,
      {
        genreName: "Irish Traditional",
        tuneTypeName: "Jig",
      },
      {
        sampleBaseUrl: "",
      }
    );

    expect(metadata).toMatchObject({
      genreName: "Irish Traditional",
      tuneTypeName: "Jig",
      tempoQpm: 115,
      sampleKit: "generic_click",
      premiumAudioSource: "registry",
      premiumAudioSourceTempoQpm: 110,
      source: "tune_type_fallback",
    });
    expect(metadata?.premiumAudioUrl).toBe(
      "/audio/loops/ITRAD/bodhran/santigaitero/A5.mp3"
    );
  });

  it("resolves the uploaded polka premium loop from the registry", async () => {
    const db = createFallbackPolkaRhythmDb();

    const metadata = await loadRhythmPatternMetadata(
      db,
      {
        genreName: "Irish Traditional",
        tuneTypeName: "Polka",
      },
      {
        sampleBaseUrl: "",
      }
    );

    expect(metadata).toMatchObject({
      genreName: "Irish Traditional",
      tuneTypeName: "Polka",
      tempoQpm: 120,
      sampleKit: "generic_click",
      premiumAudioSource: "registry",
      premiumAudioSourceTempoQpm: 120,
      source: "tune_type_fallback",
    });
    expect(metadata?.premiumAudioUrl).toBe(
      "/audio/loops/ITRAD/bodhran/santigaitero/F3.mp3"
    );
  });

  it("prefixes registry loop URLs with the configured public R2 base URL", async () => {
    const db = createPremiumLoopRhythmDb();

    const metadata = await loadRhythmPatternMetadata(
      db,
      {
        genreName: "Irish Traditional",
        tuneTypeName: "Reel",
      },
      {
        sampleBaseUrl: "https://pub-c77b0e0025a0474588b12433d1a025db.r2.dev",
      }
    );

    expect(metadata?.premiumAudioUrl).toBe(
      "https://pub-c77b0e0025a0474588b12433d1a025db.r2.dev/audio/loops/ITRAD/bodhran/santigaitero/A4.mp3"
    );
  });

  it("falls back to generated percussion ABC and default tempo when new tables are absent", async () => {
    const db = createFallbackRhythmDb();

    const metadata = await loadRhythmPatternMetadata(
      db,
      {
        tuneTypeName: "Reel",
      },
      {
        sampleBaseUrl: "",
      }
    );

    expect(metadata).toMatchObject({
      genreName: null,
      tuneTypeName: "Reel",
      tempoQpm: 100,
      source: "tune_type_fallback",
    });
    expect(metadata?.rhythmAbc).toContain("M:4/4");
    expect(metadata?.rhythmAbc).toContain("K:clef=perc");
  });
});

describe("createRhythmService", () => {
  it("plays mapped bodhran samples and restarts timing callbacks when tempo changes", async () => {
    const db = createSampleKitRhythmDb();
    const fetchMock = vi.fn(async (_url: string) => ({
      ok: true,
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
      sampleRate = 44_100;
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
      createBuffer = vi.fn(
        (_channels: number, length: number, sampleRate: number) => {
          const data = new Float32Array(length);
          return {
            duration: length / sampleRate,
            length,
            numberOfChannels: 1,
            sampleRate,
            getChannelData: vi.fn(() => data),
          } as unknown as AudioBuffer;
        }
      );
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
            gain: { value: 1 },
            connect: vi.fn(),
          }) as unknown as GainNode
      );
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
        sampleBaseUrl: "",
        fetchImpl: fetchMock as unknown as typeof fetch,
      });
    });

    const metadata = await service.loadPattern({
      genreName: "Session Test",
      tuneTypeName: "Reel",
    });

    expect(metadata?.tempoQpm).toBe(112);

    await service.play();

    expect(service.isPlaying()).toBe(true);
    expect(service.isReady()).toBe(true);
    expect(service.currentBeatIndex()).toBe(1);
    expect(service.currentMeasure()).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/audio/kits/bodhran/bass.mp3");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/audio/kits/bodhran/rim.mp3");
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

  it("plays premium loop audio when a registry-mapped loop exists", async () => {
    const db = createPremiumLoopRhythmDb();
    const fetchMock = vi.fn();
    const createdAudio: Array<{
      crossOrigin: string | null;
      currentTime: number;
      loop: boolean;
      pause: ReturnType<typeof vi.fn>;
      play: ReturnType<typeof vi.fn>;
      playbackRate: number;
      preload: string;
      src: string;
    }> = [];

    class FakeAudioContext {
      state: AudioContextState = "suspended";
      currentTime = 0;
      sampleRate = 44_100;
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
      createBuffer = vi.fn(
        (_channels: number, length: number, sampleRate: number) => {
          const data = new Float32Array(length);
          return {
            duration: length / sampleRate,
            length,
            numberOfChannels: 1,
            sampleRate,
            getChannelData: vi.fn(() => data),
          } as unknown as AudioBuffer;
        }
      );
      createBufferSource = vi.fn(() => {
        throw new Error(
          "sample buffers should not be used for premium loop playback"
        );
      });
      createGain = vi.fn(
        () =>
          ({
            gain: { value: 1 },
            connect: vi.fn(),
          }) as unknown as GainNode
      );
      close = vi.fn(async () => {
        this.state = "closed";
      });
    }

    class FakeTimingCallbacks {
      static instances: FakeTimingCallbacks[] = [];
      startedWith: Array<{ position?: number; units?: string }> = [];
      paused = false;
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
          midiPitches: [{ pitch: 60 }],
          elements: [[]],
        });
      }

      pause() {
        this.paused = true;
      }

      reset() {}

      stop() {}

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
        sampleBaseUrl: "",
        audioElementFactory: (src) => {
          const element = {
            crossOrigin: null,
            currentTime: 0,
            loop: false,
            pause: vi.fn(),
            play: vi.fn(async () => undefined),
            playbackRate: 1,
            preload: "none",
            src,
          };
          createdAudio.push(element);
          return element as unknown as HTMLAudioElement;
        },
        fetchImpl: fetchMock as unknown as typeof fetch,
      });
    });

    const metadata = await service.loadPattern({
      genreName: "Irish Traditional",
      tuneTypeName: "Reel",
    });

    expect(metadata?.premiumAudioUrl).toBe(
      "/audio/loops/ITRAD/bodhran/santigaitero/A4.mp3"
    );

    await service.play();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(createdAudio).toHaveLength(1);
    expect(createdAudio[0]?.src).toBe(
      "/audio/loops/ITRAD/bodhran/santigaitero/A4.mp3"
    );
    expect(createdAudio[0]?.loop).toBe(true);
    expect(createdAudio[0]?.crossOrigin).toBe("anonymous");
    expect(createdAudio[0]?.preload).toBe("auto");
    expect(createdAudio[0]?.play).toHaveBeenCalledTimes(1);
    expect(createdAudio[0]?.playbackRate).toBeCloseTo(112 / 110, 6);
    expect(service.currentBeatIndex()).toBe(1);
    expect(service.currentMeasure()).toBe(1);

    FakeTimingCallbacks.instances[0]!.currentPositionMs = 1500;
    await service.setTempoQpm(132);

    expect(createdAudio).toHaveLength(2);
    expect(createdAudio[1]?.src).toBe(
      "/audio/loops/ITRAD/bodhran/santigaitero/C6.mp3"
    );
    expect(createdAudio[1]?.playbackRate).toBeCloseTo(132 / 130, 6);
    expect(FakeTimingCallbacks.instances[1]?.startedWith[0]).toMatchObject({
      position: 1.5,
      units: "seconds",
    });

    service.pause();

    expect(createdAudio[1]?.pause).toHaveBeenCalledTimes(1);
    expect(service.isPlaying()).toBe(false);

    dispose();
  });

  it("uses synthesized generic clicks when no uploaded kit applies", async () => {
    const db = createFallbackRhythmDb();
    const fetchMock = vi.fn();

    const bufferSources: Array<{
      buffer: AudioBuffer | null;
      connect: ReturnType<typeof vi.fn>;
      start: ReturnType<typeof vi.fn>;
    }> = [];

    class FakeAudioContext {
      state: AudioContextState = "suspended";
      currentTime = 0;
      sampleRate = 44_100;
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
      createBuffer = vi.fn(
        (_channels: number, length: number, sampleRate: number) => {
          const data = new Float32Array(length);
          return {
            duration: length / sampleRate,
            length,
            numberOfChannels: 1,
            sampleRate,
            getChannelData: vi.fn(() => data),
          } as unknown as AudioBuffer;
        }
      );
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
            gain: { value: 1 },
            connect: vi.fn(),
          }) as unknown as GainNode
      );
      close = vi.fn(async () => {
        this.state = "closed";
      });
    }

    class FakeTimingCallbacks {
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
      }

      start() {
        this.options.eventCallback?.({
          type: "event",
          measureStart: true,
          measureNumber: 1,
          midiPitches: [{ pitch: 60 }, { pitch: 69 }],
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
        sampleBaseUrl: "",
        fetchImpl: fetchMock as unknown as typeof fetch,
      });
    });

    const metadata = await service.loadPattern({
      tuneTypeName: "Reel",
    });

    expect(metadata?.sampleKit).toBe("generic_click");

    await service.play();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(bufferSources).toHaveLength(2);
    expect(bufferSources[0]?.start).toHaveBeenCalledTimes(1);
    expect(bufferSources[1]?.start).toHaveBeenCalledTimes(1);

    dispose();
  });
});
