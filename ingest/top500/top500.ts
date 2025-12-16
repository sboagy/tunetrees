#!/usr/bin/env tsx

/**
 * Top 500 Songs Catalog Builder
 *
 * This script processes the Rolling Stone Top 500 dataset and generates
 * a clean JSON catalog for TuneTrees.
 *
 * Usage:
 *   npm run ingest:top500
 *   # or directly:
 *   tsx ingest/top500/top500.ts
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import Papa from "papaparse";

// Load .env.local from project root
config({ path: join(process.cwd(), ".env.local") });

// Types for our catalog
interface CatalogEntry {
  id: string;
  title: string;
  artist: string;
  composer?: string;
  key?: string;
  year?: number;
  genre?: string;
  links: {
    youtube?: string;
    chordie?: string;
    wikipedia?: string;
  };
  origin: string;
}

interface RawSongData {
  ""?: string | number; // First column (rank)
  Artist?: string;
  Title?: string;
  Writers?: string;
  Producer?: string;
  Year?: string | number;
  "Spotify id"?: string;
  Popularity?: string | number;
  danceability?: string | number;
  energy?: string | number;
  key?: string | number;
  loudness?: string | number;
  mode?: string | number;
  tempo?: string | number;
}

interface SpotifyTrack {
  id: string;
  artists: Array<{ id: string; name: string }>;
  album?: {
    release_date?: string;
  };
}

interface SpotifyArtist {
  id: string;
  name: string;
  genres: string[];
}

interface SpotifyTracksResponse {
  tracks: Array<SpotifyTrack | null>;
}

interface SpotifyArtistsResponse {
  artists: Array<SpotifyArtist | null>;
}

// Get current directory in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CSV_PATH = join(__dirname, "rollingstone.csv");
const OUTPUT_PATH = join(__dirname, "output/public_catalog.json");
const SPOTIFY_CACHE_PATH = join(__dirname, "output/spotify_cache.json");

interface SpotifyCache {
  trackMap: Record<string, SpotifyTrack>;
  artistMap: Record<string, SpotifyArtist>;
  cachedAt: string;
}

/**
 * Chunk an array into smaller arrays of specified size
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Fetch tracks from Spotify API
 */
async function fetchSpotifyTracks(
  trackIds: string[],
  token: string
): Promise<Map<string, SpotifyTrack>> {
  const trackMap = new Map<string, SpotifyTrack>();
  const chunks = chunkArray(trackIds, 50);

  for (const chunk of chunks) {
    const ids = chunk.join(",");
    try {
      const response = await fetch(
        `https://api.spotify.com/v1/tracks?ids=${ids}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        console.warn(`⚠️  Spotify API error: ${response.statusText}`);
        continue;
      }

      const data = (await response.json()) as SpotifyTracksResponse;

      // BREAKPOINT HERE - inspect Spotify track response

      for (const track of data.tracks) {
        if (track) {
          trackMap.set(track.id, track);
        }
      }
    } catch (error) {
      console.error(`❌ Error fetching tracks:`, error);
    }
  }

  return trackMap;
}

/**
 * Fetch artists from Spotify API to get genre data
 */
async function fetchSpotifyArtists(
  artistIds: string[],
  token: string
): Promise<Map<string, SpotifyArtist>> {
  const artistMap = new Map<string, SpotifyArtist>();
  const chunks = chunkArray(artistIds, 50);

  for (const chunk of chunks) {
    const ids = chunk.join(",");
    try {
      const response = await fetch(
        `https://api.spotify.com/v1/artists?ids=${ids}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        console.warn(`⚠️  Spotify API error: ${response.statusText}`);
        continue;
      }

      const data = (await response.json()) as SpotifyArtistsResponse;

      // BREAKPOINT HERE - inspect Spotify artist response

      for (const artist of data.artists) {
        if (artist) {
          artistMap.set(artist.id, artist);
        }
      }
    } catch (error) {
      console.error(`❌ Error fetching artists:`, error);
    }
  }

  return artistMap;
}

/**
 * Normalize Spotify genres to simpler categories
 */
function normalizeGenre(spotifyGenres: string[]): string | undefined {
  if (!spotifyGenres || spotifyGenres.length === 0) return undefined;

  const genre = spotifyGenres[0].toLowerCase();

  // Map Spotify's granular genres to broader categories
  if (genre.includes("rock")) return "Rock";
  if (genre.includes("pop")) return "Pop";
  if (genre.includes("soul") || genre.includes("r&b")) return "R&B/Soul";
  if (genre.includes("hip hop") || genre.includes("rap")) return "Hip Hop";
  if (genre.includes("jazz")) return "Jazz";
  if (genre.includes("country")) return "Country";
  if (genre.includes("folk")) return "Folk";
  if (genre.includes("blues")) return "Blues";
  if (genre.includes("electronic") || genre.includes("dance"))
    return "Electronic";
  if (genre.includes("metal")) return "Metal";

  // Default to first genre capitalized
  return spotifyGenres[0];
}

