# src/AGENTS Instructions

Scope: implementation under `src/**` for the SolidJS PWA. Inherits root [AGENTS.md](../AGENTS.md) and [.github/copilot-instructions.md](../.github/copilot-instructions.md).

## Mandatory UI contract

Before constructing, changing, or auditing UI, read [the TuneTrees design system](../docs/design/tunetrees-design-system.md). It is the sole repository authority for appearance, action vocabulary, interaction behavior, accessibility behavior, responsive layouts, and audit acceptance. Follow its rule IDs and audit protocol; report unverified behavior. Existing code, legacy screenshots, and component defaults do not override it. Keep user-facing policy there; this file contains implementation constraints only.

## Implementation constraints

- Use SolidJS signals, memos, effects, and composition. No React imports, hooks, or React-only libraries. Avoid duplicate draft state and unnecessary reactive dependencies.
- Use the installed TanStack Solid Table API for core lists and Solid Virtual for large datasets. Inspect current package APIs and shared table utilities; do not copy obsolete construction examples.
- Read local SQLite via Drizzle. Mutations persist locally and enqueue sync through existing data services; do not add browser remote reads to render a screen. Implement feedback according to the design system's distinction between local persistence and synchronization.
- Reuse shared UI components and accessible Kobalte primitives. Implement missing common behavior centrally when authorized; do not duplicate overlay, focus, keyboard, or dirty-state handling in feature components.
- Use Zod with light form handling and one source of truth for each draft. Keep validation and submission logic shared across mouse and keyboard paths.
- Use semantic HTML and primitive accessibility APIs to implement the design system. Keep labels, descriptions, error associations, live regions, and focus restoration intact through conditional rendering and virtualization.
- Persist theme preference in user settings; apply the selected theme to the document and portals. Keep theme resolution centralized.
- Memoize expensive derived table data; preserve stable row identity. Avoid rerender/requery loops and unnecessary whole-table refreshes.
- Interactive controls used by E2E need stable kebab-case `data-testid` values. Coordinate with `e2e/page-objects/TuneTreesPage.ts` and scoped test instructions. Preserve selectors unless the interaction intentionally changes.
- Component API documentation explains props/composition and links to design-system rule IDs; it must not restate or invent UI policy.

## Verification

Apply the design system's §12 acceptance matrix to affected surfaces and shared-component consumers. Use deterministic tests for behavior changes and visual/keyboard checks where appropriate. Follow root instructions for typecheck, lint, formatting, and permission to start servers. Report actual checks and remaining gaps; do not equate passing TypeScript with UI compliance.
