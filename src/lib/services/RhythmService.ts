import abcjs, {
  type AnimationOptions,
  type BeatCallback,
  type NoteTimingEvent,
  type TuneObject,
} from "abcjs";
import { sql } from "drizzle-orm";
import { type Accessor, createSignal, onCleanup } from "solid-js";
import type { SqliteDatabase } from "@/lib/db/client-sqlite";

const DEFAULT_SAMPLE_KIT = "bodhran_bosone";
const SAMPLE_FILE_BY_PITCH: Record<number, string> = {
  60: "bass.mp3",
  69: "rim.mp3",
};
const SAMPLE_PITCH_BY_ABC_NOTE: Record<string, number> = {
  c: 60,
  a: 69,
};
const COUNT_IN_MEASURES = 2;
const DEFAULT_TEMPO_BY_TYPE: Record<string, number> = {
  reel: 100,
  hornpipe: 90,
  jig: 115,
  "jig (single)": 105,
  "slip jig": 110,
  polka: 120,
};

export interface RhythmPatternRequest {
  genreName?: string | null;
  tuneTypeName?: string | null;
}

export interface RhythmPatternMetadata {
  genreName: string | null;
  tuneTypeName: string;
  rhythmAbc: string;
  rhythmSignature: string | null;
  tuneStructure: string | null;
  tempoQpm: number;
  sampleKit: string;
  source: "rhythm_patterns" | "tune_type_fallback";
}

export interface RhythmService {
  metadata: Accessor<RhythmPatternMetadata | null>;
  tempoQpm: Accessor<number>;
  isPlaying: Accessor<boolean>;
  isReady: Accessor<boolean>;
  currentBeatIndex: Accessor<number>;
  currentMeasure: Accessor<number>;
  error: Accessor<string | null>;
  loadPattern: (
    request: RhythmPatternRequest
  ) => Promise<RhythmPatternMetadata | null>;
  updateRhythmAbc: (abc: string) => void;
  play: () => Promise<void>;
  pause: () => void;
  restart: () => Promise<void>;
  togglePlayback: () => Promise<void>;
  setTempoQpm: (nextQpm: number) => Promise<void>;
}

export interface CreateRhythmServiceOptions {
  db: SqliteDatabase;
  abcjsModule?: Pick<typeof abcjs, "renderAbc" | "TimingCallbacks">;
  audioContext?: AudioContext;
  fetchImpl?: typeof fetch;
  sampleUrlBuilder?: (sampleKit: string, fileName: string) => string;
}

type ResolvedAbcjsModule = NonNullable<
  CreateRhythmServiceOptions["abcjsModule"]
>;
type TimingCallbacksInstance = InstanceType<
  ResolvedAbcjsModule["TimingCallbacks"]
>;

function normalizeTuneTypeName(value: string): string {
  return value.trim().toLowerCase();
}

function sanitizeAbcTitle(value: string): string {
  return value.replace(/[\r\n:|[\]]+/g, " ").trim() || "Rhythm";
}

async function tableExists(
  db: SqliteDatabase,
  tableName: string
): Promise<boolean> {
  const rows = await db.all<{ name: string }>(sql`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table' AND name = ${tableName}
    LIMIT 1
  `);

  return rows.length > 0;
}

async function getTableColumns(
  db: SqliteDatabase,
  tableName: string
): Promise<Set<string>> {
  const rows = await db.all<{ name: string }>(
    sql.raw(`PRAGMA table_info("${tableName}")`)
  );
  return new Set(rows.map((row) => row.name));
}

function getDefaultTempoForTuneType(tuneTypeName: string): number {
  return DEFAULT_TEMPO_BY_TYPE[normalizeTuneTypeName(tuneTypeName)] ?? 100;
}

function msToSeconds(value: number): number {
  return value / 1000;
}

function formatErrorMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback;
}

function reportRhythmError(
  action: string,
  cause: unknown,
  context?: Record<string, unknown>
): string {
  const message = formatErrorMessage(cause, `Failed to ${action}.`);
  console.error(`[RhythmService] ${action} failed`, {
    message,
    cause,
    ...context,
  });
  return message;
}

