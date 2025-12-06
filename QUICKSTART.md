# TuneTrees SolidJS PWA - Quick Start Guide

**Branch:** `feat/pwa1`  
**Phase:** Phase 1 Complete ✅  
**Last Updated:** October 5, 2025

---

## What's Working Now

✅ **Authentication System:**

- Email/password sign up and sign in
- OAuth (Google, GitHub)
- Session persistence
- Protected routes

✅ **Database:**

- PostgreSQL on Supabase (cloud)
- SQLite WASM (local/offline)
- Drizzle ORM for type-safe queries
- Row Level Security policies

✅ **Routing:**

- Home page (landing)
- Login page
- Practice page (protected)

---

## Prerequisites

- Node.js 18+ and npm
- Supabase account (free tier is fine)
- Git

---

## Setup Instructions

### 1. Clone and Install

```bash
cd tunetrees
npm install
```

### 2. Environment Configuration

Create `.env.local` file:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Database URL (for migrations)
DATABASE_URL=postgresql://postgres:your-password@db.xxxxx.supabase.co:5432/postgres
```

**Get these values from Supabase:**

1. Go to [supabase.com](https://supabase.com)
2. Create a new project (or use existing)
3. Go to Settings → API
4. Copy `URL` and `anon` key
5. Go to Settings → Database
6. Copy connection string

### 3. Database Setup

The schema is already deployed, but to redeploy:

```bash
# Push schema to Supabase
npx drizzle-kit push

# Apply RLS policies
npx tsx scripts/apply-rls-policies.ts
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Using the App

### Create an Account

1. Click "Get Started Free" on home page
2. You'll be redirected to `/login`
3. Toggle to "Create Account"
4. Enter:
   - Name: Your name
   - Email: your.email@example.com
   - Password: At least 6 characters
5. Click "Create Account"
6. You'll be redirected to `/practice`

### Sign In

1. Go to `/login`
2. Enter your email and password
3. Click "Sign In"
4. You'll be redirected to `/practice`

### OAuth Sign In (Google/GitHub)

1. Go to `/login`
2. Click "Continue with Google" or "Continue with GitHub"
3. Authorize in popup
4. You'll be redirected back to `/practice`

**Note:** OAuth requires Supabase OAuth configuration in your project settings.

### Sign Out

1. On `/practice` page
2. Click "Sign Out" button in top right
3. You'll be redirected to `/login`

---

## Project Structure

```
src/
├── components/
│   └── auth/
│       ├── LoginForm.tsx       # Login/signup form
│       ├── LogoutButton.tsx    # Logout button
│       ├── ProtectedRoute.tsx  # Route guard
│       └── index.ts            # Barrel export
├── lib/
│   ├── auth/
│   │   └── AuthContext.tsx     # Auth state management
│   ├── db/
│   │   ├── client-postgres.ts  # Supabase PostgreSQL client
│   │   ├── client-sqlite.ts    # SQLite WASM client
│   │   └── index.ts            # DB exports
│   └── supabase/
│       └── client.ts           # Supabase config
├── routes/
│   ├── Home.tsx                # Landing page (/)
│   ├── Login.tsx               # Login page (/login)
│   └── practice/
│       └── Index.tsx           # Practice page (/practice)
├── App.tsx                     # Main app with router
└── index.tsx                   # Entry point
```

---

## Development Commands

```bash
# Start dev server
npm run dev

# Type check
npm run typecheck

# Lint
npm run lint

# Format code
npm run format

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## Authentication Flow

### Sign Up Flow

```
User fills form → signUp() → Supabase creates account
  → Auto sign-in → Initialize local DB → Redirect to /practice
```

### Sign In Flow

```
User fills form → signIn() → Supabase validates credentials
  → Set user/session → Initialize local DB → Redirect to /practice
```

### OAuth Flow

```
User clicks OAuth button → signInWithOAuth() → Redirect to provider
  → User authorizes → Redirect back to app → Supabase creates session
  → Initialize local DB → Redirect to /practice
```

### Protected Route Flow

```
User visits /practice → ProtectedRoute checks user()
  → If authenticated: Show page
  → If not authenticated: Redirect to /login
  → If loading: Show spinner
