BEGIN;

ALTER TABLE public.user_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profile FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Select own user_profile" ON public.user_profile;
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profile;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profile;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profile;

CREATE POLICY "Users can view own profile" ON public.user_profile
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.user_profile
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.user_profile
  FOR INSERT
  WITH CHECK (auth.uid() = id);

COMMIT;