function buildFallbackRhythmAbc(
  tuneTypeName: string,
  rhythmSignature: string | null
): string {
  const meter = rhythmSignature?.trim() || "4/4";

  const patternByMeter: Record<
    string,
    { noteLength: string; pattern: string }
  > = {
    "2/4": { noteLength: "1/8", pattern: "|: !accent!C2 A2 :|" },
    "3/4": { noteLength: "1/8", pattern: "|: !accent!C2 A2 A2 :|" },
    "4/4": { noteLength: "1/8", pattern: "|: !accent!C2 A2 C2 A2 :|" },
    "6/8": { noteLength: "1/8", pattern: "|: !accent!C A A C A A :|" },
    "9/8": {
      noteLength: "1/8",
      pattern: "|: !accent!C A A C A A C A A :|",
    },
    "12/8": {
      noteLength: "1/8",
      pattern: "|: !accent!C A A C A A C A A C A A :|",
    },
    "3/2": {
      noteLength: "1/8",
      pattern: "|: !accent!C2 A2 C2 A2 C2 A2 :|",
    },
  };

  const fallback = patternByMeter[meter] ?? patternByMeter["4/4"];

  return [
    "X:1",
    `T:${sanitizeAbcTitle(tuneTypeName)} Rhythm`,
    `M:${meter}`,
    `L:${fallback.noteLength}`,
    "Q:1/4=100",
    "K:clef=perc",
    fallback.pattern,
  ].join("\n");
}

