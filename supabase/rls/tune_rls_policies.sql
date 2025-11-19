-- TuneTrees Supabase RLS Policies
-- =============================================
-- This script is idempotent: it drops existing conflicting policies/functions
-- and recreates them. Apply after schema migrations.
--
-- PURPOSE:
--  - Prevent modification of public tunes (tune.private_for IS NULL) by non-admins
--  - Allow users to manage only their own private tunes (ownership frozen)
--  - Route user-specific variations of public tunes through tune_override
--  - Ensure tune_override rows are only visible/mutable to their owner
--  - Prevent ownership escalation by forbidding changes to private_for on update
--
-- IMPORTANT:
--  - Assumes table names live in schema "public"
--  - Assumes columns: tune.private_for -> user_profile.id (UUID internal id)
--                     tune_override.user_ref -> user_profile.id
--                     user_profile.supabase_user_id is the PK and equals auth.uid()
--  - Requires Supabase auth context (auth.uid())
--  - Admin / service role bypasses RLS automatically
-- =============================================

BEGIN;

-- Helper function (idempotent)
CREATE OR REPLACE FUNCTION public.auth_internal_user_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.user_profile WHERE supabase_user_id = auth.uid();
$$;

-- Enable / force RLS on involved tables
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

-- TUNE POLICIES -------------------------------------------------------------
-- SELECT: Allow reading public tunes OR privately owned tunes
CREATE POLICY "Select public or owned tunes" ON public.tune FOR SELECT USING (
  private_for IS NULL OR private_for = auth_internal_user_id()
);

-- INSERT: User may insert only private tunes they own (must set private_for)
CREATE POLICY "Insert user private tunes" ON public.tune FOR INSERT WITH CHECK (
  private_for = auth_internal_user_id()
);

-- UPDATE: Only owner may update, and may NOT change private_for (ownership frozen)
CREATE POLICY "Update owned private tunes" ON public.tune FOR UPDATE USING (
  private_for = auth_internal_user_id()
) WITH CHECK (
  private_for = auth_internal_user_id()
);

-- DELETE (soft or hard): Only owner may delete
CREATE POLICY "Delete owned private tunes" ON public.tune FOR DELETE USING (
  private_for = auth_internal_user_id()
);

-- NOTE: No policy grants UPDATE for public tunes (private_for IS NULL),
-- so public catalog rows are immutable to regular users.

-- TUNE_OVERRIDE POLICIES ----------------------------------------------------
-- SELECT: User sees only their own overrides
CREATE POLICY "Select own tune overrides" ON public.tune_override FOR SELECT USING (
  user_ref = auth_internal_user_id()
);

-- INSERT: User can insert overrides only for themselves
CREATE POLICY "Insert own tune overrides" ON public.tune_override FOR INSERT WITH CHECK (
  user_ref = auth_internal_user_id()
);

-- UPDATE: User can update only their own overrides; cannot reassign user_ref
CREATE POLICY "Update own tune overrides" ON public.tune_override FOR UPDATE USING (
  user_ref = auth_internal_user_id()
) WITH CHECK (
  user_ref = auth_internal_user_id()
);

-- DELETE: User can delete only their own overrides
CREATE POLICY "Delete own tune overrides" ON public.tune_override FOR DELETE USING (
  user_ref = auth_internal_user_id()
);

-- USER_PROFILE POLICIES -----------------------------------------------------
-- SELECT: User may read only their own profile row (function relies on table access)
CREATE POLICY "Select own user_profile" ON public.user_profile FOR SELECT USING (
  supabase_user_id = auth.uid()
);

-- (Optional) UPDATE policy if self-service profile edits are desired:
-- CREATE POLICY "Update own user_profile" ON public.user_profile FOR UPDATE USING (
--   supabase_user_id = auth.uid()
-- ) WITH CHECK (
--   supabase_user_id = auth.uid()
-- );

-- REVIEW CHECKLIST ----------------------------------------------------------
-- 1. Ensure admin/service role still bypasses RLS.
-- 2. Verify auth_internal_user_id() returns expected UUID for a test user.
-- 3. Confirm attempts to UPDATE public tunes fail for regular users.
-- 4. Confirm ownership cannot be transferred (private_for change blocked).
-- 5. Confirm overrides insert/update/delete restricted to owner.
-- 6. Confirm selecting another user's override returns zero rows.
-- 7. Run regression tests touching tune & tune_override logic.

COMMIT;

-- END OF FILE