/**
 * Parse CSV file using proper CSV parser that handles quoted fields
 */
function parseCSV(filePath: string): RawSongData[] {
  const content = readFileSync(filePath, "utf-8");

  const result = Papa.parse<RawSongData>(content, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false, // Keep all values as strings initially
  });

  if (result.errors.length > 0) {
    console.warn("⚠️  CSV parsing warnings:", result.errors);
  }

  if (!result.data || result.data.length === 0) {
    throw new Error("CSV file is empty or invalid");
  }

  return result.data;
}

/**
 * Generate search link for YouTube
 */
function generateYouTubeLink(title: string, artist: string): string {
  const query = encodeURIComponent(`${title} ${artist} official`);
  return `https://www.youtube.com/results?search_query=${query}`;
}

/**
 * Generate search link for Chordie
 */
function generateChordieLink(title: string, artist: string): string {
  const query = encodeURIComponent(`${title} ${artist}`);
  return `https://www.chordie.com/result.php?q=${query}`;
}

/**
 * Map Spotify key number to musical key
 * Spotify uses Pitch Class notation (0 = C, 1 = C#, etc.)
 */
function mapSpotifyKey(keyNum: number, mode: number): string {
  const keys = [
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B",
  ];
  const keyName = keys[keyNum] || "Unknown";
  const modeName = mode === 1 ? "Major" : "Minor";
  return `${keyName} ${modeName}`;
}

/**
 * Convert raw song data to catalog entry
 */
function convertToCatalogEntry(
  raw: RawSongData,
  index: number,
  genreMap?: Map<string, string>
): CatalogEntry {
  const title = raw.Title || "Unknown Title";
  const artist = raw.Artist || "Unknown Artist";
  const writers = raw.Writers;
  const year = raw.Year;
  const spotifyId = raw["Spotify id"];

  // Parse Spotify data from CSV
  const spotifyKey = raw.key ? Number(raw.key) : undefined;
  const spotifyMode = raw.mode ? Number(raw.mode) : undefined;
  const musicalKey =
    spotifyKey !== undefined && spotifyMode !== undefined
      ? mapSpotifyKey(spotifyKey, spotifyMode)
      : undefined;

  // Get genre from Spotify API enrichment
  const genre = spotifyId && genreMap ? genreMap.get(spotifyId) : undefined;

  return {
    id: `rs-500-${String(index + 1).padStart(4, "0")}`,
    title,
    artist,
    composer: writers,
    key: musicalKey,
    year: year ? Number(year) : undefined,
    genre,
    links: {
      youtube: generateYouTubeLink(title, artist),
      chordie: generateChordieLink(title, artist),
    },
    origin: "rolling_stone_top_500_v1",
  };
}

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

