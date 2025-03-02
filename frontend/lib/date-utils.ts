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
