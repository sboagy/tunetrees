-- Runs only against local Supabase: npx supabase test db supabase/tests/goal_configuration.test.sql
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;
SELECT no_plan();

-- Session-local constant accessors are also visible inside pgTAP's dynamically
-- executed SQL and after SET ROLE. The final rollback removes these functions.
CREATE FUNCTION pg_temp.test_user_a() RETURNS uuid
LANGUAGE sql IMMUTABLE AS $$ SELECT '42600000-0000-0000-0000-000000000001'::uuid $$;
CREATE FUNCTION pg_temp.test_user_b() RETURNS uuid
LANGUAGE sql IMMUTABLE AS $$ SELECT '42600000-0000-0000-0000-000000000002'::uuid $$;
CREATE FUNCTION pg_temp.test_goal_a() RETURNS uuid
LANGUAGE sql IMMUTABLE AS $$ SELECT '42600000-0000-0000-0000-000000000011'::uuid $$;
CREATE FUNCTION pg_temp.test_goal_b() RETURNS uuid
LANGUAGE sql IMMUTABLE AS $$ SELECT '42600000-0000-0000-0000-000000000012'::uuid $$;
CREATE FUNCTION pg_temp.recall_goal() RETURNS uuid
LANGUAGE sql IMMUTABLE AS $$ SELECT '00000000-0000-0000-0000-000000000001'::uuid $$;
CREATE FUNCTION pg_temp.check_violation() RETURNS text
LANGUAGE sql IMMUTABLE AS $$ SELECT '23514'::text $$;


-- Check the actual post-seed database before fixture writes. A legacy baseline
-- applied after migrations must not erase the current built-in definitions.
SELECT is(
  (SELECT count(*) FROM public.goal
   WHERE private_for IS NULL AND NOT deleted
     AND nullif(trim(display_name), '') IS NOT NULL
     AND nullif(trim(description), '') IS NOT NULL
     AND default_config IS NOT NULL),
  5::bigint,
  'All five built-in goals retain display metadata and configuration after seeding'
);

INSERT INTO public.user_profile(id) VALUES
  (pg_temp.test_user_a()),
  (pg_temp.test_user_b());
-- Legacy custom-goal writes still work, without any new columns.
SELECT lives_ok($sql$
  INSERT INTO public.goal(id, name, private_for) VALUES
    (pg_temp.test_goal_a(), 'test-goal-a', pg_temp.test_user_a()),
    (pg_temp.test_goal_b(), 'test-goal-b', pg_temp.test_user_b())
$sql$, 'Legacy private goal creation remains valid');
SELECT lives_ok($sql$
  INSERT INTO public.goal(id, name, private_for) VALUES
    (pg_temp.test_goal_a(), 'renamed-legacy-goal', pg_temp.test_user_a())
  ON CONFLICT(id) DO UPDATE SET name = excluded.name, private_for = excluded.private_for
$sql$, 'Legacy same-owner upsert remains valid');

-- These run as postgres, as privileged as the Worker: RLS cannot save us here.
SELECT throws_ok($sql$
  INSERT INTO public.goal(id, name, private_for) VALUES
    (pg_temp.recall_goal(), 'forged-recall', pg_temp.test_user_a())
  ON CONFLICT(id) DO UPDATE SET name = excluded.name
$sql$, pg_temp.check_violation(), NULL, 'Forged shared ID rejected even if upsert omits owner');
SELECT throws_ok($sql$
  INSERT INTO public.goal(id, name, private_for) VALUES
    (pg_temp.test_goal_b(), 'forged-private', pg_temp.test_user_a())
  ON CONFLICT(id) DO UPDATE SET name = excluded.name, private_for = excluded.private_for
$sql$, pg_temp.check_violation(), NULL, 'Another user goal cannot be taken over');
SELECT throws_ok($sql$
  INSERT INTO public.goal(name) VALUES ('unowned-client-goal')
$sql$, pg_temp.check_violation(), NULL, 'Missing owner cannot create a shared goal');
SELECT throws_ok($sql$
  UPDATE public.goal SET description = 'client overwrite' WHERE id = pg_temp.recall_goal()
$sql$, pg_temp.check_violation(), NULL, 'Shared definitions require explicit seed authorization');
SELECT throws_ok($sql$
  UPDATE public.goal SET private_for = pg_temp.test_user_b()
  WHERE id = pg_temp.test_goal_a()
$sql$, pg_temp.check_violation(), NULL, 'Goal owner is immutable');
SELECT throws_ok($sql$
  UPDATE public.goal SET id = '42600000-0000-0000-0000-000000000013'
  WHERE id = pg_temp.test_goal_a()
$sql$, pg_temp.check_violation(), NULL, 'Goal ID is immutable');

DELETE FROM public.sync_change_log WHERE table_name = 'goal_user_settings';
SELECT lives_ok($sql$
  INSERT INTO public.goal_user_settings(user_id, goal_id, overrides) VALUES
    (pg_temp.test_user_a(), pg_temp.test_goal_a(), '{"description":"Personal intent","intervals":[0.1,0.3333333333333333]}'),
    (pg_temp.test_user_a(), pg_temp.recall_goal(), '{}'),
    (pg_temp.test_user_b(), pg_temp.recall_goal(), '{}')
$sql$, 'Own custom and shared settings can be written in the goal creation transaction');
SELECT is((SELECT overrides FROM public.goal_user_settings WHERE goal_id = pg_temp.test_goal_a()),
  '{"description":"Personal intent","intervals":[0.1,0.3333333333333333]}', 'JSON TEXT preserves fractional values exactly');
