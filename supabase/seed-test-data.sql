--
-- Test Data for Playwright Tests
-- 
-- ============================================================
-- TuneTrees Seed Data with Hardcoded UUIDs (UUID Migration)
-- ============================================================
-- This file contains test seed data matching test-data.ts fixtures
-- All IDs use predictable UUIDs for reproducible testing
-- 
-- Run this AFTER the UUID migration (after 20251031000003_switch_to_uuid_pks.sql)
-- ============================================================
SET
    session_replication_role = replica;

-- ============================================================
-- GENRE (Reference Data)
-- ============================================================
INSERT INTO
    "public"."genre" ("id", "name", "region", "description")
VALUES
    (
        '00000000-0000-4000-8000-000000001000',
        'Irish Traditional',
        NULL,
        'Traditional music from Ireland'
    ),
    (
        '00000000-0000-4000-8000-000000001001',
        'Scottish Traditional',
        NULL,
        'Traditional music from Scotland'
    ),
    (
        '00000000-0000-4000-8000-000000001002',
        'English Traditional',
        NULL,
        'Traditional music from England'
    ) ON CONFLICT (id) DO
UPDATE
SET
    name = EXCLUDED.name,
    region = EXCLUDED.region,
    description = EXCLUDED.description;

-- ============================================================
-- INSTRUMENT (Reference Data)
-- ============================================================
INSERT INTO
    "public"."instrument" (
        "id",
        "private_to_user",
        "instrument",
        "description",
        "genre_default",
        "deleted",
        "sync_version",
        "last_modified_at",
        "device_id"
    )
VALUES
    (
        '00000000-0000-4000-8000-000000001100',
        NULL,
        'Fiddle',
        'Violin for traditional music',
        '00000000-0000-4000-8000-000000001000',
        false,
        1,
        NOW (),
        NULL
    ),
    (
        '00000000-0000-4000-8000-000000001101',
        NULL,
        'Flute',
        'Wooden or metal flute',
        '00000000-0000-4000-8000-000000001000',
        false,
        1,
        NOW (),
        NULL
    ),
    (
        '00000000-0000-4000-8000-000000001102',
        NULL,
        'Mandolin',
        '8-string mandolin',
        '00000000-0000-4000-8000-000000001000',
        false,
        1,
        NOW (),
        NULL
    ) ON CONFLICT (id) DO
UPDATE
SET
    instrument = EXCLUDED.instrument,
    description = EXCLUDED.description,
    genre_default = EXCLUDED.genre_default;

-- ============================================================
-- TUNE_TYPE (Reference Data)
-- ============================================================
INSERT INTO
    "public"."tune_type" ("id", "name", "rhythm", "description")
VALUES
    (
        '00000000-0000-4000-8000-000000001200',
        'Reel',
        '4/4',
        'Fast dance tune in 4/4 time'
    ),
    (
        '00000000-0000-4000-8000-000000001201',
        'Jig',
        '6/8',
        'Dance tune in 6/8 time'
    ),
    (
        '00000000-0000-4000-8000-000000001202',
        'Hornpipe',
        '4/4',
        'Hornpipe rhythm'
    ),
    (
        '00000000-0000-4000-8000-000000001203',
        'Waltz',
        '3/4',
        'Slow dance in 3/4 time'
    ) ON CONFLICT (id) DO
UPDATE
SET
    name = EXCLUDED.name,
    rhythm = EXCLUDED.rhythm,
    description = EXCLUDED.description;

-- ============================================================
-- GENRE_TUNE_TYPE (Junction Table)
-- ============================================================
INSERT INTO
    "public"."genre_tune_type" ("genre_id", "tune_type_id")
