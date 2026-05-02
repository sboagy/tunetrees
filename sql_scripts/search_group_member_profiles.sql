-- Minimal, authenticated directory lookup for adding members to a group.
-- This deliberately does not widen general user_profile table visibility.

CREATE OR REPLACE FUNCTION public.search_group_member_profiles(
  p_group_id uuid,
  p_search_term text,
  p_limit integer DEFAULT 8
)
RETURNS TABLE (
  id uuid,
  name text,
  email text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH caller AS (
    SELECT auth.uid() AS user_id
  )
  SELECT up.id, up.name, up.email
  FROM public.user_profile up
  CROSS JOIN caller c
  WHERE c.user_id IS NOT NULL
    AND public.is_group_owner(p_group_id, c.user_id)
    AND COALESCE(up.deleted, FALSE) = FALSE
    AND length(trim(COALESCE(p_search_term, ''))) >= 2
    AND lower(
      concat_ws(
        ' ',
        COALESCE(up.name, ''),
        COALESCE(up.email, ''),
        up.id::text
      )
    ) LIKE '%' || lower(trim(p_search_term)) || '%'
  ORDER BY lower(COALESCE(up.name, up.email, up.id::text)), up.id
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 8), 1), 20);
$$;

GRANT EXECUTE ON FUNCTION public.search_group_member_profiles(uuid, text, integer)
  TO authenticated;