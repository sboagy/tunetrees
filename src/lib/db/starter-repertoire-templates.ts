/**
 * Starter Repertoire Templates
 *
 * Pre-defined demo/starter repertoire templates for new user onboarding.
 * These templates let new users quickly explore TuneTrees with a pre-populated
 * set of tunes rather than starting from a blank repertoire.
 *
 * Tune population is deferred to after catalog sync so the templates work
 * regardless of network state at the time the user picks a starter.
 *
 * @module lib/db/starter-repertoire-templates
 */

/**
 * Describes how to filter catalog tunes for a starter repertoire.
 *
 * - `genre`: Filter tunes by their genre column (e.g., "ITRAD").
 * - `origin`: Filter tunes by their primary_origin column
 *             (e.g., "rolling_stone_top_500_v1").
 */
export type TuneFilterType = "genre" | "origin";

/**
 * A pre-defined starter/demo repertoire template shown during onboarding.
 */
export interface StarterRepertoireTemplate {
  /** Unique, stable identifier for the template */
  id: string;

  /** Display name for the repertoire (used as the created repertoire's name) */
  name: string;

  /** Short description shown on the onboarding card */
  description: string;

  /** Emoji icon shown on the card */
  emoji: string;

  /**
   * Default genre for the repertoire (maps to repertoire.genre_default).
   * null when no single genre applies (e.g. mixed-genre collections).
   */
  genreDefault: string | null;

  /** Spaced-repetition algorithm to use for the repertoire */
  srAlgType: string;

  /**
   * Genre IDs to pre-select in the "Choose Genres" onboarding step
   * so the catalog sync downloads the relevant tunes automatically.
   */
  preselectedGenreIds: string[];

  /**
   * How to filter catalog tunes when populating the starter repertoire
   * after catalog sync.
   */
  tuneFilterType: TuneFilterType;

  /**
   * The value to match against:
   * - When tuneFilterType === "genre": a single genre ID (e.g. "ITRAD")
   * - When tuneFilterType === "origin": a primary_origin value
   *   (e.g. "rolling_stone_top_500_v1")
   */
  tuneFilterValue: string;

  /** Approximate number of tunes (used for display only) */
  estimatedTuneCount: number;
}

/**
 * Irish Traditional Music starter repertoire.
 *
 * Contains ~490 Irish traditional tunes (reels, jigs, hornpipes, polkas, etc.)
 * from the irishtune.info catalog.
 */
export const ITRAD_STARTER_TEMPLATE: StarterRepertoireTemplate = {
  id: "itrad-starter",
  name: "Irish Traditional [starter]",
  description:
    "~490 traditional Irish tunes — reels, jigs, hornpipes, polkas, and more from the irishtune.info catalog. A great starting point for any session player.",
  emoji: "🪈",
  genreDefault: "ITRAD",
  srAlgType: "fsrs",
  preselectedGenreIds: ["ITRAD"],
  tuneFilterType: "genre",
  tuneFilterValue: "ITRAD",
  estimatedTuneCount: 490,
};

/**
 * Rolling Stone Top 500 Greatest Songs starter repertoire.
 *
 * Contains ~500 songs from Rolling Stone magazine's "500 Greatest Songs of
 * All Time" list (2021 edition), spanning rock, pop, soul, blues, hip-hop,
 * country, folk, indie, jazz, and reggae.
 */
export const RS500_STARTER_TEMPLATE: StarterRepertoireTemplate = {
  id: "rs500-starter",
  name: "Rolling Stone Top 500 [starter]",
  description:
    "~500 songs from Rolling Stone magazine's '500 Greatest Songs of All Time' list — spanning rock, pop, soul, blues, hip-hop, country, folk, indie, jazz, and reggae.",
  emoji: "🎸",
  genreDefault: null,
  srAlgType: "fsrs",
  // Pre-select all genres represented in this catalog so they are downloaded.
  preselectedGenreIds: [
    "Rock",
    "Pop",
    "Blues",
    "Country",
    "Folk",
    "Hip Hop",
    "Indie",
    "Jazz",
    "R&B/Soul",
    "Reggae",
  ],
  tuneFilterType: "origin",
  tuneFilterValue: "rolling_stone_top_500_v1",
  estimatedTuneCount: 500,
};

/**
 * All available starter repertoire templates, in display order.
 */
export const STARTER_TEMPLATES: StarterRepertoireTemplate[] = [
  ITRAD_STARTER_TEMPLATE,
  RS500_STARTER_TEMPLATE,
];

/**
 * Look up a starter template by its ID.
 */
export function getStarterTemplateById(
  id: string
): StarterRepertoireTemplate | undefined {
  return STARTER_TEMPLATES.find((t) => t.id === id);
}
