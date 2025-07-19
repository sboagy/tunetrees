# GitHub Copilot Instructions

## Project Overview

TuneTrees is a spaced repetition learning app for musical tunes built with FastAPI backend and Next.js frontend. The system uses FSRS (Free Spaced Repetition Scheduler) and SM2 algorithms to optimize practice scheduling.

## Architecture & Key Components

### Backend Structure (`tunetrees/app/`)

- **`main.py`**: FastAPI application entry point with CORS and route registration
- **`schedule.py`**: Core spaced repetition logic with FSRS/SM2 algorithms (~850 lines)
- **`models.py`**: SQLAlchemy 2.0.35 models for practice records, playlists, and preferences
- **`database.py`**: Database configuration and session management
- **`routers/`**: API endpoints organized by feature area

### Frontend Structure (`frontend/`)

- **Next.js 15.1.3 with App Router**: Modern file-based routing in `app/` directory
- **TypeScript**: Strict typing with `I` prefix for interfaces, **NO `any!` types allowed**
- **Styling**: Tailwind CSS with Headless UI components
- **UI Guidelines**: Comprehensive patterns in `frontend/UI_STYLE_GUIDE2.md`. Core patterns automatically included via `.github/instructions/ui-development.instructions.md` when editing frontend files
- **Authentication**: NextAuth.js v5 beta configured in `auth.ts`
- **State Management**: React built-in hooks + custom context providers
- **Testing**: Playwright E2E tests in `tests/` directory

## Critical Patterns & Conventions

### Code Quality Standards

- **Strict typing**: No `any` types - use proper TypeScript interfaces and generics
- **Clean lints**: Code must pass all linting rules without warnings
- **Proper formatting**: Consistent code formatting via Prettier/ESLint
- **Interface naming**: Use `I` prefix for all TypeScript interfaces

### Database Layer (SQLAlchemy 2.0.35)

```python
# Use new SQLAlchemy 2.0 syntax throughout
stmt = select(PracticeRecord).where(PracticeRecord.tune_ref == tune_id)
result = db.execute(stmt).scalars().all()
```

**Critical Database Schema Note**: The `practice_record` table uses a unique constraint on `(tune_ref, playlist_ref, practiced)` to support historical practice record tracking. When creating new practice records, ensure unique timestamps to avoid constraint violations. The `upsert_practice_record` function automatically handles this by setting the current timestamp for new records.

### TypeScript Conventions

```typescript
// Interface naming with I prefix - REQUIRED
interface IUserPreferences {
  algorithmType: AlgorithmType;
  requestRetention: number;
}

// Strict typing - NO any! types - use proper generics
const handleSubmit = <T extends IFormData>(
  data: T
): Promise<IApiResponse<T>> => {
  // implementation
};

// Proper error handling with typed responses
interface IApiError {
  message: string;
  code: number;
  details?: Record<string, unknown>;
}
```

### UI/UX Development

- **Style Guide**: Comprehensive UI patterns in `frontend/UI_STYLE_GUIDE2.md`, with core patterns automatically included for frontend development
- **Tailwind CSS**: Utility-first styling approach
- **Headless UI**: Accessible component primitives
- **Responsive design**: Mobile-first approach
- **Dark mode**: Theme switching support via Tailwind
- **Component composition**: Reusable components in `frontend/components/`

### Spaced Repetition Core Logic

- **Two algorithms**: `AlgorithmType.FSRS` and `AlgorithmType.SM2`
- **Key functions in `schedule.py`**:
  - `_process_single_tune_feedback()`: Main review processing
  - `get_prefs_spaced_repetition()`: User-specific algorithm preferences
  - `optimize_fsrs_parameters()`: FSRS parameter tuning every 50 reviews
- **Quality ratings**: Integer 0-5 mapped to FSRS ratings (Again/Hard/Good/Easy)

### Authentication & User Management

- **NextAuth.js v5**: Configuration in `frontend/auth.ts`
- **User identification**: `user_ref` string used throughout backend API calls
- **Session management**: Server-side sessions with database persistence
- **Self-hosted**: No external auth providers, credentials managed internally

### Frontend State Management

- **React built-in hooks**: `useState`, `useReducer`, `useContext`
- **Custom context providers**: For shared application state
- **Server components**: Next.js App Router for server-side state
- **No external state library**: Avoiding Redux/Zustand complexity

### Data Flow Pattern

