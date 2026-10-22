-- Additive: old clients may omit this nullable field; existing locators remain valid.
ALTER TABLE public.user_profile ADD COLUMN byos_storage_config text;
COMMENT ON COLUMN public.user_profile.byos_storage_config IS
  'Versioned completed BYOS setup: provider and folder locator/name only. No tokens or account identity.';
