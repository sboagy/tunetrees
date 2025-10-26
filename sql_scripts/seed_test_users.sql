-- Seed additional test users for parallel E2E testing
-- Users: bob, carol, dave, eve, frank, grace, henry, iris
-- User IDs: 9002-9009, Playlist IDs: 9002-9009

-- Insert test users into auth.users (Supabase Auth)
-- Note: Run this in Supabase SQL Editor or via migration

-- Bob Test User (9002)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
VALUES (
  '00000000-0000-0000-0000-000000009002',
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
  '00000000-0000-0000-0000-000000009003',
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
  '00000000-0000-0000-0000-000000009004',
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
  '00000000-0000-0000-0000-000000009005',
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
  '00000000-0000-0000-0000-000000009006',
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
  '00000000-0000-0000-0000-000000009007',
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
  '00000000-0000-0000-0000-000000009008',
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
  '00000000-0000-0000-0000-000000009009',
  'iris.test@tunetrees.test',
  crypt('TestPassword123!', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '{"name": "Iris Test"}'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- Insert corresponding user records in public.user table
INSERT INTO public.user (id, name, email) VALUES
  (9002, 'Bob Test', 'bob.test@tunetrees.test'),
  (9003, 'Carol Test', 'carol.test@tunetrees.test'),
  (9004, 'Dave Test', 'dave.test@tunetrees.test'),
  (9005, 'Eve Test', 'eve.test@tunetrees.test'),
  (9006, 'Frank Test', 'frank.test@tunetrees.test'),
  (9007, 'Grace Test', 'grace.test@tunetrees.test'),
  (9008, 'Henry Test', 'henry.test@tunetrees.test'),
  (9009, 'Iris Test', 'iris.test@tunetrees.test')
ON CONFLICT (id) DO NOTHING;

-- Create playlists for each test user
INSERT INTO public.playlist (id, user_ref, instrument, genre, name) VALUES
  (9002, 9002, 'Flute', 'Irish', 'Bob''s Irish Flute'),
  (9003, 9003, 'Flute', 'Irish', 'Carol''s Irish Flute'),
  (9004, 9004, 'Flute', 'Irish', 'Dave''s Irish Flute'),
  (9005, 9005, 'Flute', 'Irish', 'Eve''s Irish Flute'),
  (9006, 9006, 'Flute', 'Irish', 'Frank''s Irish Flute'),
  (9007, 9007, 'Flute', 'Irish', 'Grace''s Irish Flute'),
  (9008, 9008, 'Flute', 'Irish', 'Henry''s Irish Flute'),
  (9009, 9009, 'Flute', 'Irish', 'Iris''s Irish Flute')
ON CONFLICT (id) DO NOTHING;

-- Verify users were created
SELECT id, email FROM auth.users WHERE email LIKE '%.test@tunetrees.test' ORDER BY id;
SELECT id, name, email FROM public.user WHERE id >= 9002 AND id <= 9009 ORDER BY id;
SELECT id, name, user_ref FROM public.playlist WHERE id >= 9002 AND id <= 9009 ORDER BY id;
