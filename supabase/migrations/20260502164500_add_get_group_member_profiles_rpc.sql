BEGIN;

CREATE OR REPLACE FUNCTION public.get_group_member_profiles(
  p_group_id uuid
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
  ),
  visible_member_ids AS (
    SELECT ug.owner_user_ref AS id
    FROM public.user_group ug
    CROSS JOIN caller c
    WHERE c.user_id IS NOT NULL
      AND ug.id = p_group_id
      AND public.is_group_member(p_group_id, c.user_id)

    UNION

    SELECT gm.user_ref AS id
    FROM public.group_member gm
    CROSS JOIN caller c
    WHERE c.user_id IS NOT NULL
      AND gm.group_ref = p_group_id
      AND gm.deleted = FALSE
      AND public.is_group_member(p_group_id, c.user_id)
  )
  SELECT up.id, up.name, up.email
  FROM public.user_profile up
  WHERE up.id IN (SELECT id FROM visible_member_ids)
    AND COALESCE(up.deleted, FALSE) = FALSE;
$$;

GRANT EXECUTE ON FUNCTION public.get_group_member_profiles(uuid)
  TO authenticated;

COMMIT;