VALUES
    (
        '00000000-0000-4000-8000-000000001000',
        '00000000-0000-4000-8000-000000001200'
    ),
    (
        '00000000-0000-4000-8000-000000001000',
        '00000000-0000-4000-8000-000000001201'
    ),
    (
        '00000000-0000-4000-8000-000000001000',
        '00000000-0000-4000-8000-000000001202'
    ),
    (
        '00000000-0000-4000-8000-000000001000',
        '00000000-0000-4000-8000-000000001203'
    ),
    (
        '00000000-0000-4000-8000-000000001001',
        '00000000-0000-4000-8000-000000001200'
    ),
    (
        '00000000-0000-4000-8000-000000001001',
        '00000000-0000-4000-8000-000000001201'
    ),
    (
        '00000000-0000-4000-8000-000000001001',
        '00000000-0000-4000-8000-000000001202'
    ),
    (
        '00000000-0000-4000-8000-000000001002',
        '00000000-0000-4000-8000-000000001200'
    ),
    (
        '00000000-0000-4000-8000-000000001002',
        '00000000-0000-4000-8000-000000001201'
    ) ON CONFLICT (genre_id, tune_type_id) DO NOTHING;

-- ============================================================
-- TEST USERS
-- ============================================================
-- Note: In Supabase, users are created via auth.users, then referenced in user_profile
-- For local testing, you may need to create these users through Supabase Auth first
-- Then insert user_profile records referencing their supabase_user_id
-- Example user_profile insert (assumes auth.users already exists):
INSERT INTO
    "public"."user_profile" (
        "supabase_user_id",
        "name",
        "email",
        "sr_alg_type",
        "phone",
        "phone_verified",
        "acceptable_delinquency_window",
        "deleted",
        "sync_version",
        "last_modified_at",
        "device_id"
    )
VALUES
    (
        '00000000-0000-4000-8000-000000000001',
        'Test User',
        'test@example.com',
        'FSRS',
        NULL,
        false,
        300,
        false,
        1,
        NOW (),
        NULL
    ),
    (
        '00000000-0000-4000-8000-000000000002',
        'Test User 2',
        'test2@example.com',
        'FSRS',
        NULL,
        false,
        300,
        false,
        1,
        NOW (),
        NULL
    ) ON CONFLICT (supabase_user_id) DO
UPDATE
SET
    name = EXCLUDED.name,
    email = EXCLUDED.email;

-- ============================================================
-- TEST PLAYLISTS
-- ============================================================
INSERT INTO
    "public"."playlist" (
        "id",
        "user_ref",
        "instrument",
        "sr_alg_type",
        "deleted",
        "sync_version",
        "last_modified_at",
        "device_id",
        "name",
        "genre"
    )
VALUES
    (
        '00000000-0000-4000-8000-000000001010',
        '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000001100',
        'FSRS',
        false,
        1,
        NOW (),
        NULL,
        'Irish Fiddle Practice',
        '00000000-0000-4000-8000-000000001000'
    ),
    (
        '00000000-0000-4000-8000-000000001011',
        '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000001101',
        'FSRS',
        false,
        1,
        NOW (),
        NULL,
        'Scottish Flute Tunes',
        '00000000-0000-4000-8000-000000001001'
    ),
    (
        '00000000-0000-4000-8000-000000001012',
        '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000001100',
        'FSRS',
        false,
        1,
        NOW (),
        NULL,
        'Favorite Jigs',
        '00000000-0000-4000-8000-000000001000'
    ) ON CONFLICT (id) DO
UPDATE
SET
    name = EXCLUDED.name,
    instrument = EXCLUDED.instrument,
    genre = EXCLUDED.genre;

-- ============================================================
-- TEST TUNES
-- ============================================================
INSERT INTO
    "public"."tune" (
        "id",
        "title",
        "type",
        "structure",
        "mode",
        "incipit",
        "genre",
        "private_for",
        "deleted",
        "sync_version",
        "last_modified_at",
        "device_id",
        "current_key",
        "default_key",
        "user_ref"
    )
