# GitHub Copilot: Global AI Execution Rules

This file intentionally contains only global execution guardrails.

Repository-specific architecture, tech stack details, and patterns (including sync adapters/codegen boundaries) live in the root `AGENTS.md` and scoped `*/AGENTS.md` files.

## 0. Analysis Before Action

- **Clarify Ambiguities:** If the requirements I give you are ambiguous, ask clarifying questions before writing any code.
- **Understand Before Acting:** Before making any code changes, ensure you fully understand the request and the existing code. If anything is unclear, ask for clarification.
- **Plan Your Changes:** Outline the specific changes you intend to make before writing code. This includes identifying which files and sections of code will be affected, and how you will ensure your changes integrate smoothly with the existing codebase.
- **Plan Tests:** Consider how you will test your changes before implementing them. Identify the types of tests (unit, integration, etc.) that will be necessary to verify your changes work as intended and do not introduce new issues.  Consider if you should write new tests or update existing ones, and how you will cover edge cases.  Consider if you should write tests before or after implementing the code changes, and how you will ensure your tests are comprehensive and effective.
- **Check for Existing Solutions:** Before implementing a change, check if there are existing functions, utilities, or patterns in the codebase that can be reused or adapted to meet the requirements. Avoid reinventing the wheel when a suitable solution already exists.
- **Consider the Impact:** Think about how your changes will affect the overall system, including potential side effects and interactions with other parts of the codebase. Aim to minimize disruption while achieving the desired outcome.
- **Respect the Codebase:** Always strive to maintain the integrity and readability of the codebase. Avoid making unnecessary changes or introducing complexity that could make the code harder to understand or maintain in the future.
- **Test Thoroughly:** After making changes, thoroughly test your code to ensure it works as intended and does not introduce new issues. Consider edge cases and potential failure points in your testing strategy.

## 1. Reliability & Loop Prevention

- **Verify State:** Before any file edit, read the current state of the file (and the specific section you will change) to ensure symbols and context match your plan.
- **Stop on Error:** If an edit results in a syntax error, type error, failing test, or logic loop, stop. Explain what failed, re-read the entire file from disk, then propose a corrected patch.
- **No Apology-and-Retry Loops:** Do not keep attempting near-identical patches after failures. After 2 failed edit attempts on the same file without new information, stop and ask for guidance.
- **No Duplicates:** Never append code that already exists. Before finalizing, check for duplicate imports, duplicate exports, repeated helper functions, and repeated config blocks.

## 2. Technical Standards

- **Surgical Edits:** Prefer minimal, targeted diffs over full-file rewrites unless the file is genuinely small (< 50 lines) or a rewrite is explicitly requested.  HOWEVER, do not be afraid to rewrite if the existing code is very messy or if the change is large and would be more error-prone as a patch.  Simplicity and correctness are more important than patch size.  Bottom line is that human understanding and reviewability should be the primary guide for how to structure your changes.
- **Preserve Comments:** Do not remove existing developer comments unless the logic they describe is being removed.
- **Add Comments:** When adding new code, include comments to explain complex logic or decisions.  Do not add comments for trivial code, but err on the side of over-commenting if you think it will help human reviewers understand your changes.
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
