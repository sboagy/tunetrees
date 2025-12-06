/**
 * Catalog Instrument ID Mapping
 *
 * Maps legacy SQLite integer instrument IDs to stable UUIIDv7 values.
 * These UUIDs are used consistently across:
 * - Production migration (scripts/migrate-production-to-supabase.ts)
 * - Test fixtures (tests/fixtures/test-data.ts)
 * - Test environment setup (scripts/setup-test-environment.ts)
 *
 * Format: 00000000-0000-4000-8000-0000000011XX
 * where XX = zero-padded instrument ID (01-08)
 *
 * Based on legacy instrument table:
 * 1: Irish Flute
 * 2: Irish Tenor Banjo
 * 3: Irish Fiddle
 * 4: Irish Box (Accordion)
 * 5: 5-String Banjo
 * 6: doo-da (deleted - private_to_user=100)
 * 7: organ (private_to_user=1)
 * 8: Harmonica (Irish) (private_to_user=1)
 */

// Catalog instrument UUIDs (public instruments)
// Generated with UUIDv7 to maintain time-ordering
export const CATALOG_INSTRUMENT_IRISH_FLUTE_ID =
  "019a4531-0c93-70a3-b71e-e80b6d24edc4";
export const CATALOG_INSTRUMENT_IRISH_TENOR_BANJO_ID =
  "019a4531-0c95-7006-8143-b4f01a547596";
export const CATALOG_INSTRUMENT_IRISH_FIDDLE_ID =
  "019a4531-0c97-70de-bc38-74eb94b02a9a";
export const CATALOG_INSTRUMENT_IRISH_BOX_ID =
  "019a4531-0c98-70e1-8d27-24018eef3a54";
export const CATALOG_INSTRUMENT_5_STRING_BANJO_ID =
  "019a4531-0c9a-709b-aeb4-707640e1f519";

// Private instruments (kept for migration completeness)
export const CATALOG_INSTRUMENT_DOO_DA_ID =
  "019a4531-0c9b-70b3-8bd9-93087cc75a43";
export const CATALOG_INSTRUMENT_ORGAN_ID =
  "019a4531-0c9d-7079-be6b-e708a338625c";
export const CATALOG_INSTRUMENT_HARMONICA_IRISH_ID =
  "019a4531-0c9e-70ed-83de-37bd3c5b1c0e";

/**
 * Map of legacy SQLite integer IDs to catalog instrument UUIDs
 */
export const CATALOG_INSTRUMENT_ID_MAP: Record<number, string> = {
  1: CATALOG_INSTRUMENT_IRISH_FLUTE_ID,
  2: CATALOG_INSTRUMENT_IRISH_TENOR_BANJO_ID,
  3: CATALOG_INSTRUMENT_IRISH_FIDDLE_ID,
  4: CATALOG_INSTRUMENT_IRISH_BOX_ID,
  5: CATALOG_INSTRUMENT_5_STRING_BANJO_ID,
  6: CATALOG_INSTRUMENT_DOO_DA_ID,
  7: CATALOG_INSTRUMENT_ORGAN_ID,
  8: CATALOG_INSTRUMENT_HARMONICA_IRISH_ID,
};

/**
 * Instrument definitions matching legacy schema
 */
export interface CatalogInstrument {
  id: string; // UUID
  legacyId: number; // Original SQLite ID
  instrument: string; // Display name
  description: string;
  genre_default: string;
  private_to_user?: number | null; // Legacy user ID (null = public)
}

export const CATALOG_INSTRUMENTS: CatalogInstrument[] = [
  {
    id: CATALOG_INSTRUMENT_IRISH_FLUTE_ID,
    legacyId: 1,
    instrument: "Irish Flute",
    description: "Irish Flute",
    genre_default: "ITRAD",
    private_to_user: null,
  },
  {
    id: CATALOG_INSTRUMENT_IRISH_TENOR_BANJO_ID,
    legacyId: 2,
    instrument: "Irish Tenor Banjo",
    description: "4-String Irish Tenor Banjo",
    genre_default: "ITRAD",
    private_to_user: null,
  },
  {
    id: CATALOG_INSTRUMENT_IRISH_FIDDLE_ID,
    legacyId: 3,
    instrument: "Irish Fiddle",
    description: "Irish Fiddle",
    genre_default: "ITRAD",
    private_to_user: null,
  },
  {
    id: CATALOG_INSTRUMENT_IRISH_BOX_ID,
    legacyId: 4,
    instrument: "Irish Box",
    description: "Accordion",
    genre_default: "ITRAD",
    private_to_user: null,
  },
  {
    id: CATALOG_INSTRUMENT_5_STRING_BANJO_ID,
    legacyId: 5,
    instrument: "5-String Banjo",
    description: "5-string (Clawhammer, etc.)",
    genre_default: "BGRA",
    private_to_user: null,
  },
  {
    id: CATALOG_INSTRUMENT_DOO_DA_ID,
    legacyId: 6,
    instrument: "doo-da",
    description: "whoopie",
    genre_default: "ITRAD",
    private_to_user: 100,
  },
  {
    id: CATALOG_INSTRUMENT_ORGAN_ID,
    legacyId: 7,
    instrument: "organ",
    description: "test",
    genre_default: "OTIME",
    private_to_user: 1,
  },
  {
    id: CATALOG_INSTRUMENT_HARMONICA_IRISH_ID,
    legacyId: 8,
    instrument: "Harmonica (Irish)",
    description: "Harmonica (diatonic, solo-tuned)",
    genre_default: "ITRAD",
    private_to_user: 1,
  },
];

/**
 * Get catalog instrument UUID from legacy integer ID
 */
export function getCatalogInstrumentUuid(legacyId: number): string {
  const uuid = CATALOG_INSTRUMENT_ID_MAP[legacyId];
  if (!uuid) {
    throw new Error(
      `No catalog instrument UUID mapping for legacy ID: ${legacyId}`
    );
  }
  return uuid;
}

/**
 * Get catalog instrument by UUID
 */
export function getCatalogInstrumentById(
  uuid: string
): CatalogInstrument | undefined {
  return CATALOG_INSTRUMENTS.find((inst) => inst.id === uuid);
}

/**
 * Get catalog instrument by legacy ID
 */
export function getCatalogInstrumentByLegacyId(
  legacyId: number
): CatalogInstrument | undefined {
  return CATALOG_INSTRUMENTS.find((inst) => inst.legacyId === legacyId);
}

/**
 * Check if a UUID is a catalog instrument
 */
export function isCatalogInstrument(uuid: string): boolean {
  return CATALOG_INSTRUMENTS.some((inst) => inst.id === uuid);
}
