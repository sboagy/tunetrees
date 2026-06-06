import { normalizeTuneTypeName } from "@/lib/rhythm/tune-type-lookup";
import type { MetronomeMode } from "@/lib/services/rhythm-service/RhythmService";

const RHYTHM_METRONOME_STORAGE_KEY_PREFIX = "tunetrees.rhythm-metronome";
const METRONOME_MODES = new Set<MetronomeMode>(["off", "on", "metronome-only"]);

function getRhythmMetronomeStorage(): Storage | null {
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

function buildRhythmMetronomeStorageKey(
  userId: string | null | undefined,
  tuneTypeName: string
): string {
  const normalizedUserId = userId?.trim() || "anonymous";
  return [
    RHYTHM_METRONOME_STORAGE_KEY_PREFIX,
    normalizedUserId,
    normalizeTuneTypeName(tuneTypeName),
  ].join(":");
}

export function readStoredRhythmMetronomeMode(
  userId: string | null | undefined,
  tuneTypeName: string
): MetronomeMode | null {
  const storage = getRhythmMetronomeStorage();
  if (!storage) {
    return null;
  }

  const rawValue = storage.getItem(
    buildRhythmMetronomeStorageKey(userId, tuneTypeName)
  );
  return METRONOME_MODES.has(rawValue as MetronomeMode)
    ? (rawValue as MetronomeMode)
    : null;
}

export function writeStoredRhythmMetronomeMode(
  userId: string | null | undefined,
  tuneTypeName: string,
  metronomeMode: MetronomeMode
): void {
  const storage = getRhythmMetronomeStorage();
  if (!storage) {
    return;
  }

  storage.setItem(
    buildRhythmMetronomeStorageKey(userId, tuneTypeName),
    metronomeMode
  );
}