1. User submits practice feedback → `update_practice_feedbacks()`
2. Process each tune → `_process_single_tune_feedback()`
3. Load user preferences → `get_prefs_spaced_repetition()`
4. Calculate next review date using scheduler
5. Update `PracticeRecord` with new scheduling data

### Error Handling Convention

```python
try:
    # Database operations
    db.commit()
except Exception as e:
    db.rollback()
    log.error(f"Operation failed: {e}")
    raise e
```

## Development Workflow

### Backend Development

```bash
# Start development server
cd tunetrees
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Run backend tests
pytest tests/
```

### Frontend Development

```bash
cd frontend
npm run dev  # Next.js dev server on port 3000
npm run build
npm run start  # Production build
npm run lint  # Must pass without warnings
npm run type-check  # TypeScript strict checking

# Run frontend tests - MUST use the environment setup script
./run-playwright-tests.sh [test-file-pattern]  # Properly sets up environment and database
# Do NOT use: npx playwright test directly - it lacks proper environment setup
```

### Code Quality Checks

- **TypeScript**: Strict mode enabled, no `any` types permitted
- **ESLint**: All rules must pass without warnings
- **Prettier**: Consistent formatting enforced
- **Type checking**: Full TypeScript compilation without errors

### Git Operations & GitHub Integration

**IMPORTANT**: Always use the GitHub MCP server tools for git operations instead of basic `git` commands when available. The GitHub MCP server provides:

- Better GitHub API integration with proper authentication
- Richer metadata and PR/issue association
- GitHub-specific features like workflow triggers
- Superior error handling for GitHub operations

**Preferred tools for commits:**

- `mcp_github_push_files` - For pushing multiple files in a single commit
- `mcp_github_create_pull_request` - For creating commits via GitHub API
- `mcp_github_update_pull_request` - For updating PR with commit information

**Only fall back to basic `git` commands if GitHub MCP server tools are unavailable.**

### Commit Message Guidelines

**REQUIRED**: Always use gitmojis to lead commit messages for clear visual categorization.

You can use either the emoji (🎨) or the text code (`:art:`) - both are equivalent:

**Core Development:**

- 🎨 `:art:` - Improve structure/format of the code
- ⚡️ `:zap:` - Improve performance
- 🔥 `:fire:` - Remove code or files
- 🐛 `:bug:` - Fix a bug
- ✨ `:sparkles:` - Introduce new features
- 📝 `:memo:` - Add or update documentation
- 🚀 `:rocket:` - Deploy stuff
- 🚑 `:ambulance:` - Critical hotfix
- ♻️ `:recycle:` - Refactor code
- 🏗️ `:building_construction:` - Make architectural changes

**Dependencies & Build:**

- ➕ `:heavy_plus_sign:` - Add or update dependencies
- ➖ `:heavy_minus_sign:` - Remove a dependency
- ⬆️ `:arrow_up:` - Upgrade a dependency
- ⬇️ `:arrow_down:` - Downgrade a dependency
- 🔨 `:hammer:` - Add or update build scripts
- 📦 `:package:` - Add or update compiled files or packages

**Database & Infrastructure:**

- 🗃️ `:card_file_box:` - Perform database related changes
- 🔊 `:loud_sound:` - Add or update logs
- 🔇 `:mute:` - Remove logs

**Frontend & UX:**

- 📱 `:iphone:` - Work on responsive design
- � `:lipstick:` - Add or update the UI and style files
- �🚸 `:children_crossing:` - Improve user experience/usability
- 🌐 `:globe_with_meridians:` - Internationalization (i18n)
- ♿ `:wheelchair:` - Improve accessibility
- 💫 `:dizzy:` - Add or update animations

**Code Quality & Testing:**

- ✅ `:white_check_mark:` - Add, update, or pass tests
- 🧪 `:test_tube:` - Add or update tests
- 💡 `:bulb:` - Add or update comments in source code
- 🏷️ `:label:` - Add or update types
- 🥅 `:goal_net:` - Catch errors
- 🤡 `:clown_face:` - Mock things

**Configuration & Maintenance:**

- 🔧 `:wrench:` - Change configuration files
- ⚙️ `:gear:` - Update CI/CD pipeline
- 🩹 `:adhesive_bandage:` - Simple fix for a non-critical issue
- 🧹 `:broom:` - Clean up code or files

**Other:**

