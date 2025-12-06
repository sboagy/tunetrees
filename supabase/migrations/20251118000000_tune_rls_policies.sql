-- Migration: TuneTrees RLS Policies
-- Timestamp: 2025-11-18 00:00:00 (generated)
-- NOTE: This mirrors supabase/rls/tune_rls_policies.sql for persistent application via migrations.

-- Safe to run multiple times (idempotent sections included).

-- =============================================
-- BEGIN RLS POLICY MIGRATION
-- =============================================
BEGIN;

-- Create or replace helper function without dynamic EXECUTE to avoid migration parser issues
CREATE OR REPLACE FUNCTION public.auth_internal_user_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.user_profile WHERE supabase_user_id = auth.uid();
$$;

-- Enable and force RLS
ALTER TABLE public.tune ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tune FORCE ROW LEVEL SECURITY;
ALTER TABLE public.tune_override ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tune_override FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profile FORCE ROW LEVEL SECURITY;

-- Drop existing policies explicitly (idempotent)
DROP POLICY IF EXISTS "Select public or owned tunes" ON public.tune;
DROP POLICY IF EXISTS "Insert user private tunes" ON public.tune;
DROP POLICY IF EXISTS "Update owned private tunes" ON public.tune;
DROP POLICY IF EXISTS "Delete owned private tunes" ON public.tune;
DROP POLICY IF EXISTS "Select own tune overrides" ON public.tune_override;
DROP POLICY IF EXISTS "Insert own tune overrides" ON public.tune_override;
DROP POLICY IF EXISTS "Update own tune overrides" ON public.tune_override;
DROP POLICY IF EXISTS "Delete own tune overrides" ON public.tune_override;
DROP POLICY IF EXISTS "Select own user_profile" ON public.user_profile;

-- Recreate policies
CREATE POLICY "Select public or owned tunes" ON public.tune FOR SELECT USING (
  private_for IS NULL OR private_for = auth_internal_user_id()
);

CREATE POLICY "Insert user private tunes" ON public.tune FOR INSERT WITH CHECK (
  private_for = auth_internal_user_id()
);

CREATE POLICY "Update owned private tunes" ON public.tune FOR UPDATE USING (
  private_for = auth_internal_user_id()
) WITH CHECK (
  private_for = auth_internal_user_id()
);

CREATE POLICY "Delete owned private tunes" ON public.tune FOR DELETE USING (
  private_for = auth_internal_user_id()
);

CREATE POLICY "Select own tune overrides" ON public.tune_override FOR SELECT USING (
  user_ref = auth_internal_user_id()
);

CREATE POLICY "Insert own tune overrides" ON public.tune_override FOR INSERT WITH CHECK (
  user_ref = auth_internal_user_id()
);

CREATE POLICY "Update own tune overrides" ON public.tune_override FOR UPDATE USING (
  user_ref = auth_internal_user_id()
) WITH CHECK (
  user_ref = auth_internal_user_id()
);

CREATE POLICY "Delete own tune overrides" ON public.tune_override FOR DELETE USING (
  user_ref = auth_internal_user_id()
);

CREATE POLICY "Select own user_profile" ON public.user_profile FOR SELECT USING (
  supabase_user_id = auth.uid()
);

COMMIT;
-- =============================================
-- END RLS POLICY MIGRATION
-- =============================================
