# GitHub Copilot: Repository Instructions

Audience and intent

- This file guides Copilot’s code suggestions for the TuneTrees repo. Optimize for correctness, safety, and speed. Prefer minimal diffs and existing patterns.
- Respond with short, actionable output. Provide complete, runnable code with only necessary imports. Avoid boilerplate and new abstractions unless required.

Top ten rules (read first)

1. Never ever commit and/or push code without specifically asking for permission first.
2.
3. Strict TypeScript: no `any`; interfaces start with `I*`. Keep client code thin; server components fetch data.
4. Never import Server Actions into client bundles. Client components should call Server Actions indirectly.
5. Database: SQLAlchemy 2.0 only: use `select(Model).where(...)` and session patterns in `tunetrees/app`.Batch DB queries; avoid N+1 (use `.in_(...)` and fetch related data upfront). PracticeRecord uniqueness is sacred: `(tune_ref, playlist_ref, practiced)` must be unique. Use model helpers that stamp a fresh timestamp; never reuse timestamps.
6. Follow existing page patterns for settings and scheduling options (server `page.tsx` → thin client form → Server Actions → queries module).
7. Testing: Playwright E2E in `frontend/tests/`. Always run via provided scripts (`npm run test:ui` or `npm run test:ui:single <test-file-pattern>`, avoid `./run-playwright-tests.sh [test-file-pattern]`) unless special circumstances arise, and not raw `npx playwright test` unless very special circumstances. Use storage state auth helpers. Page Objects: `frontend/test-scripts/tunetrees.po.ts` etc. For backend logic add/modify pytest tests in `tests/` (root) mirroring module paths. Playwright tests use storage state, Page Objects, `ttPO.gotoMainPage()` first, and `data-testid` locators.
8. Add minimal tests for new behavior (happy path + 1–2 edges). Keep tests stable and readable.
9. Quality Gates: Before commits run (frontend): `npm run lint && npm run biome_lint && npm run type-check && npx prettier --write <changed files>`. Backend: `python -m ruff check tunetrees/ && python -m ruff format tunetrees/` plus pytest if logic changed. No warnings permitted. Never commit unformatted code.
10. Prefer MCP tools (Memory, Playwright, GitHub) when available. If unavailable, pause and ask to start them.

Architecture snapshot

- Backend: FastAPI (`tunetrees/app`), SQLAlchemy 2.0 models in `tunetrees/app/models.py`, scheduling logic (FSRS/SM2) in `tunetrees/app/schedule.py`, app init in `tunetrees/app/main.py`.
- Frontend: Next.js App Router (`frontend/app`), strict TypeScript, Tailwind + Headless UI, NextAuth v5 config in `frontend/auth.ts`.
- Tests: Backend pytest under `tests/`; Frontend E2E Playwright under `frontend/tests/` with helpers in `frontend/test-scripts/`.

Patterns to copy

- Settings pages: server `page.tsx` does `auth()` + server-only queries → thin Client form → Server Actions wrapping query calls.
- API calls: queries module uses axios with `TT_API_BASE_URL` (no extra path segments added).
- Scheduling review flow: `update_practice_feedbacks()` → `_process_single_tune_feedback()` → `get_prefs_spaced_repetition()` → FSRS/SM2 calc → create new `PracticeRecord` (unique timestamp) → FSRS optimization every ~50 reviews.
- Playwright: storage state auth, use Page Objects, `ttPO.gotoMainPage()` first, and `data-testid` selectors.

Backend rules

- Use SQLAlchemy 2.0 style. Example commit pattern:
  ```python
  try:
      db.commit()
  # GitHub Copilot: Repository Instructions (Consolidated)
  except Exception as e:
      db.rollback()
      raise
  ```
- Strict TS: no `any`. New interfaces use `I*` prefix; reuse existing types when possible.
- Add `data-testid` to new interactive UI and update Page Objects when selectors change.
- `practice_record` unique key `(tune_ref, playlist_ref, practiced)`.
- Always create new practice rows via helpers that stamp a fresh `practiced` timestamp.
- See `.github/instructions/database.instructions.md` for additional rules and safety guidance.

