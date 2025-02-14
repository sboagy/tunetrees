"use server";

import { normalizeKey, normalizeTuneType } from "@/lib/abc-utils";
import { fetchWithTimeout } from "@/lib/fetch-utils";
import { levenshteinDistance } from "@/lib/utils";
import abcjs, { type VoiceItem, type VoiceItemBar } from "abcjs";
import { type CheerioAPI, load } from "cheerio";
import type { ITheSessionTune } from "./import-the-session-schemas";
import { getTune, queryReferences, searchTunesByTitle } from "./queries";
import type { ITune, ITuneOverview } from "./types";

export async function fetchTheSessionURLFromTitle(
  title: string,
  tuneType: string,
): Promise<string> {
  try {
    const encodedTitle = encodeURIComponent(title);
    const theSessionUrl = `https://thesession.org/tunes/search?type=${tuneType}&mode=&q=${encodedTitle}&format=json`;

    const response = await fetch(theSessionUrl, {
      headers: {
        Accept: "text/json",
      },
    });
    const results = await response.json();
    if (results.total > 0) {
      let closestMatchIndex = 0;
      let bestDistance = levenshteinDistance(
        results.tunes[0].name.toLowerCase(),
        title.toLowerCase(),
      );

      for (let index = 1; index < results.tunes.length; index++) {
        const tune = results.tunes[index];
        const currentDistance = levenshteinDistance(
          tune.name.toLowerCase(),
          title.toLowerCase(),
        );

        if (currentDistance < bestDistance) {
          bestDistance = currentDistance;
          closestMatchIndex = index;
        }
      }
      const tuneUrlBase = results.tunes[closestMatchIndex].url;
      return tuneUrlBase as string;
    }
  } catch (error) {
    console.error("Error fetching data:", error);
    throw error;
  }

  return "";
}

export async function fetchTheSessionIncipitFromTitle(
  title: string,
  tuneType: string,
): Promise<[string, string]> {
  const theSessionURL = await fetchTheSessionURLFromTitle(title, tuneType);
  if (!theSessionURL) {
    return ["", ""];
  }
  const incipit = await extractTuneMeasuresFromURL(theSessionURL);
  return [incipit, theSessionURL];
}

async function extractTuneMeasuresFromURL(
  tuneUrlBase: string,
  numberMeasuresToExtract = 4,
) {
  const { tuneParsed, abcString } =
    await fetchTuneFromTheSessionURL(tuneUrlBase);
  const { incipit } = extractIncipitFromTheSessionJson(
    tuneParsed,
    abcString,
    numberMeasuresToExtract,
  );

  return incipit;
}

interface IExtractedTuneInfo {
  incipit: string;
  structure: string;
}

// Type guard to check if subElement is a VoiceItemBar
function isVoiceItemBar(element: VoiceItem): element is VoiceItemBar {
  return element.el_type === "bar";
}

function getBarsPerSection(tuneType: string): number | null {
  const tuneTypeLower = tuneType.toLowerCase(); // Handle variations in capitalization

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
      return null; // Could vary, treat as unknown or handle separately

    // Add more cases as needed for specific tune types with variations
    // Example:
    // case "special jig":  return 16;

    default:
      return null; // Default: unknown, handle specially or assume 8
  }
}

