-- Runs only against local Supabase: npx supabase test db supabase/tests/goal_configuration.test.sql
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;
SELECT no_plan();

INSERT INTO public.user_profile(id) VALUES
  ('42600000-0000-0000-0000-000000000001'),
  ('42600000-0000-0000-0000-000000000002');
-- Legacy custom-goal writes still work, without any new columns.
SELECT lives_ok($sql$
  INSERT INTO public.goal(id, name, private_for) VALUES
    ('42600000-0000-0000-0000-000000000011', 'test-goal-a', '42600000-0000-0000-0000-000000000001'),
    ('42600000-0000-0000-0000-000000000012', 'test-goal-b', '42600000-0000-0000-0000-000000000002')
$sql$, 'Legacy private goal creation remains valid');
SELECT lives_ok($sql$
  INSERT INTO public.goal(id, name, private_for) VALUES
    ('42600000-0000-0000-0000-000000000011', 'renamed-legacy-goal', '42600000-0000-0000-0000-000000000001')
  ON CONFLICT(id) DO UPDATE SET name = excluded.name, private_for = excluded.private_for
$sql$, 'Legacy same-owner upsert remains valid');

-- These run as postgres, as privileged as the Worker: RLS cannot save us here.
SELECT throws_ok($sql$
  INSERT INTO public.goal(id, name, private_for) VALUES
    ('00000000-0000-0000-0000-000000000001', 'forged-recall', '42600000-0000-0000-0000-000000000001')
  ON CONFLICT(id) DO UPDATE SET name = excluded.name
$sql$, '23514', NULL, 'Forged shared ID rejected even if upsert omits owner');
SELECT throws_ok($sql$
  INSERT INTO public.goal(id, name, private_for) VALUES
    ('42600000-0000-0000-0000-000000000012', 'forged-private', '42600000-0000-0000-0000-000000000001')
  ON CONFLICT(id) DO UPDATE SET name = excluded.name, private_for = excluded.private_for
$sql$, '23514', NULL, 'Another user goal cannot be taken over');
SELECT throws_ok($sql$
  INSERT INTO public.goal(name) VALUES ('unowned-client-goal')
$sql$, '23514', NULL, 'Missing owner cannot create a shared goal');
SELECT throws_ok($sql$
  UPDATE public.goal SET description = 'client overwrite' WHERE id = '00000000-0000-0000-0000-000000000001'
$sql$, '23514', NULL, 'Shared definitions require explicit seed authorization');
SELECT throws_ok($sql$
  UPDATE public.goal SET private_for = '42600000-0000-0000-0000-000000000002'
  WHERE id = '42600000-0000-0000-0000-000000000011'
$sql$, '23514', NULL, 'Goal owner is immutable');
SELECT throws_ok($sql$
  UPDATE public.goal SET id = '42600000-0000-0000-0000-000000000013'
  WHERE id = '42600000-0000-0000-0000-000000000011'
$sql$, '23514', NULL, 'Goal ID is immutable');

