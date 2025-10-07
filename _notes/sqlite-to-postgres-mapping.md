# SQLite to Supabase PostgreSQL Schema Mapping

**Date:** October 5, 2025  
**Purpose:** Document all differences between legacy SQLite schema and Supabase PostgreSQL schema

---

## Critical Architecture Difference

### User ID Strategy

**SQLite (legacy):**

```
user.id = 1 (integer)
All foreign keys → user.id (integer)
```

**Supabase PostgreSQL:**

```
user_profile.id = 1, 2, 3... (serial/integer auto-increment)
user_profile.supabase_user_id = 'b2b64a0a-18d4-4d00-aecb-27f676defe31' (UUID)
All foreign keys → user_profile.id (integer)
```

**Migration Strategy:**

1. Insert into user_profile with supabase_user_id = UUID
2. Get back the generated user_profile.id (integer)
3. Map old user_id=1 → new user_profile.id
4. Use that integer ID for all foreign key references

---

## Table Name Mappings

| SQLite Table | PostgreSQL Table | Notes                              |
| ------------ | ---------------- | ---------------------------------- |
| `user`       | `user_profile`   | PostgreSQL reserves 'user' keyword |
| All others   | Same name        | No change                          |

---

## Column Mappings by Table

### user → user_profile

| SQLite Column      | PostgreSQL Column               | Type Change     | Notes                                |
| ------------------ | ------------------------------- | --------------- | ------------------------------------ |
| `id` (integer)     | `supabase_user_id` (uuid)       | ✅ Maps to UUID | Primary auth identifier              |
| -                  | `id` (serial)                   | ⚠️ NEW          | Auto-generated integer, used for FKs |
| `email`            | `email`                         | ✓ Same          |                                      |
| `name`             | `name`                          | ✓ Same          |                                      |
| `external_source`  | -                               | ❌ MISSING      | Not in PostgreSQL schema             |
| `external_id`      | -                               | ❌ MISSING      | Not in PostgreSQL schema             |
| -                  | `sr_alg_type`                   | ⚠️ NEW          | Scheduling algorithm type            |
| -                  | `phone`                         | ⚠️ NEW          | Phone number                         |
| -                  | `phone_verified`                | ⚠️ NEW          | Verification timestamp               |
| -                  | `acceptable_delinquency_window` | ⚠️ NEW          | Scheduling preference (default 21)   |
| `deleted`          | `deleted`                       | ✓ Same          | Boolean                              |
| `sync_version`     | `sync_version`                  | ✓ Same          | Default 1 in PG, 0 in SQLite         |
| `last_modified_at` | `last_modified_at`              | ✓ Same          | Timestamp                            |
| `device_id`        | `device_id`                     | ✓ Same          |                                      |

### tune

| SQLite Column             | PostgreSQL Column          | Type Change    | Notes                                |
| ------------------------- | -------------------------- | -------------- | ------------------------------------ |
| `id` (integer)            | `id` (serial)              | ⚠️ Type change | PK auto-increment in PG              |
| `title`                   | `title`                    | ✓ Same         |                                      |
| `type`                    | `type`                     | ✓ Same         |                                      |
| `structure`               | `structure`                | ✓ Same         | ABC notation                         |
| `mode`                    | `mode`                     | ✓ Same         |                                      |
| `incipit`                 | `incipit`                  | ✓ Same         |                                      |
| `genre_ref` (integer)     | `genre` (text FK)          | ✅ Type change | References genre.id (text)           |
| `private_for` (text UUID) | `private_for` (integer FK) | ✅ Type change | References user_profile.id (integer) |
| `deleted`                 | `deleted`                  | ✓ Same         |                                      |
| `sync_version`            | `sync_version`             | ✓ Same         |                                      |
| `last_modified_at`        | `last_modified_at`         | ✓ Same         |                                      |
| `device_id`               | `device_id`                | ✓ Same         |                                      |

### playlist