function extractIncipitFromTheSessionJson(
  tuneParsed: abcjs.TuneObject[],
  abcString: string,
  numberMeasuresToExtract = 4,
  numberBarsPerSection: number | null = 8,
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
            abcString.slice(subElement.startChar, subElement.endChar),
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

async function fetchTuneFromTheSessionURL(tuneUrlBase: string): Promise<{
  tuneParsed: abcjs.TuneObject[];
  abcString: string;
  tuneJson: ITheSessionTune;
}> {
  const tuneUrl = `${tuneUrlBase}?format=json`;
  const responseTune = await fetchWithTimeout(tuneUrl, {
    timeout: 30_000,
    headers: {
      Accept: "text/json",
    },
  });
  const tuneJson = await responseTune.json();
  const setting = tuneJson.settings[0];
  const abcString = setting.abc;
  const tuneParsed = abcjs.parseOnly(abcString);
  return { tuneParsed, abcString, tuneJson };
}

async function extractTheSessionTune(
  url: string,
): Promise<[Partial<ITuneOverview>, ITune[], string]> {
  const extractedTune: Partial<ITuneOverview> = {};

  try {
    const { tuneParsed, abcString, tuneJson } =
      await fetchTuneFromTheSessionURL(url);
    extractedTune.title = tuneJson.name;
    extractedTune.type = normalizeTuneType(tuneJson.type);

    extractedTune.mode = normalizeKey(tuneJson.settings[0].key);
    const barsPerSection = getBarsPerSection(tuneJson.type);
    const { incipit, structure } = extractIncipitFromTheSessionJson(
      tuneParsed,
      abcString,
      4,
      barsPerSection,
    );
    extractedTune.incipit = incipit;
    extractedTune.structure = structure;

    const existingMatches = await findExistingMatches(
      url,
      extractedTune.title ?? "",
      extractedTune.type ?? "",
    );

    return [extractedTune, existingMatches, ""];
  } catch (error) {
    console.error("Error extracting data:", error);
    throw error;
  }
}

async function findExistingMatches(url: string, title: string, type: string) {
  const existingMatches: ITune[] = [];

  const refs = await queryReferences(url);
  if (refs.length > 0) {
    const tuneRef = refs[0].tune_ref;
    if (tuneRef) {
      const existingTune: ITuneOverview | { detail: string } =
        await getTune(tuneRef);
      if ("detail" in existingTune) {
        throw new Error(`Existing tune not found: ${existingTune.detail}`);
      }
      if (existingTune) {
        existingMatches.push(existingTune);
        return existingMatches;
      }
    }
  }

  if (title) {
    const matches = await searchTunesByTitle(title);
    for (const match of matches) {
      if (match.type === type) {
        existingMatches.push(match);
      }
    }
  }
  return existingMatches;
}

async function scrapeIrishTuneInfoTune(
  url: string,
): Promise<[Partial<ITuneOverview>, ITune[], string]> {
  function extractColumnText(
    $: CheerioAPI,
    columnIndex: number,
  ): string | undefined {
    try {
      const selector = `body > div.twoCol > div.leftCol > table > tbody > tr > td:nth-child(${columnIndex})`;
      const elements = $(selector);

      if (elements.length > 0) {
        return elements.first().text().trim();
      }

      return undefined;
    } catch {
      throw Error("Error extracting column text");
    }
  }

  const scrapedTune: Partial<ITuneOverview> = {};

  try {
    // const response = await fetchWithTimeout(url, { timeout: 100000 });
    const response = await fetchWithTimeout(url, {
      timeout: 20_0000,
      headers: {
        Accept: "text/html",
      },
    });
    const html = await response.text();
    const $: CheerioAPI = load(html); // Load HTML into Cheerio

    const titleSection = $("body > div.twoCol > div.leftCol > h1")
      .map((i, el) => $(el))
      .get();

    const titleNode: Text = titleSection[0][0].children[3] as unknown as Text;
    let title = titleNode.nodeValue?.trim();
    if (title?.startsWith("(") && title?.endsWith(")")) {
      title = title.slice(1, -1).trim();
    }
    scrapedTune.title = title;

    // Example: Extract all the text from <p> tags
    const rhythm = extractColumnText($, 1);
    scrapedTune.type = rhythm;
    // const bars = extractColumnText(3);

    const phraseStructure = extractColumnText($, 3);
    scrapedTune.structure = phraseStructure;

    const mode = extractColumnText($, 4);
    scrapedTune.mode = mode;

    let secondarySourceUrl = "";
    if (title) {
      const [incipit, incipitURL] = await fetchTheSessionIncipitFromTitle(
        title,
        rhythm ?? "",
      );
      secondarySourceUrl = incipitURL;
      scrapedTune.incipit = incipit;
    }

    const existingMatches = await findExistingMatches(
      url,
      scrapedTune.title ?? "",
      rhythm ?? "",
    );

    return [scrapedTune, existingMatches, secondarySourceUrl];
  } catch (error) {
    console.error("Error scraping data:", error);
    throw error;
  }
}

export async function importTune(
  url: string,
): Promise<[Partial<ITuneOverview>, ITune[], string]> {
  try {
    if (url.includes("://www.irishtune.info")) {
      return await scrapeIrishTuneInfoTune(url);
    }
    if (url.includes("://thesession.org")) {
      return await extractTheSessionTune(url);
    }
    throw new Error("Unsupported URL");
  } catch (error) {
    console.error("Error scraping data:", error);
    throw error;
  }
}
