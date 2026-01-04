# TuneTrees Documentation

Welcome to the TuneTrees documentation. This directory contains guides for both users and developers.

## Documentation Structure

```
docs/
├── user/                    # End-user documentation
│   ├── getting-started.md   # Quick start for new users
│   ├── features.md          # Feature overview
│   └── faq.md               # Frequently asked questions
│
├── development/             # Developer documentation
│   ├── setup.md             # Development environment setup
│   ├── architecture.md      # System architecture overview
│   ├── database.md          # Database schema and sync
│   ├── testing.md           # Testing guide
│   └── deployment.md        # Deployment procedures
│
├── reference/               # Technical reference (detailed)
│   ├── pwa.md               # PWA implementation details
│   ├── sync.md              # Sync engine internals
│   ├── scheduling.md        # Spaced repetition algorithms
│   └── spaced-repetition-terminology.md
│
├── practice_flow.md         # Detailed practice flow code map
│
└── _archive/                # Historical docs (outdated)
```

## Quick Links

### For Users
- [Getting Started](user/getting-started.md) - Install and start using TuneTrees
- [Features](user/features.md) - Learn what TuneTrees can do
- [FAQ](user/faq.md) - Common questions answered

### For Developers
- [Setup Guide](development/setup.md) - Set up your development environment
- [Architecture](development/architecture.md) - Understand the system design
- [Database](development/database.md) - Database schema and sync architecture
- [Testing](development/testing.md) - Run and write tests
- [Deployment](development/deployment.md) - Deploy to production
- [Sync Diagnostics](development/setup.md) - Enable `VITE_SYNC_DIAGNOSTICS` and optional worker `SYNC_DIAGNOSTICS`

### Technical Reference
- [PWA Details](reference/pwa.md) - Service worker, caching, offline
- [Sync Engine](reference/sync.md) - Bidirectional sync internals
- [Scheduling](reference/scheduling.md) - FSRS spaced repetition

---

**Project:** [TuneTrees on GitHub](https://github.com/sboagy/tunetrees)  
**Live App:** [tunetrees.com](https://tunetrees.com)

