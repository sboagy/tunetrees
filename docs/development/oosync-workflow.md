# oosync Dependency Workflow (TuneTrees)

This document defines the supported workflow for developing TuneTrees and `oosync` together while keeping CI stable.

## Goals

- Treat `oosync` as a real external dependency in TuneTrees.
- Keep CI deterministic with no branch-resolution or checkout hacks.
- Preserve an efficient local multi-repo development loop.

## Current dependency model

TuneTrees depends on `oosync` using an immutable GitHub tarball in `package.json`:

- `oosync`: `https://codeload.github.com/sboagy/oosync/tar.gz/<commit-sha>`

Why this is used:

- Immutable and reproducible (`npm ci` installs exactly one commit).
- No npm publish required.
- No SSH/git transport assumptions in CI runners.

## CI behavior

CI installs dependencies using only:

- `npm ci`

There is no `.deps/oosync` checkout, branch mapping, or fallback logic in workflows.

## Updating TuneTrees to a new oosync ref

Use the update helper script from TuneTrees root:

```bash
npm run deps:oosync:update -- <tag-or-sha>
```

Examples:

```bash
npm run deps:oosync:update -- v0.2.1
npm run deps:oosync:update -- 12f1eacec9fca72122220a016d647c648a55411a
```

This updates:

- `package.json`
- `package-lock.json`

After bumping, run smoke checks:

```bash
npm run codegen:schema:check
npm run typecheck
npx vitest run tests/lib/sync/casing.test.ts tests/lib/sync/table-meta.test.ts tests/lib/sync/adapters.test.ts
```

Then commit both files (`package.json` and `package-lock.json`) with the bump.

## Developing oosync and TuneTrees in parallel

Use two repositories/worktrees:

- TuneTrees repo
- oosync repo

### Option A (default, CI-like)

- Keep TuneTrees using the pinned tarball dependency.
- Make changes in `oosync`, push commit, bump TuneTrees with `deps:oosync:update`.

### Option B (active local iteration)

When iterating rapidly across both repos:

```bash
# in oosync repo
npm link

# in tunetrees repo
npm link oosync
```

When done, return to pinned dependency state:

```bash
npm unlink oosync
npm install
```

## Release cadence recommendation

- Prefer tags for shared milestones (`v0.x.y`).
- Use commit SHAs for urgent or pre-tag integration.
- Keep TuneTrees pinned to immutable refs only.

## Troubleshooting

### TuneTrees still uses old oosync code

```bash
rm -rf node_modules package-lock.json
npm install
```

### Linked dependency confusion

```bash
npm unlink oosync
npm install
npm ls oosync
```

### Verify installed ref

Check resolved source in `package-lock.json` under `node_modules/oosync.resolved`.
