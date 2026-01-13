-- Ensure anonymous sign-ins remain enabled in all environments.
-- Fixes regression where hosted Supabase auth returned
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'auth'
      AND table_name = 'config'
  ) THEN
    UPDATE auth.config
    SET enable_anonymous_sign_ins = TRUE;
  ELSE
    RAISE NOTICE 'auth.config does not exist; skipping anonymous sign-in enablement';
  END IF;
END
$$;