SELECT is((SELECT count(*) FROM public.sync_change_log WHERE table_name = 'goal_user_settings'), 1::bigint, 'Settings writes notify incremental sync');
SELECT throws_ok($sql$
  INSERT INTO public.goal_user_settings(user_id, goal_id) VALUES
    (pg_temp.test_user_a(), pg_temp.test_goal_b())
$sql$, pg_temp.check_violation(), NULL, 'Privileged insert cannot reference another user goal');
SELECT throws_ok($sql$
  UPDATE public.goal_user_settings SET user_id = pg_temp.test_user_b()
  WHERE goal_id = pg_temp.test_goal_a()
$sql$, pg_temp.check_violation(), NULL, 'Settings owner cannot be reassigned');
SELECT throws_ok($sql$
  UPDATE public.goal_user_settings SET goal_id = pg_temp.test_goal_b()
  WHERE goal_id = pg_temp.test_goal_a()
$sql$, pg_temp.check_violation(), NULL, 'Settings goal cannot be reassigned');
SELECT throws_ok($sql$
  UPDATE public.goal_user_settings SET overrides = '{broken'
  WHERE goal_id = pg_temp.test_goal_a()
$sql$, pg_temp.check_violation(), NULL, 'Malformed overrides rejected');
SELECT throws_ok($sql$
  UPDATE public.goal_user_settings SET overrides = '[]'
  WHERE goal_id = pg_temp.test_goal_a()
$sql$, pg_temp.check_violation(), NULL, 'Nonobject overrides rejected');
SELECT throws_ok($sql$
  UPDATE public.goal_user_settings SET overrides = json_build_object('description', repeat('x', 65536))::text
  WHERE goal_id = pg_temp.test_goal_a()
$sql$, pg_temp.check_violation(), NULL, 'Oversized overrides rejected');
SELECT throws_ok($sql$
  UPDATE public.goal SET default_config = 'null' WHERE id = pg_temp.test_goal_a()
$sql$, pg_temp.check_violation(), NULL, 'Nonobject default configuration rejected');
SELECT throws_ok($sql$
  UPDATE public.goal SET default_config = '{broken' WHERE id = pg_temp.test_goal_a()
$sql$, pg_temp.check_violation(), NULL, 'Malformed default configuration rejected');
SELECT throws_ok($sql$
  UPDATE public.goal SET default_config = json_build_object('description', repeat('é', 32768))::text
  WHERE id = pg_temp.test_goal_a()
$sql$, pg_temp.check_violation(), NULL, 'Configuration limit counts bytes, not characters');

-- Goal tombstones do not prevent replay of settings tombstones.
UPDATE public.goal SET deleted = true WHERE id = pg_temp.test_goal_a();
SELECT lives_ok($sql$
  UPDATE public.goal_user_settings SET deleted = true WHERE goal_id = pg_temp.test_goal_a()
$sql$, 'Settings remain syncable after goal soft deletion');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', pg_temp.test_user_a()::text, true);
SELECT is((SELECT count(*) FROM public.goal_user_settings), 2::bigint, 'RLS hides another user settings');
SELECT throws_ok($sql$
  INSERT INTO public.goal_user_settings(user_id, goal_id) VALUES
    (pg_temp.test_user_b(), '42600000-0000-0000-0000-000000000000')
$sql$, pg_temp.check_violation(), NULL, 'Direct API insert cannot reference an unavailable goal');
SELECT throws_ok($sql$
  INSERT INTO public.goal_user_settings(user_id, goal_id) VALUES
    (pg_temp.test_user_b(), '00000000-0000-0000-0000-000000000003')
$sql$, '42501', NULL, 'RLS prevents writing another user settings for a shared goal');
SELECT lives_ok($sql$
  UPDATE public.goal_user_settings SET overrides = '{"daily":{"minimum":0}}'
  WHERE user_id = pg_temp.test_user_a() AND goal_id = pg_temp.recall_goal()
$sql$, 'Direct API can update own settings');
RESET ROLE;

-- Trusted seed updates are explicit, transaction-scoped, and preserve ordering.
CREATE TEMP TABLE goal_seed_before AS SELECT id, last_modified_at FROM public.goal
WHERE id = pg_temp.recall_goal();
SET LOCAL tunetrees.goal_seed_write = 'on';
SELECT lives_ok($sql$
  UPDATE public.goal SET description = 'Trusted release default'
  WHERE id = pg_temp.recall_goal()
$sql$, 'Trusted migrations can update shared defaults');
SELECT is((SELECT g.last_modified_at FROM public.goal g JOIN goal_seed_before b USING (id)),
  (SELECT last_modified_at FROM goal_seed_before), 'Default seed updates preserve existing timestamps');
SET LOCAL tunetrees.goal_seed_write = 'off';
SELECT throws_ok($sql$
  UPDATE public.goal SET description = 'Unexpected client write'
  WHERE id = pg_temp.recall_goal()
$sql$, pg_temp.check_violation(), NULL, 'Seed authorization does not remain enabled after restore');

SELECT * FROM finish();
ROLLBACK;
