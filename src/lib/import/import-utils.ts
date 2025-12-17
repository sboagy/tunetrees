/**
 * Tune Import Utilities
 *
 * Functions for importing tunes from external sources (TheSession.org, IrishTune.info).
 * Ported from legacy Next.js app to SolidJS PWA.
 *
 * @module lib/import/import-utils
 */

import type abcjs from "abcjs";
import type { VoiceItem, VoiceItemBar } from "abcjs";
import type {
  ITheSessionQueryResults,
  ITheSessionTune,
} from "./the-session-schemas";

/**
 * Extracted tune information from parsing
 */
export interface IExtractedTuneInfo {
  incipit: string;
  structure: string;
}

/**
 * Partial tune data from import
 */
export interface IImportedTuneData {
  title?: string;
  type?: string;
  structure?: string;
  mode?: string;
  incipit?: string;
  genre?: string;
  notes?: string | null;
}

/**
 * Fetch tune search results from TheSession.org by title
 * Uses CORS proxy through Cloudflare Worker to avoid browser CORS restrictions
 */
export async function fetchTheSessionURLsFromTitle(
  title: string,
  tuneType: string | null
): Promise<ITheSessionQueryResults> {
  try {
    const encodedTitle = encodeURIComponent(title);
    const typeQuery = tuneType ? `type=${tuneType}&` : "";
    const theSessionUrl = `https://thesession.org/tunes/search?${typeQuery}mode=&q=${encodedTitle}&format=json`;

    // Use CORS proxy through Cloudflare Worker
    const workerUrl = import.meta.env.VITE_WORKER_URL || "http://localhost:8787";
    const proxyUrl = `${workerUrl}/api/proxy/thesession?url=${encodeURIComponent(theSessionUrl)}`;

    const response = await fetch(proxyUrl, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const results = await response.json();
    return results as ITheSessionQueryResults;
  } catch (error) {
    console.error("Error fetching data from TheSession:", error);
    throw error;
  }
}

/**
 * Fetch tune details from TheSession.org by URL
 * Uses CORS proxy through Cloudflare Worker to avoid browser CORS restrictions
 */
export async function fetchTuneInfoFromTheSessionURL(
  tuneUrlBase: string
): Promise<ITheSessionTune> {
  try {
    const url = new URL(tuneUrlBase);
    const primaryUrl = url.origin + url.pathname;
    const tuneUrl = `${primaryUrl}?format=json`;

    // Use CORS proxy through Cloudflare Worker
    const workerUrl = import.meta.env.VITE_WORKER_URL || "http://localhost:8787";
    const proxyUrl = `${workerUrl}/api/proxy/thesession?url=${encodeURIComponent(tuneUrl)}`;

    const response = await fetch(proxyUrl, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const tuneJson: ITheSessionTune = await response.json();
    return tuneJson;
  } catch (error) {
    console.error("Error fetching tune from TheSession:", error);
    throw error;
  }
}

/**
 * Type guard to check if element is a VoiceItemBar
 */
function isVoiceItemBar(element: VoiceItem): element is VoiceItemBar {
  return element.el_type === "bar";
}

/**
 * Extract incipit (first few measures) from ABC notation
 */
export function extractIncipitFromTheSessionJson(
  tuneParsed: abcjs.TuneObject[],
  abcString: string,
  numberMeasuresToExtract = 4,
  numberBarsPerSection: number | null = 8
): IExtractedTuneInfo {
  const firstTune = tuneParsed[0];
  const measures: string[] = [];
  let measureCount = 0;
  let structure = "";
  let sectionCount = 0;
  let incipitComplete = false;

  for (const line of firstTune.lines) {
    if (!line.staff) continue;
    for (const element of line.staff) {
      for (const subElement of element.voices?.flat() || []) {
        const elType = subElement.el_type;

        if (elType === "bar") {
          measureCount++;
          if (
            numberBarsPerSection &&
            measureCount % numberBarsPerSection === 0
          ) {
            sectionCount++;
            structure += String.fromCodePoint(65 + sectionCount); // A, B, C, etc.
          }
          if (measureCount >= numberMeasuresToExtract) {
            incipitComplete = true;
          }
        }

        if (
          (elType === "note" || elType === "bar") &&
          "startChar" in subElement &&
          "endChar" in subElement &&
          !incipitComplete
        ) {
          measures.push(
            abcString.slice(subElement.startChar, subElement.endChar)
          );
        }

        // Handle repeats
        if (
          isVoiceItemBar(subElement) &&
          subElement.type &&
          (subElement.type === "bar_left_repeat" ||
            subElement.type === "bar_right_repeat")
        ) {
          structure += String.fromCodePoint(65 + sectionCount);
        }
      }
    }
  }

  // Convert the measures back to an ABC string
  const abcMeasures = `${measures.join("")}|`;

  return { incipit: abcMeasures, structure };
}

/**
 * Get expected bars per section for a given tune type
 */
export function getBarsPerSection(tuneType: string): number | null {
  const tuneTypeLower = tuneType.toLowerCase();

  switch (tuneTypeLower) {
    case "jig":
    case "single jig":
    case "double jig":
    case "slip jig":
    case "reel":
    case "hornpipe":
    case "polka":
    case "waltz":
      return 8; // Most common case

    case "air":
    case "slow air":
      return null; // Could vary

    default:
      return null; // Unknown
  }
}

/**
 * Normalize tune key/mode to standard format
 * Examples: "Ador" -> "A Dorian", "D" -> "D Major"
 */
export function normalizeKey(key: string): string {
  if (!key) return "";

  // Handle common formats
  const keyUpper = key.toUpperCase();

  // Map of mode abbreviations to full names
  const modeMap: Record<string, string> = {
    DOR: "Dorian",
    MIX: "Mixolydian",
    AEO: "Aeolian",
    MIN: "Minor",
    MAJ: "Major",
    LYD: "Lydian",
    PHR: "Phrygian",
    LOC: "Locrian",
  };

  // Try to parse note + mode pattern (e.g., "Ador", "Dmix")
  for (const [abbr, fullName] of Object.entries(modeMap)) {
    if (keyUpper.includes(abbr)) {
      const note = keyUpper.replace(abbr, "").trim();
      return `${note} ${fullName}`;
    }
  }

  // If no mode specified, assume Major
  if (/^[A-G][#b]?$/.test(keyUpper)) {
    return `${keyUpper} Major`;
  }

  return key; // Return as-is if we can't parse it
}

/**
 * Normalize tune type to standard format
 * Examples: "slip jig" -> "Slip Jig", "reel" -> "Reel"
 */
export function normalizeTuneType(type: string): string {
  if (!type) return "";

  // Capitalize first letter of each word
  return type
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