- 💬 `:speech_balloon:` - Add or update text and literals
- 👥 `:busts_in_silhouette:` - Add or update contributor(s)
- 🔍 `:mag:` - Improve SEO
- 🌱 `:seedling:` - Add or update seed files
- 🚩 `:triangular_flag_on_post:` - Add, update, or remove feature flags
- 🥚 `:egg:` - Add or update an easter egg
- 🚧 `:construction:` - Work in progress
- ⚠️ `:warning:` - Address warnings or introduce breaking changes
- ↩️ `:leftwards_arrow_with_hook:` - Revert changes
- ⏪ `:rewind:` - Revert previous commits
- 🔖 `:bookmark:` - Release/Version tags
- 🎉 `:tada:` - Begin a project

**Commit Structure Best Practices:**

- **Break commits into logical units** when possible (e.g., separate backend fixes, database changes, and frontend improvements)
- **Each commit should have a single clear purpose** that can be described in the first line
- **Use descriptive commit bodies** with bullet points for multiple changes
- **Reference issues/PRs** when applicable
- **Follow conventional commit format**: `<gitmoji> <type>: <description>`
- **Always ask for user approval** before executing commits - present the proposed commit message(s) and wait for confirmation

**Example Multi-Commit Approach:**

```
🔒 Fix authentication constraint violation in user endpoint
🗃️ Update database schema for historical user tracking
✨ Add frontend validation and improve user experience
```

This approach creates cleaner git history, easier code review, and safer rollback capabilities.

### Gitmoji Selection Guidelines

**CRITICAL**: Always carefully examine the actual code changes before selecting gitmojis. Don't rely solely on file names or user descriptions.

**Gitmoji Selection Process:**

1. **Analyze the diff**: Read through the actual code changes line by line
2. **Identify change types**: Look for patterns in the modifications (refer to the gitmoji categories in the Commit Message Guidelines section above)
3. **Apply multiple gitmojis**: When changes span multiple categories, use multiple gitmojis in order of importance
4. **Prioritize by impact**: Place the most significant change type first

**Multiple Gitmoji Examples:**

```bash
# Database schema + frontend changes
🗃️✨ Add user preferences table and settings UI

# Bug fix + test addition
🐛✅ Fix authentication timeout and add regression tests

# Performance + refactoring + tests
⚡️♻️🧪 Optimize query performance, refactor cache logic, and add benchmarks

# UI + accessibility improvements
💄♿ Update button styles and improve keyboard navigation

# Configuration + dependency updates
🔧⬆️ Update Docker config and upgrade Node.js dependencies
```

**Guidelines for Multiple Gitmojis:**

- **Maximum 3 gitmojis** per commit to maintain readability
- **Order by significance**: Most important change first
- **Related changes only**: Don't combine unrelated modifications
- **Consider splitting**: If you need 4+ gitmojis, consider multiple commits

**Change Detection Checklist:**

- [ ] Are new files being created? (✨ `:sparkles:`)
- [ ] Are bugs being fixed? (🐛 `:bug:`)
- [ ] Are tests being added/modified? (✅ `:white_check_mark:` or 🧪 `:test_tube:`)
- [ ] Are dependencies changing? (➕➖⬆️⬇️)
- [ ] Are UI/styles being modified? (💄 `:lipstick:`)
- [ ] Are database schemas changing? (🗃️ `:card_file_box:`)
- [ ] Are configuration files being updated? (🔧 `:wrench:`)
- [ ] Is code being refactored without functional changes? (♻️ `:recycle:`)
- [ ] Are performance optimizations being made? (⚡️ `:zap:`)
- [ ] Is documentation being updated? (📝 `:memo:`)

### Testing Strategy

- **Backend**: pytest in `tests/` directory with GitHub Actions CI
- **Frontend**: Playwright E2E tests in `frontend/tests/` with GitHub Actions CI
- **CI/CD**: Automated testing on push/PR via GitHub Actions

### Branch Naming Conventions

Follow these naming conventions for Git branches to maintain consistency and enable automated workflows. Based on industry standards like GitFlow, GitHub Flow, and conventional commits.

**Format**: `{type}/{brief-description}` or `{type}/{brief-description}-{issue-number}`

**Primary Types** (following conventional commits):

