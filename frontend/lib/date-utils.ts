/**
 * Transforms a UTC date string to a local datetime string suitable for
 * input[type="datetime-local"].
 *
 * @param dateString - The UTC date string to be transformed.
 * @returns A local datetime string in the format `YYYY-MM-DDTHH:mm:ss`.
 */
export function transformToDatetimeLocalForInput(dateString: string): string {
  if (!dateString) {
    return "";
  }
  const utcDate = new Date(`${dateString}Z`); // Ensure the date is interpreted as UTC
  const year = utcDate.getFullYear();
  const month = String(utcDate.getMonth() + 1).padStart(2, "0");
  const day = String(utcDate.getDate()).padStart(2, "0");
  const hours = String(utcDate.getHours()).padStart(2, "0");
  const minutes = String(utcDate.getMinutes()).padStart(2, "0");
  const seconds = String(utcDate.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

/**
 * Transforms a given date string into a UTC datetime string formatted for database storage.
 *
 * @param dateString - The date string to be transformed.
 * @returns A UTC datetime string in the format "YYYY-MM-DD HH:MM:SS".
 */
export function transformToDatetimeUtcForDB(dateString: string): string {
  if (!dateString) {
    return "";
  }
  const dateStringUtc = new Date(dateString ?? "")
    .toISOString()
    .replace("T", " ")
    .slice(0, 19);
  return dateStringUtc;
}

/**
 * Transforms a given UTC date string to a localized datetime string for display,
 * suitable for use in the user interface.
 *
 * @param dateString - The UTC date string to be transformed.
 * @returns The localized datetime string formatted for display.
 */
export function transformToDatetimeLocalForDisplay(dateString: string): string {
  if (!dateString) {
    return "";
  }
  const utcDate = new Date(`${dateString}Z`); // Ensure the date is interpreted as UTC
  const dateStringLocal = utcDate.toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });
  return dateStringLocal;
}

export function formatDateForEmailVerification(dateObject: Date): string {
  const dateString = dateObject
    .toISOString()
    .replace("T", " ")
    .replace("Z", "+00:00");

  return dateString;
}

export function formatTypeScriptDateToPythonUTCString(date: Date): string {
  const year = date.getUTCFullYear();
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = date.getUTCDate().toString().padStart(2, "0");
  const hours = date.getUTCHours().toString().padStart(2, "0");
  const minutes = date.getUTCMinutes().toString().padStart(2, "0");
  const seconds = date.getUTCSeconds().toString().padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function convertToPythonUTCString(dateString: string): string {
  // Attempt to parse the string as a Date.
  // Date.parse() returns the number of milliseconds since 1970/01/01 UTC,
  // or NaN if the string is not a valid date.
  const parsedDate = new Date(dateString);

  // Check if the parsedDate is a valid date object and not "Invalid Date"
  // and if its toISOString() output is consistent with what's expected from an ISO string.
  // This helps differentiate from numeric strings that might parse but aren't dates.
  if (
    !Number.isNaN(parsedDate.getTime()) &&
    parsedDate.toISOString().startsWith(dateString.substring(0, 10))
  ) {
    // It's likely an ISO-style date string or something Date.parse() understands.
    // Format it into a Python-style UTC string.
    const year = parsedDate.getUTCFullYear();
    const month = (parsedDate.getUTCMonth() + 1).toString().padStart(2, "0");
    const day = parsedDate.getUTCDate().toString().padStart(2, "0");
    const hours = parsedDate.getUTCHours().toString().padStart(2, "0");
    const minutes = parsedDate.getUTCMinutes().toString().padStart(2, "0");
    const seconds = parsedDate.getUTCSeconds().toString().padStart(2, "0");

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }
  // If it's not parsable as an ISO date or similar, assume it's already a Python-style string.
  // You might add stricter regex validation here if needed for robustness.
  return dateString;
}

export function formatDateToPythonUTCString(date: string | Date): string {
  if (typeof date === "string") {
    return convertToPythonUTCString(date);
  }
  if (date instanceof Date) {
    return formatTypeScriptDateToPythonUTCString(date);
  }
  throw new TypeError("Invalid date type. Expected string or Date.");
}

export function convertToIsoUTCString(dateString: string): string {
  // First, try to parse it directly.
  // If it's a valid ISO string, Date() constructor will handle it,
  // and toISOString() will then ensure it's in the correct output format.
  const parsedDateFromInput = new Date(dateString);

  // If parsed successfully as a standard/ISO date, and it's not 'Invalid Date'
  if (!Number.isNaN(parsedDateFromInput.getTime())) {
    // If it's already an ISO string, or another format Date() understands,
    // toISOString() will convert it to the standard UTC ISO format.
    return parsedDateFromInput.toISOString();
  }

  // If the direct parse failed, it might be a Python-style UTC string
  // (e.g., "YYYY-MM-DD HH:MM:SS") which the Date constructor might not parse reliably across all browsers/contexts
  // if it doesn't have the 'T' separator or timezone info.
  // We'll manually parse it to be safe, assuming it's UTC.

  const parts = dateString.match(
    /(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/,
  );

  if (parts) {
    // Extract parts: [full_match, year, month, day, hour, minute, second]
    const year = Number.parseInt(parts[1], 10);
    const month = Number.parseInt(parts[2], 10) - 1; // Month is 0-indexed in Date constructor
    const day = Number.parseInt(parts[3], 10);
    const hour = Number.parseInt(parts[4], 10);
    const minute = Number.parseInt(parts[5], 10);
    const second = Number.parseInt(parts[6], 10);

    // Construct a Date object using UTC components.
    // This creates a Date object that represents the *exact UTC moment*
    // specified by the Python-style string.
    const utcDate = new Date(Date.UTC(year, month, day, hour, minute, second));

    // Then convert this UTC Date object to an ISO string.
    return utcDate.toISOString();
  }

  // If neither parsing method worked, return the original string or throw an error,
  // depending on desired behavior for truly unrecognized formats.
  // For robustness, returning the original string is less likely to break things
  // than throwing, but it means you'd need to handle invalid outputs upstream.
  console.warn(
    `Unrecognized date format for string: "${dateString}". Returning as-is or consider throwing.`,
  );
  return dateString; // Or throw new Error("Invalid date string format");
}
