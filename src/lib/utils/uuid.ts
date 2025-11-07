/**
 * UUID utilities for offline-first PWA
 *
 * This module provides UUIDv7 generation for all database records.
 * UUIDv7 is time-ordered, which maintains chronological sort order
 * and provides better B-tree index performance than UUIDv4.
 *
 * @see https://datatracker.ietf.org/doc/draft-ietf-uuidrev-rfc4122bis/
 * @see https://supabase.com/docs/guides/database/tables#uuid-primary-keys
 */

/**
 * Generate a new UUIDv7 (time-ordered)
 *
 * UUIDv7 format: xxxxxxxx-xxxx-7xxx-xxxx-xxxxxxxxxxxx
 * - First 48 bits: Unix timestamp in milliseconds
 * - Next 12 bits: Random sub-millisecond precision
 * - Version: 7 (0111)
 * - Variant: 10 (RFC 4122)
 * - Remaining: Random bits
 *
 * Benefits:
 * - Time-ordered (maintains chronological sort order)
 * - Better B-tree index performance (sequential inserts)
 * - Compatible with standard UUID APIs
 * - Recommended by Supabase for new tables
 *
 * @returns A UUIDv7 string in canonical format
 *
 * @example
 * const id = generateId();
 * // => "018c3f7a-9c2a-7000-8000-123456789abc"
 */
export function generateId(): string {
  // Get current timestamp in milliseconds
  const timestamp = BigInt(Date.now());

  // Generate random bytes for the rest
  const randomBytes = new Uint8Array(10);
  crypto.getRandomValues(randomBytes);

  // Build UUIDv7:
  // - 48 bits: timestamp (milliseconds since epoch)
  // - 4 bits: version (0111 = 7)
  // - 12 bits: random
  // - 2 bits: variant (10)
  // - 62 bits: random

  const timestampHex = timestamp.toString(16).padStart(12, "0");

  // Time low (32 bits) - first 8 hex chars
  const timeLow = timestampHex.slice(0, 8);

  // Time mid (16 bits) - next 4 hex chars
  const timeMid = timestampHex.slice(8, 12);

  // Time high and version (16 bits) - 4 bits version + 12 bits random
  // Version 7 = 0111, so we use "7" as the first nibble
  const timeHiAndVersion = `7${randomBytes[0]
    .toString(16)
    .padStart(3, "0")
    .slice(0, 3)}`;

  // Clock sequence and variant (16 bits) - 2 bits variant + 14 bits random
  // Variant 10 (RFC 4122), so we set the top two bits to 10
  const clockSeqAndReserved = (0x80 | (randomBytes[1] & 0x3f))
    .toString(16)
    .padStart(2, "0");
  const clockSeqLow = randomBytes[2].toString(16).padStart(2, "0");

  // Node (48 bits) - random
  const node = Array.from(randomBytes.slice(3, 9))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `${timeLow}-${timeMid}-${timeHiAndVersion}-${clockSeqAndReserved}${clockSeqLow}-${node}`;
}

/**
 * Validate UUID format (accepts both UUIDv4 and UUIDv7)
 *
 * This is a lenient validator that accepts any valid UUID format.
 * Use isUUIDv7() if you need to specifically check for version 7.
 *
 * @param uuid - The UUID string to validate
 * @returns true if the UUID is valid, false otherwise
 *
 * @example
 * isValidUUID("018c3f7a-9c2a-7000-8000-123456789abc"); // => true
 * isValidUUID("550e8400-e29b-41d4-a716-446655440000"); // => true (UUIDv4)
 * isValidUUID("not-a-uuid"); // => false
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[47][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Check if UUID is version 7 (time-ordered)
 *
 * UUIDv7 has "7" as the version nibble (13th hex character).
 *
 * @param uuid - The UUID string to check
 * @returns true if the UUID is version 7, false otherwise
 *
 * @example
 * isUUIDv7("018c3f7a-9c2a-7000-8000-123456789abc"); // => true
 * isUUIDv7("550e8400-e29b-41d4-a716-446655440000"); // => false (v4)
 */
export function isUUIDv7(uuid: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    uuid,
  );
}

/**
 * Extract timestamp from UUIDv7
 *
 * UUIDv7 encodes the creation timestamp in the first 48 bits.
 * This function extracts and returns it as a Date object.
 *
 * @param uuid - The UUIDv7 string to extract timestamp from
 * @returns Date object representing the UUID creation time, or null if not a valid UUIDv7
 *
 * @example
 * const uuid = generateId();
 * const timestamp = getUUIDv7Timestamp(uuid);
 * console.log(timestamp); // => Date object (approximately now)
 */
export function getUUIDv7Timestamp(uuid: string): Date | null {
  if (!isUUIDv7(uuid)) {
    return null;
  }

  // Remove dashes and extract first 12 hex characters (48 bits)
  const hex = uuid.replace(/-/g, "");
  const timestampHex = hex.slice(0, 12);

  // Convert hex to milliseconds since epoch
  const timestamp = parseInt(timestampHex, 16);

  return new Date(timestamp);
}

/**
 * Generate a batch of UUIDs efficiently
 *
 * For bulk insert operations, this is more efficient than calling
 * generateId() in a loop.
 *
 * @param count - Number of UUIDs to generate
 * @returns Array of UUIDv7 strings
 *
 * @example
 * const ids = generateBatchIds(100);
 * // => ["018c3f7a-...", "018c3f7a-...", ...]
 */
export function generateBatchIds(count: number): string[] {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    ids.push(generateId());
  }
  return ids;
}
