# GitHub Copilot: TuneTrees SolidJS PWA Rewrite Instructions

**Effective Date:** October 4, 2025  
**Branch:** `feat/pwa1`  
**Status:** Active Development - Phase 0 (Project Setup)

> **⚠️ IMPORTANT:** This repository is undergoing a complete architecture rewrite.
>
> - **New Stack:** SolidJS + TypeScript + Supabase + SQLite WASM (this file)
> - **Legacy Stack:** Next.js + Python/FastAPI (see `legacy/.github/copilot-instructions.md`)

---

## Audience & Intent

This file guides Copilot's code suggestions for the **new SolidJS PWA** rewrite. Optimize for:

- **Offline-first** architecture
- **Reactive** programming with Solid signals
- **Type safety** (strict TypeScript, no `any`)
- **Performance** (60 FPS, sub-3s load times)
- **Clean, minimal code** that follows SolidJS best practices

Respond with short, actionable output. Provide complete, runnable code with only necessary imports. Avoid boilerplate and new abstractions unless required.

---

## Top 10 Rules (Read First)

1. **Never commit/push code** without explicit permission.
2. **Strict TypeScript:** No `any` types. Use strict mode. Interfaces prefix with `I*`.
3. **SolidJS Reactivity:** Use signals (`createSignal`), effects (`createEffect`), memos (`createMemo`). Avoid unnecessary re-renders.
4. **Offline-First:** All reads from local SQLite WASM. Writes queue to Supabase sync layer.
5. **Supabase Auth:** Replace NextAuth patterns with Supabase Auth SDK. Use SolidJS context for user state.
6. **Drizzle ORM:** Type-safe queries. No raw SQL unless absolutely necessary.
7. **shadcn-solid + Kobalte:** Port React components to Solid equivalents. Use `@kobalte/core` primitives.
8. **No React Patterns:** Avoid `useEffect`, `useState`, etc. Learn SolidJS equivalents.
9. **Quality Gates:** Run `npm run typecheck && npm run lint && npm run format` before commits.
10. **Reference Legacy:** When porting features, reference `legacy/` code for business logic, not framework patterns.

---

## Stack Overview

### **Frontend**

- **Framework:** SolidJS 1.8+ with TypeScript 5.x (strict mode)
- **Build Tool:** Vite 5.x
- **Routing:** `@solidjs/router`
- **UI Components:** shadcn-solid (port of shadcn/ui)
- **UI Primitives:** `@kobalte/core` (Solid port of Radix UI)
- **Styling:** Tailwind CSS 4.x
- **Icons:** Lucide Solid
- **Data Grids:** `@tanstack/solid-table` + `@tanstack/solid-virtual`

### **Backend & Auth**

- **Auth:** Supabase Auth (email/password, OAuth)
- **Cloud Database:** Supabase PostgreSQL
- **Realtime:** Supabase Realtime (websocket-based sync)

### **Local Storage**

- **Database:** SQLite WASM (`sql.js` or `wa-sqlite`)
- **ORM:** Drizzle ORM with TypeScript
- **Sync:** Custom sync layer (Supabase ↔ SQLite)

### **Scheduling**

- **Algorithm:** `ts-fsrs` (client-side FSRS implementation)
- **Fallback:** SM2 algorithm (from legacy Python logic)

### **External Libraries**

- **Music Notation:** `abcjs` (wrapped in Solid component)
- **Rich Text Editor:** `jodit` (wrapped in Solid component)

### **PWA**

- **Plugin:** `vite-plugin-pwa`
- **Service Worker:** Workbox-based
- **Deployment:** Cloudflare Pages

---

## Architecture Principles

### **Offline-First Model**

```
User Action → SQLite WASM (immediate) → Sync Queue → Supabase (background)
                     ↓
              Supabase Realtime → SQLite WASM (updates from other clients)
```

**Key Points:**

- All UI reads from local SQLite (fast, always available)
- Writes save locally first, then sync asynchronously
- Conflict resolution: last-write-wins with user override option
- Service worker handles background sync

### **Data Flow**

