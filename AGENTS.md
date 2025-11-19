# TuneTrees Global AGENTS Instructions

> Hierarchical instruction root. Directory‑scoped AGENTS.md files inherit these global rules and add local specifics. Do not duplicate global content in PRs—reference this file instead.

## Scope Hierarchy

Global (this file) → src/AGENTS.md (UI) → tests/AGENTS.md (unit) → e2e/AGENTS.md (E2E) → tunetrees/models/AGENTS.md (schema + invariants) → tunetrees/app/AGENTS.md (backend query & service layer) → sql_scripts/AGENTS.md (views & migrations).

The `legacy/` and `archive/` directories are reference only—never modify for new features. UI docs may still reference legacy screenshots; keep those references intact.

## Top 12 Global Rules

1. Ask before committing/pushing; follow branch + PR process.
2. Strict TypeScript (no `any`); interface names prefix `I*`.
3. SolidJS reactivity: use `createSignal`, `createEffect`, `createMemo`; avoid React patterns (`useState`, `useEffect`, etc.).
4. Offline‑first: all reads from local SQLite WASM; writes queue for Supabase sync (background).
5. Supabase Auth only; SolidJS Context for user/session state.
6. Drizzle ORM for TypeScript data access; raw SQL only in vetted edge cases.
7. UI components: shadcn-solid + @kobalte/core primitives; table‑centric design (TanStack Solid Table).
8. Scheduling logic: `ts-fsrs` primary, SM2 fallback—never overload `due` semantics.
9. Quality gates before merge: `npm run typecheck && npm run lint && npm run format && npm run test` (unit) + E2E passing.
10. Zero TypeScript errors / ESLint warnings / failing tests at merge time.
11. Database invariants (PracticeRecord uniqueness etc.) must not be broken by feature work—see models/app/sql_scripts AGENTS files.
12. Legacy code consulted for business logic only; never port framework patterns.

## Architecture & Stack Overview (Condensed)

Frontend: SolidJS 1.8+, Vite 5, Tailwind, TanStack Solid Table, Kobalte, shadcn-solid, Lucide icons.
Backend/Auth: Supabase Postgres + Auth + Realtime; local offline DB: SQLite WASM + Drizzle. Sync layer: local writes → queue → Supabase; Supabase Realtime pushes remote changes back into local DB.
Scheduling: FSRS (client) with SM2 fallback.
PWA: vite-plugin-pwa + Workbox; deploy via Cloudflare Pages.
External libs: abcjs (notation wrapper), jodit (rich text editor wrapper).

## Offline-First Data Flow

```
User Action → Local SQLite (immediate) → Sync Queue → Supabase (async)
                         ↓
                 Supabase Realtime → Local SQLite (remote updates)
```
Conflict resolution: last-write-wins with user override UI planned; never block local write for network failure.

## Global Code Patterns (Exemplars)

Solid Resource read:
```ts
const [tunes] = createResource(async () => db.select().from(tunesTable).all());
<Show when={!tunes.loading()} fallback={<p>Loading...</p>}>
  <For each={tunes()}>{t => <div>{t.title}</div>}</For>
</Show>
```
Auth context (see frontend for UI binding): maintain `user` signal; subscribe to `supabase.auth.onAuthStateChange`.

## Directory Delegations

- UI specifics (navigation, theming, layout density, responsive tables): `src/AGENTS.md`.
- Unit testing guidance (Vitest): `tests/AGENTS.md`.
- E2E testing guidance (Playwright): `e2e/AGENTS.md`.
- Schema & invariants (PracticeRecord uniqueness, view sync): `tunetrees/models/AGENTS.md`.
- Backend query/service rules (SQLAlchemy 2.0 style, avoiding N+1, integration with scheduling): `tunetrees/app/AGENTS.md`.
- SQL view maintenance & migrations: `sql_scripts/AGENTS.md`.

## Quality Gates (Global)

Pre-commit: typecheck, lint, format, unit tests.
Pre-push: build, E2E (Playwright). No warnings permitted. Large refactors require explicit migration notes in `_notes/`.

## Commit & Branch Conventions

Gitmoji + Conventional style (e.g. `✨ feat: Add user authentication with Supabase`). Branch naming: `feat/…`, `fix/…`, `refactor/…`, `docs/…`. Include issue/ticket reference when applicable.

## Testing Summary (High-Level)

Unit: Vitest + @solidjs/testing-library for components/utilities. E2E: Playwright across Chromium/Firefox/WebKit + mobile. Single input state per test, explicit timeouts, page objects. See `tests/AGENTS.md` for full detail.

## When Details Are Missing

1. Prefer existing non-legacy project patterns. 2. If unavoidable, inspect legacy for business rules only. 3. Ask for clarification before speculative implementation. 4. Document assumptions inline (minimal) or in `_notes/`.

## Current Phase

Phase 0 (Project Setup) → Next: Phase 1 (Core Authentication). Keep new instructions aligned with migration plan in `_notes/solidjs-pwa-migration-plan.md`.

## Danger Zones (Global)

- Introducing React patterns. - Raw SQL bypassing Drizzle without justification. - Mutating signal values directly (must reassign). - Expanding scope of `due` field semantics. - Ignoring view updates when schema changes. - Adding conditional logic branches inside E2E tests.

## References

Docs: SolidJS, Supabase, Drizzle ORM, ts-fsrs, TanStack Table, Kobalte. Project notes in `_notes/`. Legacy for screenshots/workflows only.

---
Maintained by GitHub Copilot (per @sboagy). Update this file for global policy changes; do NOT embed directory-specific minutiae here.
