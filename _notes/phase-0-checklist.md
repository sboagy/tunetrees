# Phase 0: Project Setup & Infrastructure - Checklist

**Status:** Ready to Begin  
**Target Completion:** 1-2 weeks  
**Started:** October 4, 2025

---

## Prerequisites ✅

- [x] Create feature branch `feat/pwa1`
- [x] Migration scripts created (`migrate-to-legacy.sh`, `restore-from-legacy.sh`)
- [x] Migration plan documented (`_notes/solidjs-pwa-migration-plan.md`)
- [x] Deployment platform chosen (Cloudflare Pages)

---

## Step 1: Repository Migration

### Tasks

- [ ] **Run migration script**
  ```bash
  ./migrate-to-legacy.sh
  ```
- [ ] **Verify legacy code** is in `legacy/` and accessible
- [ ] **Review commit** with `git show HEAD --stat`
- [ ] **Push to GitHub**
  ```bash
  git push -u origin feat/pwa1
  ```

### Success Criteria

- ✅ All legacy code in `legacy/` directory
- ✅ Legacy code committed to git (not gitignored)
- ✅ Root directory clean except for docs/design/scripts
- ✅ `.gitignore` updated for SolidJS artifacts

---

## Step 2: Cloudflare Setup

### Tasks

- [ ] **Create Cloudflare account** at [cloudflare.com](https://www.cloudflare.com)
- [ ] **Create new Pages project**
  - Link to GitHub repository
  - Select `feat/pwa1` branch
  - Set build command: `npm run build`
  - Set build output directory: `dist`
- [ ] **Note the preview URL** (e.g., `tunetrees-pwa.pages.dev`)

### Configuration

```yaml
# Will add to repo later: wrangler.toml or pages configuration
```

### Success Criteria

- ✅ Cloudflare account created
- ✅ Pages project linked to GitHub
- ✅ Preview URL accessible

---

## Step 3: Supabase Setup

### Tasks

- [ ] **Create Supabase account** at [supabase.com](https://supabase.com)
- [ ] **Create new project**
  - Name: `tunetrees-pwa` (or similar)
  - Database password: (save securely)
  - Region: Choose closest to users
- [ ] **Note credentials:**
  ```
  Project URL: https://[your-project].supabase.co
  Anon Key: [your-anon-key]
  Service Role Key: [your-service-key] (keep secret!)
  Database Password: [your-db-password]
  ```
- [ ] **Configure authentication providers**
  - [ ] Email/Password (enabled by default)
  - [ ] Google OAuth (optional for Phase 1)
  - [ ] GitHub OAuth (optional for Phase 1)

### Database Setup

- [ ] **Review legacy schema** in `legacy/tunetrees/models/tunetrees.py`
- [ ] **Plan initial tables** (User, Playlist, Tune, etc.)
- [ ] Note: Will create schema in Phase 2 with Drizzle

### Success Criteria

- ✅ Supabase project created
- ✅ Credentials saved securely
- ✅ Authentication providers configured
- ✅ Database accessible via Supabase dashboard

---

## Step 4: Initialize SolidJS Project

### Tasks

- [ ] **Initialize Vite + SolidJS**

  ```bash
  npm create vite@latest . -- --template solid-ts
  ```

  When prompted:

  - Package name: `tunetrees-pwa`
  - Framework: `solid`
  - Variant: `solid-ts`

- [ ] **Install dependencies**

  ```bash
  npm install
  ```

- [ ] **Test dev server**
  ```bash
  npm run dev
  ```
  Should open at `http://localhost:5173`

### Success Criteria

- ✅ SolidJS project initialized
- ✅ Dependencies installed without errors
- ✅ Dev server runs successfully
- ✅ Default Solid template loads in browser

---

## Step 5: Install Core Dependencies

### Tasks

#### Core Framework

```bash
npm install @solidjs/router solid-js
```

#### Database & Sync

```bash
npm install drizzle-orm sql.js @supabase/supabase-js
npm install -D drizzle-kit
```

#### UI Components (Tailwind + Kobalte)

```bash
npm install @kobalte/core
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

#### External Libraries

```bash
npm install abcjs jodit
```

#### Development Tools

```bash
npm install -D vite-plugin-pwa @tailwindcss/vite
```

### Verify Installation

```bash
npm list --depth=0
```

### Success Criteria

- ✅ All core dependencies installed
- ✅ No peer dependency warnings
- ✅ `package.json` updated

---

## Step 6: Configure Environment Variables

### Tasks

- [ ] **Create `.env.local`**

  ```env
  # Supabase
  VITE_SUPABASE_URL=https://[your-project].supabase.co
  VITE_SUPABASE_ANON_KEY=[your-anon-key]

  # Development
  VITE_API_BASE_URL=http://localhost:5173

  # Feature Flags (optional)
  VITE_ENABLE_OFFLINE_MODE=true
  VITE_ENABLE_DEBUG=true
  ```

- [ ] **Update `.gitignore`** (already done by migration script)

  ```gitignore
  .env.local
  .env.production.local
  .env.development.local
  ```

- [ ] **Create `.env.example`** for documentation
  ```env
  VITE_SUPABASE_URL=
  VITE_SUPABASE_ANON_KEY=
  VITE_API_BASE_URL=
  ```

### Success Criteria

- ✅ `.env.local` created with real credentials
- ✅ `.env.example` created for reference
- ✅ Environment variables accessible in app

---

## Step 7: Configure Tailwind CSS

### Tasks

- [ ] **Update `tailwind.config.js`**

  ```javascript
  /** @type {import('tailwindcss').Config} */
  export default {
    content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
    theme: {
      extend: {},
    },
    plugins: [],
  };
  ```

- [ ] **Create `src/index.css`** (or update existing)

  ```css
  @tailwind base;
  @tailwind components;
  @tailwind utilities;
  ```

- [ ] **Import in `src/index.tsx`**

  ```typescript
  import "./index.css";
  ```

- [ ] **Test Tailwind** - add a styled component and verify

### Success Criteria

- ✅ Tailwind configured
- ✅ Styles apply correctly
- ✅ No console errors

---

## Step 8: Set Up Project Structure

### Tasks

- [ ] **Create directory structure**

  ```bash
  mkdir -p src/components/ui
  mkdir -p src/components/auth
  mkdir -p src/components/layouts
  mkdir -p src/routes
  mkdir -p src/lib/db
  mkdir -p src/lib/supabase
  mkdir -p src/lib/utils
  mkdir -p drizzle
  mkdir -p public/assets
  ```

- [ ] **Create placeholder files**
  ```bash
  touch src/lib/supabase/client.ts
  touch src/lib/db/schema.ts
  touch drizzle.config.ts
  ```

### Success Criteria

- ✅ Directory structure created
- ✅ Matches planned architecture
- ✅ Ready for component development

---

## Step 9: Configure Vite & PWA

### Tasks

- [ ] **Update `vite.config.ts`**

  ```typescript
  import { defineConfig } from "vite";
  import solid from "vite-plugin-solid";
  import { VitePWA } from "vite-plugin-pwa";

  export default defineConfig({
    plugins: [
      solid(),
      VitePWA({
        registerType: "autoUpdate",
        manifest: {
          name: "TuneTrees",
          short_name: "TuneTrees",
          description: "Practice Assistant for Musicians",
          theme_color: "#1a1a1a",
          icons: [
            // Will add icons later
          ],
        },
      }),
    ],
    server: {
      port: 5173,
    },
  });
  ```

- [ ] **Create basic manifest** (will enhance later)

### Success Criteria

- ✅ Vite configured
- ✅ PWA plugin installed
- ✅ Dev server runs on port 5173

---

## Step 10: Set Up Supabase Client

### Tasks

- [ ] **Create `src/lib/supabase/client.ts`**

  ```typescript
  import { createClient } from "@supabase/supabase-js";

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  export const supabase = createClient(supabaseUrl, supabaseAnonKey);
  ```

- [ ] **Test connection** with a simple component

  ```typescript
  // Test in App.tsx or similar
  import { supabase } from "./lib/supabase/client";

  // Try to fetch a simple query (will fail until tables exist, but tests connection)
  supabase.from("test").select("*").then(console.log);
  ```

### Success Criteria

- ✅ Supabase client configured
- ✅ No TypeScript errors
- ✅ Connection test runs (even if no tables yet)

---

## Step 11: Basic Routing Setup

### Tasks

- [ ] **Create basic routes**

  ```typescript
  // src/routes.ts
  import { lazy } from "solid-js";

  export const routes = [
    {
      path: "/",
      component: lazy(() => import("./routes/index")),
    },
    {
      path: "/login",
      component: lazy(() => import("./routes/login")),
    },
  ];
  ```

- [ ] **Update App.tsx** with Router

  ```typescript
  import { Router, Route } from "@solidjs/router";
  import { routes } from "./routes";

  function App() {
    return (
      <Router>
        {routes.map((route) => (
          <Route path={route.path} component={route.component} />
        ))}
      </Router>
    );
  }
  ```

- [ ] **Create placeholder route components**

### Success Criteria

- ✅ Routing configured
- ✅ Home page loads
- ✅ Can navigate between routes

---

## Step 12: CI/CD Setup

### Tasks

- [ ] **Update `.github/workflows/deploy.yml`** (or create new)

  ```yaml
  name: Deploy to Cloudflare Pages

  on:
    push:
      branches: [feat/pwa1]
    pull_request:
      branches: [feat/pwa1]

  jobs:
    deploy:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v3
        - uses: actions/setup-node@v3
          with:
            node-version: 18
        - run: npm ci
        - run: npm run build
        - run: npm run typecheck
        # Cloudflare Pages will handle actual deployment
  ```

- [ ] **Test CI pipeline** on push

### Success Criteria

- ✅ CI workflow runs on push
- ✅ Build succeeds
- ✅ Type checking passes

---

## Step 13: Documentation Updates

### Tasks

- [ ] **Update `README.md`**

  - Mention SolidJS rewrite in progress
  - Link to migration plan
  - Add new setup instructions
  - Reference legacy code location

- [ ] **Create `CONTRIBUTING.md`** (optional)
  - Development setup
  - Code style (strict TypeScript)
  - Testing requirements

### Success Criteria

- ✅ README updated
- ✅ Clear instructions for new developers
- ✅ Legacy code referenced

---

## Step 14: Initial Commit & Push

### Tasks

- [ ] **Review all changes**

  ```bash
  git status
  git diff
  ```

- [ ] **Commit the SolidJS setup**

  ```bash
  git add .
  git commit -m "✨ feat: Initialize SolidJS PWA project structure

  - Set up Vite + SolidJS + TypeScript
  - Configure Tailwind CSS
  - Install core dependencies (Supabase, Drizzle, Kobalte)
  - Set up routing with @solidjs/router
  - Configure PWA with vite-plugin-pwa
  - Create initial project structure
  - Update documentation

  Phase 0 of migration complete.
  Ref: _notes/solidjs-pwa-migration-plan.md"
  ```

- [ ] **Push to GitHub**
  ```bash
  git push origin feat/pwa1
  ```

### Success Criteria

- ✅ All changes committed
- ✅ Pushed to GitHub
- ✅ Cloudflare Pages detects and builds (if configured)

---

## Step 15: Verification & Testing

### Tasks

- [ ] **Local dev server runs**

  ```bash
  npm run dev
  # Should open at localhost:5173
  ```

- [ ] **Build succeeds**

  ```bash
  npm run build
  # Should create dist/ directory
  ```

- [ ] **Type checking passes**

  ```bash
  npm run typecheck
  # (or tsc --noEmit if not configured yet)
  ```

- [ ] **Preview build locally**

  ```bash
  npm run preview
  ```

- [ ] **Check Cloudflare Pages deployment** (if configured)
  - Visit your Pages URL
  - Verify app loads

### Success Criteria

- ✅ Dev server runs without errors
- ✅ Production build succeeds
- ✅ No TypeScript errors
- ✅ App accessible locally and on Cloudflare

---

## Phase 0 Completion Checklist

- [ ] Repository migrated (legacy code in `legacy/`)
- [ ] Cloudflare account created and linked
- [ ] Supabase project created
- [ ] SolidJS project initialized
- [ ] Core dependencies installed
- [ ] Environment variables configured
- [ ] Tailwind CSS configured
- [ ] Project structure created
- [ ] Vite & PWA configured
- [ ] Supabase client set up
- [ ] Basic routing configured
- [ ] CI/CD pipeline updated
- [ ] Documentation updated
- [ ] Initial commit pushed
- [ ] All verification tests pass

---

## Next: Phase 1 - Core Authentication

Once Phase 0 is complete, proceed to Phase 1:

- Implement Supabase Auth
- Create login/signup UI
- Set up SolidJS auth context
- Protected routes

**Estimated Start:** ~1-2 weeks from now

---

## Notes & Observations

_Use this space to track issues, decisions, and learnings during Phase 0_

---

**Last Updated:** October 4, 2025