```typescript
// ✅ Correct SolidJS pattern
import { createSignal, createResource } from "solid-js";
import { db } from "@/lib/db/client";
import { tunes } from "@/lib/db/schema";

export function TunesList() {
  const [tunes] = createResource(async () => {
    return await db.select().from(tunes).all();
  });

  return (
    <Show when={!tunes.loading} fallback={<p>Loading...</p>}>
      <For each={tunes()}>{(tune) => <div>{tune.title}</div>}</For>
    </Show>
  );
}

// ❌ WRONG - Don't use React patterns
// import { useState, useEffect } from 'react'; // NO!
```

### **State Management**

- **Local Component State:** `createSignal`
- **Derived State:** `createMemo`
- **Side Effects:** `createEffect`
- **Global State:** SolidJS Context API
- **URL State:** `useSearchParams` from `@solidjs/router`

---

## Code Patterns

### **1. Supabase Auth Integration**

```typescript
// src/lib/supabase/client.ts
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// src/lib/auth/AuthContext.tsx
import {
  createContext,
  useContext,
  createSignal,
  ParentComponent,
} from "solid-js";
import { supabase } from "@/lib/supabase/client";

interface AuthState {
  user: () => User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>();

export const AuthProvider: ParentComponent = (props) => {
  const [user, setUser] = createSignal<User | null>(null);

  supabase.auth.onAuthStateChange((event, session) => {
    setUser(session?.user ?? null);
  });

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, signIn, signOut }}>
      {props.children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext)!;
```

### **2. Drizzle ORM Queries**

```typescript
// src/lib/db/schema.ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("user", {
  id: integer("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
});

export const playlists = sqliteTable("playlist", {
  id: integer("id").primaryKey(),
  user_ref: integer("user_ref").references(() => users.id),
  instrument: text("instrument"),
  genre: text("genre"),
});

// src/lib/db/queries.ts
import { db } from "./client";
import { playlists, users } from "./schema";
import { eq, and } from "drizzle-orm";

export async function getPlaylistsForUser(userId: number) {
  return await db
    .select()
    .from(playlists)
    .where(eq(playlists.user_ref, userId))
    .all();
}

// ✅ Batch queries to avoid N+1
export async function getPlaylistsWithUserInfo(userId: number) {
  return await db
    .select()
    .from(playlists)
    .leftJoin(users, eq(playlists.user_ref, users.id))
    .where(eq(playlists.user_ref, userId))
    .all();
}
```

### **3. External Library Wrappers**

```typescript
// src/components/AbcNotation.tsx
import { createEffect, onCleanup, Component } from "solid-js";
import abcjs from "abcjs";

interface AbcNotationProps {
  notation: string;
  responsive?: boolean;
}

export const AbcNotation: Component<AbcNotationProps> = (props) => {
  let containerRef: HTMLDivElement;

  createEffect(() => {
    if (containerRef && props.notation) {
      abcjs.renderAbc(containerRef, props.notation, {
        responsive: props.responsive ?? "resize",
      });
    }
  });

  onCleanup(() => {
    // Cleanup if needed
  });

  return <div ref={containerRef!} class="abc-notation" />;
};
```

### **4. TanStack Solid Table**

```typescript
// src/components/TunesTable.tsx
import { createSolidTable, flexRender } from "@tanstack/solid-table";
import { For } from "solid-js";

export function TunesTable(props: { data: Tune[] }) {
  const table = createSolidTable({
    get data() {
      return props.data;
    },
    columns: [
      { accessorKey: "title", header: "Title" },
      { accessorKey: "type", header: "Type" },
      { accessorKey: "mode", header: "Mode" },
    ],
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <table>
      <thead>
        <For each={table.getHeaderGroups()}>
          {(headerGroup) => (
            <tr>
              <For each={headerGroup.headers}>
                {(header) => (
                  <th>
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                  </th>
                )}
              </For>
            </tr>
          )}
        </For>
      </thead>
      <tbody>
        <For each={table.getRowModel().rows}>
          {(row) => (
            <tr>
              <For each={row.getVisibleCells()}>
                {(cell) => (
                  <td>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                )}
              </For>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  );
}
```

---

## Migration from Legacy

