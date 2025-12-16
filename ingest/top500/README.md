# Top 500 Songs Catalog Ingest

This directory contains scripts for processing the Rolling Stone Top 500 dataset into a TuneTrees-compatible catalog.

## Quick Start

```bash
# Run directly with tsx (recommended for development)
cd ingest/top500
tsx top500.ts

# Or from project root
tsx ingest/top500/top500.ts

# Or use the npm script
npm run ingest:top500
```

**Note:** This is development tooling only. All files remain in `ingest/top500/` directory.

## Setup

1. Place your `rollingstone.csv` file in this directory
2. The CSV should have columns like: `Artist`, `Title`, `Year`, `key`, `mode`, etc.
3. Run the script to generate `output/public_catalog.json` (in this directory)

## Files

- `top500.ts` - Main ingest script
- `rollingstone.csv` - Source data (gitignored)
- `tsconfig.json` - TypeScript configuration for this directory
- `.gitignore` - Prevents committing source CSV files

## Output

The script generates a JSON catalog at `output/public_catalog.json` (in this directory) with entries like:

```json
{
  "id": "rs-500-0001",
  "title": "Song Title",
  "artist": "Artist Name",
  "year": 1975,
  "links": {
    "youtube": "https://www.youtube.com/results?search_query=...",
    "chordie": "https://www.chordie.com/songs.php?q=..."
  },
  "origin": "rolling_stone_top_500_v1"
}
```

## Development

The script is written in TypeScript and can be:
- Executed directly with `tsx`
- Imported as a module for testing
- Extended with additional data enrichment (Spotify API, etc.)

## Next Steps

- [ ] Add Spotify API integration for key/BPM data
- [ ] Add genre mapping logic
- [ ] Add composer field support
- [ ] Create validation tests
