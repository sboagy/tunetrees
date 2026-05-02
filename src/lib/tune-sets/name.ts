const DEFAULT_TUNE_SET_NAME = "Untitled Tune Set";

export function buildDefaultTuneSetName(tuneTitles: string[]): string {
  const normalizedTitles = tuneTitles
    .map((title) => title.trim())
    .filter((title) => title.length > 0);

  if (normalizedTitles.length === 0) {
    return DEFAULT_TUNE_SET_NAME;
  }

  return normalizedTitles.join(" / ");
}
