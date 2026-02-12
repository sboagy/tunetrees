-- Seed additional test users for parallel E2E testing
-- Users: bob, carol, dave, eve, frank, grace, henry, iris
-- User IDs: 9002-9009, Playlist IDs: 9002-9009

-- Insert test users into auth.users (Supabase Auth)
-- Note: Run this in Supabase SQL Editor or via migration

-- Bob Test User (9002)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
VALUES (
  '00000000-0000-4000-8000-000000009002',
  'bob.test@tunetrees.test',
  crypt('TestPassword123!', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '{"name": "Bob Test"}'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- Carol Test User (9003)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
VALUES (
  '00000000-0000-4000-8000-000000009003',
  'carol.test@tunetrees.test',
  crypt('TestPassword123!', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '{"name": "Carol Test"}'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- Dave Test User (9004)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
VALUES (
  '00000000-0000-4000-8000-000000009004',
  'dave.test@tunetrees.test',
  crypt('TestPassword123!', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '{"name": "Dave Test"}'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- Eve Test User (9005)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
VALUES (
  '00000000-0000-4000-8000-000000009005',
  'eve.test@tunetrees.test',
  crypt('TestPassword123!', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '{"name": "Eve Test"}'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- Frank Test User (9006)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
VALUES (
  '00000000-0000-4000-8000-000000009006',
  'frank.test@tunetrees.test',
  crypt('TestPassword123!', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '{"name": "Frank Test"}'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- Grace Test User (9007)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
VALUES (
  '00000000-0000-4000-8000-000000009007',
  'grace.test@tunetrees.test',
  crypt('TestPassword123!', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '{"name": "Grace Test"}'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- Henry Test User (9008)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
VALUES (
  '00000000-0000-4000-8000-000000009008',
  'henry.test@tunetrees.test',
  crypt('TestPassword123!', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '{"name": "Henry Test"}'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- Iris Test User (9009)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
VALUES (
  '00000000-0000-4000-8000-000000009009',
  'iris.test@tunetrees.test',
  crypt('TestPassword123!', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '{"name": "Iris Test"}'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- Insert corresponding user_profile records
-- Note: Both id and supabase_user_id are set to the same UUID (Auth user ID)
INSERT INTO public.user_profile (id, supabase_user_id, name, email, sync_version, last_modified_at) VALUES
  ('00000000-0000-4000-8000-000000009002', '00000000-0000-4000-8000-000000009002', 'Bob Test', 'bob.test@tunetrees.test', 1, NOW()),
  ('00000000-0000-4000-8000-000000009003', '00000000-0000-4000-8000-000000009003', 'Carol Test', 'carol.test@tunetrees.test', 1, NOW()),
  ('00000000-0000-4000-8000-000000009004', '00000000-0000-4000-8000-000000009004', 'Dave Test', 'dave.test@tunetrees.test', 1, NOW()),
  ('00000000-0000-4000-8000-000000009005', '00000000-0000-4000-8000-000000009005', 'Eve Test', 'eve.test@tunetrees.test', 1, NOW()),
  ('00000000-0000-4000-8000-000000009006', '00000000-0000-4000-8000-000000009006', 'Frank Test', 'frank.test@tunetrees.test', 1, NOW()),
  ('00000000-0000-4000-8000-000000009007', '00000000-0000-4000-8000-000000009007', 'Grace Test', 'grace.test@tunetrees.test', 1, NOW()),
  ('00000000-0000-4000-8000-000000009008', '00000000-0000-4000-8000-000000009008', 'Henry Test', 'henry.test@tunetrees.test', 1, NOW()),
  ('00000000-0000-4000-8000-000000009009', '00000000-0000-4000-8000-000000009009', 'Iris Test', 'iris.test@tunetrees.test', 1, NOW())
ON CONFLICT (id) DO NOTHING;

-- Create playlists for each test user (using UUID format from test-data.ts)
INSERT INTO public.playlist (playlist_id, user_ref, instrument_ref, genre_default, deleted, sync_version, last_modified_at) VALUES
  ('00000000-0000-4000-8000-000000019002', '00000000-0000-4000-8000-000000009002',  '019a4531-0c93-70a3-b71e-e80b6d24edc4', 'ITRAD', false, 1, NOW()),
  ('00000000-0000-4000-8000-000000019003', '00000000-0000-4000-8000-000000009003', '019a4531-0c93-70a3-b71e-e80b6d24edc4', 'ITRAD', false, 1, NOW()),
  ('00000000-0000-4000-8000-000000019004', '00000000-0000-4000-8000-000000009004', '019a4531-0c93-70a3-b71e-e80b6d24edc4', 'ITRAD', false, 1, NOW()),
  ('00000000-0000-4000-8000-000000019005', '00000000-0000-4000-8000-000000009005', '019a4531-0c93-70a3-b71e-e80b6d24edc4', 'ITRAD', false, 1, NOW()),
  ('00000000-0000-4000-8000-000000019006', '00000000-0000-4000-8000-000000009006', '019a4531-0c93-70a3-b71e-e80b6d24edc4', 'ITRAD', false, 1, NOW()),
  ('00000000-0000-4000-8000-000000019007', '00000000-0000-4000-8000-000000009007', '019a4531-0c93-70a3-b71e-e80b6d24edc4', 'ITRAD', false, 1, NOW()),
  ('00000000-0000-4000-8000-000000019008', '00000000-0000-4000-8000-000000009008', '019a4531-0c93-70a3-b71e-e80b6d24edc4', 'ITRAD', false, 1, NOW()),
  ('00000000-0000-4000-8000-000000019009', '00000000-0000-4000-8000-000000009009', '019a4531-0c93-70a3-b71e-e80b6d24edc4', 'ITRAD', false, 1, NOW())
ON CONFLICT (playlist_id) DO NOTHING;

-- Verify users were created
SELECT id, email FROM auth.users WHERE email LIKE '%.test@tunetrees.test' ORDER BY id;
SELECT id, supabase_user_id, name, email FROM public.user_profile WHERE id >= '00000000-0000-4000-8000-000000009002' ORDER BY id;
SELECT playlist_id, user_ref FROM public.playlist WHERE playlist_id >= '00000000-0000-4000-8000-000000019002' ORDER BY playlist_id;