- `feat/` or `feature/` - New features or enhancements
- `fix/` or `bugfix/` - Bug fixes and hotfixes
- `docs/` - Documentation-only changes
- `style/` - Code style/formatting changes (no logic changes)
- `refactor/` - Code refactoring without feature changes
- `test/` - Adding or modifying tests
- `chore/` - Maintenance, dependencies, tooling
- `perf/` - Performance improvements
- `ci/` - CI/CD configuration changes

**Additional Types** (for workflow management):

- `release/` - Release preparation branches
- `hotfix/` - Critical production fixes
- `experiment/` - Experimental or spike work

**Guidelines**:

- **Use kebab-case** (hyphens) for descriptions - industry standard
- **Keep concise but descriptive** - aim for 2-4 words
- **Include issue numbers** when applicable for traceability
- **Lowercase only** for consistency across platforms
- **20-character limit** - keep total branch name under 20 characters using abbreviations when needed

**Examples**:

```bash
feat/user-auth               # New authentication system (abbreviated)
feat/spaced-rep-123          # Feature with issue reference (abbreviated)
fix/login-redirect-bug       # Bug fix
fix/db-conn-456              # Bug fix with issue number (abbreviated)
docs/api-docs                # Documentation update (abbreviated)
refactor/sched-algo          # Code refactoring (abbreviated)
test/e2e-playlist-mgmt       # Test additions (abbreviated)
chore/update-deps            # Maintenance work (abbreviated)
perf/optimize-query-456      # Performance improvement
hotfix/critical-fix-789      # Critical production fix
release/v2.1.0               # Release preparation
experiment/new-ui-framework  # Experimental work
```

**Branch Management**:

```bash
# Create and switch to new branch
git checkout -b feat/user-authentication

# Create branch from specific commit/branch
git checkout -b hotfix/critical-fix main

# Push and set upstream tracking
git push -u origin feat/user-authentication

# Create branch with issue reference
git checkout -b fix/login-redirect-456
```

**Integration Patterns**:

- **Feature branches**: `feat/` → merge to `main` via PR
- **Hotfixes**: `hotfix/` → merge to `main` and `develop` if using GitFlow
- **Release branches**: `release/` → merge to `main` and tag version
- **Experiments**: `experiment/` → merge or delete based on outcome

This naming convention enables:

- **Conventional commits compatibility** for automated changelogs
- **Semantic versioning integration** for automated releases
- **GitHub/GitLab automation** with type-based workflow triggers
- **Clear intent communication** through standardized type prefixes
- **Issue tracking integration** via optional number suffixes
- **Tool compatibility** with popular Git workflows and CI/CD systems

## Deployment (DigitalOcean)

### Docker Multi-Service Setup

- **docker-compose**: Orchestrated via `compose.yaml`
- **Multi-platform builds**: `docker-bake.hcl` with `linux/amd64` and `linux/arm64` targets
- **Container registry**: `docker.io/sboagy/tunetrees-server:latest` and `tunetrees-frontend:latest`

### Deployment Commands

```bash
# Deploy to DigitalOcean droplet
./scripts/redeploy_tt1dd.sh

# Build and push containers
docker buildx bake --push
```

### Infrastructure Details

- **DigitalOcean droplet**: 165.227.182.140
- **SSH access**: `~/.ssh/id_rsa_ttdroplet`
- **Production database**: SQLite with automated backups via migration script

### Database Migration (Current System)

- **Manual SQLite migration**: `scripts/migrate_from_prod_db.sh`
- **Schema changes**: Made in `tunetrees_test_clean.sqlite3` first
- **Production sync**: SCP download from DigitalOcean droplet
- **Backup strategy**: Timestamped backups in `tunetrees_do_backup/` and `tunetrees_local_backup/`
- **Known migration issues**: May need to delete `view_playlist_joined` from production DB

## Key Integration Points

### FSRS Library Integration

- Import: `from fsrs import Scheduler, Rating, ReviewLog`
- Optimization: `from fsrs.optimizer import Optimizer`
- Parameter tuning happens every 50 reviews in `optimize_fsrs_parameters()`

### Database Models Relationships

- `PracticeRecord` ↔ `Playlist` (many-to-one)
- `PrefsSpacedRepetition` ↔ User (one-to-one per algorithm type)
- JSON serialization for complex fields (FSRS weights, learning steps)

### Date Handling Pattern

```python
# Consistent date format throughout
TT_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"
practiced_str = datetime.strftime(sitdown_date, TT_DATE_FORMAT)
```