export async function loadRhythmPatternMetadata(
  db: SqliteDatabase,
  request: RhythmPatternRequest
): Promise<RhythmPatternMetadata | null> {
  const tuneTypeName = request.tuneTypeName?.trim();
  if (!tuneTypeName) {
    return null;
  }

  const hasGenreTempoColumn = (await tableExists(db, "genre_tune_type"))
    ? (await getTableColumns(db, "genre_tune_type")).has("tempo")
    : false;
  const hasRhythmPatternsTable = await tableExists(db, "rhythm_patterns");

  const rhythmPatternColumns = hasRhythmPatternsTable
    ? await getTableColumns(db, "rhythm_patterns")
    : new Set<string>();

  const canUseRhythmPatterns =
    hasRhythmPatternsTable &&
    rhythmPatternColumns.has("rhythm_abc") &&
    rhythmPatternColumns.has("sample_kit") &&
    rhythmPatternColumns.has("tune_type_id");

  const genreFilter = request.genreName?.trim() || null;

  if (hasGenreTempoColumn || canUseRhythmPatterns) {
    const rows = await db.all<{
      genre_name: string | null;
      tune_type_name: string | null;
      rhythm_signature: string | null;
      tempo_qpm: number | null;
      rhythm_abc: string | null;
      sample_kit: string | null;
      tune_structure: string | null;
    }>(sql`
      WITH tune_type_match AS (
        SELECT id, name, rhythm
        FROM tune_type
        WHERE lower(id) = lower(${tuneTypeName})
           OR lower(name) = lower(${tuneTypeName})
        ORDER BY CASE WHEN lower(id) = lower(${tuneTypeName}) THEN 0 ELSE 1 END
        LIMIT 1
      ),
      genre_match AS (
        SELECT id, name
        FROM genre
        WHERE ${genreFilter} IS NOT NULL
          AND (
            lower(id) = lower(${genreFilter})
            OR lower(name) = lower(${genreFilter})
          )
        ORDER BY CASE WHEN lower(id) = lower(${genreFilter}) THEN 0 ELSE 1 END
        LIMIT 1
      )
      SELECT
        gm.name AS genre_name,
        ttm.name AS tune_type_name,
        ttm.rhythm AS rhythm_signature,
        ${
          hasGenreTempoColumn ? sql`gtt.tempo` : sql`CAST(NULL AS INTEGER)`
        } AS tempo_qpm,
        ${
          canUseRhythmPatterns ? sql`rp.rhythm_abc` : sql`CAST(NULL AS TEXT)`
        } AS rhythm_abc,
        ${
          canUseRhythmPatterns ? sql`rp.sample_kit` : sql`CAST(NULL AS TEXT)`
        } AS sample_kit,
        ${
          canUseRhythmPatterns
            ? sql`rp.tune_structure`
            : sql`CAST(NULL AS TEXT)`
        } AS tune_structure
      FROM tune_type_match ttm
      LEFT JOIN genre_match gm ON 1 = 1
      LEFT JOIN genre_tune_type gtt
        ON gtt.tune_type_id = ttm.id
       AND (gm.id IS NULL OR gtt.genre_id = gm.id)
      ${
        canUseRhythmPatterns
          ? sql`LEFT JOIN rhythm_patterns rp
              ON rp.tune_type_id = ttm.id
             AND (gm.id IS NULL OR rp.genre_id = gm.id)`
          : sql``
      }
      LIMIT 1
    `);

    const row = rows[0];
    if (row?.tune_type_name) {
      const rhythmSignature = row.rhythm_signature ?? null;
      return {
        genreName: row.genre_name ?? genreFilter,
        tuneTypeName: row.tune_type_name,
        rhythmSignature,
        tuneStructure: row.tune_structure?.trim() || null,
        rhythmAbc:
          row.rhythm_abc?.trim() ||
          buildFallbackRhythmAbc(row.tune_type_name, rhythmSignature),
        tempoQpm:
          typeof row.tempo_qpm === "number" && Number.isFinite(row.tempo_qpm)
            ? row.tempo_qpm
            : getDefaultTempoForTuneType(row.tune_type_name),
        sampleKit: row.sample_kit?.trim() || DEFAULT_SAMPLE_KIT,
        source: row.rhythm_abc?.trim()
          ? "rhythm_patterns"
          : "tune_type_fallback",
      };
    }
  }

  const fallbackRows = await db.all<{
    tune_type_name: string | null;
    rhythm_signature: string | null;
  }>(sql`
    SELECT name AS tune_type_name, rhythm AS rhythm_signature
    FROM tune_type
    WHERE lower(id) = lower(${tuneTypeName})
       OR lower(name) = lower(${tuneTypeName})
    ORDER BY CASE WHEN lower(id) = lower(${tuneTypeName}) THEN 0 ELSE 1 END
    LIMIT 1
  `);

  const fallbackRow = fallbackRows[0];
  if (!fallbackRow?.tune_type_name) {
    return null;
  }

  return {
    genreName: genreFilter,
    tuneTypeName: fallbackRow.tune_type_name,
    rhythmSignature: fallbackRow.rhythm_signature ?? null,
    tuneStructure: null,
    rhythmAbc: buildFallbackRhythmAbc(
      fallbackRow.tune_type_name,
      fallbackRow.rhythm_signature ?? null
    ),
    tempoQpm: getDefaultTempoForTuneType(fallbackRow.tune_type_name),
    sampleKit: DEFAULT_SAMPLE_KIT,
    source: "tune_type_fallback",
  };
}

function clampTempo(qpm: number): number {
  const normalized = Math.round(qpm);
  if (!Number.isFinite(normalized)) {
    return 100;
  }

  return Math.min(240, Math.max(30, normalized));
}

function getAudioContextConstructor(): (new () => AudioContext) | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return (
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: new () => AudioContext })
      .webkitAudioContext
  );
}

async function decodeSample(
  audioContext: AudioContext,
  fetchImpl: typeof fetch,
  url: string
): Promise<AudioBuffer> {
  const response = await fetchImpl(url, { cache: "reload" });
  if (!response.ok) {
    throw new Error(
      `Failed to fetch rhythm sample from ${url} (HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}).`
    );
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType && !contentType.startsWith("audio/")) {
    throw new Error(
      `Received non-audio response while loading rhythm sample from ${url} (content-type: ${contentType}). This usually means the R2 object is missing, the worker route is pointing at the wrong key, or the object was uploaded without correct audio metadata.`
    );
  }

  const buffer = await response.arrayBuffer();
  try {
    return await audioContext.decodeAudioData(buffer);
  } catch (cause: unknown) {
    throw new Error(
      `Unable to decode rhythm sample from ${url}${contentType ? ` (content-type: ${contentType})` : ""}. ${formatErrorMessage(cause, "The file was fetched but could not be decoded as audio.")}`
    );
  }
}

