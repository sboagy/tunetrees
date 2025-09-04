# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Frontend (Next.js/React)

- **Development**: `cd frontend && npm run dev` - Starts development server with HTTPS
- **Build**: `cd frontend && npm run build` - Creates production build
- **Lint**: `cd frontend && npm run lint` or `npm run eslint` - Runs ESLint
- **Type Check**: `cd frontend && npm run typecheck` - TypeScript type checking
- **Tests**: `cd frontend && npm test` - Runs Playwright E2E tests
- **Format**: `cd frontend && npm run format` - Prettier formatting

### Backend (FastAPI/Python)

- **Development**: `uvicorn tunetrees.api.main:app --reload` - Starts FastAPI server
- **Tests**: `pytest tests/ -v` - Runs backend tests
- **Lint**: `black tunetrees/` and `ruff check --fix tunetrees/` - Code formatting and linting
- **ORM Generation**: `scripts/sqlacodegen.sh` - Generates SQLAlchemy models

### Docker

- **Build All**: `docker buildx bake` - Builds both frontend and backend containers
- **Build Frontend**: `docker buildx bake frontend`
- **Build Backend**: `docker buildx bake server`
- **Deploy Local**: `docker compose up server frontend -d` - Local containerized deployment

## Code Architecture

### High-Level Structure

TuneTrees is a full-stack web application for helping folk musicians memorize tune repertoires using spaced repetition algorithms:

- **Frontend**: Next.js 15 with React 19, TypeScript, Tailwind CSS, shadcn/ui components
- **Backend**: FastAPI with SQLAlchemy, SQLite database, spaced repetition scheduling
- **Authentication**: NextAuth.js with custom HTTP adapter
- **Testing**: Playwright for E2E, pytest for backend
- **Deployment**: Docker containers with nginx proxy

### Key Directories

- `frontend/app/(main)/pages/practice/` - Main practice interface with tune management, scheduling, and practice sessions
- `tunetrees/api/` - FastAPI routes and authentication
- `tunetrees/app/` - Core business logic (database, queries, schedulers)
- `tunetrees/models/` - SQLAlchemy ORM models (auto-generated)
- `frontend/components/` - Reusable React components
- `tests/` - Backend pytest tests
- `frontend/tests/` - Playwright E2E tests

### Database Management

- **Schema Source**: `tunetrees_test_clean.sqlite3` (checked into git)
- **Development DB**: `tunetrees.sqlite3` (local, git-ignored)
- **Test DB**: `tunetrees_test.sqlite3` (auto-reset for each test run)
- **ORM Models**: Auto-generated from schema using `./scripts/sqlacodegen.sh`

### Practice System

The core functionality revolves around spaced repetition scheduling:

- **Schedulers**: SM2 and FSRS algorithms for optimal review timing
- **Practice Records**: Track learning progress with quality ratings
- **Tune Management**: Catalog, repertoire, and scheduled practice views
- **User Preferences**: Configurable scheduling options and algorithm parameters

### Frontend Architecture

- **App Router**: Next.js 15 app directory structure
- **State Management**: React Context providers for practice session state
- **Components**: Mix of custom components and shadcn/ui library
- **Styling**: Tailwind CSS with custom theme support
- **Authentication**: NextAuth.js integration with custom HTTP adapter

### API Integration

- **Frontend-Backend**: HTTP API calls using custom fetch utilities
- **Authentication**: Session-based auth with NextAuth.js
- **Real-time Updates**: Practice session state synchronized between frontend and backend

## Testing Requirements

### Environment Setup

- **Test Database**: Set `TT_REVIEW_SITDOWN_DATE` to `2024-12-31 16:47:57.671465+00:00` for stable test conditions
- **Frontend Tests**: Use Playwright with headless mode in CI (`PLAYWRIGHT_HEADLESS=true`)
- **Backend Tests**: Use pytest with automatic database reset per test

### Test Commands

- **Backend Only**: `pytest tests/ -v`
- **Frontend Only**: `cd frontend && npm test`
- **Reset Test DB**: `cp tunetrees_test_clean.sqlite3 tunetrees_test.sqlite3`

## Development Workflow

### Making Database Changes

1. Modify schema in `tunetrees_test_clean.sqlite3`
2. Regenerate ORM: `./scripts/sqlacodegen.sh`
3. Format code: `black tunetrees/models/tunetrees.py && ruff check --fix tunetrees/`
4. Test changes with both backend and frontend tests

### Code Quality

- **Python**: Use `black` and `ruff` for formatting and linting
- **TypeScript/JavaScript**: Use ESLint with TypeScript and React rules
- **Components**: Follow PascalCase naming for React components
- **API Routes**: Follow REST conventions in FastAPI routes

### Practice Components Development

When working on the practice interface, note that:

- Components in `frontend/app/(main)/pages/practice/components/` cannot import queries directly
- Use action wrappers in `practice-actions.ts` for server communication
- Practice state is managed through multiple React Context providers
- The TuneGrid system supports different views (Catalog, Repertoire, Scheduled)

## UI Development Guidelines

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

- **No Database Migrations**: This project uses direct schema management instead of Alembic migrations
- **SSL Development**: Frontend dev server uses HTTPS with self-signed certificates
- **Monorepo Structure**: Frontend and backend are separate but related packages
- **Production Deployment**: Uses Docker Compose with nginx proxy and Let's Encrypt certificates
- **Test Isolation**: Backend tests use TestClient, frontend tests may use live server
