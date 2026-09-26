-- Issue #721: sync the non-secret provider choice across a user's devices.
-- OAuth tokens and provider account identity remain browser-local and are not
-- represented by this column.

ALTER TABLE public.user_profile
  ADD COLUMN byos_provider text,
  ADD CONSTRAINT user_profile_byos_provider_check
    CHECK (byos_provider IS NULL OR byos_provider IN ('google-drive', 'dropbox'));

COMMENT ON COLUMN public.user_profile.byos_provider IS
  'Selected BYOS provider identifier only. It never contains OAuth tokens, a provider account ID, or an email address.';
