/**
 * Normalizes a musical key string by ensuring the note is uppercase and the mode is capitalized.
 *
 * @param key - The musical key string to normalize. It should be in the format of a note followed by an optional mode (e.g., "Cmaj", "dmin").
 * @returns The normalized key string with the note in uppercase and the mode capitalized. If the key is invalid, returns the original key string.
 *
 * @example
 * ```typescript
 * normalizeKey("cmaj"); // Returns "C Maj"
 * normalizeKey("dmin"); // Returns "D Min"
 * normalizeKey("F#");   // Returns "F#"
 * normalizeKey("");     // Returns ""
 * ```
 */
export function normalizeKey(key: string): string {
  // Handle the case where the key string is empty.
  if (!key) {
    return "";
  }

  // Use a regular expression to split the key into note and mode.
  const match = key.match(/^([A-Ga-g][#b]?)(.*)$/);

  if (match) {
    let note = match[1];
    let mode = match[2] || "";

    // Normalize the note to uppercase.
    note = note.toUpperCase();

    // Capitalize the mode if present.
    if (mode) {
      mode = mode.trim();
      mode = mode.charAt(0).toUpperCase() + mode.slice(1).toLowerCase();
    }

    // Combine the normalized note and mode.
    const normalizedKey = mode ? `${note} ${mode}` : note;

    return normalizedKey;
  }

  // Log a warning and return the key string unchanged for invalid formats.
  console.warn(`Warning: Invalid key format: ${key}`);
  return key;
}

export const tuneTypeTranslation: { [key: string]: string } = {
  hornpipe: "Hpipe",
  jig: "JigD",
  "jig (single)": "SgJig",
  "slip jig": "JigSl",
  slipjig: "JigSl",
  slide: "Slide",
  "set dance": "SetD",
  "single reel": "SgReel",
  polka: "Polka",
  "barn dance": "BDnce",
  barndance: "BDnce",
  schottische: "Schot",
  "highland fling": "Hland",
  strathspey: "Strath",
  mazurka: "Mzrka",
  waltz: "Waltz",
  piece: "Piece",
  song: "Song",
  air: "Air",
  breakdown: "Breakdown",
  branle: "Branle",
  quadrille: "Quadrille",
  march: "March",
  "slow air": "SlowAir",
  "fado (corrido)": "FadoCorrido",
  "fado (menor)": "FadoMenor",
  "fado (canção)": "FadoCancao",
  "newfoundland slide": "NFLDSlide",
  "newfoundland polka": "NFLDPolska",
  freylekh: "Freylekh",
  khosidl: "Khosidl",
  doina: "Doina",
  bulgar: "Bulgar",
  soleares: "Soleares",
  alegrias: "Alegrias",
  bulerias: "Bulerias",
  segiriyas: "Seguiriyas",
  "blues shuffle": "BluesShuffle",
  "blues ballad": "Blues Ballad",
  "delta blues": "DeltaBlues",
  "two-step": "TwoStep",
  "cajun waltz": "WaltzCajun",
  cumbia: "Cumbia",
  ranchera: "Ranchera",
  "samba batucada": "SambaBatucada",
  "samba pagode": "SambaPagode",
  "samba enredo": "SambaEnredo",
  slendro: "Slendro",
  pelog: "Pelog",
};

/**
 * Normalizes the given tune type string by translating it to a
 * standardized format, based on, for now, a built-in translation table.
 * If no translation is found, the original tune type string is returned.
 *
 * Over time, the translation table may be populated from the database.
 *
 * @param tuneType - The tune type string to be normalized.
 * @returns The normalized tune type string if a translation exists;
 *          otherwise, returns the original tune type string.
 *
 * @example
 * ```typescript
 * normalizeTuneType("jig"); // Returns "JigD"
 * normalizeTuneType("jig (single)"); // Returns "SgJig"
 * normalizeTuneType("hornpipe"); // Returns "Hpipe"
 * normalizeTuneType("reel"); // Returns "Reel"
 * ```
 */
export function normalizeTuneType(tuneType: string): string {
  const normalizedTuneType = tuneTypeTranslation[tuneType.toLowerCase()];

  if (normalizedTuneType) {
    return normalizedTuneType;
  }

  return tuneType;
}