| SQLite Column                       | PostgreSQL Column             | Type Change               | Notes                      |
| ----------------------------------- | ----------------------------- | ------------------------- | -------------------------- |
| `playlist_id` (integer)             | `playlist_id` (serial)        | ⚠️ Type change            | Auto-increment             |
| `user_ref` (text UUID)              | `user_ref` (integer FK)       | ✅ Type change            | References user_profile.id |
| `instrument` (text)                 | `instrument_ref` (integer FK) | ✅ Type + semantic change | References instrument.id   |
| `genre` (text)                      | -                             | ❌ MISSING                | Not in PostgreSQL schema   |
| `annotation_set_ref` (integer)      | -                             | ❌ MISSING                | Not in PostgreSQL schema   |
| `recall_current_position` (boolean) | -                             | ❌ MISSING                | Not in PostgreSQL schema   |
| `current` (text)                    | -                             | ❌ MISSING                | Not in PostgreSQL schema   |
| -                                   | `sr_alg_type` (text)          | ⚠️ NEW                    | Scheduling algorithm       |
| `deleted`                           | `deleted`                     | ✓ Same                    |                            |
| `sync_version`                      | `sync_version`                | ✓ Same                    |                            |
| `last_modified_at`                  | `last_modified_at`            | ✓ Same                    |                            |
| `device_id`                         | `device_id`                   | ✓ Same                    |                            |

### playlist_tune

| SQLite Column              | PostgreSQL Column       | Type Change    | Notes                   |
| -------------------------- | ----------------------- | -------------- | ----------------------- |
| `playlist_ref`             | `playlist_ref`          | ✓ Same         | FK to playlist          |
| `tune_ref`                 | `tune_ref`              | ✓ Same         | FK to tune              |
| `current` (text timestamp) | `current` (timestamp)   | ⚠️ Type change | Text → timestamp        |
| -                          | `learned` (timestamp)   | ⚠️ NEW         | When tune was learned   |
| -                          | `scheduled` (timestamp) | ⚠️ NEW         | Scheduled practice time |
| -                          | `goal` (text)           | ⚠️ NEW         | Default 'recall'        |
| `deleted`                  | `deleted`               | ✓ Same         |                         |
| `sync_version`             | `sync_version`          | ✓ Same         |                         |
| `last_modified_at`         | `last_modified_at`      | ✓ Same         |                         |
| `device_id`                | `device_id`             | ✓ Same         |                         |

### practice_record

| SQLite Column             | PostgreSQL Column              | Type Change           | Notes                  |
| ------------------------- | ------------------------------ | --------------------- | ---------------------- |
| `id`                      | `id` (serial)                  | ⚠️ Type change        | Auto-increment         |
| `user_ref` (text UUID)    | -                              | ❌ MISSING            | Not in PG schema!      |
| -                         | `playlist_ref` (integer FK)    | ⚠️ NEW                | Required in PG         |
| `tune_ref`                | `tune_ref`                     | ✓ Same                |                        |
| `playlist_ref` (nullable) | `playlist_ref` (NOT NULL)      | ⚠️ Nullability change | Required in PG         |
| `practiced_at` (text)     | `practiced` (timestamp)        | ⚠️ Name + type change |                        |
| `quality`                 | `quality`                      | ✓ Same                |                        |
| `stability`               | `stability`                    | ✓ Same                |                        |
| `difficulty`              | `difficulty`                   | ✓ Same                |                        |
| `elapsed_days`            | `elapsed_days`                 | ✓ Same                |                        |
| `scheduled_days`          | -                              | ❌ MISSING            | Not in PG              |
| `reps`                    | `repetitions`                  | ⚠️ Name change        |                        |
| `lapses`                  | `lapses`                       | ✓ Same                |                        |
| `state`                   | `state`                        | ✓ Same                |                        |
| `last_review` (text)      | -                              | ❌ MISSING            | Not in PG              |
| -                         | `easiness` (real)              | ⚠️ NEW                | SM2 parameter          |
| -                         | `interval` (integer)           | ⚠️ NEW                | Days until next review |
| -                         | `step` (integer)               | ⚠️ NEW                | Current learning step  |
| -                         | `due` (timestamp)              | ⚠️ NEW                | Next review date       |
| -                         | `backup_practiced` (timestamp) | ⚠️ NEW                | Backup timestamp       |
| -                         | `goal` (text)                  | ⚠️ NEW                | Default 'recall'       |
| -                         | `technique` (text)             | ⚠️ NEW                | Practice technique     |
| `deleted`                 | -                              | ❌ MISSING            | Not in PG!             |
| `sync_version`            | `sync_version`                 | ✓ Same                |                        |
| `last_modified_at`        | `last_modified_at`             | ✓ Same                |                        |
| `device_id`               | `device_id`                    | ✓ Same                |                        |

