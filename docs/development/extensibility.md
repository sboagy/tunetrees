# Extensibility: Imports and Goal Scheduling

The current QuickJS contracts are described first. Earlier alternatives are retained in a clearly marked historical section; they are not supported runtime APIs.

## Current Implementation: Sandboxed JS Plugins (QuickJS)

TuneTrees now ships a **sandboxed QuickJS plugin system** for imports and goal-based scheduling.

### Where it lives

- Database table: `plugin`
- UI: **User Settings → Plugins**
- Transport and deadlines: `src/lib/plugins/quickjs-host.ts`
- Worker channel and initialization: `src/lib/plugins/quickjs-worker.ts`
- VM contexts, host promises, and cleanup: `src/lib/plugins/quickjs-core.ts`
- Shared message validation: `src/lib/plugins/quickjs-protocol.ts`

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
- `scheduleGoal` — calculate scheduling for an explicitly selected goal (versioned API below)

### Host helpers

The sandbox provides:

- `await fetchUrl(url, options)` — fetch via `/api/proxy` (CORS-safe)
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

### Versioned Goal Scheduler Contract

Select an enabled scheduler plugin explicitly in a goal's editor. Pair its named
actions with editable evaluation labels. `scheduleGoal` denotes this capability;
it does not select a plugin by matching a goal name.

- `describeGoalSchedulerV1()` returns `apiVersion: 1`, `stateVersion`,
  `compatibleStateVersions`, and named `actions` (`id`, `label`, `description`).
- `scheduleGoalV1(input)` receives `apiVersion`, `goalId`, `evaluation` (including
  `actionId`), ISO `practiced`, goal `options`, requested `stateVersion`, and either
  null or `previousState: { version, data }`.
- Return `{ due, state }`: a valid future due timestamp and bounded JSON state.
  The host derives the fractional interval and wraps state with plugin identity,
  version and script hash. Continuation is limited to the latest submitted event
  with the same goal/plugin and a declared compatible state version.

Use the maintained [scheduler template](../../src/lib/plugins/scheduling-template.ts)
for a complete executable example. The [executor](../../src/lib/plugins/goal-scheduler.ts)
validates declarations, results and state. The Test Runner offers the same versioned
entry points; legacy factory-only scripts require an explicit rewrite.

Errors, invalid results and timeouts leave the evaluation unsubmitted with a
retryable error. There is no implicit built-in fallback. A timed-out worker is
replaced, and old replies cannot complete calls in its replacement. Scheduling
uses the captured script/declaration and passes state/options explicitly; no host
FSRS scheduler or database-query bridge is supplied by the goal executor.

Save revalidates the plugin declaration and caller ownership. Staging fingerprints
include script/metadata; Submit validates the captured receipt without running a
possibly nondeterministic script again. Label changes do not rewrite recorded
history. Updating the app template does not rewrite a user's saved scripts.

### Migrations and Codegen

Follow the repository's additive schema workflow: apply the source migration to
local Postgres, regenerate with `npm run codegen:schema`, and run the schema check,
typecheck, lint and unit tests. Do not reset a database merely to edit a plugin.
Deployment compatibility is governed by [schema promotion](schema-promotion.md).

### Proxy configuration

The generic proxy lives at `/api/proxy` with the following env vars:

- `PROXY_BLOCKLIST` — comma-separated hostnames to block
- `PROXY_TIMEOUT_MS` — request timeout (default 10000)
- `PROXY_MAX_BYTES` — response size limit (default 2000000)

## Historical Alternatives (Not the Implemented Contract)

The proposals below record earlier design exploration. They do not override the
current QuickJS contract above.

### Constraints & Goals

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
