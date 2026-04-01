-- Deterministic private tune fixtures for shared-auth E2E users.
-- These rows are app-owned and safe to replay after shared auth seeding.

INSERT INTO "public"."tune" (
  "id",
  "id_foreign",
  "primary_origin",
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
  "composer",
  "artist",
  "release_year"
) VALUES
  ('00000000-0000-4000-8000-000000029001', NULL, 'irishtune.info', 'Banish Misfortune', 'JigD', 'AABBCC', 'D Mixolydian', '|fed cAG|', 'ITRAD', '00000000-0000-4000-8000-000000009001', false, 1, '2025-11-03 04:57:14.283643', NULL, NULL, NULL, NULL),
  ('00000000-0000-4000-8000-000000039001', NULL, 'irishtune.info', 'Morrison''s Jig', 'JigD', 'AABBCC', 'E Dorian', '|EDB cAF|', 'ITRAD', '00000000-0000-4000-8000-000000009001', false, 1, '2025-11-03 04:57:14.283643', NULL, NULL, NULL, NULL),
  ('00000000-0000-4000-8000-000000029002', NULL, 'irishtune.info', 'Banish Misfortune', 'JigD', 'AABBCC', 'D Mixolydian', '|fed cAG|', 'ITRAD', '00000000-0000-4000-8000-000000009002', false, 1, '2025-11-03 04:57:14.283643', NULL, NULL, NULL, NULL),
  ('00000000-0000-4000-8000-000000039002', NULL, 'irishtune.info', 'Morrison''s Jig', 'JigD', 'AABBCC', 'E Dorian', '|EDB cAF|', 'ITRAD', '00000000-0000-4000-8000-000000009002', false, 1, '2025-11-03 04:57:14.283643', NULL, NULL, NULL, NULL),
  ('00000000-0000-4000-8000-000000029003', NULL, 'irishtune.info', 'Banish Misfortune', 'JigD', 'AABBCC', 'D Mixolydian', '|fed cAG|', 'ITRAD', '00000000-0000-4000-8000-000000009003', false, 1, '2025-11-03 04:57:14.283643', NULL, NULL, NULL, NULL),
  ('00000000-0000-4000-8000-000000039003', NULL, 'irishtune.info', 'Morrison''s Jig', 'JigD', 'AABBCC', 'E Dorian', '|EDB cAF|', 'ITRAD', '00000000-0000-4000-8000-000000009003', false, 1, '2025-11-03 04:57:14.283643', NULL, NULL, NULL, NULL),
  ('00000000-0000-4000-8000-000000029004', NULL, 'irishtune.info', 'Banish Misfortune', 'JigD', 'AABBCC', 'D Mixolydian', '|fed cAG|', 'ITRAD', '00000000-0000-4000-8000-000000009004', false, 1, '2025-11-03 04:57:14.283643', NULL, NULL, NULL, NULL),
  ('00000000-0000-4000-8000-000000039004', NULL, 'irishtune.info', 'Morrison''s Jig', 'JigD', 'AABBCC', 'E Dorian', '|EDB cAF|', 'ITRAD', '00000000-0000-4000-8000-000000009004', false, 1, '2025-11-03 04:57:14.283643', NULL, NULL, NULL, NULL),
  ('00000000-0000-4000-8000-000000029005', NULL, 'irishtune.info', 'Banish Misfortune', 'JigD', 'AABBCC', 'D Mixolydian', '|fed cAG|', 'ITRAD', '00000000-0000-4000-8000-000000009005', false, 1, '2025-11-03 04:57:14.283643', NULL, NULL, NULL, NULL),
  ('00000000-0000-4000-8000-000000039005', NULL, 'irishtune.info', 'Morrison''s Jig', 'JigD', 'AABBCC', 'E Dorian', '|EDB cAF|', 'ITRAD', '00000000-0000-4000-8000-000000009005', false, 1, '2025-11-03 04:57:14.283643', NULL, NULL, NULL, NULL),
  ('00000000-0000-4000-8000-000000029006', NULL, 'irishtune.info', 'Banish Misfortune', 'JigD', 'AABBCC', 'D Mixolydian', '|fed cAG|', 'ITRAD', '00000000-0000-4000-8000-000000009006', false, 1, '2025-11-03 04:57:14.283643', NULL, NULL, NULL, NULL),
  ('00000000-0000-4000-8000-000000039006', NULL, 'irishtune.info', 'Morrison''s Jig', 'JigD', 'AABBCC', 'E Dorian', '|EDB cAF|', 'ITRAD', '00000000-0000-4000-8000-000000009006', false, 1, '2025-11-03 04:57:14.283643', NULL, NULL, NULL, NULL),
  ('00000000-0000-4000-8000-000000029007', NULL, 'irishtune.info', 'Banish Misfortune', 'JigD', 'AABBCC', 'D Mixolydian', '|fed cAG|', 'ITRAD', '00000000-0000-4000-8000-000000009007', false, 1, '2025-11-03 04:57:14.283643', NULL, NULL, NULL, NULL),
  ('00000000-0000-4000-8000-000000039007', NULL, 'irishtune.info', 'Morrison''s Jig', 'JigD', 'AABBCC', 'E Dorian', '|EDB cAF|', 'ITRAD', '00000000-0000-4000-8000-000000009007', false, 1, '2025-11-03 04:57:14.283643', NULL, NULL, NULL, NULL),
  ('00000000-0000-4000-8000-000000029008', NULL, 'irishtune.info', 'Banish Misfortune', 'JigD', 'AABBCC', 'D Mixolydian', '|fed cAG|', 'ITRAD', '00000000-0000-4000-8000-000000009008', false, 1, '2025-11-03 04:57:14.283643', NULL, NULL, NULL, NULL),
  ('00000000-0000-4000-8000-000000039008', NULL, 'irishtune.info', 'Morrison''s Jig', 'JigD', 'AABBCC', 'E Dorian', '|EDB cAF|', 'ITRAD', '00000000-0000-4000-8000-000000009008', false, 1, '2025-11-03 04:57:14.283643', NULL, NULL, NULL, NULL),
  ('00000000-0000-4000-8000-000000029009', NULL, 'irishtune.info', 'Banish Misfortune', 'JigD', 'AABBCC', 'D Mixolydian', '|fed cAG|', 'ITRAD', '00000000-0000-4000-8000-000000009009', false, 1, '2025-11-03 04:57:14.283643', NULL, NULL, NULL, NULL),
  ('00000000-0000-4000-8000-000000039009', NULL, 'irishtune.info', 'Morrison''s Jig', 'JigD', 'AABBCC', 'E Dorian', '|EDB cAF|', 'ITRAD', '00000000-0000-4000-8000-000000009009', false, 1, '2025-11-03 04:57:14.283643', NULL, NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;