VALUES
    -- Irish Reels
    (
        '00000000-0000-4000-8000-000000000100',
        'The Kesh',
        '00000000-0000-4000-8000-000000001200',
        'AABB',
        'D Major',
        NULL,
        '00000000-0000-4000-8000-000000001000',
        NULL,
        false,
        1,
        NOW (),
        NULL,
        'D',
        'D',
        '00000000-0000-4000-8000-000000000001'
    ),
    (
        '00000000-0000-4000-8000-000000000101',
        'Banish Misfortune',
        '00000000-0000-4000-8000-000000001200',
        'AABB',
        'D Mixolydian',
        NULL,
        '00000000-0000-4000-8000-000000001000',
        NULL,
        false,
        1,
        NOW (),
        NULL,
        'D',
        'D',
        '00000000-0000-4000-8000-000000000001'
    ),
    (
        '00000000-0000-4000-8000-000000000102',
        'The Mason''s Apron',
        '00000000-0000-4000-8000-000000001200',
        'AABB',
        'A Major',
        NULL,
        '00000000-0000-4000-8000-000000001000',
        NULL,
        false,
        1,
        NOW (),
        NULL,
        'A',
        'A',
        '00000000-0000-4000-8000-000000000001'
    ),
    -- Jigs
    (
        '00000000-0000-4000-8000-000000000110',
        'Swallowtail Jig',
        '00000000-0000-4000-8000-000000001201',
        'AABB',
        'E Minor',
        NULL,
        '00000000-0000-4000-8000-000000001000',
        NULL,
        false,
        1,
        NOW (),
        NULL,
        'E',
        'E',
        '00000000-0000-4000-8000-000000000001'
    ),
    (
        '00000000-0000-4000-8000-000000000111',
        'Morrison''s Jig',
        '00000000-0000-4000-8000-000000001201',
        'AABB',
        'E Dorian',
        NULL,
        '00000000-0000-4000-8000-000000001000',
        NULL,
        false,
        1,
        NOW (),
        NULL,
        'E',
        'E',
        '00000000-0000-4000-8000-000000000001'
    ),
    -- Hornpipes
    (
        '00000000-0000-4000-8000-000000000120',
        'Harvest Home',
        '00000000-0000-4000-8000-000000001202',
        'AABB',
        'D Major',
        NULL,
        '00000000-0000-4000-8000-000000001000',
        NULL,
        false,
        1,
        NOW (),
        NULL,
        'D',
        'D',
        '00000000-0000-4000-8000-000000000001'
    ) ON CONFLICT (id) DO
UPDATE
SET
    title = EXCLUDED.title,
    type = EXCLUDED.type,
    structure = EXCLUDED.structure,
    mode = EXCLUDED.mode,
    genre = EXCLUDED.genre,
    current_key = EXCLUDED.current_key,
    default_key = EXCLUDED.default_key;

-- ============================================================
-- PLAYLIST_TUNE (Junction Table - Which tunes are in which playlists)
-- ============================================================
INSERT INTO
    "public"."playlist_tune" (
        "id",
        "playlist_ref",
        "tune_ref",
        "current",
        "learned",
        "scheduled",
        "goal",
        "deleted",
        "sync_version",
        "last_modified_at",
        "device_id"
    )
VALUES
    (
        '00000000-0000-4000-8000-000000030001',
        '00000000-0000-4000-8000-000000001010',
        '00000000-0000-4000-8000-000000000100',
        true,
        false,
        true,
        'LEARN',
        false,
        1,
        NOW (),
        NULL
    ),
    (
        '00000000-0000-4000-8000-000000030002',
        '00000000-0000-4000-8000-000000001010',
        '00000000-0000-4000-8000-000000000101',
        true,
        false,
        true,
        'LEARN',
        false,
        1,
        NOW (),
        NULL
    ),
    (
        '00000000-0000-4000-8000-000000030003',
        '00000000-0000-4000-8000-000000001012',
        '00000000-0000-4000-8000-000000000110',
        true,
        false,
        true,
        'LEARN',
        false,
        1,
        NOW (),
        NULL
    ) ON CONFLICT (id) DO
UPDATE
SET
    current = EXCLUDED.current,
    scheduled = EXCLUDED.scheduled,
    goal = EXCLUDED.goal;

-- ============================================================
-- RESET replication role
-- ============================================================
SET
    session_replication_role = DEFAULT;

-- Auth users are created separately via scripts/create-test-users.ts
--
-- Test Users (created by create-test-users.ts):
--   Alice:   11111111-1111-1111-1111-111111111111 (alice.test@tunetrees.test)
--   Bob:     22222222-2222-2222-2222-222222222222 (bob.test@tunetrees.test)
--   Charlie: 33333333-3333-3333-3333-333333333333 (charlie.test@tunetrees.test)
--
-- ============================================================================
-- ALICE'S DATA: Full test user with playlists, tunes, and practice records
-- ============================================================================
-- Alice's Playlist
INSERT INTO
    public.playlist (id, user_ref, instrument, genre, created, updated)
