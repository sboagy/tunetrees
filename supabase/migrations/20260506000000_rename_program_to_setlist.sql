BEGIN;

-- ============================================================================
-- Migration: Rename program → setlist
-- Issue: #581 - Program -> Setlist terminology change
-- ============================================================================
-- Replaces the deprecated "program" terminology with "setlist" throughout:
--   program       → setlist
--   program_item  → setlist_item
--   program_ref   → setlist_ref
-- Also:
--   - Makes group_ref nullable (setlists can be user-owned)
--   - Adds user_ref column (nullable FK to user_profile)
--   - Creates events table (UI deferred to future issue)
-- ============================================================================

-- ── Step 1: Drop dependent RLS policies ───────────────────────────────────

DROP POLICY IF EXISTS "Users can view visible programs" ON public.program;
DROP POLICY IF EXISTS "Group managers can insert programs" ON public.program;
DROP POLICY IF EXISTS "Group managers can update programs" ON public.program;
DROP POLICY IF EXISTS "Group managers can delete programs" ON public.program;

DROP POLICY IF EXISTS "Users can view visible program items" ON public.program_item;
DROP POLICY IF EXISTS "Group managers can insert program items" ON public.program_item;
DROP POLICY IF EXISTS "Group managers can update program items" ON public.program_item;
DROP POLICY IF EXISTS "Group managers can delete program items" ON public.program_item;

-- ── Step 2: Drop dependent sync RPC functions ─────────────────────────────

DROP FUNCTION IF EXISTS public.sync_get_programs(uuid, timestamptz, integer, integer);
DROP FUNCTION IF EXISTS public.sync_get_program_items(uuid, text[], timestamptz, integer, integer);

-- Also drop the helper RPC that references programs
DROP FUNCTION IF EXISTS public.can_manage_group_programs(uuid, uuid);

-- ── Step 3: Rename tables ─────────────────────────────────────────────────

ALTER TABLE public.program RENAME TO setlist;
ALTER TABLE public.program_item RENAME TO setlist_item;

-- ── Step 4: Rename columns ────────────────────────────────────────────────

ALTER TABLE public.setlist_item RENAME COLUMN program_ref TO setlist_ref;

-- ── Step 5: Rename indexes and constraints ────────────────────────────────

ALTER INDEX IF EXISTS idx_program_group_ref RENAME TO idx_setlist_group_ref;
ALTER INDEX IF EXISTS idx_program_item_program_ref RENAME TO idx_setlist_item_setlist_ref;
ALTER INDEX IF EXISTS idx_program_item_tune_ref RENAME TO idx_setlist_item_tune_ref;
ALTER INDEX IF EXISTS idx_program_item_tune_set_ref RENAME TO idx_setlist_item_tune_set_ref;
ALTER INDEX IF EXISTS idx_program_item_program_position RENAME TO idx_setlist_item_setlist_position;

ALTER INDEX IF EXISTS program_pkey RENAME TO setlist_pkey;
ALTER INDEX IF EXISTS program_item_pkey RENAME TO setlist_item_pkey;

-- Rename constraints
ALTER TABLE public.setlist_item
  RENAME CONSTRAINT program_item_kind_check TO setlist_item_kind_check;
ALTER TABLE public.setlist_item
  RENAME CONSTRAINT program_item_target_check TO setlist_item_target_check;
ALTER TABLE public.setlist_item
  DROP CONSTRAINT IF EXISTS program_item_program_position_unique;
ALTER TABLE public.setlist_item
  RENAME CONSTRAINT program_item_position_nonnegative TO setlist_item_position_nonnegative;

-- ── Step 6: Make group_ref nullable, add user_ref ─────────────────────────

ALTER TABLE public.setlist
  ALTER COLUMN group_ref DROP NOT NULL;

