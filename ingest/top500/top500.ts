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
import { generateId } from "../../src/lib/utils/uuid";

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
    spotify?: string;
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
 * Generate search link for Spotify
 * Format: https://open.spotify.com/search/<Artist> <Title>
 */
function generateSpotifyLink(title: string, artist: string): string {
  const query = encodeURIComponent(`${artist} ${title}`);
  return `https://open.spotify.com/search/${query}`;
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

function normalizeYear(value: string | number | undefined): number | undefined {
  if (value === undefined || value === null) return undefined;
  const raw = typeof value === "string" ? value.trim() : String(value);
  if (!raw) return undefined;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return undefined;

  // Already a 4-digit year (or larger) – keep as-is.
  if (parsed >= 1000) return parsed;

  // Rolling Stone CSV uses 2-digit years for 1900s and single-digit for 2000s.
  // Heuristic: 00–29 => 2000–2029, otherwise => 1900–1999.
  if (parsed >= 0 && parsed <= 29) return 2000 + parsed;
  if (parsed >= 30 && parsed <= 99) return 1900 + parsed;

  return parsed;
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
  const year = normalizeYear(raw.Year);
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
    year,
    genre,
    links: {
      youtube: generateYouTubeLink(title, artist),
      chordie: generateChordieLink(title, artist),
      spotify: generateSpotifyLink(title, artist),
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

  const SONG_OVERRIDES: Record<string, string> = {
    "shake, rattle & roll": "Rock",
    "hit the road jack": "R&B/Soul",
    "mr. tambourine man": "Folk",
    "river deep - mountain high": "R&B/Soul",
    "proud mary": "R&B/Soul",
    "what's love got to do with it": "Pop",
    "private dancer": "Pop",
    "hotel california": "Rock",
    hurt: "Rock",
  };

  const MANUAL_GENRES: Record<string, string> = {
    // Classic Rock / Rock
    "Daft Punk": "Pop",
    "Creedence Clearwater Revival": "Rock",
    "The White Stripes": "Rock",
    "The Black Keys": "Rock", // They also get tagged as Blues, but they are Rock
    "The Strokes": "Rock", // Often tagged as Indie, but they are Rock
    Jet: "Rock",
    Beck: "Rock",
    "The Lovin": "Rock",
    "The Mamas & The Papas": "Rock",
    "The Mamas and the Papas": "Rock",
    "Crosby, Stills and Nash": "Rock",
    "Crosby, Stills, Nash and Young": "Rock",

    "Derek & The Dominos": "Rock", // Don't forget 'Layla'!
    Carpenters: "Pop",
    "Bruce Springsteen": "Rock",
    "Van Morrison": "Rock",
    "George Harrison": "Rock",
    "The Police": "Rock",
    "Paul McCartney": "Rock",
    "The Young Rascals": "Rock",
    Blondie: "Rock",
    "Jeff Buckley": "Rock",
    "The Bobby Fuller Four": "Rock",
    "The Box Tops": "Rock",

    // Pop
    Coldplay: "Pop",
    "John Lennon": "Rock",
    "Sonny & Cher": "Pop",
    Rihanna: "Pop",
    "Randy Newman": "Pop",
    Beyoncé: "Pop",
    "Gnarls Barkley": "Pop",
    "Sinéad O'Connor": "Pop",

    // Soul / R&B (New category suggested for this list)
    "The Five Stairsteps": "R&B/Soul",
    "The Righteous Brothers": "R&B/Soul",
    "Ben E. King": "R&B/Soul",
    "Curtis Mayfield, Jerry Butler & The Impressions": "R&B/Soul",
    "Screamin' Jay Hawkins": "R&B/Soul",
    "Dusty Springfield": "R&B/Soul",
    "Amy Winehouse": "R&B/Soul",
    "Booker T. & the M.G.'s": "R&B/Soul",
    "James Brown & The Famous Flames": "R&B/Soul",
    "Dionne Warwick": "R&B/Soul",

    // Folk / Country
    "Bobbie Gentry": "Country",

    // Hip Hop (New category suggested)
    "Hip Hop DJs United": "Hip Hop", // (California Love)
    "The Karaoke Channel": "Hip Hop", // (Data artifact for Eminem's 'Stan')
    "M.I.A.": "Hip Hop",

    // Data Artifacts / Edge Cases
    "Joel Adams": "R&B/Soul", // (Likely a dataset error for James Brown's 'Please, Please, Please')

    // ========
    "The Jimi Hendrix Experience": "Rock",
    "Jimi Hendrix": "Rock",
    Cream: "Rock",
    "Eric Clapton": "Rock",
    "Derek and the Dominos": "Rock",
    "The Yardbirds": "Rock",
    "Big Joe Turner": "Rock", // "Shake, Rattle & Roll"
    "Bill Haley & His Comets": "Rock",
    "Neil Young": "Rock",
    "Crosby, Stills & Nash": "Rock",
    "Crosby, Stills, Nash & Young": "Rock",
    "Buffalo Springfield": "Rock",
    "The Byrds": "Rock",
    "The Band": "Rock",
    "The Eagles": "Rock",
    "Fleetwood Mac": "Rock",
    "The Mamas & the Papas": "Rock",
    "The Beach Boys": "Rock",
    "The Lovin' Spoonful": "Rock",
    "Jefferson Airplane": "Rock",
    "The Velvet Underground": "Rock", // Proto-punk -> Rock
    "The Stooges": "Rock", // Proto-punk -> Rock
    Ramones: "Rock", // Punk -> Rock
    "The Clash": "Rock", // Punk -> Rock
    "Sex Pistols": "Rock", // Punk -> Rock
    Nirvana: "Rock", // Grunge -> Rock
    "Pearl Jam": "Rock", // Grunge -> Rock
    U2: "Rock",
    "R.E.M.": "Rock", // Or 'Indie' if you prefer, but usually Rock for RS500
    Prince: "Rock", // (The hardest one. Could be Pop/Soul, but "Purple Rain" is Rock)

    // --- R&B / SOUL (The Groove, The Motown, The Gospel) ---
    "Aretha Franklin": "R&B/Soul",
    "Ray Charles": "R&B/Soul",
    "Otis Redding": "R&B/Soul",
    "Sam Cooke": "R&B/Soul",
    "Al Green": "R&B/Soul",
    "Marvin Gaye": "R&B/Soul",
    "Stevie Wonder": "R&B/Soul",
    "James Brown": "R&B/Soul",
    "The Ronettes": "R&B/Soul",
    "The Supremes": "R&B/Soul",
    "The Temptations": "R&B/Soul",
    "Smokey Robinson": "R&B/Soul",
    "Roberta Flack": "R&B/Soul",
    "Sly & The Family Stone": "R&B/Soul",
    Parliament: "R&B/Soul",
    Funkadelic: "R&B/Soul",
    "Earth, Wind & Fire": "R&B/Soul",
    Chic: "R&B/Soul",
    "Donna Summer": "R&B/Soul", // Disco -> R&B/Soul

    // --- POP (The Radio, The Divas, The Soft Stuff) ---
    "Michael Jackson": "Pop",
    Madonna: "Pop",
    ABBA: "Pop",
    "Whitney Houston": "Pop",
    "Mariah Carey": "Pop",
    "Kelly Clarkson": "Pop",
    "Britney Spears": "Pop",
    "Justin Timberlake": "Pop",
    "Elton John": "Pop", // Could be Rock, but fits Pop piano better
    "Billy Joel": "Pop", // Same as Elton

    // --- BLUES (The Pure Stuff) ---
    "B.B. King": "Blues",
    "Muddy Waters": "Blues",
    "Robert Johnson": "Blues",
    "Howlin' Wolf": "Blues",
    "John Lee Hooker": "Blues",

    // --- JAZZ (The Swing & Bop) ---
    "Miles Davis": "Jazz",
    "John Coltrane": "Jazz",
    "Dave Brubeck": "Jazz",
    "Louis Armstrong": "Jazz",
    "Bobby Darin": "Jazz", // "Mack the Knife"
    "Billie Holiday": "Jazz",
    "Ella Fitzgerald": "Jazz",

    // --- FOLK (The Acoustic Poets) ---
    "Bob Dylan": "Folk", // The exception to the "Rock" rule because he is THE Folk guy
    "Simon & Garfunkel": "Folk",
    "Joni Mitchell": "Folk",
    "Leonard Cohen": "Folk",
    "Tracy Chapman": "Folk",
    "Woody Guthrie": "Folk",

    // --- HIP HOP (The Beats) ---
    "Afrika Bambaataa & The Soulsonic Force": "Hip Hop",
    "Grandmaster Flash and the Furious Five": "Hip Hop",
    "Run-D.M.C.": "Hip Hop",
    "Public Enemy": "Hip Hop",
    "N.W.A": "Hip Hop",
    "Dr. Dre": "Hip Hop",
    OutKast: "Hip Hop",
    "Jay-Z": "Hip Hop",
    Eminem: "Hip Hop",
    "Kanye West": "Hip Hop",

    // --- COUNTRY (The Twang) ---
    "Johnny Cash": "Country",
    "Hank Williams": "Country",
    "Patsy Cline": "Country",
    "Dolly Parton": "Country",
    "Willie Nelson": "Country",
    "Merle Haggard": "Country",

    // --- REGGAE ---
    "Bob Marley & The Wailers": "Reggae",
    "Toots and the Maytals": "Reggae",
    "Jimmy Cliff": "Reggae",
  };

  // The "Target 10" List:
  // Jazz, Blues, Country, Folk, Hip Hop, Indie, Pop, R&B/Soul, Reggae, Rock

  function determineGenre(
    artistName: string,
    trackTitle: string,
    spotifyGenres: string[]
  ): string {
    // --- 1. OVERRIDES (The "I know better" layer) ---
    const songKey = trackTitle.toLowerCase();

    // Specific Song Fixes
    if (trackTitle.includes("Get Lucky")) return "R&B/Soul"; // Daft Punk (Disco/Funk)
    if (trackTitle.includes("River Deep")) return "R&B/Soul"; // Tina Turner (Soul era)

    const songOverrideGenre = SONG_OVERRIDES[songKey];
    if (songOverrideGenre) {
      return songOverrideGenre;
    }

    // Specific Artist Fixes (Manual Map)
    // Ensure your MANUAL_GENRES values match your Target 10 exactly!

    if (MANUAL_GENRES[artistName]) return MANUAL_GENRES[artistName];

    // --- 2. THE GRINCH (Clean the data) ---
    const cleanGenres = spotifyGenres.filter(
      (g) =>
        !g.includes("christmas") &&
        !g.includes("holiday") &&
        !g.includes("movie") &&
        !g.includes("soundtrack")
    );
    const combined = cleanGenres.join(" ").toLowerCase();

    // --- 3. DISTINCT BUCKETS (Easy to spot) ---

    // Hip Hop
    if (
      combined.includes("hip hop") ||
      combined.includes("rap") ||
      combined.includes("miami bass") ||
      combined.includes("electro")
    )
      return "Hip Hop";

    // Reggae
    if (
      combined.includes("reggae") ||
      combined.includes("ska") ||
      combined.includes("rocksteady") ||
      combined.includes("dub")
    )
      return "Reggae";

    // Country
    if (
      combined.includes("country") ||
      combined.includes("bluegrass") ||
      combined.includes("americana")
    )
      return "Country";

    // Jazz (Replaces Big Band)
    if (
      combined.includes("jazz") ||
      combined.includes("big band") ||
      combined.includes("bop") ||
      combined.includes("swing")
    )
      return "Jazz";

    // Blues
    if (
      combined.includes("blues") ||
      combined.includes("delta") ||
      combined.includes("chicago")
    )
      return "Blues";

    // Folk
    if (
      combined.includes("folk") ||
      combined.includes("singer-songwriter") ||
      combined.includes("acoustic")
    )
      return "Folk";

    // --- 4. THE NUANCE BUCKETS (Overlap danger) ---

    // R&B / Soul (Must come before Pop because "Soul" is often tagged "Pop Soul")
    if (
      combined.includes("soul") ||
      combined.includes("r&b") ||
      combined.includes("motown") ||
      combined.includes("funk") ||
      combined.includes("disco") ||
      combined.includes("doo-wop") ||
      combined.includes("gospel")
    ) {
      return "R&B/Soul";
    }

    // Indie (Optional: If you want to separate it from Rock)
    if (
      combined.includes("indie") ||
      combined.includes("alternative") ||
      combined.includes("shoegaze")
    ) {
      return "Indie";
    }

    // Rock (The Big Bucket - catches Metal, Punk, New Wave)
    if (
      combined.includes("rock") ||
      combined.includes("metal") ||
      combined.includes("punk") ||
      combined.includes("grunge") ||
      combined.includes("new wave") ||
      combined.includes("psychedelic")
    ) {
      return "Rock";
    }

    // 2. The "Keyword Fallback" (The Safety Net)
    const text = `${artistName} ${trackTitle}`.toLowerCase();

    // Classical cues
    if (
      text.includes("symphony") ||
      text.includes("orchestra") ||
      text.includes("bach ") ||
      text.includes("beethoven")
    ) {
      return "Classical";
    }

    // Jazz cues
    if (
      text.includes("quartet") ||
      text.includes("quintet") ||
      text.includes("miles davis") ||
      text.includes("coltrane")
    ) {
      return "Jazz";
    }

    // --- 5. THE CATCH-ALL ---

    // Pop (Catches everything left: Dance, Electronic, Teen Pop, Adult Standards)
    return "Pop";
  }

  try {
    // Parse CSV
    const rawData = parseCSV(CSV_PATH);
    console.log(`✅ Parsed ${rawData.length} songs`);

    // Optional: Enrich with Spotify API data
    let genreMap: Map<string, string> | undefined;
    const spotifyToken = await getSpotifyToken();
    // Use a typed Set for genre values
    const genreListSet = new Set<string>();

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
        // Try to find tune title from CSV first, fallback to track.name from Spotify response
        const csvRecord = rawData.find(
          (r) => String(r["Spotify id"]) === String(trackId)
        );
        const tuneName =
          csvRecord?.Title ??
          (track as unknown as { name?: string }).name ??
          "Unknown Title";

        const primaryArtistId = track.artists[0]?.id;
        if (primaryArtistId) {
          const artist = artistMap.get(primaryArtistId);

          const NO_GENRE_CSV = join(
            __dirname,
            "output",
            "artists_tunes_no_genre.csv"
          );

          // Ensure output dir exists
          const noGenreDir = dirname(NO_GENRE_CSV);
          if (!existsSync(noGenreDir)) {
            mkdirSync(noGenreDir, { recursive: true });
          }

          if (artist?.genres) {
            const normalizedGenre = determineGenre(
              artist.name,
              tuneName,
              artist.genres
            );
            if (normalizedGenre) {
              genreMap.set(trackId, normalizedGenre);
              genreListSet.add(normalizedGenre);
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
    const catalog: CatalogEntry[] = rawData.map((raw, index) =>
      convertToCatalogEntry(raw, index, genreMap)
    );

    // Remove duplicates by normalized title (case-insensitive, trimmed, single-spaced)
    const normalizeTitle = (t: string) =>
      t.replace(/\s+/g, " ").trim().toLowerCase();

    const uniqueMap = new Map<string, CatalogEntry>();
    for (const entry of catalog) {
      const key = normalizeTitle(entry.title);
      if (!uniqueMap.has(key)) uniqueMap.set(key, entry);
    }
    const uniqueCatalog = Array.from(uniqueMap.values());

    // Randomize order to avoid copyright issues with the specific ranking
    const shuffledCatalog = uniqueCatalog.sort(() => Math.random() - 0.5);

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

    // Also emit a SQL file that loads this catalog into Supabase Postgres.
    // NOTE:
    // - `id` is generated as UUIDv7 for good B-tree locality on inserts.
    // - `id_foreign` is the stable Rolling Stone ID (`rs-500-####`).
    // We intentionally omit `sync_version` and `last_modified_at` so Postgres
    // defaults apply.
    const SUPABASE_SEED_SQL_PATH = join(
      __dirname,
      "..",
      "..",
      "supabase",
      "seeds",
      "rsTop500.sql"
    );
    const TUNE_ID_MAP_PATH = join(
      __dirname,
      "output",
      "rsTop500_tune_id_map.json"
    );

    type TuneIdMap = Record<string, string>;

    const isUuid = (value: string): boolean =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        value
      );

    const readTuneIdMapFromJson = (filePath: string): TuneIdMap | null => {
      if (!existsSync(filePath)) return null;
      try {
        const parsed = JSON.parse(readFileSync(filePath, "utf-8")) as unknown;
        if (!parsed || typeof parsed !== "object") return null;

        const map: TuneIdMap = {};
        for (const [foreignId, tuneId] of Object.entries(
          parsed as Record<string, unknown>
        )) {
          if (typeof foreignId !== "string") continue;
          if (typeof tuneId !== "string") continue;
          if (!foreignId.startsWith("rs-500-")) continue;
          if (!isUuid(tuneId)) continue;
          map[foreignId] = tuneId;
        }

        return Object.keys(map).length > 0 ? map : null;
      } catch {
        return null;
      }
    };

    const readTuneIdMapFromSeedSql = (filePath: string): TuneIdMap | null => {
      if (!existsSync(filePath)) return null;

      const sqlTextContent = readFileSync(filePath, "utf-8");
      const insertStart = sqlTextContent.indexOf("INSERT INTO public.tune");
      if (insertStart === -1) return null;

      const after = sqlTextContent.slice(insertStart);
      const insertEnd = after.indexOf(";\n");
      const block = insertEnd === -1 ? after : after.slice(0, insertEnd);

      // Tuple format begins with: ('<tune_uuid>', '<id_foreign>', ...)
      const tupleRegex =
        /\(\s*'([0-9a-f-]{36})'\s*,\s*'(rs-500-[0-9]{4})'\s*,/gi;

      const map: TuneIdMap = {};
      for (const match of block.matchAll(tupleRegex)) {
        const tuneId = match[1];
        const foreignId = match[2];
        if (!tuneId || !foreignId) continue;
        if (!isUuid(tuneId)) continue;
        map[foreignId] = tuneId;
      }

      return Object.keys(map).length > 0 ? map : null;
    };

    const sqlEscape = (value: string) => value.replace(/'/g, "''");
    const sqlText = (value: string | null | undefined): string => {
      if (value == null) return "NULL";
      const trimmed = value.trim();
      if (!trimmed) return "NULL";
      return `'${sqlEscape(trimmed)}'`;
    };
    const sqlInt = (value: number | undefined): string => {
      if (typeof value !== "number" || !Number.isFinite(value)) return "NULL";
      return String(Math.trunc(value));
    };

    const normalizeTuneMode = (
      raw: string | null | undefined
    ): string | null => {
      if (raw == null) return null;

      const cleaned = raw.replace(/\s+/g, " ").trim();
      if (!cleaned) return null;

      const toTitle = (value: string): string =>
        value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();

      const normalizeNote = (
        letter: string,
        accidental: string | undefined
      ): string => {
        const noteLetter = letter.toUpperCase();
        const acc = accidental === "#" ? "#" : accidental ? "b" : "";
        const note = `${noteLetter}${acc}`;

        // Prefer flat spellings to match existing DB values (e.g. Bb, Eb).
        const enharmonicToFlat: Record<string, string> = {
          "A#": "Bb",
          "C#": "Db",
          "D#": "Eb",
          "F#": "Gb",
          "G#": "Ab",
        };
        return enharmonicToFlat[note] ?? note;
      };

      const modeMap: Record<string, string> = {
        dor: "Dorian",
        mix: "Mixolydian",
        aeo: "Aeolian",
        ion: "Ionian",
        min: "Minor",
        maj: "Major",
        lyd: "Lydian",
        phr: "Phrygian",
        loc: "Locrian",
      };

      // Full-word forms: "G Major", "Bb Minor", "D Mixolydian".
      const fullWordMatch = cleaned.match(
        /^([A-Ga-g])\s*([#b])?\s*(major|minor|dorian|mixolydian|aeolian|ionian|lydian|phrygian|locrian)$/i
      );
      if (fullWordMatch) {
        const note = normalizeNote(fullWordMatch[1], fullWordMatch[2]);
        const mode = toTitle(fullWordMatch[3]);
        return `${note} ${mode}`;
      }

      // Abbreviated forms: "Ador", "Dmix", "Emin", "Bbmaj".
      const abbrMatch = cleaned.match(
        /^([A-Ga-g])\s*([#b])?\s*(dor|mix|aeo|ion|min|maj|lyd|phr|loc)$/i
      );
      if (abbrMatch) {
        const note = normalizeNote(abbrMatch[1], abbrMatch[2]);
        const mode = modeMap[abbrMatch[3].toLowerCase()];
        return mode ? `${note} ${mode}` : `${note} Major`;
      }

      // Note-only forms: "D", "F#", "Bb" => assume Major.
      const noteOnlyMatch = cleaned.match(/^([A-Ga-g])\s*([#b])?$/);
      if (noteOnlyMatch) {
        const note = normalizeNote(noteOnlyMatch[1], noteOnlyMatch[2]);
        return `${note} Major`;
      }

      // If already has a space but is oddly-cased, try a soft normalization.
      const parts = cleaned.split(" ");
      if (parts.length === 2) {
        const notePart = parts[0];
        const modePart = parts[1];
        const soft = notePart.match(/^([A-Ga-g])([#b])?$/);
        const modeKey = modePart.toLowerCase();
        if (
          soft &&
          (modeMap[modeKey.slice(0, 3)] ||
            modeKey in
              {
                major: 1,
                minor: 1,
                dorian: 1,
                mixolydian: 1,
                aeolian: 1,
                ionian: 1,
                lydian: 1,
                phrygian: 1,
                locrian: 1,
              })
        ) {
          const note = normalizeNote(soft[1], soft[2]);
          const mode =
            modeKey.length <= 3 ? modeMap[modeKey] : toTitle(modeKey);
          if (mode) return `${note} ${mode}`;
        }
      }

      return cleaned;
    };

    // Build genre SQL first so it can be included in the Supabase seed SQL ahead of tunes.
    // Source is ingest/top500/output/genres_list.csv (two columns: id, description).
    const GENRES_CSV_PATH = join(__dirname, "output", "genres_list.csv");
    const GENRES_SQL_PATH = join(__dirname, "output", "public_genres.sql");

    const unquoteCsvValue = (value: string): string => {
      const trimmed = value.trim();
      if (
        trimmed.length >= 2 &&
        trimmed.startsWith('"') &&
        trimmed.endsWith('"')
      ) {
        return trimmed.slice(1, -1).replace(/""/g, '"').trim();
      }
      return trimmed;
    };

    let genreRowsSqlForCatalog: string | null = null;
    if (existsSync(GENRES_CSV_PATH)) {
      const genresCsv = readFileSync(GENRES_CSV_PATH, "utf-8");

      // genres_list.csv is intentionally simple: two columns (id, description).
      // Some descriptions contain commas, so we split on the first comma only.
      const genreRows = genresCsv
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => {
          const commaIndex = line.indexOf(",");
          const idRaw = commaIndex === -1 ? line : line.slice(0, commaIndex);
          const descRaw = commaIndex === -1 ? "" : line.slice(commaIndex + 1);

          const id = unquoteCsvValue(idRaw);
          const description = unquoteCsvValue(descRaw);

          if (!id) return null;
          return `(${sqlText(id)}, ${sqlText(id)}, NULL, ${sqlText(description)})`;
        })
        .filter((row): row is string => row !== null)
        .join(",\n");

      genreRowsSqlForCatalog = genreRows;

      const genresSql = `-- Auto-generated by ingest/top500/top500.ts\n-- Generated at: ${new Date().toISOString()}\n\nBEGIN;\n\nINSERT INTO public.genre\n  (id, name, region, description)\nVALUES\n${genreRows}\n;\n\nCOMMIT;\n`;

      writeFileSync(GENRES_SQL_PATH, genresSql, "utf-8");
      console.log(`💾 Writing genre SQL to: ${GENRES_SQL_PATH}`);
    } else {
      console.warn(`⚠️  genres_list.csv not found: ${GENRES_CSV_PATH}`);
    }

    // Stable tune IDs across regenerations:
    // 1) Prefer the explicit JSON map in ingest/top500/output.
    // 2) Otherwise, try to parse the existing supabase seed SQL.
    // 3) Otherwise, generate fresh UUIDv7s.
    const existingTuneIdMap: TuneIdMap =
      readTuneIdMapFromJson(TUNE_ID_MAP_PATH) ??
      readTuneIdMapFromSeedSql(SUPABASE_SEED_SQL_PATH) ??
      {};

    let wroteTuneIdMap = false;
    const generatedTunes = shuffledCatalog.map((entry) => {
      const existingTuneId = existingTuneIdMap[entry.id];
      if (existingTuneId && isUuid(existingTuneId)) {
        return { entry, tuneId: existingTuneId };
      }

      const tuneId = generateId();
      existingTuneIdMap[entry.id] = tuneId;
      wroteTuneIdMap = true;
      return { entry, tuneId };
    });

    // Persist the map so future regenerations stay stable.
    if (wroteTuneIdMap || !existsSync(TUNE_ID_MAP_PATH)) {
      const sortedMap = Object.fromEntries(
        Object.entries(existingTuneIdMap).sort(([a], [b]) => a.localeCompare(b))
      );
      writeFileSync(
        TUNE_ID_MAP_PATH,
        JSON.stringify(sortedMap, null, 2),
        "utf-8"
      );
      console.log(`💾 Writing tune id map to: ${TUNE_ID_MAP_PATH}`);
    }

    const tuneRowsSql = generatedTunes
      .map(
        ({ entry, tuneId }) =>
          `(${sqlText(tuneId)}, ${sqlText(entry.id)}, ${sqlText(entry.title)}, ${sqlText(entry.artist)}, ${sqlText(entry.composer)}, ${sqlInt(entry.year)}, ${sqlText(entry.genre)}, ${sqlText(entry.origin)}, ${sqlText("Song")}, ${sqlText(normalizeTuneMode(entry.key))}, NULL, false)`
      )
      .join(",\n");

    const referenceRowsSql = generatedTunes
      .flatMap(({ entry, tuneId }) => {
        const youtubeUrl = generateYouTubeLink(entry.title, entry.artist);
        const chordieUrl = generateChordieLink(entry.title, entry.artist);
        const spotifyUrl = generateSpotifyLink(entry.title, entry.artist);

        return [
          `(${sqlText(generateId())}, ${sqlText(youtubeUrl)}, ${sqlText("website")}, ${sqlText(tuneId)}, NULL, ${sqlText("YouTube")}, true)`,
          `(${sqlText(generateId())}, ${sqlText(chordieUrl)}, ${sqlText("website")}, ${sqlText(tuneId)}, NULL, ${sqlText("Chordie")}, true)`,
          `(${sqlText(generateId())}, ${sqlText(spotifyUrl)}, ${sqlText("website")}, ${sqlText(tuneId)}, NULL, ${sqlText("Spotify")}, true)`,
        ];
      })
      .join(",\n");

    const genreInsertSqlForCatalog = genreRowsSqlForCatalog
      ? `INSERT INTO public.genre\n  (id, name, region, description)\nVALUES\n${genreRowsSqlForCatalog}\n;\n\n`
      : "";

    const sql = `-- Auto-generated by ingest/top500/top500.ts\n-- Generated at: ${new Date().toISOString()}\n\nBEGIN;\n\n${genreInsertSqlForCatalog}INSERT INTO public.tune\n  (id, id_foreign, title, artist, composer, release_year, genre, primary_origin, type, mode, private_for, deleted)\nVALUES\n${tuneRowsSql}\n;\n\nINSERT INTO public.reference\n  (id, url, ref_type, tune_ref, user_ref, title, public)\nVALUES\n${referenceRowsSql}\n;\n\nCOMMIT;\n`;

    // Keep the local Supabase seed in sync (used by `supabase db reset`).
    const seedDir = dirname(SUPABASE_SEED_SQL_PATH);
    if (!existsSync(seedDir)) {
      mkdirSync(seedDir, { recursive: true });
    }
    writeFileSync(SUPABASE_SEED_SQL_PATH, sql, "utf-8");
    console.log(`💾 Writing Supabase seed SQL to: ${SUPABASE_SEED_SQL_PATH}`);

    const GENRES_FILE = join(__dirname, "output", "genres_list.txt");
    const genresDir = dirname(GENRES_FILE);
    if (!existsSync(genresDir)) {
      mkdirSync(genresDir, { recursive: true });
    }
    const genresArray = Array.from(genreListSet).sort();
    try {
      writeFileSync(GENRES_FILE, genresArray.join("\n"), "utf-8");
      console.log(`💾 Wrote ${genresArray.length} genres to: ${GENRES_FILE}`);
    } catch (err) {
      console.error("❌ Failed to write genres_list.txt:", err);
    }

    // NOTE: public_genres.sql is also emitted above (and the same rows are embedded
    // into the Supabase seed SQL ahead of public.tune).

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
  generateSpotifyLink,
  mapSpotifyKey,
};