VALUES
    (
        9001,
        '11111111-1111-1111-1111-111111111111',
        'flute',
        'Irish Traditional',
        NOW (),
        NOW ()
    ) ON CONFLICT (id) DO NOTHING;

-- Alice's Tunes (in repertoire)
INSERT INTO
    public.tune (
        id,
        title,
        type,
        structure,
        mode,
        incipit,
        date_created,
        difficulty,
        user_ref,
        playlist_ref,
        recall_state,
        recall_eval,
        notes,
        external_ref,
        backup_practiced,
        current_stage,
        current_interval,
        current_ease,
        current_elapsed_days
    )
VALUES
    -- Tune 9001: Due today (New state)
    (
        9001,
        'Banish Misfortune',
        'jig',
        '(AB)3',
        'Emin',
        'EDBA',
        NOW () - INTERVAL '1 day',
        3,
        '11111111-1111-1111-1111-111111111111',
        9001,
        0,
        0.0,
        'Classic jig, test new state',
        NULL,
        NOW () - INTERVAL '1 day',
        0,
        0,
        2.5,
        1
    ),
    -- Tune 9002: Due today (Learning state)  
    (
        9002,
        'Morrison''s Jig',
        'jig',
        '(AB)3',
        'Emin',
        'EDEG',
        NOW () - INTERVAL '3 days',
        4,
        '11111111-1111-1111-1111-111111111111',
        9001,
        1,
        3.0,
        'Test learning state',
        NULL,
        NOW () - INTERVAL '2 days',
        1,
        1,
        2.5,
        2
    ),
    -- Tune 9003: Due today (Review state)
    (
        9003,
        'The Kesh',
        'jig',
        '(AB)3',
        'Gmaj',
        'GABd',
        NOW () - INTERVAL '30 days',
        2,
        '11111111-1111-1111-1111-111111111111',
        9001,
        2,
        4.0,
        'Test review state',
        NULL,
        NOW () - INTERVAL '10 days',
        2,
        10,
        2.8,
        10
    ),
    -- Tune 9004: Not due yet (future)
    (
        9004,
        'Si Bheag Si Mhor',
        'slow air',
        'AB',
        'Gmaj',
        'DGAB',
        NOW () - INTERVAL '20 days',
        3,
        '11111111-1111-1111-1111-111111111111',
        9001,
        2,
        4.0,
        'Test future due date',
        NULL,
        NOW () - INTERVAL '5 days',
        2,
        15,
        2.9,
        5
    ),
    -- Tune 9005: Lapsed (overdue)
    (
        9005,
        'The Silver Spear',
        'reel',
        '(AB)3',
        'Dmaj',
        'defg',
        NOW () - INTERVAL '60 days',
        4,
        '11111111-1111-1111-1111-111111111111',
        9001,
        2,
        2.0,
        'Test lapsed state',
        NULL,
        NOW () - INTERVAL '30 days',
        2,
        7,
        2.5,
        30
    ) ON CONFLICT (id) DO NOTHING;

-- Alice's Practice Records
INSERT INTO
    public.practice_record (
        id,
        user_ref,
        tune_ref,
        practiced,
        quality,
        type_recall,
        external_ref,
        notes,
        interval,
        ease,
        stage,
        elapsed_days
    )