### Frontend-Backend API Integration

- **FastAPI OpenAPI**: Auto-generated schemas for TypeScript integration
- **API base URL**: Configurable via environment variables
- **Error handling**: Consistent error response format across endpoints
- **Type safety**: Generate TypeScript types from OpenAPI schema

## Testing & Debugging

### Playwright E2E Testing Guidelines

When creating new Playwright tests for TuneTrees:

1. **Running Tests**: ALWAYS use the environment setup script:

   ```bash
   cd frontend
   ./run-playwright-tests.sh [test-file-pattern]
   ```

   Do NOT use `npx playwright test` directly - it lacks proper environment setup including database initialization and environment variables.

2. **Authentication & Storage State**: For features requiring login, set up storage state:

   ```typescript
   test.use({
     storageState: getStorageState("STORAGE_STATE_TEST1"),
     trace: "retain-on-failure",
   });
   ```

3. **Test Setup (beforeEach)**: Always include proper test initialization:

   ```typescript
   test.beforeEach(async ({ page }, testInfo) => {
     console.log(`===> ${testInfo.file}, ${testInfo.title} <===`);
     await setTestDefaults(page);
     await applyNetworkThrottle(page);
     await page.goto("/your-page-route");
     await page.waitForLoadState("domcontentloaded");
   });
   ```

4. **Page Readiness**: Use `page.waitForLoadState("domcontentloaded")` for page readiness, not network idle timeouts.

5. **Test Cleanup (afterEach)**: Always restore backend state:

   ```typescript
   test.afterEach(async ({ page }) => {
     await restartBackend();
     await page.waitForTimeout(1_000);
   });
   ```

6. **Page Objects**: Use existing Page Object classes from `frontend/test-scripts/`:

   - `tunetrees.po.ts` - Main application Page Object
   - `tune-editor.po.ts` - Specialized for tune editing workflows
   - **Add new locators to Page Objects** when you find yourself repeating the same selector paths across tests
   - Create new Page Objects following these patterns when needed

7. **Defensive Testing**: Always check element visibility before interactions:

   ```typescript
   const element = page.locator("selector");
   if (await element.isVisible()) {
     await element.click();
     // ... test logic
   }
   ```

8. **Required Imports**: Include these standard imports for TuneTrees tests:

   ```typescript
   import { restartBackend } from "@/test-scripts/global-setup";
   import { applyNetworkThrottle } from "@/test-scripts/network-utils";
   import { setTestDefaults } from "@/test-scripts/set-test-defaults";
   import { getStorageState } from "@/test-scripts/storage-state";
   import { test, expect } from "@playwright/test";
   ```

9. **Locator Management**: When adding new locators to Page Objects, follow these patterns:

   ```typescript
   // In Page Object file (e.g., tunetrees.po.ts)
   readonly fsrsRadioButton = this.page.locator('input[type="radio"][value="FSRS"]');
   readonly optimizeButton = this.page.locator('button:has-text("Auto-Optimize Parameters")');

   // Use in tests instead of repeating selectors
   const po = new TuneTreesPageObject(page);
   await po.fsrsRadioButton.check();
   await expect(po.optimizeButton).toBeVisible();
   ```

### Diagnostic Functions

- `query_and_print_tune_by_id(tune_id)`: Debug specific practice records
- `get_user_review_history()`: Fetch review logs for FSRS optimization
- Enable debug logging: `log.debug(f"FSRS review_log: {review_log}")`

### Key Files for Understanding Core Logic

- `schedule.py`: Lines 490-600 contain main scheduling algorithms
- `models.py`: Database schema and relationships
- `main.py`: API structure and dependency injection patterns
- `frontend/app/`: Next.js App Router pages and layouts
- `frontend/components/`: Reusable UI components with Tailwind CSS
- `frontend/UI_STYLE_GUIDE2.md`: Complete UI component patterns and design system
- `compose.yaml`: Production deployment configuration
- `docker-bake.hcl`: Multi-platform container build configuration

## Quality Assurance Requirements

- **No `any` types**: Use proper TypeScript interfaces and generics
- **Clean lints**: All ESLint rules must pass without warnings
- **Proper formatting**: Consistent code style via Prettier
- **Type safety**: Full TypeScript compilation without errors
- **UI consistency**: Comprehensive patterns in `frontend/UI_STYLE_GUIDE2.md`, with core patterns automatically included for frontend development
