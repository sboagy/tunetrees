# tests/AGENTS Instructions

Scope: Unit tests under `tests/**` (Vitest + @solidjs/testing-library).

Inherits global execution guardrails from `.github/copilot-instructions.md` and repository domain context from root `AGENTS.md`.

## Philosophy

1. One input state per test; no branching logic.
2. Test behavior, not implementation details (prefer user-facing outcomes).
3. Keep tests small, isolated, and deterministic.
4. Favor in-memory data and lightweight mocks over heavy integration.

## Stack & Setup

- Runner: Vitest
- Rendering: `@solidjs/testing-library`
- Types: Strict TypeScript (no `any`)

## Patterns

- Component tests: render, assert accessibility/visible output, fire events.
- Utility tests: pure functions with clear inputs/outputs.
- Data access: stub Drizzle calls with minimal fakes; do not hit real Supabase.

Example component test:
```ts
import { render, screen } from '@solidjs/testing-library';
import { MyComponent } from '@/components/MyComponent';

it('renders title', () => {
  render(() => <MyComponent title="Hello" />);
  expect(screen.getByText('Hello')).toBeInTheDocument();
});
```

## Conventions

- File names: `*.test.ts(x)` near unit under test or in `tests/` when cross-cutting.
- One main expectation per test; split scenarios.
- Avoid time-based flakiness; use synchronous utilities or fake timers.

## Mocks & Fakes

- Prefer narrow mocks at module boundary (e.g., `vi.mock('@/lib/db/client')`).
- Keep mock data minimal and explicit (see `tests/fixtures/`).

## CI & Gates

- Run with `npm run test` in CI. All unit tests must pass with zero warnings.
- Coverage optional; add where critical logic warrants it.

## References

- Global rules: root `AGENTS.md`
- UI specifics (IDs, structure): `src/AGENTS.md`
- E2E: `e2e/AGENTS.md`

---
Update this file for unit-testing policy only. E2E belongs in `e2e/AGENTS.md`.