DELETE FROM public.sync_change_log WHERE table_name = 'goal_user_settings';
SELECT lives_ok($sql$
  INSERT INTO public.goal_user_settings(user_id, goal_id, overrides) VALUES
    ('42600000-0000-0000-0000-000000000001', '42600000-0000-0000-0000-000000000011', '{"description":"Personal intent","intervals":[0.1,0.3333333333333333]}'),
    ('42600000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '{}'),
    ('42600000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '{}')
$sql$, 'Own custom and shared settings can be written in the goal creation transaction');
SELECT is((SELECT overrides FROM public.goal_user_settings WHERE goal_id = '42600000-0000-0000-0000-000000000011'),
  '{"description":"Personal intent","intervals":[0.1,0.3333333333333333]}', 'JSON TEXT preserves fractional values exactly');
SELECT is((SELECT count(*) FROM public.sync_change_log WHERE table_name = 'goal_user_settings'), 1::bigint, 'Settings writes notify incremental sync');
SELECT throws_ok($sql$
  INSERT INTO public.goal_user_settings(user_id, goal_id) VALUES
    ('42600000-0000-0000-0000-000000000001', '42600000-0000-0000-0000-000000000012')
$sql$, '23514', NULL, 'Privileged insert cannot reference another user goal');
SELECT throws_ok($sql$
  UPDATE public.goal_user_settings SET user_id = '42600000-0000-0000-0000-000000000002'
  WHERE goal_id = '42600000-0000-0000-0000-000000000011'
$sql$, '23514', NULL, 'Settings owner cannot be reassigned');
SELECT throws_ok($sql$
  UPDATE public.goal_user_settings SET goal_id = '42600000-0000-0000-0000-000000000012'
  WHERE goal_id = '42600000-0000-0000-0000-000000000011'
$sql$, '23514', NULL, 'Settings goal cannot be reassigned');
SELECT throws_ok($sql$
  UPDATE public.goal_user_settings SET overrides = '{broken'
  WHERE goal_id = '42600000-0000-0000-0000-000000000011'
$sql$, '23514', NULL, 'Malformed overrides rejected');
SELECT throws_ok($sql$
  UPDATE public.goal_user_settings SET overrides = '[]'
  WHERE goal_id = '42600000-0000-0000-0000-000000000011'
$sql$, '23514', NULL, 'Nonobject overrides rejected');
SELECT throws_ok($sql$
  UPDATE public.goal_user_settings SET overrides = json_build_object('description', repeat('x', 65536))::text
  WHERE goal_id = '42600000-0000-0000-0000-000000000011'
$sql$, '23514', NULL, 'Oversized overrides rejected');
SELECT throws_ok($sql$
  UPDATE public.goal SET default_config = 'null' WHERE id = '42600000-0000-0000-0000-000000000011'
$sql$, '23514', NULL, 'Nonobject default configuration rejected');
SELECT throws_ok($sql$
  UPDATE public.goal SET default_config = '{broken' WHERE id = '42600000-0000-0000-0000-000000000011'
$sql$, '23514', NULL, 'Malformed default configuration rejected');
SELECT throws_ok($sql$
  UPDATE public.goal SET default_config = json_build_object('description', repeat('é', 32768))::text
  WHERE id = '42600000-0000-0000-0000-000000000011'
$sql$, '23514', NULL, 'Configuration limit counts bytes, not characters');

-- Goal tombstones do not prevent replay of settings tombstones.
UPDATE public.goal SET deleted = true WHERE id = '42600000-0000-0000-0000-000000000011';
SELECT lives_ok($sql$
  UPDATE public.goal_user_settings SET deleted = true WHERE goal_id = '42600000-0000-0000-0000-000000000011'
$sql$, 'Settings remain syncable after goal soft deletion');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '42600000-0000-0000-0000-000000000001', true);
SELECT is((SELECT count(*) FROM public.goal_user_settings), 2::bigint, 'RLS hides another user settings');
SELECT throws_ok($sql$
  INSERT INTO public.goal_user_settings(user_id, goal_id) VALUES
    ('42600000-0000-0000-0000-000000000002', '42600000-0000-0000-0000-000000000000')
$sql$, '23514', NULL, 'Direct API insert cannot reference an unavailable goal');
SELECT throws_ok($sql$
  INSERT INTO public.goal_user_settings(user_id, goal_id) VALUES
    ('42600000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003')
$sql$, '42501', NULL, 'RLS prevents writing another user settings for a shared goal');
SELECT lives_ok($sql$
  UPDATE public.goal_user_settings SET overrides = '{"daily":{"minimum":0}}'
  WHERE user_id = '42600000-0000-0000-0000-000000000001' AND goal_id = '00000000-0000-0000-0000-000000000001'
$sql$, 'Direct API can update own settings');
RESET ROLE;

-- Trusted seed updates are explicit, transaction-scoped, and preserve ordering.
CREATE TEMP TABLE goal_seed_before AS SELECT id, last_modified_at FROM public.goal
WHERE id = '00000000-0000-0000-0000-000000000001';
SET LOCAL tunetrees.goal_seed_write = 'on';
SELECT lives_ok($sql$
  UPDATE public.goal SET description = 'Trusted release default'
  WHERE id = '00000000-0000-0000-0000-000000000001'
$sql$, 'Trusted migrations can update shared defaults');
SELECT is((SELECT g.last_modified_at FROM public.goal g JOIN goal_seed_before b USING (id)),
  (SELECT last_modified_at FROM goal_seed_before), 'Default seed updates preserve existing timestamps');
SET LOCAL tunetrees.goal_seed_write = 'off';
SELECT throws_ok($sql$
  UPDATE public.goal SET description = 'Unexpected client write'
  WHERE id = '00000000-0000-0000-0000-000000000001'
$sql$, '23514', NULL, 'Seed authorization does not remain enabled after restore');

SELECT * FROM finish();
ROLLBACK;
