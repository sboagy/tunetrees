const SELECTED_TUNE_SET_KEY_PREFIX = "tunetrees:selectedTuneSet";

const getSelectedTuneSetKey = (userId: string) =>
  `${SELECTED_TUNE_SET_KEY_PREFIX}:${userId}`;

export function getSelectedTuneSetId(userId: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(getSelectedTuneSetKey(userId));
}

export function setSelectedTuneSetId(
  userId: string,
  tuneSetId: string | null
): void {
  if (typeof window === "undefined") return;

  const storageKey = getSelectedTuneSetKey(userId);
  if (tuneSetId) {
    localStorage.setItem(storageKey, tuneSetId);
    return;
  }

  localStorage.removeItem(storageKey);
}

export function clearSelectedTuneSetId(userId: string): void {
  setSelectedTuneSetId(userId, null);
}
