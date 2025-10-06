# CLAUDE.md

> **🏗️ ARCHITECTURE REWRITE IN PROGRESS**  
> **Branch:** `feat/pwa1`  
> **New Stack:** SolidJS + TypeScript + Supabase + SQLite WASM (see `.github/copilot-instructions.md`)  
> **Legacy Stack:** Next.js + Python/FastAPI (see `legacy/` directory and `legacy/.github/copilot-instructions.md`)

This file provides guidance for working with code in this repository during the migration from the legacy stack to the new SolidJS PWA.

## Quick Reference

**For SolidJS PWA (new):** See `.github/copilot-instructions.md`  
**For Legacy Stack:** See `legacy/.github/copilot-instructions.md`

> **📝 Note on AGENTS.md:** Per [GitHub's August 2024 announcement](https://github.blog/changelog/2025-08-28-copilot-coding-agent-now-supports-agents-md-custom-instructions/), you can create `AGENTS.md` files for directory-specific instructions. The Copilot agent supports:
>
> - Root-level `AGENTS.md`
> - Nested `AGENTS.md` files for specific project areas
> - `.github/copilot-instructions.md` (this repo's primary instructions)
> - `.github/instructions/**.instructions.md` for additional guidance
> - `CLAUDE.md` and `GEMINI.md` for Claude/Gemini-specific hints
>
> Consider using `AGENTS.md` in subdirectories (e.g., `src/AGENTS.md`, `legacy/AGENTS.md`) when we need scoped instructions during Phase 1+.

---

## Legacy Development Commands (Reference Only)

> **⚠️ These commands apply to the LEGACY stack in `legacy/` directory.**  
> **For new SolidJS development, see Phase 0 checklist in `_notes/phase-0-checklist.md`**

### Frontend (Next.js/React) - LEGACY

- **Development**: `cd frontend && npm run dev` - Starts development server with HTTPS
- **Build**: `cd frontend && npm run build` - Creates production build
- **Lint**: `cd frontend && npm run lint` or `npm run eslint` - Runs ESLint
- **Type Check**: `cd frontend && npm run typecheck` - TypeScript type checking
- **Tests**: `cd frontend && npm test` - Runs Playwright E2E tests
- **Format**: `cd frontend && npm run format` - Prettier formatting

### Backend (FastAPI/Python) - LEGACY

- **Development**: `uvicorn tunetrees.api.main:app --reload` - Starts FastAPI server
- **Tests**: `pytest tests/ -v` - Runs backend tests
- **Lint**: `black tunetrees/` and `ruff check --fix tunetrees/` - Code formatting and linting
- **ORM Generation**: `scripts/sqlacodegen.sh` - Generates SQLAlchemy models

### Docker - LEGACY

- **Build All**: `docker buildx bake` - Builds both frontend and backend containers
- **Build Frontend**: `docker buildx bake frontend`
- **Build Backend**: `docker buildx bake server`
- **Deploy Local**: `docker compose up server frontend -d` - Local containerized deployment

## Code Architecture

### **NEW Stack (Active Development on `feat/pwa1`)**

TuneTrees is being rewritten as an **offline-first Progressive Web App**:

- **Frontend**: SolidJS + TypeScript (strict mode)
- **UI**: shadcn-solid + Kobalte + Tailwind CSS
- **Backend/Auth**: Supabase (PostgreSQL + Auth + Realtime)
- **Local Storage**: SQLite WASM + Drizzle ORM
- **Scheduling**: ts-fsrs (client-side)
- **Deployment**: Cloudflare Pages
- **Data Grids**: @tanstack/solid-table + @tanstack/solid-virtual

**See:** `.github/copilot-instructions.md` for detailed patterns

### **LEGACY Stack (Preserved in `legacy/`)**

The original full-stack application:

- **Frontend**: Next.js 15 with React 19, TypeScript, Tailwind CSS, shadcn/ui components
- **Backend**: FastAPI with SQLAlchemy, SQLite database, spaced repetition scheduling
- **Authentication**: NextAuth.js with custom HTTP adapter
- **Testing**: Playwright for E2E, pytest for backend
- **Deployment**: Docker containers with nginx proxy

**See:** `legacy/.github/copilot-instructions.md` for legacy patterns

### Key Directories

**NEW Structure (Phase 0+):**

- `src/` - SolidJS application root (to be created)
  - `src/components/` - Reusable SolidJS components
  - `src/routes/` - SolidJS router pages
  - `src/lib/` - Core utilities (db, auth, utils)
- `drizzle/` - Drizzle ORM schema definitions (to be created)
- `public/` - Static assets for PWA
- `_notes/` - Migration planning documents

**LEGACY Structure (reference only):**

- `legacy/frontend/` - Next.js/React application
- `legacy/tunetrees/` - FastAPI backend
- `legacy/tests/` - Backend pytest tests
- `legacy/frontend/tests/` - Playwright E2E tests

### Database Management

**NEW Approach (SolidJS PWA):**

- **Local Storage**: SQLite WASM in browser (indexed DB persistence)
- **Cloud Sync**: Supabase PostgreSQL
- **ORM**: Drizzle ORM with TypeScript type safety
- **Schema**: Version-controlled in `drizzle/schema.ts`
- **Migrations**: Drizzle Kit (to be configured)

**LEGACY Approach (reference):**

- Schema in `legacy/tunetrees_test_clean.sqlite3`
- SQLAlchemy ORM models (auto-generated)
- Direct schema management (no Alembic)

### Practice System

The core functionality revolves around spaced repetition scheduling:

**NEW Implementation (SolidJS PWA):**

- **Client-Side Scheduling**: `ts-fsrs` library (FSRS algorithm)
- **Offline-First**: All scheduling calculations happen locally
- **Sync**: Practice records sync to Supabase in background
- **Fallback**: SM2 algorithm (ported from legacy Python)

**Core Features (to be ported):**

- Practice Records: Track learning progress with quality ratings
- Tune Management: Catalog, repertoire, and scheduled practice views
- User Preferences: Configurable scheduling parameters

**Legacy Reference:**

- See `legacy/tunetrees/app/schedule.py` for FSRS/SM2 algorithms
- See `legacy/frontend/app/(main)/pages/practice/` for UI patterns

### Frontend Architecture

**NEW (SolidJS PWA):**

- **Routing**: `@solidjs/router` for client-side routing
- **State Management**: SolidJS signals and context API
- **Components**: shadcn-solid + Kobalte primitives
- **Styling**: Tailwind CSS 4.x (same classes as legacy)
- **Authentication**: Supabase Auth SDK
- **Offline**: Service Worker + SQLite WASM

**LEGACY (Next.js/React):**

- App Router (Next.js 15)
- React Context providers
- shadcn/ui + Radix UI
- NextAuth.js

### API Integration

**NEW (SolidJS PWA):**

- **Local-First**: All reads from SQLite WASM (no HTTP for data access)
- **Authentication**: Supabase Auth SDK (email/password + OAuth)
- **Sync Layer**: Supabase Realtime for multi-device sync
- **Conflict Resolution**: Last-write-wins with user override

**LEGACY (Next.js/FastAPI):**

- HTTP API calls to FastAPI backend
- Session-based auth with NextAuth.js
- Direct backend queries

## Testing Requirements

**NEW (SolidJS PWA):**

- **Unit Tests**: Vitest + `@solidjs/testing-library`
- **E2E Tests**: Playwright (reuse patterns from `legacy/frontend/tests/`)
- **Test Commands**: TBD in Phase 0 (will be `npm run test`, `npm run test:e2e`)

**LEGACY (reference):**

- Backend: `pytest tests/ -v`
- Frontend: `cd legacy/frontend && npm test`
- Playwright with headless mode in CI

## Development Workflow

**NEW (SolidJS PWA):**

### Making Database Changes

1. Modify schema in `drizzle/schema.ts`
2. Generate migrations: `npm run db:generate`
3. Apply migrations: `npm run db:push` (local) or Drizzle Studio
4. Test changes with Vitest unit tests

### Code Quality

- **TypeScript**: Strict mode, no `any` types
- **Linting**: ESLint + Prettier
- **Pre-Commit**: `npm run typecheck && npm run lint && npm run format`
- **Components**: PascalCase for SolidJS components
- **Signals**: Use `createSignal`, `createEffect`, `createMemo`

### Practice Components Development

When porting the practice interface:

- All data from local SQLite WASM (instant reads)
- Use SolidJS signals for reactive state
- Port TuneGrid views to SolidJS Table (@tanstack/solid-table)
- Reference `legacy/frontend/app/(main)/pages/practice/` for UI patterns
- Rewrite logic, not React patterns

**LEGACY (reference):**

- SQLAlchemy schema management
- Python: `black` + `ruff`
- React Context providers
- Server Actions for data mutations

## UI Development Guidelines

> **⚠️ CRITICAL:** See `.github/instructions/ui-development.instructions.md` for complete UI guidelines.
>
> **Key Requirements:**
>
> - **Table-centric UI** for primary data views (TanStack Solid Table) - NOT card-based layouts
> - **Desktop & mobile equally important** - same functionality, different ergonomics
> - **User-controlled theme** (light/dark/system) - NOT system-forced
> - **Legacy app fidelity** - reference screenshots in `legacy/` for proven patterns

> **⚠️ Note:** These guidelines apply to BOTH legacy and new implementations. The **design philosophy and Tailwind classes remain the same** when porting to SolidJS. Only the **framework patterns change** (React → SolidJS).

### Design Philosophy

TuneTrees follows a **minimalist, productivity-focused design** inspired by developer tools like VS Code. The interface prioritizes function over decoration, with clean lines, subtle borders, and restrained use of color.

**Design Characteristics:**

- **Minimalist aesthetic**: Clean, uncluttered interfaces with plenty of white space
- **Functional hierarchy**: UI elements are sized and positioned based on frequency of use
- **Subtle visual cues**: Borders, shadows, and color are used sparingly but meaningfully
- **Developer-tool inspiration**: Similar to VS Code's clean, professional appearance
- **Daily-use optimization**: Interface designed for repeated, efficient daily interactions

### Component Patterns

**Button Variants (ShadCN):**

- `default`: Primary actions (Save, Submit) - solid primary color
- `outline`: Secondary actions (Cancel, Sign In) - border with transparent background
- `ghost`: Subtle actions, toggles, icon buttons - transparent with hover state
- `destructive`: Delete/remove actions - red background
- `link`: Text-only links

**Button Order & Positioning:**

- Dialog actions: Right-aligned with primary action on the right
- Cancel/Close buttons: Always on the left of primary actions
- Icon buttons: Often use `variant="ghost"` with `size="icon"`

### Iconography (Lucide React)

- **Icons come AFTER text** in most cases: `Save <Save className="h-4 w-4" />`
- **Standard size**: `h-4 w-4` or `h-5 w-5`
- **Common icons**: Save, X/XCircle (close), TrashIcon (delete), PlusIcon (add), PencilIcon (edit)

### Forms & Validation

Use React Hook Form + Zod with consistent form field structure:

```tsx
<FormField
  control={form.control}
  name="fieldName"
  render={({ field }) => (
    <FormItem className="tune-form-item-style2">
      <FormLabel className="tune-form-label-style">
        <em>Label:</em>
      </FormLabel>
      <FormControl className="tune-form-control-style">
        <Input {...field} value={field.value || ""} />
      </FormControl>
    </FormItem>
  )}
/>
```

### Mobile-First Responsive Design

- **Primary platform**: Desktop/laptop for daily practice sessions
- **Mobile goal**: Functional smartphone access with PWA capabilities
- **Touch interactions**: Minimum 44px × 44px interactive elements
- **Breakpoints**: Mobile-first approach using Tailwind's responsive system

### Theming & Accessibility

- **Dark mode**: Full support with `dark:` variants
- **Colors**: Restrained palette with gray backgrounds, green for success, blue for actions
- **Screen reader support**: Use `sr-only` classes and `aria-hidden` for decorative icons
- **Focus management**: Logical tab order and escape key handling in dialogs

## Important Notes

**NEW (SolidJS PWA):**

- **Offline-First**: All reads from local SQLite WASM, no server required for core functionality
- **Drizzle Migrations**: Schema versioning via Drizzle Kit (to be configured)
- **PWA Deployment**: Cloudflare Pages with edge caching
- **Phase 0 Status**: Project setup in progress (see `_notes/phase-0-checklist.md`)
- **Reference Legacy**: Business logic in `legacy/` for porting (not framework patterns)

**LEGACY (preserved in `legacy/`):**

- No Alembic migrations (direct schema management)
- SSL dev server (HTTPS with self-signed certs)
- Docker Compose deployment
- Monorepo structure (frontend + backend)