ALTER TABLE public.setlist
  ADD COLUMN user_ref uuid REFERENCES public.user_profile(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_setlist_user_ref ON public.setlist USING btree (user_ref);

-- ── Step 7: Update comments ───────────────────────────────────────────────

COMMENT ON TABLE public.setlist IS 'Ordered musical setlists owned by a group or individual user.';
COMMENT ON COLUMN public.setlist.group_ref IS 'Group that owns this setlist (nullable if user-owned).';
COMMENT ON COLUMN public.setlist.user_ref IS 'User that owns this setlist (nullable if group-owned).';
COMMENT ON COLUMN public.setlist.deleted IS 'Soft-delete flag for the setlist.';

COMMENT ON TABLE public.setlist_item IS 'Ordered items for a setlist; each item is either a tune or a tune set.';
COMMENT ON COLUMN public.setlist_item.setlist_ref IS 'Setlist that this item belongs to.';
COMMENT ON COLUMN public.setlist_item.item_kind IS 'Discriminator for whether the item references a tune or a tune set.';
COMMENT ON COLUMN public.setlist_item.position IS 'Zero-based position of the item within the setlist.';

-- ── Step 8: Add CHECK constraint for ownership (at least one owner) ───────
-- A setlist must have either group_ref or user_ref (or both)

ALTER TABLE public.setlist
  ADD CONSTRAINT setlist_ownership_check
  CHECK (group_ref IS NOT NULL OR user_ref IS NOT NULL);

-- ── Step 9: Recreate helper RPC ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.can_manage_group_setlists(
  p_group_id uuid,
  p_user_id uuid
) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT public.can_manage_group_sets(p_group_id, p_user_id);
$$;

GRANT EXECUTE ON FUNCTION public.can_manage_group_setlists(uuid, uuid) TO authenticated;

-- Keep old function name as a wrapper for backward compat (will be removed later)
CREATE OR REPLACE FUNCTION public.can_manage_group_programs(
  p_group_id uuid,
  p_user_id uuid
) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT public.can_manage_group_setlists(p_group_id, p_user_id);
$$;

GRANT EXECUTE ON FUNCTION public.can_manage_group_programs(uuid, uuid) TO authenticated;

-- ── Step 10: Recreate RLS policies ────────────────────────────────────────

ALTER TABLE public.setlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setlist_item ENABLE ROW LEVEL SECURITY;

-- Setlist SELECT: visible if user is member of the owning group
--   OR if user is the direct owner
CREATE POLICY "Users can view visible setlists" ON public.setlist
  FOR SELECT USING (
    (group_ref IS NOT NULL AND public.is_group_member(group_ref, auth.uid()))
    OR (user_ref = auth.uid())
  );

-- Setlist INSERT: group managers can create group setlists;
--   any authenticated user can create a personal setlist
CREATE POLICY "Users can insert setlists" ON public.setlist
  FOR INSERT WITH CHECK (
    (group_ref IS NOT NULL AND public.can_manage_group_setlists(group_ref, auth.uid()))
    OR (user_ref = auth.uid())
  );

-- Setlist UPDATE: group managers OR owning user
CREATE POLICY "Users can update setlists" ON public.setlist
  FOR UPDATE USING (
    (group_ref IS NOT NULL AND public.can_manage_group_setlists(group_ref, auth.uid()))
    OR (user_ref = auth.uid())
  )
  WITH CHECK (
    (group_ref IS NOT NULL AND public.can_manage_group_setlists(group_ref, auth.uid()))
    OR (user_ref = auth.uid())
  );

-- Setlist DELETE: group managers OR owning user
CREATE POLICY "Users can delete setlists" ON public.setlist
  FOR DELETE USING (
    (group_ref IS NOT NULL AND public.can_manage_group_setlists(group_ref, auth.uid()))
    OR (user_ref = auth.uid())
  );

-- Setlist item SELECT: visible if parent setlist is visible
CREATE POLICY "Users can view visible setlist items" ON public.setlist_item
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.setlist s
      WHERE s.id = setlist_ref
        AND (
          (s.group_ref IS NOT NULL AND public.is_group_member(s.group_ref, auth.uid()))
          OR (s.user_ref = auth.uid())
        )
    )
  );

