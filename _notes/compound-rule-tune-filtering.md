# Implementation Plan: Compound Rule for Tune Table Genre Filtering

## Overview

Fix boundary violation in [oosync/worker/src/sync-schema.ts:285-298](oosync/worker/src/sync-schema.ts#L285-L298) where tune table genre filtering is hardcoded into oosync core. Replace with generic compound rule support + config override.

**Scope**: ONLY the `tune` table. Child tables (`note`, `reference`, `practice_record`) are handled separately via RPCs due to JOIN requirements.

## Current Boundary Violation

The `buildUserFilter` function has hardcoded TuneTrees schema knowledge:

```typescript
// Lines 285-298 in sync-schema.ts
if (params.tableName === "tune") {
  // Filter tune table to only tunes with selected genres
  if (params.table.genre) {
    conditions.push(inArray(params.table.genre, genreIds));
    // Also include user's private tunes regardless of genre
    if (params.table.privateFor) {
      return [
        or(
          and(
            inArray(params.table.genre, genreIds),
            isNull(params.table.privateFor)
          ),
          eq(params.table.privateFor, params.userId)
        ),
      ];
    }
    return conditions;
  }
}
```

**Problems**:
- ❌ Hardcodes `tune`, `genre`, `privateFor` column names
- ❌ Violates oosync's schema-agnostic design
- ❌ Can't be used by other apps with similar patterns

## Proposed Solution: Compound PullTableRule

### Step 1: Extend PullTableRule Type

**File**: [oosync/worker/src/sync-schema.ts:74-78](oosync/worker/src/sync-schema.ts#L74-L78)

```typescript
export type PullTableRule =
  | { kind: "eqUserId"; column: string }
  | { kind: "orNullEqUserId"; column: string }
  | { kind: "inCollection"; column: string; collection: string }
  | { kind: "compound"; rules: PullTableRule[] };  // NEW: nested rules combined with OR
```

**Semantics**: 
- `compound` rule applies each nested rule and combines results with OR
- Allows expressing: `(rule1 AND rule2) OR (rule3)` patterns
- Fully generic - no app-specific logic

### Step 2: Update buildUserFilter to Handle Compound Rules

**File**: [oosync/worker/src/sync-schema.ts:254-340](oosync/worker/src/sync-schema.ts#L254-L340)

**Remove**: Lines 264-298 (hardcoded catalog table special cases)

**Add**: Compound rule handler:

```typescript
function buildUserFilter(params: {
  tableName: string;
  table: any;
  userId: string;
  collections: Record<string, Set<string>>;
}): unknown[] | null {
  const rule = getPullRule(params.tableName);
  if (!rule) {
    // Fallback to heuristics...
    return applyHeuristicFilter(params);
  }

  return applyPullRule(rule, params);
}

function applyPullRule(
  rule: PullTableRule,
  params: { tableName: string; table: any; userId: string; collections: Record<string, Set<string>> }
): unknown[] | null {
  if (rule.kind === "compound") {
    // Evaluate each nested rule and combine with OR
    const nestedConditions = rule.rules
      .map(r => applyPullRule(r, params))
      .filter(c => c !== null && c.length > 0)
      .flat();
    
    if (nestedConditions.length === 0) return null;
    if (nestedConditions.length === 1) return nestedConditions;
    return [or(...nestedConditions)];
  }

  const prop = snakeToCamel(rule.column);
  const col = params.table[prop];
  if (!col) return [];

  if (rule.kind === "eqUserId") {
    return [eq(col, params.userId)];
  }

  if (rule.kind === "orNullEqUserId") {
    return [or(isNull(col), eq(col, params.userId))];
  }

  if (rule.kind === "inCollection") {
    const ids = params.collections[rule.collection];
    const arr = ids ? Array.from(ids) : [];
    if (arr.length === 0) return null;
    return [inArray(col, arr)];
  }

  return [];
}
```

### Step 3: Add Config Override for Tune Table

**File**: [oosync.codegen.config.json](oosync.codegen.config.json)

Add new section:

```json
{
  "worker": {
    "config": {
      "pull": {
        "tableRuleOverrides": {
          "tune": {
            "kind": "compound",
            "rules": [
              {
                "kind": "inCollection",
                "column": "genre",
                "collection": "selectedGenres"
              },
              {
                "kind": "orNullEqUserId",
                "column": "private_for"
              }
            ]
          }
        }
      },
      "push": {
        // ... existing push rules
      }
    }
  }
}
```

**Codegen behavior**: 
- If `tableRuleOverrides` exists for a table, use it instead of auto-detected rule
- Otherwise, use auto-detected rule from Postgres schema inspection

### Step 4: Update Codegen to Support Overrides

**File**: [oosync/src/codegen-schema.ts](oosync/src/codegen-schema.ts)

**Changes**:

1. Add config schema for rule overrides:
```typescript
interface CodegenConfig {
  // ... existing fields
  worker?: {
    config?: {
      pull?: {
        tableRuleOverrides?: Record<string, PullTableRule>;
      };
      push?: {
        // ... existing
      };
    };
  };
}
```

2. Merge overrides with auto-detected rules:
```typescript
// Around line 1370 where tableOwnerColumn is populated
const pullRuleOverrides = config.worker?.config?.pull?.tableRuleOverrides ?? {};

for (const [tableName, rule] of Object.entries(pullRuleOverrides)) {
  // Override takes precedence
  tableOwnerColumn.set(tableName, rule);
}
```

3. Generate compound rules in worker-config.generated.ts:
```typescript
// Output compound rules with proper TypeScript typing
if (rule.kind === "compound") {
  output += `      "${tableName}": {\n`;
  output += `        "kind": "compound",\n`;
  output += `        "rules": ${JSON.stringify(rule.rules, null, 2)}\n`;
  output += `      },\n`;
}
```

## Implementation Steps

### Phase 1: Add Compound Rule Support to oosync

**Files**: 
- [oosync/worker/src/sync-schema.ts](oosync/worker/src/sync-schema.ts#L74-L340)
- [oosync/src/codegen-schema.ts](oosync/src/codegen-schema.ts) (config schema)

**Changes**:
1. Add `compound` variant to `PullTableRule` type
2. Implement `applyPullRule` function with compound rule logic
3. Refactor `buildUserFilter` to delegate to `applyPullRule`
4. Remove hardcoded tune/genre/tune_type special cases (lines 264-298)

**Testing**: 
- Unit tests for compound rule evaluation
- Verify existing simple rules still work
- Test nested compound rules (edge case)

### Phase 2: Add Config Schema for Rule Overrides

**Files**:
- [oosync.codegen.config.json](oosync.codegen.config.json)
- [oosync/src/codegen-schema.ts](oosync/src/codegen-schema.ts) (load config)

**Changes**:
1. Add `tableRuleOverrides` config property
2. Load overrides in codegen script
3. Merge overrides with auto-detected rules
4. Generate compound rules in worker-config.generated.ts

**Testing**:
- Run `npm run codegen:schema`
- Verify worker-config.generated.ts has compound rule for tune
- Verify other tables unchanged

### Phase 3: Configure Tune Table Override

**File**: [oosync.codegen.config.json](oosync.codegen.config.json)

**Changes**:
1. Add tune table compound rule (genre + private_for)
2. Regenerate worker config
3. Verify generated rule matches hardcoded logic semantics

**Testing**:
- Compare old vs new filter results for same user/genres
- Test with 0 genres selected (should only pull private tunes)
- Test with 25 genres selected (should pull all public + private)
- Test private tune in non-selected genre (should still pull)

### Phase 4: Remove Hardcoded Logic

**File**: [oosync/worker/src/sync-schema.ts:264-298](oosync/worker/src/sync-schema.ts#L264-L298)

**Changes**:
1. Delete `isCatalogTable` special case logic
2. Delete tune/genre filtering code
3. Remove `buildTuneRefFilterCondition` function (no longer needed)
4. Clean up unused imports

**Testing**:
- Run full sync with genre filter
- Verify no functional changes (same rows pulled)
- Check for unused code/imports
- Run `npm run typecheck` and `npm run lint`

### Phase 5: Validation & Documentation

**Testing**:
- E2E test with various genre selections
- Verify boundary compliance (no TuneTrees schema in oosync/**)
- Performance check (should be same or better)
- Test with local Supabase instance

**Documentation**:
- Update oosync README with compound rule examples
- Document `tableRuleOverrides` config option
- Add migration guide for apps with custom filtering

## Success Criteria

- ✅ No hardcoded `tune`, `genre`, `privateFor` references in oosync/worker/src/*.ts
- ✅ Compound rule type added to PullTableRule union
- ✅ Config override working for tune table
- ✅ Codegen supports rule overrides
- ✅ Same functional behavior as before (verified by tests)
- ✅ TypeScript compilation passes
- ✅ Lint passes

## Open Questions

1. **Compound rule nesting depth**: Should we limit how deeply compound rules can nest? (e.g., max 2 levels)

2. **AND vs OR semantics**: Current proposal uses OR for combining nested rules. Do we need AND as well?
   - Example use case: `(genre IN [...]) AND (private_for IS NULL OR private_for = userId)`
   - Proposed: Add `combineWith: "and" | "or"` option to compound rule

3. **Collection loading order**: The `selectedGenres` collection is loaded from `user_genre_selection` table. Should this happen before or after applying compound rules?
   - Current: Collections loaded first, then rules applied
   - Impact: Compound rule can reference collections that may not be loaded yet

4. **Backward compatibility**: Should old worker-config.generated.ts files (without compound rules) continue to work?
   - Proposal: Yes, treat missing rule as fallback to heuristics
   - Alternative: Require regeneration after oosync upgrade

5. **Config validation**: Should codegen validate compound rule structure (e.g., no circular references, valid column names)?
   - Proposal: Yes, fail codegen with clear error message if invalid
   - Implementation: Add schema validation step before generating worker config

---

**Ready for review. Will implement after answers to open questions.**
