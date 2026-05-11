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

function createReferenceRhythmDb() {
  return createDb([
    "CREATE TABLE genre (id TEXT PRIMARY KEY, name TEXT)",
    "CREATE TABLE tune_type (id TEXT PRIMARY KEY, name TEXT, rhythm TEXT, description TEXT)",
    "CREATE TABLE genre_tune_type (genre_id TEXT NOT NULL, tune_type_id TEXT NOT NULL, tempo INTEGER, PRIMARY KEY (genre_id, tune_type_id))",
    "CREATE TABLE rhythm_patterns (id TEXT PRIMARY KEY, genre_id TEXT, tune_type_id TEXT NOT NULL, rhythm_abc TEXT, sample_kit TEXT, tune_structure TEXT)",
    "INSERT INTO genre (id, name) VALUES ('ITRAD', 'Irish Traditional')",
    "INSERT INTO tune_type (id, name, rhythm, description) VALUES ('Reel', 'Reel', '4/4', 'Reel rhythm')",
    "INSERT INTO genre_tune_type (genre_id, tune_type_id, tempo) VALUES ('ITRAD', 'Reel', 112)",
    `INSERT INTO rhythm_patterns (id, genre_id, tune_type_id, rhythm_abc, sample_kit, tune_structure)
      VALUES ('rp-1', 'ITRAD', 'Reel', 'X:1
T:Reel Groove
M:4/4
L:1/8
K:clef=perc
|: C2 A2 C2 A2 :|', 'bodhran_bosone', 'AABB')`,
  ]);
}

function createFallbackRhythmDb() {
  return createDb([
    "CREATE TABLE tune_type (id TEXT PRIMARY KEY, name TEXT, rhythm TEXT, description TEXT)",
    "INSERT INTO tune_type (id, name, rhythm, description) VALUES ('Reel', 'Reel', '4/4', 'Reel rhythm')",
  ]);
}

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
      tempoQpm: 100,
      source: "tune_type_fallback",
    });
    expect(metadata?.rhythmAbc).toContain("M:4/4");
    expect(metadata?.rhythmAbc).toContain("K:clef=perc");
  });
});

describe("createRhythmService", () => {
  it("plays mapped bodhran samples and restarts timing callbacks when tempo changes", async () => {
    const db = createReferenceRhythmDb();
    const fetchMock = vi.fn(async () => ({
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
});
