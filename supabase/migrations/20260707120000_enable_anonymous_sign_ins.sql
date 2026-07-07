-- Ensure anonymous sign-ins remain enabled in deployed Supabase projects.
-- The local config.toml setting does not automatically update hosted Auth
-- configuration, so keep this as an active migration for staging/production.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'auth'
      AND table_name = 'config'
  ) THEN
    UPDATE auth.config
    SET enable_anonymous_sign_ins = TRUE
    WHERE enable_anonymous_sign_ins IS FALSE;
  ELSE
    RAISE NOTICE 'auth.config does not exist; skipping anonymous sign-in enablement';
  END IF;
END
$$;
