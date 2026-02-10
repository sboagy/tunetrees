# Extensibility Proposals (Imports + Goal Scheduling)

This document outlines **three minimal, secure extension approaches** for TuneTrees that keep complexity low while enabling new import sources and goal-specific scheduling logic.

## Current Implementation: Sandboxed JS Plugins (QuickJS)

TuneTrees now ships a **sandboxed QuickJS plugin system** for imports and goal-based scheduling.

### Where it lives

- Database table: `plugin`
- UI: **User Settings → Plugins**
- Runtime: `src/lib/plugins/quickjs-worker.ts` (Web Worker sandbox)

### Capabilities

Plugins declare capabilities as JSON (`capabilities` column):

```json
{
  "parseImport": true,
  "scheduleGoal": false
}
```

Supported capabilities:

- `parseImport` — parse external inputs into TuneTrees tune fields
- `scheduleGoal` — override scheduling for a goal (via `createScheduler`)

### Host helpers

The sandbox provides:

- `fetchUrl(url, options)` — fetch via `/api/proxy` (CORS-safe)
- `parseCsv(text)` — CSV → array of objects
- `parseJson(text)` — JSON → object
- `log(...args)` — logs to console

### `parseImport(payload)`

Input payload:

```json
{
  "input": "https://example.com/tunes.csv",
  "genre": "ITRAD",
  "isUrl": true
}
```

Return an object with tune fields:

```json
{
  "title": "New Tune",
  "type": "Reel",
  "mode": "D Major",
  "structure": "AABB",
  "incipit": "|:ABcd:|",
  "genre": "ITRAD",
  "sourceUrl": "https://example.com/tunes.csv"
}
```

### `createScheduler({ fsrsScheduler, queryDb })`

The factory returns an object with `processFirstReview` and `processReview`.
Input payload includes a `fallback` schedule (FSRS result). Return a full or
partial schedule; missing fields will be filled from the fallback.

Helpers available:

- `fsrsScheduler`: full FSRS scheduler interface for fallback results.
- `queryDb(sql)`: read-only SQL with a 500-row limit and table allowlist.

```typescript
function createScheduler({ fsrsScheduler, queryDb }) {
  return {
    async processFirstReview(payload) {
      return payload.fallback;
    },
    async processReview(payload) {
      return payload.fallback;
    },
  };
}
```

Payload example:

```json
{
  "input": {
    "playlistRef": "...",
    "tuneRef": "...",
    "quality": 3,
    "practiced": "2026-01-20T12:00:00.000Z",
    "goal": "recall"
  },
  "prior": null,
  "preferences": {},
  "scheduling": {},
  "fallback": {
    "nextDue": "2026-01-27T12:00:00.000Z",
    "lastReview": "2026-01-20T12:00:00.000Z",
    "state": 2,
    "stability": 5,
    "difficulty": 3,
    "elapsedDays": 0,
    "scheduledDays": 7,
    "reps": 1,
    "lapses": 0,
    "interval": 7
  }
}
```

### Migrations + codegen

When adding/altering plugin schema:

1. `supabase db reset` (or `npm run db:local:reset`)
2. `npm run codegen:schema`

### Proxy configuration

The generic proxy lives at `/api/proxy` with the following env vars:

- `PROXY_BLOCKLIST` — comma-separated hostnames to block
- `PROXY_TIMEOUT_MS` — request timeout (default 10000)
- `PROXY_MAX_BYTES` — response size limit (default 2000000)

## Constraints & Goals

- **PWA + offline-first:** Avoid runtime downloads of arbitrary code.
- **Security first:** No untrusted code execution in the browser.
- **Simple configuration:** Avoid a complex DSL; prefer small JSON config or curated code.
- **Two extension points:**
  1. **Importers** (catalogs/tunes)
  2. **Goal → scheduling algorithm** when a goal is set

## Proposal A: Declarative “Adapter” Config (No Code)

**Summary:** Allow plugins as **JSON config** that describe mappings and simple scheduling rules. The app provides a **fixed set of import parsers** (CSV/JSON/ABC) and a **simple rule evaluator** for goals.

- **Imports:** Config selects a built-in parser and maps columns/fields to TuneTrees schema.
- **Scheduling:** Config uses basic rule primitives like `intervalDays: [1, 3, 7, 14]` or `baseIntervalDays` per goal.
- **Security:** No executable code; only validated data.
- **Pros:** Safest, easiest for users, works offline.
- **Cons:** Limited flexibility for niche formats or complex algorithms.

## Proposal B: Build-Time Plugin Registry (Trusted Code Only)

**Summary:** Support a **plugin registry** compiled into the app build (e.g., local `src/plugins/*`). Plugins are trusted code, registered via a typed interface.

- **Imports:** Plugin implements `ImportProvider` and returns normalized tunes.
- **Scheduling:** Plugin implements `GoalScheduler` to compute next due dates.
- **Security:** No remote code loading; only code shipped with the app.
- **Pros:** Flexible, type-safe, no runtime risks.
- **Cons:** Requires rebuild/deploy for new plugins; not user-installable at runtime.

## Proposal C: Server-Side Extension Hooks (Worker/Edge)

**Summary:** Run custom import and scheduling logic **server-side** (Cloudflare Worker / Supabase Edge Function). The client calls a trusted endpoint for parsing or scheduling.

- **Imports:** Upload data → server parses/normalizes → returns tunes.
- **Scheduling:** Client sends goal + tune state → server returns next due.
- **Security:** Keeps code off the client; server can sandbox and audit.
- **Pros:** Maximum flexibility without exposing client to untrusted code.
- **Cons:** Requires network and hosting; weaker offline story.

## Proposal D: Sandboxed Runtime Scripting (Limited Capabilities)

**Summary:** Allow user-provided scripts in a **restricted language** that runs in a sandboxed worker with an explicit host API (no DOM, no network). Use it for goal rules and import parsing while controlling security and resource usage.

- **Candidate languages:** CEL or JSONLogic for simple rules; Starlark, Lua (Fengari), or WASM (e.g., AssemblyScript/Rust) for richer parsing logic.
- **Imports:** Script receives a file payload (CSV/HTML/JSON) and emits normalized tunes via a host callback.
- **Scheduling:** Script receives tune state + goal and returns a next-due date or interval.
- **Security:** Deterministic runtimes + explicit API surface; enforce timeouts and memory limits in a Web Worker.
- **Pros:** More flexible than pure config; still avoids arbitrary JS.
- **Cons:** More engineering effort; still needs guardrails against runaway scripts.

## Notes for Selection

- **If security + simplicity are top priority:** Proposal A.
- **If developer flexibility is top priority (and rebuilds are ok):** Proposal B.
- **If you want user-specific code without client risk:** Proposal C.
- **If you want runtime plugins with guardrails:** Proposal D.
