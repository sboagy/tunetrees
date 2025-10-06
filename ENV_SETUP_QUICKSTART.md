# Quick Environment Setup - TL;DR

## 1. Create Supabase Project

→ https://app.supabase.com → New Project

## 2. Get Your Keys

**From Supabase Dashboard:**

```
Settings → API
├── Project URL:     Copy this → VITE_SUPABASE_URL
├── anon public:     Copy this → VITE_SUPABASE_ANON_KEY
└── service_role:    Copy this → SUPABASE_SERVICE_ROLE_KEY

Settings → Database
├── Click "Connect" button → Connection Pooling → URI
└── Copy and replace [YOUR-PASSWORD] → DATABASE_URL
```

## 3. Update `.env` File

**Option A: Use existing `.env` file**

Add these 4 lines to your `.env`:

```bash
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
DATABASE_URL=postgresql://postgres.xxxxx:password@aws-0-us-west-1.pooler.supabase.com:6543/postgres
```

**Option B: Use `.env.local` (since you already have it)**

Add the same 4 lines to your `.env.local` instead.

## 4. Test Connection

```bash
npx drizzle-kit push
```

Should see: ✓ Connected to database

---

## That's It! 🎉

**Next:** Push your schema to Supabase and start building!

Full guide: `ENVIRONMENT_SETUP.md`
