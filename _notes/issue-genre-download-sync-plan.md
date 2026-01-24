# Plan: User-controlled genre download/sync (onboarding + settings)

## Goal
Enable each user to pick which genres are downloaded/synced. The choice is set during onboarding and can be updated later in settings. Catalog/search and sync must respect the selection so unselected genres are not downloaded.

## UX / UI Plan (detailed)

### Onboarding (new step)
- **Placement**: Insert a new onboarding step between `create-playlist` and `view-catalog`.
- **Modal layout**: Keep existing onboarding modal style (max-w-md, centered overlay). Use same button styles as existing steps.
- **Content**:
  - Title: “Choose genres to download/sync”
  - Helper text: “Select the genres you want available offline. You can change this later in Settings.”
  - Multi-select list of genres (checkboxes) sourced from `genre` table, sorted by name.
  - Optional search input above the list (same styling as settings inputs) for long lists.
  - Add “Select all” / “Clear all” text buttons (small, link-style) to make selection easy.
  - Require at least one genre selected before enabling “Continue.”
- **Controls**:
  - Primary button: “Continue” → persists selections and advances to `view-catalog`.
  - Secondary button: “Skip for now” → defaults to all genres (matches current behavior) and advances.
  - Close (X) uses existing skip onboarding behavior.
- **Testing hooks**:
  - `data-testid="onboarding-genre-selection"`
  - `data-testid="onboarding-genre-checkbox-<genreId>"`
  - `data-testid="onboarding-genre-continue"`

### Settings (new section/page)
- **Location**: Add a new settings page under `/user-settings`:
  - Sidebar label: “Catalog & Sync”
  - Route: `/user-settings/catalog-sync`
- **Page structure** (same pattern as Account/Appearance pages):
  - Header: “Catalog & Sync”
  - Description: “Choose which genres are stored offline and synced.”
  - List of genre checkboxes identical to onboarding (shared component recommended).
  - “Save” button at bottom, disabled until changes are made.
  - Success and error messages in the same style as other settings pages.
  - Optional “Sync now” link or button that triggers a sync refresh if available in existing sync UI.
- **Testing hooks**:
  - `data-testid="settings-catalog-sync"`
  - `data-testid="settings-genre-checkbox-<genreId>"`
  - `data-testid="settings-genre-save"`

### Shared UI component
Create a reusable `GenreMultiSelect` component:
- Props: `genres`, `selectedGenreIds`, `onChange`, `searchable`, `disabled`.
- Renders checkboxes and search input.
- Used by onboarding and settings to keep UX consistent.

## Data Model & Persistence
- **New table**: `user_genre_selection`
  - `user_id` (FK → `user_profile.id`)
  - `genre_id` (FK → `genre.id`)
  - Primary key: `(user_id, genre_id)`
  - Sync columns (createdAt, lastModifiedAt, etc.) per standard tables.
- **Queries**:
  - `getUserGenreSelection(db, userId): string[]`
  - `upsertUserGenreSelection(db, userId, genreIds)`
  - `clearUserGenreSelection(db, userId)` (if empty selection should revert to all)
- **Defaults**:
  - If no selection exists, treat as “all genres” for backward compatibility.  (Note this behavior is likely to be changed, once the lead dev has a better idea of the UI flow).

## Catalog & Search
- Update `getTunesForUser` (or the catalog query layer) to accept a `genreIds` filter.
- Apply filter in catalog queries and tune type lookups so search results only include selected genres.
- Ensure `CatalogToolbar` still shows full filter options *within* the selected genres.

## Sync / Download Changes
- **Delay catalog sync/download**: When onboarding, the sync of the catalog shouldn't be done until the user creates a repertoir and chooses catalog sync options.
- **Client sync request**: include selected genre IDs in sync request payload/config.
- **Worker filtering**:
  - Filter catalog tables by genre selection:
    - `genre` rows: only selected IDs.
    - `tune` rows: only those with `genre_ref` in selection (and any required joins).
    - `tune_type` and junction tables: only rows tied to selected genres.
  - Preserve user-owned data (playlists, notes, practice history) regardless of genre.
- **Fallback**: If user has no selection stored, request full catalog (current behavior).  (Note this behavior is likely to be changed, once the lead dev has a better idea of the UI flow).

## Testing Strategy
- **Unit tests**:
  - Query tests for `getUserGenreSelection` and catalog filtering.
  - Ensure empty selection defaults to full catalog.
- **E2E tests**:
  - Onboarding: select subset → catalog shows only selected genres.
  - Settings: change selection → run sync/refresh → catalog updates.

## Rollout & Migration
- Add SQL migrations for `user_genre_selection` (Postgres + SQLite).
- Regenerate schema artifacts via `npm run codegen:schema` after migration.
- Update sync metadata to include new table and filters.
