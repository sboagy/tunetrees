"use server";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { type CheerioAPI, load } from "cheerio";
import { fetchWithTimeout } from "@/lib/fetch-utils";
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
    // This should eventually have a mock, but wait for a specific test.
    const encodedTitle = encodeURIComponent(title);
    const typeQuery = tuneType ? `type=${tuneType}&` : "";
    const theSessionUrl = `https://thesession.org/tunes/search?${typeQuery}mode=&q=${encodedTitle}&format=json`;

    const response = await fetchWithTimeout(theSessionUrl, {
      timeout: 30_000,
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
  // Check for test environment
  if (process.env.NEXT_PUBLIC_MOCK_EXTERNAL_APIS === "true") {
    // Extract tune ID for mock data
    const url = new URL(tuneUrlBase);
    const pathParts = url.pathname.split("/");
    const tuneId = pathParts.at(-1);

    try {
      // Use the correct path for playwright test fixtures
      // Consider obtaining the path from the test environment,
      // but for now, just hardcode a relative path, for the sake
      // of simplicity.
      const mockPath = path.join(
        process.cwd(),
        `tests/fixtures/thesession/tunes/${tuneId}.json`,
      );

      console.log(`[MOCK] Loading from ${mockPath}`);
      const fileContent = await readFile(mockPath, "utf8");
      const mockData = JSON.parse(fileContent) as ITheSessionTune;
      return mockData;
    } catch (error) {
      console.error("[MOCK] Error loading mock data:", error);
      throw error;
    }
  }

  // Normal production code continues here
  const url = new URL(tuneUrlBase);
  const primaryUrl = url.origin + url.pathname;
  const tuneUrl = `${primaryUrl}?format=json`;
  const responseTune = await fetchWithTimeout(tuneUrl, {
    timeout: 30_000,
    headers: {
      Accept: "text/json",
    },
  });
  const tuneJson: ITheSessionTune = await responseTune.json();
  return tuneJson;
}

function getItiHeaders() {
  return {
    "User-Agent": "Mozilla/5.0",
    // "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/113.0",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    // "Accept": "text/html",
    // "Accept-Language": "en-US,en;q=0.5",
    // "Accept-Encoding": "gzip, deflate, br",
    // "Content-Type": "application/x-www-form-urlencoded",
    // "Content-Length": "73",
    // "Origin": "https://www.irishtune.info",
    // "Referer": "https://www.irishtune.info/my/login.php",
    Cookie: "MyIrishTuneInfo=b2dcbda34d41f29b2967f917e89fd77b",
    // "Upgrade-Insecure-Requests": "1",
    // "Sec-Fetch-Dest": "document",
    // "Sec-Fetch-Mode": "navigate",
    // "Sec-Fetch-Site": "same-origin",
    // "Sec-Fetch-User": "?1",
  };
}

export async function scrapeIrishTuneInfoTune(
  url: string,
): Promise<Partial<ITuneOverview>> {
  async function itiLogin() {
    const loginPageUrl = "https://www.irishtune.info/my/login2.php";

    const irishtuneinfoUsername = process.env.IRISHTUNEINFO_USERNAME_TT;
    const irishtuneinfoPassword = process.env.IRISHTUNEINFO_PASSWORD_TT;

    if (!irishtuneinfoUsername || !irishtuneinfoPassword) {
      throw new Error("Missing IrishTuneInfo credentials");
    }

    const formDataLogin = new URLSearchParams({
      username: irishtuneinfoUsername,
      password: irishtuneinfoPassword,
      B1: "Submit",
      jtest: "t",
      IE8: "false",
      from: "/my/",
    }).toString();

    const response2 = await fetchWithTimeout(loginPageUrl, {
      timeout: 200_000,
      method: "POST",
      body: formDataLogin,
      headers: {
        ...getItiHeaders(),
        Connection: "keep-alive",
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    if (!response2.ok) {
      throw new Error("Failed to fetch login page");
    }
    return response2;
  }

  const loginResponse = await itiLogin();
  console.log("loginResponse.status", loginResponse.status);

  const scrapedTune: Partial<ITuneOverview> = {};

  try {
    // const response = await fetchWithTimeout(url, { timeout: 100000 });
    const response = await fetchWithTimeout(url, {
      timeout: 20_0000,
      headers: {
        ...getItiHeaders(),
        Accept: "text/html",
      },
    });
    const html = await response.text();
    const $: CheerioAPI = load(html); // Load HTML into Cheerio

    const addOrDeleteButtonElement = $(
      "body > div.twoCol > div.rightCol form.addbutton input",
    );
    const addOrDeleteButtonValue = addOrDeleteButtonElement.attr("value");
    // This should either be "addlist" or "dellist" according to if it's already in the playlist
    console.log("Button value:", addOrDeleteButtonValue);

    if (addOrDeleteButtonValue === "addlist") {
      console.log(`Adding ${url} to iti tt playlist`);
      // const formActionUrl = "https://www.irishtune.info/my/ctrlPlaylist.php";
      const formActionUrl = url;
      const formData = new URLSearchParams({
        formname: "addlist",
      });

      const submitResponse = await fetchWithTimeout(formActionUrl, {
        timeout: 400_000,
        method: "POST",
        body: formData.toString(),
        headers: {
          ...getItiHeaders(),
          "Accept-Encoding": "gzip, deflate, br, zstd",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "max-age=0",
          "Content-Type": "application/x-www-form-urlencoded",
          Origin: "https://www.irishtune.info",
          Referer: url,
        },
      });

      if (!submitResponse.ok) {
        throw new Error("Failed to submit form (addlist)");
      }

      console.log(
        `Form submitted successfully to add ${url} to iti tt playlist`,
      );
    }

    const formData = new URLSearchParams({
      action: "listall",
      // _: "1686614383963",
    });

    const pageUrl = `https://www.irishtune.info/my/ctrlPlaylist.php?${formData.toString()}`;

    const response3 = await fetchWithTimeout(pageUrl, {
      timeout: 200_000,
      headers: {
        ...getItiHeaders(),
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "max-age=0",
        Origin: "https://www.irishtune.info",
        Referer: "https://www.irishtune.info/my/playlist.php",
        "Content-Type": "application/json",
      },
    });
    if (!response3.ok) {
      throw new Error("Failed to fetch form data page");
    }
    const tunesDataText = await response3.text();

    // ==============
    // hackity hack time, for some reason we're getting some
    // html before the json data, so we need to find the
    // start of the json data. Hopefully I'll find a fix,
    // may need to ask Allan Ng when I'm ready.
    const jsonStartIndex = tunesDataText.indexOf("{");
    if (jsonStartIndex === -1) {
      throw new Error("JSON data not found in response");
    }
    const jsonString = tunesDataText.slice(jsonStartIndex);
    // ==============

    const jsonData = JSON.parse(jsonString);
    const tunesData = jsonData.data;
    const urlParts = url.split("/");
    const tuneId = urlParts.at(-2);
    console.log("Tune ID:", tuneId);

    const matchingTune = tunesData.find(
      (tune: { ID: string }) => tune.ID === tuneId,
    );
    if (!matchingTune) {
      throw new Error(`Tune with ID ${tuneId} not found`);
    }

    scrapedTune.title = matchingTune.Title;
    scrapedTune.type = matchingTune.Type;
    scrapedTune.structure = matchingTune.Structure;
    scrapedTune.mode = matchingTune.Mode;
    scrapedTune.incipit = matchingTune.Incipit;
    scrapedTune.genre = "ITRAD";

    console.log("tunesData", tunesData);

    // If we added it, then clean up after ourselves.  Could consider to
    // do this unconditionaly, but it's a bit more polite to only do it
    // if we added it.
    if (addOrDeleteButtonValue === "addlist") {
      console.log(`Deleting ${url} from iti tt playlist`);
      // const formActionUrl = "https://www.irishtune.info/my/ctrlPlaylist.php";
      const formActionUrl = url;
      const formData = new URLSearchParams({
        formname: "dellist",
      });

      const submitResponse = await fetchWithTimeout(formActionUrl, {
        timeout: 400_000,
        method: "POST",
        body: formData.toString(),
        headers: {
          ...getItiHeaders(),
          "Accept-Encoding": "gzip, deflate, br, zstd",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "max-age=0",
          "Content-Type": "application/x-www-form-urlencoded",
          Origin: "https://www.irishtune.info",
          Referer: url,
        },
      });

      if (!submitResponse.ok) {
        throw new Error("Failed to submit form (dellist)");
      }

      console.log(
        `Form submitted successfully to delete tune ${url} from iti tt playlist`,
      );
    }

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
