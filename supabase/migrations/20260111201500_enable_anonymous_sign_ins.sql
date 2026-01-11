-- Ensure anonymous sign-ins remain enabled in all environments.
-- Fixes regression where hosted Supabase auth returned
-- "Anonymous sign-ins are disabled" for the anonymous CTA.
UPDATE auth.config
SET enable_anonymous_sign_ins = TRUE;

