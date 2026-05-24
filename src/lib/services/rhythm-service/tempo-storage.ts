import { normalizeTuneTypeName } from "@/lib/rhythm/tune-type-lookup";
import { clampTempo } from "@/lib/services/rhythm-service/playback-helpers";

const RHYTHM_TEMPO_STORAGE_KEY_PREFIX = "tunetrees.rhythm-tempo";

function getRhythmTempoStorage(): Storage | null {
  if (typeof globalThis === "undefined") {
    return null;
  }

  try {
    const storage =
      "localStorage" in globalThis ? globalThis.localStorage : null;
    if (
      storage &&
      typeof storage.getItem === "function" &&
      typeof storage.setItem === "function"
    ) {
      return storage;
    }

    return null;
  } catch {
    return null;
  }
}

function buildRhythmTempoStorageKey(
  userId: string | null | undefined,
  tuneTypeName: string
): string {
  const normalizedUserId = userId?.trim() || "anonymous";
  return [
    RHYTHM_TEMPO_STORAGE_KEY_PREFIX,
    normalizedUserId,
    normalizeTuneTypeName(tuneTypeName),
  ].join(":");
}

export function readStoredRhythmTempo(
  userId: string | null | undefined,
  tuneTypeName: string
): number | null {
  const storage = getRhythmTempoStorage();
  if (!storage) {
    return null;
  }

  const rawValue = storage.getItem(
    buildRhythmTempoStorageKey(userId, tuneTypeName)
  );
  if (!rawValue) {
    return null;
  }

  const parsedValue = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsedValue) ? clampTempo(parsedValue) : null;
}

export function writeStoredRhythmTempo(
  userId: string | null | undefined,
  tuneTypeName: string,
  tempoQpm: number
): void {
  const storage = getRhythmTempoStorage();
  if (!storage) {
    return;
  }

  storage.setItem(
    buildRhythmTempoStorageKey(userId, tuneTypeName),
    String(clampTempo(tempoQpm))
  );
}
