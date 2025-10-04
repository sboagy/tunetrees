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

// (removed older variant to avoid duplicate export; see strict ISO 8601 version below)

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

/**
 * Formats a Date into a UTC-based ISO 8601 datetime string.
 * Example: 2024-07-08T12:27:08Z
 *
 * Notes:
 * - Uses UTC components and includes the 'Z' suffix to explicitly indicate UTC.
 * - This format is the most reliable for consistent handling across client/server timezones.
 */
export function formatDateToIso8601UtcString(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");

  // The 'Z' suffix indicates UTC time
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`;
}

/**
 * Formats a Date into an ISO UTC string without milliseconds.
 * Example: 2024-12-31T16:47:57Z
 */
export function formatDateToIsoUtcString(date: Date): string {
  const iso = date.toISOString();
  // Drop milliseconds to reduce ambiguity if backend rejects them
  return iso.replace(/\.(\d{3})Z$/, "Z");
}

export function convertToIsoUTCString(dateString: string): string {
  if (!dateString) return dateString;

  const tryParse = (s: string): string | null => {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  };

  // 1) Fast path: native parse
  const native = tryParse(dateString);
  if (native) return native;

  // 2) Normalize common variants like:
  //    "YYYY-MM-DD HH:MM:SS(.fraction)?(Z|±HH:MM|±HHMM)?"
  //    - Replace space with 'T'
  //    - Ensure timezone offset has a colon
  //    - Trim fraction to milliseconds (3 digits)
  let normalized = dateString.trim();
  // Replace single space between date and time with 'T'
  normalized = normalized.replace(
    /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}(?:\.\d+)?)(.*)$/,
    "$1T$2$3",
  );

  // If offset like -0500 or +0930 exists, insert colon to match ISO (e.g., -05:00)
  normalized = normalized.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");

  // Trim microseconds to milliseconds if present (e.g., .671465 -> .671)
  normalized = normalized.replace(/(\.\d{3})\d+(Z|[+-]\d{2}:?\d{2})?$/, "$1$2");

  const normalizedParsed = tryParse(normalized);
  if (normalizedParsed) return normalizedParsed;

  // 3) Manual parse for Python-style without or with tz: YYYY-MM-DD HH:MM:SS(.frac)?(Z|±HH:MM|±HHMM)?
  const match = dateString.match(
    /(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:?\d{2})?$/,
  );
  if (match) {
    const year = Number.parseInt(match[1], 10);
    const month = Number.parseInt(match[2], 10) - 1;
    const day = Number.parseInt(match[3], 10);
    const hour = Number.parseInt(match[4], 10);
    const minute = Number.parseInt(match[5], 10);
    const second = Number.parseInt(match[6], 10);
    const frac = match[7] ? match[7].slice(0, 3) : "0"; // milliseconds (trim to 3)
    const tz = match[8] ?? null;

    let ms = Date.UTC(year, month, day, hour, minute, second, Number(frac));
    if (tz && tz !== "Z") {
      // tz like -05:00 or -0500
      const tzMatch = tz.match(/([+-])(\d{2}):?(\d{2})/);
      if (tzMatch) {
        const sign = tzMatch[1] === "-" ? -1 : 1;
        const hh = Number.parseInt(tzMatch[2], 10);
        const mm = Number.parseInt(tzMatch[3], 10);
        const offsetMinutes = sign * (hh * 60 + mm);
        // The given wall time is with tz offset; convert to UTC by subtracting the offset
        ms -= offsetMinutes * 60 * 1000;
      }
    }
    return new Date(ms).toISOString();
  }

  // 4) Legacy Python-style without time (very rare). Let native handle or return as-is.
  // As a safe fallback, return original string to avoid throwing in client code paths.
  console.warn(
    `Unrecognized date format for string: "${dateString}". Returning as-is or consider throwing.
Normalized attempted: "${normalized}"`,
  );
  return dateString;
}