VALUES
    -- Recent practices for tune 9001 (Banish Misfortune)
    (
        9001,
        '11111111-1111-1111-1111-111111111111',
        9001,
        NOW () - INTERVAL '1 day',
        3,
        0,
        NULL,
        'First attempt, struggled with B part',
        0,
        2.5,
        0,
        0
    ),
    -- Practices for tune 9002 (Morrison's Jig)
    (
        9002,
        '11111111-1111-1111-1111-111111111111',
        9002,
        NOW () - INTERVAL '3 days',
        3,
        1,
        NULL,
        'Initial learning',
        1,
        2.5,
        1,
        0
    ),
    (
        9003,
        '11111111-1111-1111-1111-111111111111',
        9002,
        NOW () - INTERVAL '2 days',
        4,
        1,
        NULL,
        'Getting better',
        1,
        2.5,
        1,
        1
    ),
    -- Practices for tune 9003 (The Kesh)  
    (
        9004,
        '11111111-1111-1111-1111-111111111111',
        9003,
        NOW () - INTERVAL '30 days',
        4,
        2,
        NULL,
        'Solid review',
        10,
        2.8,
        2,
        0
    ),
    (
        9005,
        '11111111-1111-1111-1111-111111111111',
        9003,
        NOW () - INTERVAL '10 days',
        4,
        2,
        NULL,
        'Still good',
        10,
        2.8,
        2,
        20
    ),
    -- Practice for tune 9004 (Si Bheag Si Mhor)
    (
        9006,
        '11111111-1111-1111-1111-111111111111',
        9004,
        NOW () - INTERVAL '5 days',
        4,
        2,
        NULL,
        'Beautiful slow air',
        15,
        2.9,
        2,
        0
    ),
    -- Old practice for tune 9005 (Silver Spear)
    (
        9007,
        '11111111-1111-1111-1111-111111111111',
        9005,
        NOW () - INTERVAL '30 days',
        2,
        2,
        NULL,
        'Rusty on this one',
        7,
        2.5,
        2,
        0
    ) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- BOB'S DATA: User with empty repertoire but tunes in catalog
-- ============================================================================
-- Bob's Playlist (empty repertoire)
INSERT INTO
    public.playlist (id, user_ref, instrument, genre, created, updated)
VALUES
    (
        9002,
        '22222222-2222-2222-2222-222222222222',
        'fiddle',
        'Irish Traditional',
        NOW (),
        NOW ()
    ) ON CONFLICT (id) DO NOTHING;

-- Bob's Tunes (catalog only - no playlist_ref)
INSERT INTO
    public.tune (
        id,
        title,
        type,
        structure,
        mode,
        incipit,
        date_created,
        difficulty,
        user_ref,
        playlist_ref,
        recall_state,
        recall_eval,
        notes,
        external_ref
    )
VALUES
    (
        9010,
        'The Butterfly',
        'slip jig',
        '(AB)3',
        'Emin',
        'EFGA',
        NOW (),
        3,
        '22222222-2222-2222-2222-222222222222',
        NULL,
        NULL,
        NULL,
        'In catalog, not in repertoire',
        NULL
    ),
    (
        9011,
        'Out on the Ocean',
        'jig',
        '(AB)3',
        'Gmaj',
        'DGBA',
        NOW (),
        4,
        '22222222-2222-2222-2222-222222222222',
        NULL,
        NULL,
        NULL,
        'Another catalog tune',
        NULL
    ),
    (
        9012,
        'The Blarney Pilgrim',
        'jig',
        '(AB)3',
        'Gmaj',
        'GABG',
        NOW (),
        3,
        '22222222-2222-2222-2222-222222222222',
        NULL,
        NULL,
        NULL,
        'Third catalog tune',
        NULL
    ) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- CHARLIE'S DATA: Edge case user with completely empty account
-- ============================================================================
-- Charlie has no playlist, no tunes, no practice records
-- This tests empty state handling in the UI
-- ============================================================================
-- Verification Queries (for manual testing)
-- ============================================================================
-- 
-- -- Check Alice's repertoire
-- SELECT t.id, t.title, t.type, t.recall_state, t.current_stage, t.current_interval
-- FROM tune t
-- WHERE t.user_ref = '11111111-1111-1111-1111-111111111111' 
--   AND t.playlist_ref = 9001;
--
-- -- Check Bob's catalog
-- SELECT t.id, t.title, t.type
-- FROM tune t  
-- WHERE t.user_ref = '22222222-2222-2222-2222-222222222222'
--   AND t.playlist_ref IS NULL;
--
-- -- Check Charlie's empty account
-- SELECT COUNT(*) FROM tune WHERE user_ref = '33333333-3333-3333-3333-333333333333';
-- SELECT COUNT(*) FROM playlist WHERE user_ref = '33333333-3333-3333-3333-333333333333';