Scheduling specifics

- Algorithms: FSRS + SM2. Ratings map 0–5 to Again/Hard/Good/Easy for FSRS.
- FSRS parameter optimization triggers approximately every 50 reviews; weights must be JSON-serializable.

Testing

See `.github/instructions/testing.instructions.md` for detailed guidelines. Key points:

- Use provided scripts: `npm run test:ui` or `npm run test:ui:single <test-file-pattern>`. Avoid raw `npx playwright test` unless special circumstances arise.
- Use storage state auth helpers.
- Use Page Objects: `frontend/test-scripts/tunetrees.po.ts` etc.
- Normally call `ttPO.gotoMainPage()` first.
- Prefer `data-testid` selectors.
- Add minimal tests for new behavior (happy path + 1–2 edge cases).

Quality gates (no warnings allowed)

MCP tools

- Playwright MCP: run focused E2E via standard helpers and storage state; always use Page Objects and `data-testid` selectors.
- Memory MCP: persist and recall repo norms, decisions, flaky areas, and gotchas. After major changes, store a short observation.
- Availability check: If any MCP tool isn’t accessible, stop and ask for it to be started before proceeding with tasks that depend on it. If you must fall back (e.g., to local git), state the fallback and ask for confirmation first.

Danger zones (avoid these)

- Reusing a `practiced` timestamp (breaks uniqueness constraint).
- Importing Server Actions into client bundles.
- Client-side fetching where server queries exist.
  When details are missing
- Infer 1–2 reasonable assumptions from nearby patterns and proceed; document assumptions briefly in a code comment.
- Don’t restate unchanged plans. Provide only the delta.
- Produce complete, runnable edits with minimal imports. Avoid `any` and maintain existing public APIs.
- Use up to 3 gitmojis; order by impact. Split unrelated changes.
- Branch prefixes: `feat/`, `fix/`, `refactor/`, etc., short kebab-case; optional issue suffix (e.g., `feat/sched-algo-235`).
  References (open these first)
- DB rules: `.github/instructions/database.instructions.md`

That’s it. Follow patterns, keep TS strict, protect DB uniqueness, batch queries, add small tests, pass all linters, and leverage MCP tools. If MCP isn’t running, pause and ask to start it.

### Stack

### Golden rules

- SQLAlchemy 2.0 only: `select(Model).where(...)`.

### Copy these patterns

- Playwright: storage state auth, Page Objects, `ttPO.gotoMainPage()` first, prefer `data-testid` selectors.

- Add minimal tests for new behavior (happy path + 1–2 edges); prefer `data-testid` in UI.

- Direct DB writes that bypass helpers.

### References

- DB rules: `.github/instructions/database.instructions.md`
- UI rules: `.github/instructions/ui-development.instructions.md`, `frontend/UI_STYLE_GUIDE2.md`
- Core code: `tunetrees/app/schedule.py`, `tunetrees/app/models.py`, `tunetrees/app/main.py`
- Tests: `frontend/tests/`, `frontend/test-scripts/`, `tests/`

### MCP tools (use when available)

- Memory MCP: persist and recall repo norms, decisions, flaky areas, and gotchas. After major changes, store a short observation. When missing or not reachable, pause and ask to start the Memory MCP server.
- Playwright MCP: run focused E2E tests via standard helpers and storage state; prefer Page Objects and `data-testid` selectors. If unavailable, ask to start it; do not fall back to raw `npx playwright test`.
- GitHub MCP (preferred for git): use to push files, create/update PRs, and fetch PR context. If unavailable, state that you’ll fall back to local git and ask for confirmation.

Availability check: If any MCP tool above is not accessible, stop and request it be started before proceeding with actions that depend on it.

### Implementation hygiene

- Provide runnable, minimal changes with necessary imports and types only.
- Keep surface area small; prefer extending existing modules over new abstractions.
- Note assumptions briefly in comments when non-obvious.

### Commit/branching

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

### TL;DR

- Follow patterns, keep TS strict, protect DB uniqueness, batch queries, add tests, pass all linters, and use MCP tools. Ask to start MCP servers if they’re down.