```

---

## Database Architecture

### Dual Database System

**PostgreSQL (Supabase):**

- Cloud database
- Single source of truth
- Real-time sync capabilities
- Row Level Security

**SQLite WASM (Browser):**

- Local database
- Offline-first
- Auto-persistence to IndexedDB
- Same schema as PostgreSQL

**Sync Strategy:**

- All reads: Local SQLite (fast)
- All writes: Local first, then queue for Supabase sync
- Periodic sync from Supabase to SQLite
- Conflict resolution: Last-write-wins

---

## Troubleshooting

### "Invalid URL" Error in Drizzle

**Problem:** Square brackets in password breaking DATABASE_URL.

**Solution:**

```bash
# Remove [ ] from password in .env.local
# WRONG: [gYqFUo7tjOWYlJxZ]
# RIGHT: gYqFUo7tjOWYlJxZ
```

### TypeScript Errors

**Problem:** `any` types or missing type definitions.

**Solution:**

```bash
npm run typecheck  # See specific errors
npm install @types/missing-package  # Install types if needed
```

### Auth Not Working

**Check:**

1. `.env.local` has correct Supabase URL and anon key
2. Supabase project is active
3. Browser console for errors
4. Network tab shows requests to Supabase

### Local Database Not Initializing

**Check:**

1. Browser supports WASM (all modern browsers do)
2. Console logs for initialization errors
3. IndexedDB is enabled in browser
4. `/sql-wasm/` files exist in `public/` directory

### OAuth Not Working

**Setup Required:**

1. Go to Supabase Dashboard → Authentication → Providers
2. Enable Google/GitHub provider
3. Add OAuth credentials (client ID, secret)
4. Add redirect URLs: `http://localhost:5173` for dev

---

## Testing

### Manual Testing

**Authentication:**

- [ ] Sign up with email/password
- [ ] Sign in with email/password
- [ ] Sign in with Google (if configured)
- [ ] Sign in with GitHub (if configured)
- [ ] Sign out
- [ ] Session persists on page reload

**Routing:**

- [ ] Home page shows landing
- [ ] "Get Started" navigates to login
- [ ] Login form works
- [ ] Successful login redirects to practice
- [ ] Practice page shows user info
- [ ] Logout redirects to login
- [ ] Direct access to /practice redirects to /login when logged out
- [ ] Direct access to /login redirects to /practice when logged in

**Database:**

- [ ] Local DB status shows "initialized" after login
- [ ] User ID displays correctly
- [ ] Email displays correctly

### Automated Testing (TODO)

```bash
# Unit tests (not yet implemented)
npm run test

# E2E tests (not yet implemented)
npm run test:e2e
```

---

## Next Development Steps

### Immediate (Phase 2)

1. **Tune Library:**

   - List view component
   - Search and filters
   - Tune details page

2. **Tune Editor:**

   - ABC notation input
   - Live preview with abcjs
   - Save to database

3. **Data Sync:**
   - Implement sync queue
   - Background sync service
   - Conflict resolution

### Future (Phase 3+)

- Practice queue with FSRS
- Practice session interface
- Statistics and charts
- PWA features (service worker, offline mode)

---

## Common Tasks

### Add a New Route

1. Create route component in `src/routes/`
2. Add route to `src/App.tsx`:
   ```tsx
   <Route path="/new-route" component={NewRoute} />
   ```
3. For protected route:
   ```tsx
   <Route
     path="/new-route"
     component={() => (
       <ProtectedRoute>
         <NewRoute />
       </ProtectedRoute>
     )}
   />
   ```

### Add a New Database Table

1. Add table to `drizzle/schema.ts`
2. Run migration:
   ```bash
   npx drizzle-kit push
   ```
3. Add RLS policies to `drizzle/migrations/postgres/0001_rls_policies.sql`
4. Apply policies:
   ```bash
   npx tsx scripts/apply-rls-policies.ts
   ```

### Add a New UI Component

1. Create component in `src/components/`
2. Export from barrel file if in a directory
3. Use in routes or other components:
   ```tsx
   import { MyComponent } from "@/components/MyComponent";
   ```

---

## Resources

**Documentation:**

- [SolidJS Docs](https://www.solidjs.com/docs/latest)
- [Supabase Docs](https://supabase.com/docs)
- [Drizzle ORM Docs](https://orm.drizzle.team/)
- [@solidjs/router Docs](https://github.com/solidjs/solid-router)

**Internal Docs:**

- `_notes/phase-1-final-summary.md` - Complete Phase 1 documentation
- `_notes/task-5-completion-summary.md` - Auth UI components
- `src/lib/db/README.md` - Database client usage
- `.github/copilot-instructions.md` - Project guidelines

**Migration Plan:**

- `_notes/solidjs-pwa-migration-plan.md` - Full migration strategy
- `_notes/schema-migration-strategy.md` - Database migration details

---

## Getting Help

**Issues:**

1. Check TypeScript errors: `npm run typecheck`
2. Check lint warnings: `npm run lint`
3. Check browser console for runtime errors
4. Review Supabase logs in dashboard

**Questions:**

- Review `_notes/` documentation
- Check `.github/copilot-instructions.md` for patterns
- Ask GitHub Copilot for help

---

**Happy coding! 🎵**