### note

| SQLite Column          | PostgreSQL Column          | Type Change    | Notes                      |
| ---------------------- | -------------------------- | -------------- | -------------------------- |
| `id`                   | `id` (serial)              | ⚠️ Type change | Auto-increment             |
| `user_ref` (text UUID) | `user_ref` (integer FK)    | ✅ Type change | References user_profile.id |
| `tune_ref`             | `tune_ref`                 | ✓ Same         |                            |
| `playlist_ref`         | `playlist_ref`             | ✓ Same         |                            |
| `created_date` (text)  | `created_date` (timestamp) | ⚠️ Type change |                            |
| `note_text`            | `note_text`                | ✓ Same         |                            |
| `public`               | `public`                   | ✓ Same         |                            |
| `favorite`             | `favorite`                 | ✓ Same         |                            |
| `deleted`              | `deleted`                  | ✓ Same         |                            |
| `sync_version`         | `sync_version`             | ✓ Same         |                            |
| `last_modified_at`     | `last_modified_at`         | ✓ Same         |                            |
| `device_id`            | `device_id`                | ✓ Same         |                            |

### reference

| SQLite Column      | PostgreSQL Column       | Type Change    | Notes                       |
| ------------------ | ----------------------- | -------------- | --------------------------- |
| `id`               | `id` (serial)           | ⚠️ Type change | Auto-increment              |
| `tune_ref`         | `tune_ref`              | ✓ Same         |                             |
| `reference_text`   | `comment`               | ⚠️ Name change |                             |
| `url`              | `url`                   | ✓ Same         |                             |
| -                  | `ref_type` (text)       | ⚠️ NEW         | 'website', 'audio', 'video' |
| -                  | `user_ref` (integer FK) | ⚠️ NEW         | References user_profile.id  |
| -                  | `title` (text)          | ⚠️ NEW         | Reference title             |
| -                  | `public` (boolean)      | ⚠️ NEW         | Public visibility           |
| -                  | `favorite` (boolean)    | ⚠️ NEW         | Favorite flag               |
| `deleted`          | `deleted`               | ✓ Same         |                             |
| `sync_version`     | `sync_version`          | ✓ Same         |                             |
| `last_modified_at` | `last_modified_at`      | ✓ Same         |                             |
| `device_id`        | `device_id`             | ✓ Same         |                             |

### tag

| SQLite Column          | PostgreSQL Column       | Type Change           | Notes                      |
| ---------------------- | ----------------------- | --------------------- | -------------------------- |
| `id`                   | `tag_id` (serial)       | ⚠️ Name + type change |                            |
| `tune_ref`             | `tune_ref`              | ✓ Same                |                            |
| `user_ref` (text UUID) | `user_ref` (integer FK) | ✅ Type change        | References user_profile.id |
| `tag`                  | `tag_text`              | ⚠️ Name change        |                            |
| `deleted`              | -                       | ❌ MISSING            | Not in PG!                 |
| `sync_version`         | `sync_version`          | ✓ Same                |                            |
| `last_modified_at`     | `last_modified_at`      | ✓ Same                |                            |
| `device_id`            | `device_id`             | ✓ Same                |                            |

### genre