### **DO Port:**

- ✅ Business logic (scheduling algorithms, validation rules)
- ✅ Database schema structure (adapt to Drizzle)
- ✅ UI layouts and designs (adapt to SolidJS)
- ✅ Test scenarios (adapt to Solid Testing Library)
- ✅ Tailwind classes (mostly 1:1)

### **DON'T Port:**

- ❌ React hooks (`useState`, `useEffect`, `useContext`)
- ❌ Next.js patterns (Server Components, Server Actions)
- ❌ FastAPI routes (replaced by Supabase)
- ❌ NextAuth logic (replaced by Supabase Auth)
- ❌ SQLAlchemy queries (rewrite with Drizzle)

### **Reference Guide**

| Legacy (React/Next.js)             | New (SolidJS)                     |
| ---------------------------------- | --------------------------------- |
| `useState`                         | `createSignal`                    |
| `useEffect`                        | `createEffect`                    |
| `useMemo`                          | `createMemo`                      |
| `useContext`                       | `createContext` + `useContext`    |
| `useCallback`                      | Not needed (functions are stable) |
| `useRef`                           | Direct variable assignment        |
| `{condition && <Component />}`     | `<Show when={condition}>`         |
| `array.map(item => <Component />)` | `<For each={array}>`              |
| React Router                       | `@solidjs/router`                 |
| Radix UI                           | `@kobalte/core`                   |
| shadcn/ui                          | `shadcn-solid`                    |

---

## Testing Strategy

### Special Considerations

- CoPilot local should NEVER run the dev server. I will do that. If you need the server rebooted, ask. It will always be running on http://localhost:5173/.
- The "Playwright" and "playwrite-test" server should always be running for testing.
- Tests must have one input state and one output state. Normally they should not contain conditionals.
- To reset the local database completely run `npm run db:local:reset`

### Ad hoc Playwright browser testing

- You may start a browser with Playwright MCP, and control the user interface, ad hoc.

### **Unit Tests**

- **Tool:** Vitest + `@solidjs/testing-library`
- **Coverage:** Component logic, utility functions, Drizzle queries

```typescript
// src/lib/utils.test.ts
import { describe, it, expect } from "vitest";
import { formatTuneTitle } from "./utils";

describe("formatTuneTitle", () => {
  it("capitalizes first letter", () => {
    expect(formatTuneTitle("banish misfortune")).toBe("Banish Misfortune");
  });
});
```

### **E2E Tests**

- **Tool:** Playwright (reuse existing patterns from `legacy/frontend/tests/`)
- **Focus:** Critical user flows (login, practice session, tune editing)

```typescript
// tests/login.spec.ts
import { test, expect } from "@playwright/test";

test("user can log in with email/password", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("test@example.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL("/practice");
});
```

---

## Quality Gates

### **Pre-Commit Checks**

```bash
npm run typecheck  # TypeScript strict mode check
npm run lint       # ESLint
npm run format     # Prettier
npm run test       # Unit tests
```

### **Pre-Push Checks**

```bash
npm run build      # Production build
npm run test:e2e   # Playwright tests
```

### **No Warnings Allowed**

- Zero TypeScript errors
- Zero ESLint warnings
- All tests passing
- Build succeeds

---

## Danger Zones (Avoid These)

### **❌ Using React Patterns**

```typescript
// ❌ WRONG
import { useState } from "react";
function Component() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}

// ✅ CORRECT
import { createSignal } from "solid-js";
function Component() {
  const [count, setCount] = createSignal(0);
  return <button onClick={() => setCount(count() + 1)}>{count()}</button>;
}
```

### **❌ Directly Mutating Signals**

```typescript
// ❌ WRONG
const [user, setUser] = createSignal({ name: "Alice" });
user().name = "Bob"; // DOESN'T TRIGGER REACTIVITY!

// ✅ CORRECT
const [user, setUser] = createSignal({ name: "Alice" });
setUser({ ...user(), name: "Bob" });
```

### **❌ Missing Cleanup in Effects**