-- Setlist item INSERT: same visibility + item-level validation
CREATE POLICY "Users can insert setlist items" ON public.setlist_item
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.setlist s
      WHERE s.id = setlist_ref
        AND (
          (s.group_ref IS NOT NULL AND public.can_manage_group_setlists(s.group_ref, auth.uid()))
          OR (s.user_ref = auth.uid())
        )
    )
    AND (
      (
        item_kind = 'tune'
        AND EXISTS (
          SELECT 1
          FROM public.tune t
          WHERE t.id = tune_ref
            AND t.private_for IS NULL
            AND t.deleted = FALSE
        )
      )
      OR (
        item_kind = 'tune_set'
        AND EXISTS (
          SELECT 1
          FROM public.tune_set ts
          WHERE ts.id = tune_set_ref
            AND ts.deleted = FALSE
            AND (
              ts.owner_user_ref = auth.uid()
              OR (
                ts.group_ref IS NOT NULL
                AND public.is_group_member(ts.group_ref, auth.uid())
              )
            )
        )
        AND NOT EXISTS (
          SELECT 1
          FROM public.tune_set_item tsi
          JOIN public.tune t ON t.id = tsi.tune_ref
          WHERE tsi.tune_set_ref = tune_set_ref
            AND tsi.deleted = FALSE
            AND (
              t.deleted = TRUE
              OR t.private_for IS NOT NULL
            )
        )
      )
    )
  );

-- Setlist item UPDATE: same as SELECT + item-level validation
CREATE POLICY "Users can update setlist items" ON public.setlist_item
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM public.setlist s
      WHERE s.id = setlist_ref
        AND (
          (s.group_ref IS NOT NULL AND public.can_manage_group_setlists(s.group_ref, auth.uid()))
          OR (s.user_ref = auth.uid())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.setlist s
      WHERE s.id = setlist_ref
        AND (
          (s.group_ref IS NOT NULL AND public.can_manage_group_setlists(s.group_ref, auth.uid()))
          OR (s.user_ref = auth.uid())
        )
    )
    AND (
      (
        item_kind = 'tune'
        AND EXISTS (
          SELECT 1
          FROM public.tune t
          WHERE t.id = tune_ref
            AND t.private_for IS NULL
            AND t.deleted = FALSE
        )
      )
      OR (
        item_kind = 'tune_set'
        AND EXISTS (
          SELECT 1
          FROM public.tune_set ts
          WHERE ts.id = tune_set_ref
            AND ts.deleted = FALSE
            AND (
              ts.owner_user_ref = auth.uid()
              OR (
                ts.group_ref IS NOT NULL
                AND public.is_group_member(ts.group_ref, auth.uid())
              )
            )
        )
        AND NOT EXISTS (
          SELECT 1
          FROM public.tune_set_item tsi
          JOIN public.tune t ON t.id = tsi.tune_ref
          WHERE tsi.tune_set_ref = tune_set_ref
            AND tsi.deleted = FALSE
            AND (
              t.deleted = TRUE
              OR t.private_for IS NOT NULL
            )
        )
      )
    )
  );

-- Setlist item DELETE
CREATE POLICY "Users can delete setlist items" ON public.setlist_item
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM public.setlist s
      WHERE s.id = setlist_ref
        AND (
          (s.group_ref IS NOT NULL AND public.can_manage_group_setlists(s.group_ref, auth.uid()))
          OR (s.user_ref = auth.uid())
        )
    )
  );

-- ── Step 11: Grant permissions on renamed tables ──────────────────────────

GRANT ALL ON TABLE public.setlist TO anon;
GRANT ALL ON TABLE public.setlist TO authenticated;
GRANT ALL ON TABLE public.setlist TO service_role;
GRANT ALL ON TABLE public.setlist_item TO anon;
GRANT ALL ON TABLE public.setlist_item TO authenticated;
GRANT ALL ON TABLE public.setlist_item TO service_role;

-- ── Step 12: Recreate sync RPC functions ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.sync_get_setlists(
  p_user_id uuid,
  p_after_timestamp timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 1000,
  p_offset integer DEFAULT 0
) RETURNS SETOF public.setlist
    LANGUAGE sql STABLE
    AS $$
  WITH changed_membership_group_ids AS (
    SELECT DISTINCT gm.group_ref
    FROM public.group_member gm
    WHERE gm.user_ref = p_user_id
      AND p_after_timestamp IS NOT NULL
      AND gm.last_modified_at > p_after_timestamp
  ),
  accessible_group_ids AS (
    SELECT ug.id
    FROM public.user_group ug
    WHERE ug.owner_user_ref = p_user_id

    UNION

    SELECT gm.group_ref
    FROM public.group_member gm
    WHERE gm.user_ref = p_user_id
      AND (
        gm.deleted = FALSE
        OR (p_after_timestamp IS NOT NULL AND gm.last_modified_at > p_after_timestamp)
      )
  )
  SELECT s.*
  FROM public.setlist s
  WHERE (
    s.group_ref IN (SELECT id FROM accessible_group_ids)
    OR s.user_ref = p_user_id
  )
    AND (
      p_after_timestamp IS NULL
      OR s.last_modified_at > p_after_timestamp
      OR s.group_ref IN (SELECT group_ref FROM changed_membership_group_ids)
    )
  ORDER BY s.last_modified_at ASC, s.id ASC
  LIMIT p_limit
  OFFSET p_offset;