function getPitchPlaybackGain(event: NoteTimingEvent): number {
  const hasAccent = event.elements?.some((group) =>
    group.some((element) =>
      (element.getAttribute("class") ?? "").includes("abcjs-accent")
    )
  );

  return hasAccent ? 1 : 0.8;
}

function getEventSamplePitches(
  event: NoteTimingEvent,
  rhythmAbc: string
): number[] {
  const midiPitches = (event.midiPitches ?? [])
    .map((midiPitch) => midiPitch.pitch)
    .filter((pitch) => SAMPLE_FILE_BY_PITCH[pitch] != null);
  if (midiPitches.length > 0) {
    return midiPitches;
  }

  if (
    typeof event.startChar !== "number" ||
    typeof event.endChar !== "number" ||
    event.endChar <= event.startChar
  ) {
    return [];
  }

  const sourceSlice = rhythmAbc
    .slice(event.startChar, event.endChar)
    .replace(/![^!]*!/g, " ")
    .replace(/"[^"]*"/g, " ");

  const samplePitches: number[] = [];
  for (const match of sourceSlice.matchAll(/(?:\^|_|=)?([A-Ga-g])/g)) {
    const pitch = SAMPLE_PITCH_BY_ABC_NOTE[match[1]!.toLowerCase()];
    if (pitch != null) {
      samplePitches.push(pitch);
    }
  }

  return samplePitches;
}

export function beatsPerMeasureFromSignature(signature: string | null): number {
  if (!signature) return 4;

  const match = signature.trim().match(/^(\d+)\/(\d+)/);
  if (!match) return 4;

  const upper = Number.parseInt(match[1]!, 10);
  // Compound meter: 6/8 → 2 beats, 9/8 → 3, 12/8 → 4
  if (upper % 3 === 0 && upper >= 6) return upper / 3;
  return upper;
}

/**
 * Parse a structure string like "AABB" or "A4B8C6" into total bar count.
 * Letters without a number following default to 8 bars.
 */
export function parseStructureTotalBars(structure: string | null): number {
  if (!structure) return 0;

  let total = 0;
  for (const match of structure.matchAll(/([A-Z])(\d*)/g)) {
    const count = match[2] ? Number.parseInt(match[2], 10) : 8;
    total += count;
  }
  return total;
}

function parseStructureSections(
  structure: string | null
): Array<{ label: string; bars: number }> {
  if (!structure) {
    return [];
  }

  const sections: Array<{ label: string; bars: number }> = [];
  for (const match of structure.matchAll(/([A-Z])(\d*)/g)) {
    sections.push({
      label: match[1]!,
      bars: match[2] ? Number.parseInt(match[2], 10) : 8,
    });
  }

  return sections;
}

function extractAbcBars(abc: string): {
  headerLines: string[];
  bars: string[];
} {
  const lines = abc.split("\n");
  const headerLines: string[] = [];
  const bodyLines: string[] = [];

  let inBody = false;
  for (const line of lines) {
    if (!inBody && /^[A-Za-z]:/.test(line.trim())) {
      headerLines.push(line);
    } else {
      inBody = true;
      bodyLines.push(line);
    }
  }

  const body = bodyLines.join(" ").replace(/\s+/g, " ").trim();
  const cleanBody = body
    .replace(/\|:\s*/g, "| ")
    .replace(/\s*:\|/g, " |")
    .replace(/\|+/g, "|")
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .trim();

  const bars = cleanBody
    .split("|")
    .map((bar) => bar.trim())
    .filter((bar) => bar.length > 0);

  return { headerLines, bars };
}