| SQLite Column      | PostgreSQL Column    | Type Change | Notes             |
| ------------------ | -------------------- | ----------- | ----------------- |
| `id` (text)        | `id` (text PK)       | ✓ Same      |                   |
| -                  | `name` (text)        | ⚠️ NEW      | Display name      |
| -                  | `region` (text)      | ⚠️ NEW      | Geographic region |
| -                  | `description` (text) | ⚠️ NEW      | Description       |
| `deleted`          | -                    | ❌ MISSING  | Not in PG!        |
| `sync_version`     | -                    | ❌ MISSING  | Not in PG!        |
| `last_modified_at` | -                    | ❌ MISSING  | Not in PG!        |
| `device_id`        | -                    | ❌ MISSING  | Not in PG!        |

### instrument

| SQLite Column         | PostgreSQL Column              | Type Change    | Notes                         |
| --------------------- | ------------------------------ | -------------- | ----------------------------- |
| `id` (text)           | `id` (serial)                  | ✅ Type change | Text → integer auto-increment |
| -                     | `private_to_user` (integer FK) | ⚠️ NEW         | User-specific instruments     |
| -                     | `instrument` (text)            | ⚠️ NEW         | Instrument name               |
| -                     | `description` (text)           | ⚠️ NEW         | Description                   |
| -                     | `genre_default` (text FK)      | ⚠️ NEW         | Default genre                 |
| `default_note_height` | -                              | ❌ MISSING     | Not in PG                     |
| `default_clef`        | -                              | ❌ MISSING     | Not in PG                     |
| `deleted`             | `deleted`                      | ✓ Same         |                               |
| `sync_version`        | `sync_version`                 | ✓ Same         |                               |
| `last_modified_at`    | `last_modified_at`             | ✓ Same         |                               |
| `device_id`           | `device_id`                    | ✓ Same         |                               |

### tune_type

| SQLite Column      | PostgreSQL Column    | Type Change | Notes          |
| ------------------ | -------------------- | ----------- | -------------- |
| `id` (text)        | `id` (text PK)       | ✓ Same      |                |
| -                  | `name` (text)        | ⚠️ NEW      | Display name   |
| -                  | `rhythm` (text)      | ⚠️ NEW      | Rhythm pattern |
| -                  | `description` (text) | ⚠️ NEW      | Description    |
| `deleted`          | -                    | ❌ MISSING  | Not in PG!     |
| `sync_version`     | -                    | ❌ MISSING  | Not in PG!     |
| `last_modified_at` | -                    | ❌ MISSING  | Not in PG!     |
| `device_id`        | -                    | ❌ MISSING  | Not in PG!     |

---

## Migration Strategy Summary

### Phase 1: Insert user_profile

1. Insert record with `supabase_user_id` = 'b2b64a0a-18d4-4d00-aecb-27f676defe31'
2. Get generated `id` (e.g., 1, 2, 3...)
3. Store mapping: `oldUserId(1) → newUserProfileId`

### Phase 2: Reference Data (no user dependencies)

- genre (text ID, no sync columns)
- tune_type (text ID, no sync columns)
- instrument (NEW: needs user mapping for private instruments)

### Phase 3: Core Data

- tune (map genre_ref, private_for)
- playlist (map user_ref, instrument is complex)
- playlist_tune

### Phase 4: User Data

- practice_record (critical: no user_ref column in PG!)
- note (map user_ref)
- reference (map user_ref, rename fields)
- tag (map user_ref)

---

## Critical Issues to Address

1. **practice_record has NO user_ref in PostgreSQL!**

   - SQLite has both user_ref and playlist_ref
   - PostgreSQL only has playlist_ref (NOT NULL)
   - **Solution:** User is implicit via playlist.user_ref

2. **instrument mapping is complex**

   - SQLite: instrument is text (e.g., "fiddle")
   - PostgreSQL: instrument_ref is integer FK
   - Need to either match existing instruments or create new ones

3. **Many columns don't exist in PostgreSQL**

   - Cannot migrate: external_source, external_id, scheduled_days, last_review, etc.
   - Must skip these during migration

4. **sync_version defaults differ**

   - SQLite: 0
   - PostgreSQL: 1
   - Use PostgreSQL default (1)

5. **Type conversions needed**
   - Text timestamps → PostgreSQL timestamps
   - Text UUIDs → PostgreSQL UUIDs or integers (depending on context)

---

**Next Step:** Rewrite migration script with this mapping in mind.
