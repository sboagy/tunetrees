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
