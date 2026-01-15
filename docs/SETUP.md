# TuneTrees Development Setup Guide

**Last Updated:** October 15, 2025  
**Consolidated from:** ENV_SETUP_QUICKSTART.md, ENVIRONMENT_SETUP.md, GITHUB_ACTIONS_SECRETS.md

---

## Quick Start

### Prerequisites

- Node.js 20+
- npm or pnpm
- Git

### Local Development Setup

```bash
# 1. Clone repository
git clone https://github.com/sboagy/tunetrees.git
cd tunetrees

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# 4. Start development server
npm run dev
```

Server runs on http://localhost:5173

---

## Environment Variables

### Required Variables

**Supabase Configuration:**
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Database (for local testing):**
```env
DATABASE_URL=file:./tunetrees_local.sqlite3
```

### GitHub Actions Secrets

For CI/CD, configure these in GitHub repository settings:

- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key
- `CLOUDFLARE_API_TOKEN` - Cloudflare deployment token
- `CLOUDFLARE_ACCOUNT_ID` - Cloudflare account ID

---

## Development Commands

```bash
# Start dev server
npm run dev

# Type checking
npm run typecheck

# Linting
npm run lint

# Formatting
npm run format

# Run tests
npm run test
npm run test:e2e

# Build for production
npm run build
npm run preview  # Preview production build
```

---

## Supabase Setup

### 1. Create Supabase Project

1. Go to https://supabase.com
2. Create new project
3. Copy project URL and anon key
4. Add to `.env.local`

### 2. Database Schema

Schema is managed with Drizzle ORM:

```bash
# Generate migration
npm run db:generate

# Push schema to Supabase
npm run db:push
```

### 3. Authentication Setup

Enable email/password auth in Supabase dashboard:
- Authentication → Providers → Email
- Configure email templates
- Set site URL to http://localhost:5173

For OAuth providers (Google, GitHub):
- See [OAuth Setup Guide](development/oauth-setup.md) for detailed configuration
- OAuth requires client credentials from Google/GitHub developer consoles
- Configuration is in `supabase/config.toml` for local dev
- For production, configure in Supabase Dashboard → Authentication → Providers

---

## Troubleshooting

### Common Issues

**"Module not found" errors:**
```bash
rm -rf node_modules package-lock.json
npm install
```

**Supabase connection errors:**
- Check `.env.local` has correct URL and key
- Verify Supabase project is running
- Check network connectivity

**TypeScript errors:**
```bash
npm run typecheck
```

**Database schema out of sync:**
```bash
npm run db:push
```

---

## TODO: Content to Add

- [ ] Extract environment setup details from ENV_SETUP_QUICKSTART.md
- [ ] Extract detailed setup from ENVIRONMENT_SETUP.md
- [ ] Add GitHub Actions secrets configuration from GITHUB_ACTIONS_SECRETS.md
- [ ] Add IDE setup recommendations (VS Code extensions)
- [ ] Add troubleshooting guide
- [ ] Add local database setup instructions

---

**See Also:**
- [Deployment Guide](DEPLOYMENT.md)
- [Database Migration Guide](DATABASE_MIGRATION.md)
- [Migration Plan](_notes/solidjs-pwa-migration-plan.md)