function wrapBarsIntoLines(bars: string[], barsPerLine: number): string[] {
  const normalizedBarsPerLine = Math.max(1, Math.floor(barsPerLine));
  const wrappedLines: string[] = [];

  for (let i = 0; i < bars.length; i += normalizedBarsPerLine) {
    wrappedLines.push(
      `${bars.slice(i, i + normalizedBarsPerLine).join(" | ")} |`
    );
  }

  return wrappedLines;
}

function repeatBarsToLength(bars: string[], targetBars: number): string[] {
  const repeatedBars: string[] = [];
  for (let i = 0; i < targetBars; i++) {
    repeatedBars.push(bars[i % bars.length]!);
  }
  return repeatedBars;
}

function buildStructuredBars(
  sourceBars: string[],
  structure: string | null,
  targetMeasures: number
): string[] {
  if (sourceBars.length === 0) {
    return [];
  }

  const sections = parseStructureSections(structure);
  if (sections.length === 0) {
    return repeatBarsToLength(sourceBars, targetMeasures);
  }

  const uniqueSections = Array.from(
    new Map(sections.map((section) => [section.label, section])).values()
  );
  const uniqueSectionBars = uniqueSections.reduce(
    (total, section) => total + section.bars,
    0
  );

  const barsByLabel = new Map<string, string[]>();
  if (sourceBars.length >= uniqueSectionBars) {
    let sourceOffset = 0;
    for (const section of uniqueSections) {
      barsByLabel.set(
        section.label,
        sourceBars.slice(sourceOffset, sourceOffset + section.bars)
      );
      sourceOffset += section.bars;
    }
  } else {
    for (const section of uniqueSections) {
      barsByLabel.set(
        section.label,
        repeatBarsToLength(sourceBars, section.bars)
      );
    }
  }

  return sections.flatMap((section) =>
    repeatBarsToLength(
      barsByLabel.get(section.label) ?? sourceBars,
      section.bars
    )
  );
}

/**
 * Expand a compact rhythm ABC pattern to fill a target number of measures
 * by repeating the body notes. Removes repeat signs so every measure
 * renders explicitly.
 */
export function expandRhythmAbc(
  abc: string,
  targetMeasures: number,
  barsPerLine = 4,
  structure: string | null = null
): string {
  if (targetMeasures <= 0) return abc;

  const { headerLines, bars } = extractAbcBars(abc);

  if (bars.length === 0) return abc;

  const expandedBodyBars = buildStructuredBars(bars, structure, targetMeasures);
  const wrappedLines = wrapBarsIntoLines(expandedBodyBars, barsPerLine);

  return [...headerLines, ...wrappedLines].join("\n");
}

/**
 * Play a short synthesized click on the Web Audio timeline.
 * Accented clicks (beat 1) are slightly higher-pitched and louder.
 */
function playMetronomeClick(
  audioContext: AudioContext,
  atTimeSec: number,
  accented: boolean
) {
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.type = "sine";
  osc.frequency.value = accented ? 1200 : 900;
  gain.gain.setValueAtTime(accented ? 0.25 : 0.18, atTimeSec);
  gain.gain.exponentialRampToValueAtTime(0.001, atTimeSec + 0.04);
  osc.connect(gain);
  gain.connect(audioContext.destination);
  osc.start(atTimeSec);
  osc.stop(atTimeSec + 0.05);
}

/** Schedule count-in clicks on the Web Audio timeline. Returns the time (in seconds) when the count-in ends. */
function scheduleCountInClicks(
  audioContext: AudioContext,
  beatsPerMeasure: number,
  measureCount: number,
  qpm: number
): number {
  const beatDurationSec = 60 / qpm;
  const startTime = audioContext.currentTime + 0.08;

  for (let m = 0; m < measureCount; m++) {
    for (let b = 0; b < beatsPerMeasure; b++) {
      const atTime = startTime + (m * beatsPerMeasure + b) * beatDurationSec;
      playMetronomeClick(audioContext, atTime, b === 0);
    }
  }

  return startTime + measureCount * beatsPerMeasure * beatDurationSec;
}