async function getSpotifyToken(): Promise<string | null> {
  // 1. Create the Basic Auth string (Base64 encoded ID:Secret)
  const authString = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString(
    "base64"
  );

  // 2. Prepare the form data body
  const bodyParams = new URLSearchParams();
  bodyParams.append("grant_type", "client_credentials");

  try {
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${authString}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: bodyParams,
    });

    if (!response.ok) {
      throw new Error(
        `Spotify API Error: ${response.status} ${response.statusText}`
      );
    }

    interface ISpotifyTokenResponse {
      access_token?: string;
      token_type?: string;
      expires_in?: number;
    }

    const data = (await response.json()) as ISpotifyTokenResponse;
    return data.access_token ?? null;
  } catch (error) {
    console.error("Failed to fetch Spotify token:", error);
    return null;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log("🎵 Top 500 Catalog Builder");
  console.log("=".repeat(50));

  // Check if CSV exists
  if (!existsSync(CSV_PATH)) {
    console.error(`❌ CSV file not found: ${CSV_PATH}`);
    console.log("\nPlease place your rollingstone.csv file in:");
    console.log(`   ${__dirname}/`);
    process.exit(1);
  }

  console.log(`📂 Reading CSV from: ${CSV_PATH}`);

  try {
    // Parse CSV
    const rawData = parseCSV(CSV_PATH);
    console.log(`✅ Parsed ${rawData.length} songs`);

    // Optional: Enrich with Spotify API data
    let genreMap: Map<string, string> | undefined;
    const spotifyToken = await getSpotifyToken();

    if (spotifyToken) {
      console.log("\n🎵 Enriching with Spotify API data...");

      let trackMap: Map<string, SpotifyTrack>;
      let artistMap: Map<string, SpotifyArtist>;

      // Check for cached Spotify data
      if (existsSync(SPOTIFY_CACHE_PATH)) {
        console.log("   📦 Loading cached Spotify data...");
        console.log("   💡 To refresh, delete:", SPOTIFY_CACHE_PATH);
        const cacheContent = readFileSync(SPOTIFY_CACHE_PATH, "utf-8");
        const cache = JSON.parse(cacheContent) as SpotifyCache;
        trackMap = new Map(Object.entries(cache.trackMap));
        artistMap = new Map(Object.entries(cache.artistMap));
        console.log(
          `   ✅ Loaded ${trackMap.size} tracks and ${artistMap.size} artists from cache (${cache.cachedAt})\n`
        );
      } else {
        console.log("   🌐 Fetching fresh data from Spotify API...");

        // Extract unique Spotify track IDs
        const trackIds = rawData
          .map((r) => r["Spotify id"])
          .filter((id): id is string => !!id);

        console.log(`   Found ${trackIds.length} Spotify track IDs`);

        // Fetch track data to get artist IDs
        trackMap = await fetchSpotifyTracks(trackIds, spotifyToken);
        console.log(`   ✅ Fetched ${trackMap.size} tracks`);

        // Extract unique artist IDs
        const artistIds = [
          ...new Set(
            Array.from(trackMap.values()).flatMap((track) =>
              track.artists.map((a) => a.id)
            )
          ),
        ];
        console.log(`   Found ${artistIds.length} unique artists`);

        // Fetch artist data to get genres
        artistMap = await fetchSpotifyArtists(artistIds, spotifyToken);
        console.log(
          `   ✅ Fetched ${artistMap.size} artists with genre data\n`
        );

        // Cache the results
        const cache: SpotifyCache = {
          trackMap: Object.fromEntries(trackMap),
          artistMap: Object.fromEntries(artistMap),
          cachedAt: new Date().toISOString(),
        };

        const outputDir = dirname(SPOTIFY_CACHE_PATH);
        if (!existsSync(outputDir)) {
          mkdirSync(outputDir, { recursive: true });
        }

        writeFileSync(SPOTIFY_CACHE_PATH, JSON.stringify(cache, null, 2));
        console.log(`   💾 Cached Spotify data to: ${SPOTIFY_CACHE_PATH}\n`);
      }

      // Build genre map: trackId -> normalized genre
      genreMap = new Map<string, string>();
      for (const [trackId, track] of trackMap.entries()) {
        const primaryArtistId = track.artists[0]?.id;
        if (primaryArtistId) {
          const artist = artistMap.get(primaryArtistId);
          if (artist?.genres) {
            const normalizedGenre = normalizeGenre(artist.genres);
            if (normalizedGenre) {
              genreMap.set(trackId, normalizedGenre);
            }
          }
        }
      }
      console.log(`   ✅ Mapped genres for ${genreMap.size} tracks\n`);
    } else {
      console.log("\n⚠️  No SPOTIFY_ACCESS_TOKEN found in environment");
      console.log("   Skipping Spotify API enrichment");
      console.log("   Set SPOTIFY_ACCESS_TOKEN to enable genre data\n");
    }

    // Convert to catalog entries
    const catalog = rawData.map((raw, index) =>
      convertToCatalogEntry(raw, index, genreMap)
    );

    // Randomize order to avoid copyright issues with the specific ranking
    const shuffledCatalog = catalog.sort(() => Math.random() - 0.5);

    console.log(`✅ Generated ${shuffledCatalog.length} catalog entries`);

    // Ensure output directory exists
    const outputDir = dirname(OUTPUT_PATH);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    // Write output
    console.log(`💾 Writing catalog to: ${OUTPUT_PATH}`);

    writeFileSync(
      OUTPUT_PATH,
      JSON.stringify(shuffledCatalog, null, 2),
      "utf-8"
    );

    console.log(
      `✅ Success! Catalog written with ${shuffledCatalog.length} songs`
    );
    console.log("\n📊 Sample entry:");
    console.log(JSON.stringify(shuffledCatalog[0], null, 2));
  } catch (error) {
    console.error("❌ Error processing catalog:", error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export {
  main,
  convertToCatalogEntry,
  generateYouTubeLink,
  generateChordieLink,
  mapSpotifyKey,
};