```typescript
// ❌ WRONG
createEffect(() => {
  const interval = setInterval(() => console.log("tick"), 1000);
  // Memory leak!
});

// ✅ CORRECT
createEffect(() => {
  const interval = setInterval(() => console.log("tick"), 1000);
  onCleanup(() => clearInterval(interval));
});
```

### **❌ Using `any` Types**

```typescript
// ❌ WRONG
const data: any = await fetchTunes();

// ✅ CORRECT
interface Tune {
  id: number;
  title: string;
  type: string;
}
const data: Tune[] = await fetchTunes();
```

---

## File Organization

```
src/
├── components/        # Reusable UI components
│   ├── ui/           # shadcn-solid components
│   ├── auth/         # Auth-related components
│   └── layouts/      # Layout wrappers
├── routes/           # SolidJS router pages
│   ├── index.tsx     # Home page
│   ├── login.tsx     # Login page
│   └── practice/     # Practice pages
├── lib/              # Utilities and core logic
│   ├── db/           # Drizzle ORM (schema, client, queries)
│   ├── supabase/     # Supabase client config
│   ├── auth/         # Auth context and helpers
│   └── utils/        # General utilities
├── assets/           # Static assets
└── types/            # TypeScript type definitions

drizzle/
└── schema.ts         # Database schema definitions

public/               # Static files (served as-is)
```

---

## Commit Conventions

### **Gitmoji + Conventional Commits**

```bash
✨ feat: Add user authentication with Supabase
🐛 fix: Resolve sync conflict in practice records
♻️ refactor: Convert Login component to SolidJS
📝 docs: Update README with SolidJS setup instructions
✅ test: Add E2E test for playlist creation
🎨 style: Format code with Prettier
⚡ perf: Optimize table rendering with virtual scrolling
```

### **Branch Naming**

- `feat/feature-name` - New features
- `fix/bug-description` - Bug fixes
- `refactor/what-changed` - Code refactoring
- `docs/what-documented` - Documentation updates

---

## References

### **Documentation**

- SolidJS Docs: https://www.solidjs.com/docs/latest
- Supabase Docs: https://supabase.com/docs
- Drizzle ORM Docs: https://orm.drizzle.team/
- ts-fsrs: https://github.com/open-spaced-repetition/ts-fsrs
- Kobalte UI: https://kobalte.dev/
- TanStack Solid Table: https://tanstack.com/table/latest/docs/framework/solid/solid-table

### **Project Instructions**

- **UI Guidelines:** `.github/instructions/ui-development.instructions.md` - Table-centric design, navigation patterns, theming
- **Database Rules:** `.github/instructions/database.instructions.md` - Schema, invariants, safety rules
- **Testing Guidelines:** `.github/instructions/testing.instructions.md` - Playwright and unit test patterns

### **Legacy Code**

- **Backend Logic:** `legacy/tunetrees/app/schedule.py` - Scheduling algorithms
- **Database Schema:** `legacy/tunetrees/models/tunetrees.py` - SQLAlchemy models
- **Frontend Components:** `legacy/frontend/components/` - React UI patterns
- **E2E Tests:** `legacy/frontend/tests/` - Test scenarios to port

### **Migration Plan**

- **Full Plan:** `_notes/solidjs-pwa-migration-plan.md`
- **Phase 0 Checklist:** `_notes/phase-0-checklist.md`
- **Migration Scripts:** `MIGRATION_SCRIPTS_README.md`

---

## When Details Are Missing

1. **Infer from Legacy:** Check `legacy/` for similar patterns
2. **Follow SolidJS Best Practices:** Consult official docs
3. **Ask First:** If unclear, ask before implementing
4. **Document Assumptions:** Add comments explaining choices

---

## Current Phase: Phase 0 (Project Setup)

**Active Tasks:** (See `_notes/phase-0-checklist.md`)

- [ ] Initialize SolidJS project with Vite
- [ ] Set up Supabase account and project
- [ ] Configure Drizzle ORM with SQLite WASM
- [ ] Install core dependencies
- [ ] Create initial project structure

**Next Phase:** Phase 1 (Core Authentication)

---

**Last Updated:** October 4, 2025  
**Maintained By:** GitHub Copilot (per user @sboagy)