export function createRhythmService(
  options: CreateRhythmServiceOptions
): RhythmService {
  const resolvedAbcjs: ResolvedAbcjsModule = options.abcjsModule ?? abcjs;
  const fetchImpl = options.fetchImpl ?? fetch;
  const sampleUrlBuilder =
    options.sampleUrlBuilder ??
    ((sampleKit: string, fileName: string) =>
      `/samples/${sampleKit}/${fileName}`);

  const [metadata, setMetadata] = createSignal<RhythmPatternMetadata | null>(
    null
  );
  const [tempoQpm, setTempoQpmSignal] = createSignal(100);
  const [isPlaying, setIsPlaying] = createSignal(false);
  const [isReady, setIsReady] = createSignal(false);
  const [currentBeatIndex, setCurrentBeatIndex] = createSignal(0);
  const [currentMeasure, setCurrentMeasure] = createSignal(0);
  const [error, setError] = createSignal<string | null>(null);

  let timingCallbacks: TimingCallbacksInstance | null = null;
  let lastKnownPositionMs = 0;
  let ownedAudioContext: AudioContext | null = null;
  let sampleBuffers = new Map<number, AudioBuffer>();
  let renderTarget: HTMLDivElement | null = null;
  let loopTimer: ReturnType<typeof setTimeout> | null = null;
  let loopTotalBeats = 0;

  const clearLoopTimer = () => {
    if (loopTimer != null) {
      clearTimeout(loopTimer);
      loopTimer = null;
    }
  };

  const stopPlayback = () => {
    clearLoopTimer();
    if (timingCallbacks) {
      timingCallbacks.stop();
      timingCallbacks = null;
    }
    setIsPlaying(false);
  };

  const resetPlaybackPosition = () => {
    lastKnownPositionMs = 0;
    loopTotalBeats = 0;
    setCurrentBeatIndex(0);
    setCurrentMeasure(0);
  };

  async function ensureAudioContext(): Promise<AudioContext> {
    if (options.audioContext) {
      return options.audioContext;
    }
    if (ownedAudioContext) {
      return ownedAudioContext;
    }

    const AudioContextConstructor = getAudioContextConstructor();
    if (!AudioContextConstructor) {
      throw new Error("Web Audio API is not available in this environment.");
    }

    ownedAudioContext = new AudioContextConstructor();
    return ownedAudioContext;
  }

  async function ensureSamplesLoaded(): Promise<void> {
    if (sampleBuffers.size === Object.keys(SAMPLE_FILE_BY_PITCH).length) {
      setIsReady(true);
      return;
    }

    const audioContext = await ensureAudioContext();
    const currentMetadata = metadata();
    const sampleKit = currentMetadata?.sampleKit ?? DEFAULT_SAMPLE_KIT;
    let decodedEntries: ReadonlyArray<readonly [number, AudioBuffer]>;

    try {
      decodedEntries = await Promise.all(
        Object.entries(SAMPLE_FILE_BY_PITCH).map(async ([pitch, fileName]) => {
          const sampleUrl = sampleUrlBuilder(sampleKit, fileName);
          const buffer = await decodeSample(audioContext, fetchImpl, sampleUrl);
          return [Number(pitch), buffer] as const;
        })
      );
    } catch (cause: unknown) {
      throw new Error(
        `Failed to load rhythm samples for kit "${sampleKit}". ${formatErrorMessage(cause, "Unknown sample loading failure.")}`
      );
    }

    sampleBuffers = new Map(decodedEntries);
    setIsReady(true);
  }

  function playEventPitches(
    event: NoteTimingEvent,
    audioContext: AudioContext,
    rhythmAbc: string
  ) {
    if (event.type !== "event") {
      return;
    }

    const gainValue = getPitchPlaybackGain(event);
    for (const pitch of getEventSamplePitches(event, rhythmAbc)) {
      const buffer = sampleBuffers.get(pitch);
      if (!buffer) {
        continue;
      }

      const source = audioContext.createBufferSource();
      const gainNode = audioContext.createGain();
      source.buffer = buffer;
      gainNode.gain.value = gainValue;
      source.connect(gainNode);
      gainNode.connect(audioContext.destination);
      source.start();
    }
  }

  function buildTimingCallbacks(
    rhythmAbc: string,
    audioContext: AudioContext
  ): TimingCallbacksInstance {
    if (typeof document === "undefined") {
      throw new Error("ABC rhythm playback requires a browser document.");
    }

    renderTarget ??= document.createElement("div");
    renderTarget.innerHTML = "";
    const rendered = resolvedAbcjs.renderAbc(renderTarget, rhythmAbc, {
      add_classes: true,
      staffwidth: 1,
    });

    const visualObj = rendered[0] as TuneObject | undefined;
    if (!visualObj) {
      throw new Error("Unable to parse rhythm ABC.");
    }

    const beatCallback: BeatCallback = (
      beatNumber,
      _totalBeats,
      _totalTime
    ) => {
      // Capture total beats on first callback to drive the loop timer
      if (loopTotalBeats === 0 && _totalBeats > 0) {
        loopTotalBeats = _totalBeats;
      }
      setCurrentBeatIndex(Math.max(0, Math.floor(beatNumber)));
    };

    const measureCallback = (measureNumber?: number) => {
      if (
        typeof measureNumber !== "number" ||
        !Number.isFinite(measureNumber)
      ) {
        return;
      }
      setCurrentMeasure(Math.max(0, Math.floor(measureNumber)));
    };

    const animationOptions: AnimationOptions = {
      qpm: tempoQpm(),
      beatCallback,
      eventCallback: (event) => {
        if (!event) {
          return;
        }
        if (event.measureStart) {
          measureCallback(event.measureNumber);
        }
        playEventPitches(event, audioContext, rhythmAbc);
      },
    };

    return new resolvedAbcjs.TimingCallbacks(visualObj, animationOptions);
  }

  function scheduleLoopRestart() {
    clearLoopTimer();
    if (loopTotalBeats <= 0) return;

    const qpm = tempoQpm();
    const totalDurationMs = (loopTotalBeats * 60_000) / qpm;
    const elapsedMs =
      timingCallbacks?.currentMillisecond() ?? lastKnownPositionMs;
    // Fire ~200ms after the pattern would end, then restart
    const remainingMs = Math.max(50, totalDurationMs - elapsedMs + 200);

    loopTimer = setTimeout(() => {
      loopTimer = null;
      if (!isPlaying()) return;

      const currentMetadata = metadata();
      const audioCtx = ownedAudioContext;
      if (!currentMetadata || !audioCtx) return;

      resetPlaybackPosition();

      timingCallbacks?.stop();
      timingCallbacks = buildTimingCallbacks(
        currentMetadata.rhythmAbc,
        audioCtx
      );
      timingCallbacks.start();
      setIsPlaying(true);

      // Schedule the next loop iteration
      scheduleLoopRestart();
    }, remainingMs);
  }

  async function startPlayback(positionMs?: number) {
    const currentMetadata = metadata();
    if (!currentMetadata) {
      throw new Error("Rhythm pattern metadata has not been loaded.");
    }

    await ensureSamplesLoaded();
    const audioContext = await ensureAudioContext();
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    timingCallbacks?.stop();
    // Reset beat tracking for fresh starts so the loop timer captures new totalBeats
    const isFreshStart = positionMs == null || positionMs <= 0;
    if (isFreshStart) {
      loopTotalBeats = 0;
    }
    timingCallbacks = buildTimingCallbacks(
      currentMetadata.rhythmAbc,
      audioContext
    );
    timingCallbacks.start(
      isFreshStart ? undefined : msToSeconds(positionMs ?? lastKnownPositionMs),
      "seconds"
    );
    setIsPlaying(true);

    // Schedule audible count-in clicks only on the very first start (not resume, not loop restart)
    if (isFreshStart && lastKnownPositionMs <= 0) {
      const beatsPerMeasure = beatsPerMeasureFromSignature(
        currentMetadata.rhythmSignature
      );
      scheduleCountInClicks(
        audioContext,
        beatsPerMeasure,
        COUNT_IN_MEASURES,
        tempoQpm()
      );
    }

    // Arm the loop timer after every start so loops keep going
    scheduleLoopRestart();
  }

  async function loadPattern(
    request: RhythmPatternRequest
  ): Promise<RhythmPatternMetadata | null> {
    stopPlayback();
    resetPlaybackPosition();
    setError(null);

    const nextMetadata = await loadRhythmPatternMetadata(options.db, request);
    setMetadata(nextMetadata);
    if (nextMetadata) {
      setTempoQpmSignal(clampTempo(nextMetadata.tempoQpm));
    }

    return nextMetadata;
  }

  async function play(): Promise<void> {
    setError(null);
    await startPlayback(lastKnownPositionMs || undefined);
  }

  function pause(): void {
    clearLoopTimer();
    if (!timingCallbacks) {
      setIsPlaying(false);
      return;
    }

    lastKnownPositionMs = timingCallbacks.currentMillisecond();
    timingCallbacks.pause();
    setIsPlaying(false);
  }

  async function restart(): Promise<void> {
    const wasPlaying = isPlaying();
    stopPlayback();
    resetPlaybackPosition();

    if (wasPlaying) {
      await startPlayback();
    }
  }

  async function togglePlayback(): Promise<void> {
    if (isPlaying()) {
      pause();
      return;
    }

    await play();
  }

  async function setTempoQpm(nextQpm: number) {
    const clamped = clampTempo(nextQpm);
    setTempoQpmSignal(clamped);
    if (!metadata() || !isPlaying()) {
      return;
    }

    lastKnownPositionMs =
      timingCallbacks?.currentMillisecond() ?? lastKnownPositionMs;
    try {
      await startPlayback(lastKnownPositionMs);
    } catch (cause: unknown) {
      setError(
        reportRhythmError("change rhythm tempo", cause, {
          tempoQpm: clamped,
          tuneTypeName: metadata()?.tuneTypeName,
          sampleKit: metadata()?.sampleKit,
        })
      );
      stopPlayback();
    }
  }

  onCleanup(() => {
    clearLoopTimer();
    stopPlayback();
    if (ownedAudioContext && ownedAudioContext.state !== "closed") {
      void ownedAudioContext.close();
    }
    renderTarget?.remove();
    renderTarget = null;
  });

  return {
    metadata,
    tempoQpm,
    isPlaying,
    isReady,
    currentBeatIndex,
    currentMeasure,
    error,
    loadPattern: async (request) => {
      try {
        return await loadPattern(request);
      } catch (cause: unknown) {
        const message = reportRhythmError("load rhythm pattern", cause, {
          request,
        });
        setError(message);
        return null;
      }
    },
    updateRhythmAbc: (abc: string) => {
      const current = metadata();
      if (current && abc !== current.rhythmAbc) {
        setMetadata({ ...current, rhythmAbc: abc });
      }
    },
    play: async () => {
      try {
        await play();
      } catch (cause: unknown) {
        const message = reportRhythmError("start rhythm playback", cause, {
          tuneTypeName: metadata()?.tuneTypeName,
          sampleKit: metadata()?.sampleKit,
        });
        setError(message);
        stopPlayback();
      }
    },
    pause,
    restart: async () => {
      try {
        await restart();
      } catch (cause: unknown) {
        const message = reportRhythmError("restart rhythm playback", cause, {
          tuneTypeName: metadata()?.tuneTypeName,
          sampleKit: metadata()?.sampleKit,
        });
        setError(message);
        stopPlayback();
      }
    },
    togglePlayback: async () => {
      try {
        await togglePlayback();
      } catch (cause: unknown) {
        const message = reportRhythmError("toggle rhythm playback", cause, {
          tuneTypeName: metadata()?.tuneTypeName,
          sampleKit: metadata()?.sampleKit,
        });
        setError(message);
        stopPlayback();
      }
    },
    setTempoQpm,
  };
}
