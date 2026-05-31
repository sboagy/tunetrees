import { normalizeTuneTypeName } from "@/lib/rhythm/tune-type-lookup";

const RHYTHM_SWING_STORAGE_KEY_PREFIX = "tunetrees.rhythm-swing";

function getRhythmSwingStorage(): Storage | null {
  if (typeof globalThis === "undefined") {
    return null;
  }

  try {
    const storage =
      "localStorage" in globalThis ? globalThis.localStorage : null;
    if (
      storage &&
      typeof storage.getItem === "function" &&
      typeof storage.setItem === "function" &&
      typeof storage.removeItem === "function"
    ) {
      return storage;
    }

    return null;
  } catch {
    return null;
  }
}

function clampStoredSwingPercentage(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

function buildRhythmSwingStorageKey(
  userId: string | null | undefined,
  tuneTypeName: string
): string {
  const normalizedUserId = userId?.trim() || "anonymous";
  return [
    RHYTHM_SWING_STORAGE_KEY_PREFIX,
    normalizedUserId,
    normalizeTuneTypeName(tuneTypeName),
  ].join(":");
}

export function readStoredRhythmSwing(
  userId: string | null | undefined,
  tuneTypeName: string
): number | null {
  const storage = getRhythmSwingStorage();
  if (!storage) {
    return null;
  }

  const rawValue = storage.getItem(
    buildRhythmSwingStorageKey(userId, tuneTypeName)
  );
  if (!rawValue) {
    return null;
  }

  const parsedValue = Number.parseFloat(rawValue);
  return Number.isFinite(parsedValue)
    ? clampStoredSwingPercentage(parsedValue)
    : null;
}

export function writeStoredRhythmSwing(
  userId: string | null | undefined,
  tuneTypeName: string,
  swingPercentage: number
): void {
  const storage = getRhythmSwingStorage();
  if (!storage) {
    return;
  }

  storage.setItem(
    buildRhythmSwingStorageKey(userId, tuneTypeName),
    String(clampStoredSwingPercentage(swingPercentage))
  );
}

export function clearStoredRhythmSwing(
  userId: string | null | undefined,
  tuneTypeName: string
): void {
  const storage = getRhythmSwingStorage();
  if (!storage) {
    return;
  }

  storage.removeItem(buildRhythmSwingStorageKey(userId, tuneTypeName));
}
