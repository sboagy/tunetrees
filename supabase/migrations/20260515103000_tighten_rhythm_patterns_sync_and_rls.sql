BEGIN;

CREATE OR REPLACE FUNCTION public.sync_get_rhythm_patterns(
  p_user_id UUID,
  p_genre_ids TEXT[],
  p_after_timestamp TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 1000,
  p_offset INTEGER DEFAULT 0
)
RETURNS SETOF public.rhythm_patterns
LANGUAGE sql
STABLE
AS $$
  SELECT rp.*
  FROM public.rhythm_patterns rp
  WHERE (
    (
      rp.user_id IS NULL
      AND rp.genre_id = ANY(COALESCE(p_genre_ids, ARRAY[]::TEXT[]))
    )
    OR rp.user_id = p_user_id
  )
  AND (
    p_after_timestamp IS NULL OR rp.last_modified_at > p_after_timestamp
  )
  ORDER BY rp.last_modified_at ASC, rp.id ASC
  LIMIT p_limit
  OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION public.sync_get_rhythm_patterns(UUID, TEXT[], TIMESTAMPTZ, INTEGER, INTEGER) TO authenticated;

DROP POLICY IF EXISTS "Anyone can view rhythm_patterns" ON public.rhythm_patterns;
DROP POLICY IF EXISTS "Users can view rhythm_patterns" ON public.rhythm_patterns;
DROP POLICY IF EXISTS "Users can insert their own rhythm_patterns" ON public.rhythm_patterns;
DROP POLICY IF EXISTS "Users can update their own rhythm_patterns" ON public.rhythm_patterns;
DROP POLICY IF EXISTS "Users can delete their own rhythm_patterns" ON public.rhythm_patterns;

CREATE POLICY "Users can view rhythm_patterns"
ON public.rhythm_patterns
FOR SELECT
TO authenticated
USING (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Users can insert their own rhythm_patterns"
ON public.rhythm_patterns
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own rhythm_patterns"
ON public.rhythm_patterns
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own rhythm_patterns"
ON public.rhythm_patterns
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

COMMIT;