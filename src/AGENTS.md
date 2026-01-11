# src/AGENTS Instructions

Scope: UI implementation under `src/**` for the SolidJS PWA.

Inherits global execution guardrails from `.github/copilot-instructions.md` and repository domain context from root `AGENTS.md`.

## Mission

Deliver a productivity‑focused, table‑centric SolidJS PWA UI with equal desktop/mobile capability, offline‑first responsiveness, and user‑controlled theming. Preserve proven workflows visible in legacy screenshots (navigation tabs, tune tables, sidebars, settings modal, tune editor sections) without porting React/Next.js patterns.

## Core Principles (Critical)

1. Table‑Centric Primary Views: TanStack Solid Table for tune lists, catalog, practice queues. No card grids for core data.
2. Equal Desktop & Mobile Priority: Same feature set; adapt ergonomics only (tabs vs. collapsible sidebar). Horizontal scroll acceptable—do not reduce columns by default.
3. Information Density > Spacious Layouts: Optimize for scanning large datasets (columns: Id, Title, Goal, Type, Structure, Scheduled, Practiced, Stability).
4. User‑Controlled Theme: Preferences: `light | dark | system`. Persist in user settings; system used only when preference == system.
5. Legacy Fidelity: Check legacy UI for layout, column ordering, modal grouping. Keep references; do not copy React code.
6. SolidJS Reactivity: Avoid React imports entirely. Use signals/memos/effects; NO `useState`, `useEffect`, `useContext`.
7. Accessibility: All icon buttons require `sr-only` text; dialogs manage focus; keyboard escape closes modal.
8. Deterministic Component Boundaries: Keep components simple; prefer composition + signals over prop drilling.
9. Performance: Avoid unnecessary reactive dependencies; use `createMemo` for derived heavy table data.
10. Data Reads Local First: UI queries local SQLite via Drizzle; show optimistic row updates; sync status unobtrusive.

## Navigation Patterns

Desktop: Horizontal tab bar (Practice | Repertoire | Catalog | Analysis) with border bottom highlight.
Mobile: Hamburger → slide‑in sidebar with same links; overlay click closes.
Side Panels: Collapsible References & Notes (toggle icon changes). Use fixed width ~16rem on desktop.

## Table Implementation Essentials

```ts
const table = createSolidTable({
  get data() { return tunes(); },
  columns: [
    { accessorKey: 'id', header: 'ID' },
    { accessorKey: 'title', header: 'Title' },
    { accessorKey: 'type', header: 'Type' },
    { accessorKey: 'mode', header: 'Mode' },
    // scheduling fields etc.
  ],
  getCoreRowModel: getCoreRowModel(),
});
```

UI Requirements:
- Sticky headers: `sticky top-0` with theme background.
- Hover row style: `hover:bg-gray-100 dark:hover:bg-gray-700`.
- Action column at right (icons AFTER text if combined).
- Horizontal scroll wrapper on small screens: `overflow-x-auto`.

## Theming

Preference algorithm:
```ts
function applyTheme(pref: 'light' | 'dark' | 'system') {
  const isDark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', isDark);
}
```
Settings page exposes explicit selector; never hardcode theme to system only.

## Component Patterns

Buttons (shadcn-solid variants):
- `default`: primary commit actions (Save, Submit)
- `outline`: neutral secondary (Cancel, Sign In)
- `ghost`: low emphasis / icon
- `destructive`: delete/remove
- `link`: textual

Dialog structure: header (title + close), content sections, footer (primary on right). Use consistent padding; avoid nesting scrollable areas.

Icons (Lucide Solid): Place AFTER text for mixed buttons. Icon-only requires `size="icon"` + `sr-only` span.

## Forms & Validation

Use Zod + light form handling. Each field: Label, Control, Description, Error. Avoid duplicate local state and signal state.

## Mobile Guidelines

- Touch targets ≥ 44px.
- Keep table, enable scroll; do not transform to cards.
- Collapse sidebars by default.
- Provide top‑level quick actions (Add Tune, Filter) as icon + tooltip or icon + short text.

## Accessibility

- Provide `aria-label` or `sr-only` text for icon-only controls.
- Maintain focus trap in modals; initial focus on first interactive element.
- Contrast: ensure Tailwind classes meet WCAG AA.

## Toast & Feedback

Use consistent toast for success/error; avoid blocking modals for routine success states. Long operations show inline spinner in button + toast when done.

## Testability

All interactive controls used by E2E must include stable `data-testid` values (kebab-case). Coordinate with `e2e/page-objects/TuneTreesPage.ts`.

## Performance Tips

- Memoize heavy derived cell content with `createMemo`.
- Use virtualization for large tables.
- Prefer context/signals over deep prop chains.

## References

Legacy screenshots: `legacy/frontend/components/`. Style guide: `frontend/UI_STYLE_GUIDE2.md`. Global rules: project root `AGENTS.md`.

---
UI-specific; keep concise and current. Global invariants live in root AGENTS.
