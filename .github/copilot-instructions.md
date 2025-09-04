# GitHub Copilot: Repository Instructions

Audience and intent

- This file guides Copilot’s code suggestions for the TuneTrees repo. Optimize for correctness, safety, and speed. Prefer minimal diffs and existing patterns.
- Respond with short, actionable output. Provide complete, runnable code with only necessary imports. Avoid boilerplate and new abstractions unless required.

Top ten rules (read first)

1. SQLAlchemy 2.0 only: use `select(Model).where(...)` and session patterns in `tunetrees/app`.
2. PracticeRecord uniqueness is sacred: `(tune_ref, playlist_ref, practiced)` must be unique. Use model helpers that stamp a fresh timestamp; never reuse timestamps.
3. Strict TypeScript: no `any`; interfaces start with `I*`. Keep client code thin; server components fetch data.
4. Never import Server Actions into client bundles. Client components should call Server Actions indirectly.
5. Batch DB queries; avoid N+1 (use `.in_(...)` and fetch related data upfront).
6. Follow existing page patterns for settings and scheduling options (server `page.tsx` → thin client form → Server Actions → queries module).
7. Playwright tests use storage state, Page Objects, `ttPO.gotoMainPage()` first, and `data-testid` locators.
8. Add minimal tests for new behavior (happy path + 1–2 edges). Keep tests stable and readable.
9. Quality gates must pass with zero warnings (ESLint, Biome, type-check, Ruff, Prettier formatting).
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

- Frontend E2E: Use the repo’s scripts and helpers; do not run bare `npx playwright test`. Prefer storage state auth and Page Objects.
- Backend: Add pytest tests for algorithmic or API changes (happy path + 1–2 edge cases).
- UI: Prefer `data-testid` for stable selectors.

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

- Use up to 3 gitmojis; split unrelated concerns. Branch `feat/`, `fix/`, `refactor/` etc. Ask before pushing when acting as assistant.

### TL;DR

- Follow patterns, keep TS strict, protect DB uniqueness, batch queries, add tests, pass all linters, and use MCP tools. Ask to start MCP servers if they’re down.
