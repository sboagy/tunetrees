# GitHub Copilot: Global AI Execution Rules

This file intentionally contains only global execution guardrails.

Repository-specific architecture, tech stack details, and patterns (including sync adapters/codegen boundaries) live in the root `AGENTS.md` and scoped `*/AGENTS.md` files.

## 1. Reliability & Loop Prevention

- **Verify State:** Before any file edit, read the current state of the file (and the specific section you will change) to ensure symbols and context match your plan.
- **Stop on Error:** If an edit results in a syntax error, type error, failing test, or logic loop, stop. Explain what failed, re-read the entire file from disk, then propose a corrected patch.
- **No Apology-and-Retry Loops:** Do not keep attempting near-identical patches after failures. After 2 failed edit attempts on the same file without new information, stop and ask for guidance.
- **No Duplicates:** Never append code that already exists. Before finalizing, check for duplicate imports, duplicate exports, repeated helper functions, and repeated config blocks.

## 2. Technical Standards

- **Surgical Edits:** Prefer minimal, targeted diffs over full-file rewrites unless the file is genuinely small (< 50 lines) or a rewrite is explicitly requested.
- **Preserve Comments:** Do not remove existing developer comments unless the logic they describe is being removed.
- **Keep APIs Stable:** Do not rename public exports, routes, or config keys unless the change is required to meet the request.

## 3. Type Safety Standards

- **TypeScript:** Prioritize type safety and strictness. Avoid `any`.
- **Boundary Exceptions:** If a third-party integration forces an escape hatch, isolate it to a narrow boundary and prefer `unknown` + validation/narrowing.
- **Explicit Assertions When Needed:** Use explicit type assertions for complex spreads/merges when inference loses safety (e.g., `...primaryKey as Partial<T>`), and keep assertions narrowly scoped.

## 4. Self-Correction Workflow

- **If a Patch Fails to Apply:** Do not retry blindly. Re-read the file, update your patch context, and make a new patch.
- **If a Patch Applies but Breaks Things:** Revert or fix with a deliberate, evidence-based change (read errors, re-check assumptions). Avoid speculative “quick fixes”.

## 5. Process Guardrails

- **No Commits / Pushes:** Never commit, push, or open PRs unless explicitly requested.
- **Validate Changes:** When making code changes, run the smallest relevant checks (typecheck/lint/tests) when practical and report results.