$$;

GRANT ALL ON FUNCTION public.sync_get_setlists(uuid, timestamp with time zone, integer, integer) TO anon;
GRANT ALL ON FUNCTION public.sync_get_setlists(uuid, timestamp with time zone, integer, integer) TO authenticated;
GRANT ALL ON FUNCTION public.sync_get_setlists(uuid, timestamp with time zone, integer, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.sync_get_setlist_items(
  p_user_id uuid,
  p_genre_ids text[],
  p_after_timestamp timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 1000,
  p_offset integer DEFAULT 0
) RETURNS SETOF public.setlist_item
    LANGUAGE sql STABLE
    AS $$
  WITH changed_membership_group_ids AS (
    SELECT DISTINCT gm.group_ref
    FROM public.group_member gm
    WHERE gm.user_ref = p_user_id
      AND p_after_timestamp IS NOT NULL
      AND gm.last_modified_at > p_after_timestamp
  ),
  accessible_group_ids AS (
    SELECT ug.id
    FROM public.user_group ug
    WHERE ug.owner_user_ref = p_user_id

    UNION

    SELECT gm.group_ref
    FROM public.group_member gm
    WHERE gm.user_ref = p_user_id
      AND (
        gm.deleted = FALSE
        OR (p_after_timestamp IS NOT NULL AND gm.last_modified_at > p_after_timestamp)
      )
  )
  SELECT si.*
  FROM public.setlist_item si
  JOIN public.setlist s ON s.id = si.setlist_ref
  LEFT JOIN public.tune t ON t.id = si.tune_ref
  LEFT JOIN public.tune_set ts ON ts.id = si.tune_set_ref
  WHERE (
    s.group_ref IN (SELECT id FROM accessible_group_ids)
    OR s.user_ref = p_user_id
  )
    AND (
      (si.item_kind = 'tune'
        AND t.id IS NOT NULL
        AND t.deleted = FALSE
        AND t.private_for IS NULL
        AND t.genre = ANY (p_genre_ids)
      )
      OR (
        si.item_kind = 'tune_set'
        AND ts.id IS NOT NULL
        AND ts.deleted = FALSE
      )
    )
    AND (
      p_after_timestamp IS NULL
      OR si.last_modified_at > p_after_timestamp
      OR s.last_modified_at > p_after_timestamp
      OR s.group_ref IN (SELECT group_ref FROM changed_membership_group_ids)
    )
  ORDER BY si.last_modified_at ASC, si.id ASC
  LIMIT p_limit
  OFFSET p_offset;
$$;

GRANT ALL ON FUNCTION public.sync_get_setlist_items(uuid, text[], timestamp with time zone, integer, integer) TO anon;
GRANT ALL ON FUNCTION public.sync_get_setlist_items(uuid, text[], timestamp with time zone, integer, integer) TO authenticated;
GRANT ALL ON FUNCTION public.sync_get_setlist_items(uuid, text[], timestamp with time zone, integer, integer) TO service_role;

-- ── Step 13: Update sync_get_tune_sets to reference setlist ───────────────

CREATE OR REPLACE FUNCTION public.sync_get_tune_sets(
  p_user_id UUID,
  p_after_timestamp TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 1000,
  p_offset INTEGER DEFAULT 0
)
RETURNS SETOF public.tune_set
LANGUAGE sql
STABLE
AS $$
  WITH changed_membership_group_ids AS (
    SELECT DISTINCT gm.group_ref
    FROM public.group_member gm
    WHERE gm.user_ref = p_user_id
      AND p_after_timestamp IS NOT NULL
      AND gm.last_modified_at > p_after_timestamp
  ),
  accessible_group_ids AS (
    SELECT ug.id
    FROM public.user_group ug
    WHERE ug.owner_user_ref = p_user_id

    UNION

    SELECT gm.group_ref
    FROM public.group_member gm
    WHERE gm.user_ref = p_user_id
      AND (
        gm.deleted = FALSE
        OR (p_after_timestamp IS NOT NULL AND gm.last_modified_at > p_after_timestamp)
      )
  ),
  visible_setlist_tune_set_ids AS (
    SELECT DISTINCT si.tune_set_ref AS id
    FROM public.setlist_item si
    JOIN public.setlist s ON s.id = si.setlist_ref
    WHERE si.item_kind = 'tune_set'
      AND si.tune_set_ref IS NOT NULL
      AND (
        s.group_ref IN (SELECT id FROM accessible_group_ids)
        OR s.user_ref = p_user_id
      )
  ),
  changed_visible_setlist_tune_set_ids AS (
    SELECT DISTINCT si.tune_set_ref AS id
    FROM public.setlist_item si
    JOIN public.setlist s ON s.id = si.setlist_ref
    WHERE si.item_kind = 'tune_set'
      AND si.tune_set_ref IS NOT NULL
      AND (
        s.group_ref IN (SELECT id FROM accessible_group_ids)
        OR s.user_ref = p_user_id
      )
      AND (
        p_after_timestamp IS NULL
        OR si.last_modified_at > p_after_timestamp
        OR s.last_modified_at > p_after_timestamp
        OR s.group_ref IN (SELECT group_ref FROM changed_membership_group_ids)
      )
  )
  SELECT ts.*
  FROM public.tune_set ts
  WHERE (
      ts.owner_user_ref = p_user_id
      OR ts.group_ref IN (SELECT id FROM accessible_group_ids)
      OR ts.id IN (SELECT id FROM visible_setlist_tune_set_ids)
    )
    AND (
      p_after_timestamp IS NULL
      OR ts.last_modified_at > p_after_timestamp
      OR ts.group_ref IN (SELECT group_ref FROM changed_membership_group_ids)
      OR ts.id IN (SELECT id FROM changed_visible_setlist_tune_set_ids)
    )
  ORDER BY ts.last_modified_at ASC, ts.id ASC
  LIMIT p_limit
  OFFSET p_offset;
$$;

GRANT ALL ON FUNCTION public.sync_get_tune_sets(uuid, timestamp with time zone, integer, integer) TO anon;
GRANT ALL ON FUNCTION public.sync_get_tune_sets(uuid, timestamp with time zone, integer, integer) TO authenticated;
GRANT ALL ON FUNCTION public.sync_get_tune_sets(uuid, timestamp with time zone, integer, integer) TO service_role;

-- ── Step 14: Update sync_get_tune_set_items to reference setlist ──────────

CREATE OR REPLACE FUNCTION public.sync_get_tune_set_items(
  p_user_id UUID,
  p_genre_ids TEXT[],
  p_after_timestamp TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 1000,
  p_offset INTEGER DEFAULT 0
)
RETURNS SETOF public.tune_set_item
LANGUAGE sql
STABLE
AS $$
  WITH changed_membership_group_ids AS (
    SELECT DISTINCT gm.group_ref
    FROM public.group_member gm
    WHERE gm.user_ref = p_user_id
      AND p_after_timestamp IS NOT NULL
      AND gm.last_modified_at > p_after_timestamp
  ),
  accessible_group_ids AS (
    SELECT ug.id
    FROM public.user_group ug
    WHERE ug.owner_user_ref = p_user_id

    UNION

    SELECT gm.group_ref
    FROM public.group_member gm
    WHERE gm.user_ref = p_user_id
      AND (
        gm.deleted = FALSE
        OR (p_after_timestamp IS NOT NULL AND gm.last_modified_at > p_after_timestamp)
      )
  ),
  visible_setlist_tune_set_ids AS (
    SELECT DISTINCT si.tune_set_ref AS id
    FROM public.setlist_item si
    JOIN public.setlist s ON s.id = si.setlist_ref
    WHERE si.item_kind = 'tune_set'
      AND si.tune_set_ref IS NOT NULL
      AND (
        s.group_ref IN (SELECT id FROM accessible_group_ids)
        OR s.user_ref = p_user_id
      )
  )
  SELECT tsi.*
  FROM public.tune_set_item tsi
  JOIN public.tune_set ts ON ts.id = tsi.tune_set_ref
  JOIN public.tune t ON t.id = tsi.tune_ref
  WHERE (
      ts.owner_user_ref = p_user_id
      OR ts.group_ref IN (SELECT id FROM accessible_group_ids)
      OR ts.id IN (SELECT id FROM visible_setlist_tune_set_ids)
    )
    AND (
      (t.genre = ANY(p_genre_ids) AND t.private_for IS NULL)
      OR t.private_for = p_user_id
    )
    AND (
      p_after_timestamp IS NULL
      OR tsi.last_modified_at > p_after_timestamp
      OR ts.last_modified_at > p_after_timestamp
      OR ts.group_ref IN (SELECT group_ref FROM changed_membership_group_ids)
      OR ts.id IN (SELECT id FROM visible_setlist_tune_set_ids)
    )
    AND t.deleted = FALSE
  ORDER BY tsi.last_modified_at ASC, tsi.id ASC
  LIMIT p_limit
  OFFSET p_offset;
$$;

GRANT ALL ON FUNCTION public.sync_get_tune_set_items(uuid, text[], timestamp with time zone, integer, integer) TO anon;
GRANT ALL ON FUNCTION public.sync_get_tune_set_items(uuid, text[], timestamp with time zone, integer, integer) TO authenticated;
GRANT ALL ON FUNCTION public.sync_get_tune_set_items(uuid, text[], timestamp with time zone, integer, integer) TO service_role;

-- ── Step 15: Update sync_get_user_profiles to reference setlist ───────────

CREATE OR REPLACE FUNCTION public.sync_get_user_profiles(
  p_user_id UUID,
  p_genre_ids TEXT[],
  p_after_timestamp TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 1000,
  p_offset INTEGER DEFAULT 0
)
RETURNS SETOF public.user_profile
LANGUAGE sql
STABLE
AS $$
  WITH changed_membership_group_ids AS (
    SELECT DISTINCT gm.group_ref
    FROM public.group_member gm
    WHERE gm.user_ref = p_user_id
      AND p_after_timestamp IS NOT NULL
      AND gm.last_modified_at > p_after_timestamp
  ),
  accessible_group_ids AS (
    SELECT ug.id
    FROM public.user_group ug
    WHERE ug.owner_user_ref = p_user_id

    UNION

    SELECT gm.group_ref
    FROM public.group_member gm
    WHERE gm.user_ref = p_user_id
      AND (
        gm.deleted = FALSE
        OR (p_after_timestamp IS NOT NULL AND gm.last_modified_at > p_after_timestamp)
      )
  ),
  visible_author_ids AS (
    SELECT DISTINCT author_id
    FROM (
      SELECT n.user_ref AS author_id
      FROM public.note n
      JOIN public.tune t ON n.tune_ref = t.id
      WHERE (
        (t.genre = ANY(p_genre_ids) AND t.private_for IS NULL)
        OR t.private_for = p_user_id
      )
      AND (
        n.user_ref IS NULL
        OR n.user_ref = p_user_id
        OR COALESCE(n.public, false)
      )
      AND t.deleted = FALSE

      UNION

      SELECT r.user_ref AS author_id
      FROM public.reference r
      JOIN public.tune t ON r.tune_ref = t.id
      WHERE (
        (t.genre = ANY(p_genre_ids) AND t.private_for IS NULL)
        OR t.private_for = p_user_id
      )
      AND (
        r.user_ref IS NULL
        OR r.user_ref = p_user_id
        OR COALESCE(r.public, false)
      )
      AND t.deleted = FALSE
    ) visible_authors
    WHERE author_id IS NOT NULL
  ),
  changed_visible_author_ids AS (
    SELECT DISTINCT author_id
    FROM (
      SELECT n.user_ref AS author_id
      FROM public.note n
      JOIN public.tune t ON n.tune_ref = t.id
      WHERE (
        (t.genre = ANY(p_genre_ids) AND t.private_for IS NULL)
        OR t.private_for = p_user_id
      )
      AND (
        n.user_ref IS NULL
        OR n.user_ref = p_user_id
        OR COALESCE(n.public, false)
      )
      AND (
        p_after_timestamp IS NULL OR n.last_modified_at > p_after_timestamp
      )
      AND t.deleted = FALSE

      UNION

      SELECT r.user_ref AS author_id
      FROM public.reference r
      JOIN public.tune t ON r.tune_ref = t.id
      WHERE (
        (t.genre = ANY(p_genre_ids) AND t.private_for IS NULL)
        OR t.private_for = p_user_id
      )
      AND (
        r.user_ref IS NULL
        OR r.user_ref = p_user_id
        OR COALESCE(r.public, false)
      )
      AND (
        p_after_timestamp IS NULL OR r.last_modified_at > p_after_timestamp
      )
      AND t.deleted = FALSE
    ) changed_visible_authors
    WHERE author_id IS NOT NULL
  ),
  visible_group_profile_ids AS (
    SELECT DISTINCT profile_id
    FROM (
      SELECT ug.owner_user_ref AS profile_id
      FROM public.user_group ug
      WHERE ug.id IN (SELECT id FROM accessible_group_ids)

      UNION

      SELECT gm.user_ref AS profile_id
      FROM public.group_member gm
      WHERE gm.group_ref IN (SELECT id FROM accessible_group_ids)
    ) visible_group_profiles
    WHERE profile_id IS NOT NULL
  ),
  changed_visible_group_profile_ids AS (
    SELECT DISTINCT profile_id
    FROM (
      SELECT ug.owner_user_ref AS profile_id
      FROM public.user_group ug
      WHERE ug.id IN (SELECT id FROM accessible_group_ids)
        AND (
          p_after_timestamp IS NULL OR ug.last_modified_at > p_after_timestamp
        )

      UNION

      SELECT gm.user_ref AS profile_id
      FROM public.group_member gm
      WHERE gm.group_ref IN (SELECT id FROM accessible_group_ids)
        AND (
          p_after_timestamp IS NULL OR gm.last_modified_at > p_after_timestamp
        )

      UNION

      SELECT ug.owner_user_ref AS profile_id
      FROM public.user_group ug
      WHERE ug.id IN (SELECT group_ref FROM changed_membership_group_ids)
    ) changed_group_profiles
    WHERE profile_id IS NOT NULL
  ),
  visible_setlist_tune_set_owner_ids AS (
    SELECT DISTINCT ts.owner_user_ref AS profile_id
    FROM public.setlist_item si
    JOIN public.setlist s ON s.id = si.setlist_ref
    JOIN public.tune_set ts ON ts.id = si.tune_set_ref
    WHERE si.item_kind = 'tune_set'
      AND ts.owner_user_ref IS NOT NULL
      AND (
        s.group_ref IN (SELECT id FROM accessible_group_ids)
        OR s.user_ref = p_user_id
      )
  ),
  changed_setlist_tune_set_owner_ids AS (
    SELECT DISTINCT ts.owner_user_ref AS profile_id
    FROM public.setlist_item si
    JOIN public.setlist s ON s.id = si.setlist_ref
    JOIN public.tune_set ts ON ts.id = si.tune_set_ref
    WHERE si.item_kind = 'tune_set'
      AND ts.owner_user_ref IS NOT NULL
      AND (
        s.group_ref IN (SELECT id FROM accessible_group_ids)
        OR s.user_ref = p_user_id
      )
      AND (
        p_after_timestamp IS NULL
        OR si.last_modified_at > p_after_timestamp
        OR s.last_modified_at > p_after_timestamp
        OR ts.last_modified_at > p_after_timestamp
        OR s.group_ref IN (SELECT group_ref FROM changed_membership_group_ids)
      )
  ),
  candidate_ids AS (
    SELECT p_user_id AS id

    UNION

    SELECT author_id AS id
    FROM visible_author_ids

    UNION

    SELECT profile_id AS id
    FROM visible_group_profile_ids

    UNION

    SELECT profile_id AS id
    FROM visible_setlist_tune_set_owner_ids
  )
  SELECT up.*
  FROM public.user_profile up
  WHERE up.id IN (SELECT id FROM candidate_ids)
    AND (
      p_after_timestamp IS NULL
      OR up.last_modified_at > p_after_timestamp
      OR up.id IN (SELECT author_id FROM changed_visible_author_ids)
      OR up.id IN (SELECT profile_id FROM changed_visible_group_profile_ids)
      OR up.id IN (SELECT profile_id FROM changed_setlist_tune_set_owner_ids)
    )
  ORDER BY up.last_modified_at ASC, up.id ASC
  LIMIT p_limit
  OFFSET p_offset;
$$;

GRANT ALL ON FUNCTION public.sync_get_user_profiles(uuid, text[], timestamp with time zone, integer, integer) TO anon;
GRANT ALL ON FUNCTION public.sync_get_user_profiles(uuid, text[], timestamp with time zone, integer, integer) TO authenticated;
GRANT ALL ON FUNCTION public.sync_get_user_profiles(uuid, text[], timestamp with time zone, integer, integer) TO service_role;

-- ── Step 16: Create events table ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.event (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  event_date timestamptz,
  description text,
  setlist_ref uuid REFERENCES public.setlist(id) ON DELETE SET NULL,
  group_ref uuid REFERENCES public.user_group(id) ON DELETE CASCADE,
  user_ref uuid REFERENCES public.user_profile(id) ON DELETE CASCADE,
  deleted boolean DEFAULT false NOT NULL,
  created_at timestamp without time zone DEFAULT now() NOT NULL,
  sync_version integer DEFAULT 1 NOT NULL,
  last_modified_at timestamp without time zone DEFAULT now() NOT NULL,
  device_id text,
  CONSTRAINT event_pkey PRIMARY KEY (id),
  CONSTRAINT event_ownership_check CHECK (
    (group_ref IS NOT NULL AND user_ref IS NULL)
    OR (group_ref IS NULL AND user_ref IS NOT NULL)
    OR (group_ref IS NOT NULL AND user_ref IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_event_setlist_ref ON public.event USING btree (setlist_ref);
CREATE INDEX IF NOT EXISTS idx_event_group_ref ON public.event USING btree (group_ref);
CREATE INDEX IF NOT EXISTS idx_event_user_ref ON public.event USING btree (user_ref);
CREATE INDEX IF NOT EXISTS idx_event_event_date ON public.event USING btree (event_date);

COMMENT ON TABLE public.event IS 'Calendar-bound occurrences (gigs, sessions) that can reference a setlist.';
COMMENT ON COLUMN public.event.name IS 'Display name for the event (e.g., "Saturday Pub Gig").';
COMMENT ON COLUMN public.event.event_date IS 'Date and time of the event.';
COMMENT ON COLUMN public.event.setlist_ref IS 'Optional setlist associated with this event.';
COMMENT ON COLUMN public.event.group_ref IS 'Group that owns this event (if group-scoped).';
COMMENT ON COLUMN public.event.user_ref IS 'User that owns this event (if personal).';
COMMENT ON COLUMN public.event.deleted IS 'Soft-delete flag for the event.';

-- Event RLS: visible if user is member of owning group OR is the owning user
ALTER TABLE public.event ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view visible events" ON public.event
  FOR SELECT USING (
    (group_ref IS NOT NULL AND public.is_group_member(group_ref, auth.uid()))
    OR (user_ref = auth.uid())
  );

CREATE POLICY "Users can insert events" ON public.event
  FOR INSERT WITH CHECK (
    (group_ref IS NOT NULL AND public.can_manage_group_setlists(group_ref, auth.uid()))
    OR (user_ref = auth.uid())
  );

CREATE POLICY "Users can update events" ON public.event
  FOR UPDATE USING (
    (group_ref IS NOT NULL AND public.can_manage_group_setlists(group_ref, auth.uid()))
    OR (user_ref = auth.uid())
  )
  WITH CHECK (
    (group_ref IS NOT NULL AND public.can_manage_group_setlists(group_ref, auth.uid()))
    OR (user_ref = auth.uid())
  );

CREATE POLICY "Users can delete events" ON public.event
  FOR DELETE USING (
    (group_ref IS NOT NULL AND public.can_manage_group_setlists(group_ref, auth.uid()))
    OR (user_ref = auth.uid())
  );

GRANT ALL ON TABLE public.event TO anon;
GRANT ALL ON TABLE public.event TO authenticated;
GRANT ALL ON TABLE public.event TO service_role;

COMMIT;
