-- Migration: Secure user_genre_selection + practice_list_staged
-- Date: 2026-01-22

-- Enable RLS for user_genre_selection
ALTER TABLE public.user_genre_selection ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_genre_selection FORCE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "user_genre_selection_select_own" ON public.user_genre_selection;
DROP POLICY IF EXISTS "user_genre_selection_insert_own" ON public.user_genre_selection;
DROP POLICY IF EXISTS "user_genre_selection_update_own" ON public.user_genre_selection;
DROP POLICY IF EXISTS "user_genre_selection_delete_own" ON public.user_genre_selection;

-- Policies: scope to auth.uid() via user_profile mapping
CREATE POLICY "user_genre_selection_select_own"
  ON public.user_genre_selection
  FOR SELECT
  USING (
    user_id IN (
      SELECT id FROM public.user_profile WHERE supabase_user_id = auth.uid()
    )
  );

CREATE POLICY "user_genre_selection_insert_own"
  ON public.user_genre_selection
  FOR INSERT
  WITH CHECK (
    user_id IN (
      SELECT id FROM public.user_profile WHERE supabase_user_id = auth.uid()
    )
  );

CREATE POLICY "user_genre_selection_update_own"
  ON public.user_genre_selection
  FOR UPDATE
  USING (
    user_id IN (
      SELECT id FROM public.user_profile WHERE supabase_user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id IN (
      SELECT id FROM public.user_profile WHERE supabase_user_id = auth.uid()
    )
  );

CREATE POLICY "user_genre_selection_delete_own"
  ON public.user_genre_selection
  FOR DELETE
  USING (
    user_id IN (
      SELECT id FROM public.user_profile WHERE supabase_user_id = auth.uid()
    )
  );

-- Restrict privileges on user_genre_selection
REVOKE ALL ON TABLE public.user_genre_selection FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_genre_selection TO authenticated;
GRANT ALL ON TABLE public.user_genre_selection TO service_role;

-- Harden practice_list_staged view privileges
REVOKE ALL ON TABLE public.practice_list_staged FROM anon, authenticated;
GRANT SELECT ON TABLE public.practice_list_staged TO authenticated;
GRANT ALL ON TABLE public.practice_list_staged TO service_role;

-- Ensure security invoker semantics (redundant if already applied)
ALTER VIEW public.practice_list_staged SET (security_invoker = on);
