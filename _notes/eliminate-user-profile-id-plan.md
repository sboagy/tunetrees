# Plan: Eliminate internal user_profile.id in favor of Auth User ID

## Goal
Use the Supabase Auth user ID as the single identifier for users, removing reliance on an internal `user_profile.id`.

## Evaluation (with pushback)
- ✅ Simplifies identity: fewer joins/mappings, aligns with Supabase Auth and RLS.
- ✅ Reduces sync/conflict complexity: one canonical ID across devices.
- ⚠️ Pushback: internal IDs can decouple from auth provider changes; removing them makes auth ID a hard dependency.
- ⚠️ Pushback: migration risk for existing data referencing `user_profile.id` (foreign keys, outbox, sync history).
- ⚠️ Pushback: anonymous/test users may not have Auth IDs; need explicit strategy.
- Decision: proceed if we can keep backwards-compatible migration and handle anon/test users cleanly.

## Backup instructions (before migration)
- **Production Postgres (Supabase):**
  - Create a full database backup via Supabase dashboard or `pg_dump` (schema + data).
  - Export `user_profile` table separately for quick restore if needed.
- **Local/Dev:**
  - Snapshot local SQLite/IndexedDB (e.g., browser devtools export or app-provided backup).
  - Save a copy of local Drizzle migration artifacts for rollback reference.

## Migration steps
### Local (dev + test)
1. Update schema/migrations to replace `user_profile.id` usage with `auth_user_id` (primary key).
2. Write migration to:
   - Backfill `auth_user_id` where missing.
   - Update all foreign keys referencing `user_profile.id`.
   - Drop/rename `user_profile.id` if no longer needed.
3. Regenerate schema contract/codegen as required.
4. Run local migration and validate existing users.

### Production
1. Put app in maintenance mode (or read-only) to prevent writes.
2. Backup (per instructions above).
3. Run migrations in a transaction-safe order:
   - Add new columns/keys (if needed).
   - Backfill + verify counts/uniqueness.
   - Switch foreign keys to auth ID.
   - Remove old columns/constraints when safe.
4. Resume traffic and monitor logs/sync.

## Code change plan
- **Schema/Drizzle migrations:**
  - Update `user_profile` primary key to `auth_user_id` (or equivalent).
  - Update all tables with `user_profile_id` FKs to reference auth ID.
- **oosync/codegen:**
  - Update schema inputs and regenerate contract outputs.
  - Ensure adapters map to auth ID consistently (no internal ID usage).
- **App code:**
  - Replace references to `user_profile.id` with auth user ID.
  - Update any join logic, UI selectors, and sync/outbox metadata.
  - Ensure local DB initialization uses auth ID for per-user namespaces.

## Handling anonymous/test users
- Define an explicit policy:
  - If anonymous sessions are allowed, create a stable synthetic ID (e.g., `anon:{deviceId}`) that is stored and migrated separately.
  - For automated tests, inject a deterministic Auth ID in fixtures.
- Ensure anon/test IDs do not collide with real Auth IDs and are excluded from production migration paths.

## Test plan (E2E)
- Update E2E fixtures to use auth IDs.
- Run core flows:
  - Sign-in → profile load → data create → sync → reload.
  - Existing user migration: pre-migration data loads correctly post-migration.
  - Anonymous/test session handling (if supported).

## Constraints/notes
- Do not hand-edit generated schema/contract files; update inputs and rerun codegen.
- Keep API/public contracts stable where possible.
- Avoid changes in `legacy/`.
- Ensure RLS policies continue to reference auth user IDs.
