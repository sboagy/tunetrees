File list caused by the following prompt:

Ok, next I want to work on schema changes which will make it possible to minimally support a "hybrid" world (Trad, Pop, Classical, etc.). The core of these changes are the following alterations to the tune table (focusing on the postgres side):

```
-- 1. For Choral/Classical (The "Creator")
ALTER TABLE public.tune ADD COLUMN composer text NULL;

-- 2. For Pop/Rock/Jazz (The "Performer")
ALTER TABLE public.tune ADD COLUMN artist text NULL;

-- 3. Vital: Change Foreign ID to Text (to support Spotify/YouTube IDs)
ALTER TABLE public.tune ALTER COLUMN id_foreign TYPE text;

-- 4. Optional but highly recommended for filtering (e.g. "80s Rock").
ALTER TABLE public.tune 
ADD COLUMN release_year int4 NULL;
```

In addition to those changes, we need to make sure that the tune_override columns reflect all the tune data columns from the tune table.

Of course, in addition to the changes made for the postgres migration, we'll need to reflect those for SQLite WASM. Also practice_list_joined and practice_list_staged views in both Postgres and SQLite WASM will also need to be updated to include the new columns. Also #file:TuneColumns.tsx , #sym:ITuneOverview , maybe #file:TuneDetail.tsx , #file:TuneEditor.tsx #sym:EditTunePage #file:table-state-persistence.ts #file:ColumnVisibilityMenu.tsx , and probably there are a few I'm missing.

(The ripple effect of adding 3 columns and altering the type of another, is pretty disturbing. I'm not sure how to fix it though.)

===============
drizzle/migrations/sqlite/schema.ts
drizzle/schema-postgres.ts
drizzle/schema-sqlite.ts
shared/db-constants.ts
sql_scripts/view_practice_list_staged.sql
sql_scripts/view_practice_list_staged_sqlite.sql
src/components/catalog/CatalogControlBanner.tsx
src/components/catalog/ColumnVisibilityMenu.tsx
src/components/grids/TuneColumns.tsx
src/components/grids/TunesGridCatalog.tsx
src/components/grids/TunesGridRepertoire.tsx
src/components/grids/table-state-persistence.ts
src/components/grids/types.ts
src/components/practice/FlashcardCard.tsx
src/components/practice/flashcard-fields.ts
src/components/tunes/FilterBar.tsx
src/components/tunes/TuneDetail.tsx
src/components/tunes/TuneEditor.tsx
src/lib/db/queries/playlists.ts
src/lib/db/queries/practice.ts
src/lib/db/queries/tune-overrides.ts
src/lib/db/queries/tunes.ts
src/lib/db/types.ts
src/lib/sync/casing.ts
src/routes/tunes/[id]/edit.tsx
src/routes/tunes/new.tsx
worker/src/schema-postgres.ts

New:
sql_scripts/migrations/postgres_add_hybrid_genre_support.sql
sql_scripts/migrations/sqlite_add_hybrid_genre_support.sql
src/lib/db/view-types.ts
supabase/migrations/20251216000000_add_hybrid_genre_support.sql
