"use server";

import { fetchWithTimeout } from "@/lib/fetch-utils";
import { type CheerioAPI, load } from "cheerio";
import type {
  ITheSessionQueryResults,
  ITheSessionTune,
} from "./import-the-session-schemas";
import type { ITuneOverview } from "./types";

export async function fetchTheSessionURLsFromTitle(
  title: string,
  tuneType: string | null,
): Promise<ITheSessionQueryResults> {
  try {
    const encodedTitle = encodeURIComponent(title);
    const typeQuery = tuneType ? `type=${tuneType}&` : "";
    const theSessionUrl = `https://thesession.org/tunes/search?${typeQuery}mode=&q=${encodedTitle}&format=json`;

    const response = await fetch(theSessionUrl, {
      headers: {
        Accept: "text/json",
      },
    });
    const results = await response.json();
    return results as ITheSessionQueryResults;
  } catch (error) {
    console.error("Error fetching data:", error);
    throw error;
  }
}

export async function fetchTuneInfoFromTheSessionURL(
  tuneUrlBase: string,
): Promise<ITheSessionTune> {
  const tuneUrl = `${tuneUrlBase}?format=json`;
  const responseTune = await fetchWithTimeout(tuneUrl, {
    timeout: 30_000,
    headers: {
      Accept: "text/json",
    },
  });
  const tuneJson: ITheSessionTune = await responseTune.json();
  return tuneJson;
}

export async function scrapeIrishTuneInfoTune(
  url: string,
): Promise<Partial<ITuneOverview>> {
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

    return scrapedTune;
  } catch (error) {
    console.error("Error scraping data:", error);
    throw error;
  }
}

// export async function importTune(
//   url: string,
// ): Promise<[Partial<ITuneOverview>, ITune[], string]> {
//   try {
//     if (url.includes("://www.irishtune.info")) {
//       return await scrapeIrishTuneInfoTune(url);
//     }
//     if (url.includes("://thesession.org")) {
//       return await extractTheSessionTune(url);
//     }
//     throw new Error("Unsupported URL");
//   } catch (error) {
//     console.error("Error scraping data:", error);
//     throw error;
//   }
// }
