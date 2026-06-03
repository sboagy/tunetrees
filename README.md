<p align="center">
  <img src="public/logo4.png" alt="TuneTrees Logo" width="120" height="120">
</p>

# TuneTrees

**Practice management for musicians** — Track repertoire, schedule reviews with spaced repetition, and keep organized notes.

TuneTrees is built for tune-based traditions:

- Irish/Scottish/Cape Breton trad
- Old-time, bluegrass
- Jazz standards
- Folk songs
- Any repertoire where you're building a "book" of discrete pieces

🎵 **[tunetrees.com](https://tunetrees.com)** | 📖 [Documentation](docs/README.md) | 🐛 [Issues](https://github.com/sboagy/tunetrees/issues)

## Status

⚠️ Work in Progress — Functional but not feature complete. [See roadmap →](https://github.com/users/sboagy/projects/1/views/5)

## Features

- 🎯 **Spaced Repetition** — FSRS algorithm schedules reviews at optimal intervals
- 📱 **Works Offline** — Full functionality without internet, syncs when connected
- ☁️ **Cloud Sync** — Practice on any device, data syncs automatically
- 🎸 **Any Instrument** — Multiple Repertoires
- 🎯 **Goal Focused** — Per-tune goal setting

## Quick Start

### Use the App

Visit **[tunetrees.com](https://tunetrees.com)** — no install required!

Install as an app:
- **iOS:** Safari → Share → Add to Home Screen
- **Android:** Chrome → Menu → Install app
- **Desktop:** Chrome → Install icon in address bar

### Run Locally

```bash
git clone https://github.com/sboagy/tunetrees.git
cd tunetrees
npm install
cp .env.example .env.local  # Add Supabase credentials
npm run dev
```

Open http://localhost:5173

### Sync Diagnostics (Optional)

To help debug sync performance and E2E flakiness, you can enable compact per-sync diagnostics logs:

- Client (browser): set `VITE_SYNC_DIAGNOSTICS=true`
- Worker (optional): set `SYNC_DIAGNOSTICS=true` (and optionally `SYNC_DIAGNOSTICS_USER_ID=<supabase auth uid>`)

See [Developer Setup](docs/development/setup.md) and [Deployment](docs/development/deployment.md) for details.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | SolidJS, TypeScript, Tailwind CSS |
| Local DB | SQLite WASM (@sqlite.org/sqlite-wasm) + Drizzle ORM |
| Cloud | Supabase (PostgreSQL, Auth, Realtime) |
| PWA | Vite PWA + Workbox |
| Deploy | Cloudflare Pages |

## Documentation

- **[User Guide](docs/user/getting-started.md)** — Getting started, features, FAQ
- **[Developer Setup](docs/development/setup.md)** — Run locally, contribute
- **[Architecture](docs/development/architecture.md)** — System design
- **[oosync Config Reference](oosync/README.md)** — `oosync.codegen.config.json` and worker `paramMap` bindings
- **[Full Docs](docs/README.md)** — Complete documentation index

## Scripts

```bash
npm run dev        # Development server
npm run build      # Production build
npm run test       # Unit tests
npm run test:e2e   # E2E tests (Playwright)
npm run typecheck  # TypeScript check
npm run lint       # Biome lint

# Schema codegen (Postgres → SQLite)
npm run codegen:schema       # Generate drizzle/schema-sqlite.generated.ts via Postgres introspection
npm run schema:sqlite:check  # Drift guard (alias of codegen:schema:check)
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `npm run typecheck && npm run lint && npm run test`
5. Submit a pull request

See [Development Setup](docs/development/setup.md) for details.

## License

[MIT](LICENSE)
