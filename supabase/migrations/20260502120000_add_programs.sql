BEGIN;

CREATE TABLE IF NOT EXISTS public.program (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  group_ref uuid NOT NULL REFERENCES public.user_group(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  deleted boolean DEFAULT false NOT NULL,
  created_at timestamp without time zone DEFAULT now() NOT NULL,
  sync_version integer DEFAULT 1 NOT NULL,
  last_modified_at timestamp without time zone DEFAULT now() NOT NULL,
  device_id text,
  CONSTRAINT program_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_program_group_ref ON public.program USING btree (group_ref);

COMMENT ON TABLE public.program IS 'Ordered musical program listings owned by a group.';
COMMENT ON COLUMN public.program.group_ref IS 'Group that owns and manages this program.';
COMMENT ON COLUMN public.program.deleted IS 'Soft-delete flag for the program.';

CREATE TABLE IF NOT EXISTS public.program_item (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  program_ref uuid NOT NULL REFERENCES public.program(id) ON DELETE CASCADE,
  item_kind text NOT NULL,
  tune_ref uuid REFERENCES public.tune(id) ON DELETE CASCADE,
  tune_set_ref uuid REFERENCES public.tune_set(id) ON DELETE CASCADE,
  position integer NOT NULL,
  deleted boolean DEFAULT false NOT NULL,
  sync_version integer DEFAULT 1 NOT NULL,
  last_modified_at timestamp without time zone DEFAULT now() NOT NULL,
  device_id text,
  CONSTRAINT program_item_pkey PRIMARY KEY (id),
  CONSTRAINT program_item_kind_check CHECK (item_kind = ANY (ARRAY['tune'::text, 'tune_set'::text])),
  CONSTRAINT program_item_target_check CHECK (
    (item_kind = 'tune'::text AND tune_ref IS NOT NULL AND tune_set_ref IS NULL)
    OR (item_kind = 'tune_set'::text AND tune_ref IS NULL AND tune_set_ref IS NOT NULL)
  ),
  CONSTRAINT program_item_program_position_unique UNIQUE (program_ref, position),
  CONSTRAINT program_item_position_nonnegative CHECK (position >= 0)
);

CREATE INDEX IF NOT EXISTS idx_program_item_program_ref ON public.program_item USING btree (program_ref);
CREATE INDEX IF NOT EXISTS idx_program_item_tune_ref ON public.program_item USING btree (tune_ref);
CREATE INDEX IF NOT EXISTS idx_program_item_tune_set_ref ON public.program_item USING btree (tune_set_ref);

COMMENT ON TABLE public.program_item IS 'Ordered items for a program; each item is either a tune or a tune set.';
COMMENT ON COLUMN public.program_item.item_kind IS 'Discriminator for whether the item references a tune or a tune set.';
COMMENT ON COLUMN public.program_item.position IS 'Zero-based position of the item within the program.';

INSERT INTO public.program (
  id,
  group_ref,
  name,
  description,
  deleted,
  created_at,
  sync_version,
  last_modified_at,
  device_id
)
SELECT
  ts.id,
  ts.group_ref,
  ts.name,
  ts.description,
  ts.deleted,
  ts.created_at,
  ts.sync_version,
  ts.last_modified_at,
  ts.device_id
FROM public.tune_set ts
WHERE ts.set_kind = 'group_program'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.program_item (
  id,
  program_ref,
  item_kind,
  tune_ref,
  tune_set_ref,
  position,
  deleted,
  sync_version,
  last_modified_at,
  device_id
)
SELECT
  tsi.id,
  tsi.tune_set_ref,
  'tune',
  tsi.tune_ref,
  NULL,
  tsi.position,
  tsi.deleted,
  tsi.sync_version,
  tsi.last_modified_at,
  tsi.device_id
FROM public.tune_set_item tsi
JOIN public.tune_set ts ON ts.id = tsi.tune_set_ref
WHERE ts.set_kind = 'group_program'
ON CONFLICT (id) DO NOTHING;

DELETE FROM public.tune_set_item tsi
USING public.tune_set ts
WHERE ts.id = tsi.tune_set_ref
  AND ts.set_kind = 'group_program';

DELETE FROM public.tune_set
WHERE set_kind = 'group_program';

ALTER TABLE public.tune_set
  DROP CONSTRAINT IF EXISTS tune_set_kind_check;

ALTER TABLE public.tune_set
  ADD CONSTRAINT tune_set_kind_check CHECK (set_kind = ANY (ARRAY['practice_set'::text]));

COMMENT ON COLUMN public.tune_set.set_kind IS 'practice_set for ordered tune-set groupings.';
COMMENT ON TABLE public.tune_set_item IS 'Ordered membership rows for tune sets.';

CREATE OR REPLACE FUNCTION public.can_manage_group_programs(
  p_group_id uuid,
  p_user_id uuid
) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT public.can_manage_group_sets(p_group_id, p_user_id);
$$;

GRANT EXECUTE ON FUNCTION public.can_manage_group_programs(uuid, uuid) TO authenticated;

ALTER TABLE public.program ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_item ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view visible programs" ON public.program
  FOR SELECT USING (public.is_group_member(group_ref, auth.uid()));

CREATE POLICY "Group managers can insert programs" ON public.program
  FOR INSERT WITH CHECK (public.can_manage_group_programs(group_ref, auth.uid()));

CREATE POLICY "Group managers can update programs" ON public.program
  FOR UPDATE USING (public.can_manage_group_programs(group_ref, auth.uid()))
  WITH CHECK (public.can_manage_group_programs(group_ref, auth.uid()));

CREATE POLICY "Group managers can delete programs" ON public.program
  FOR DELETE USING (public.can_manage_group_programs(group_ref, auth.uid()));

CREATE POLICY "Users can view visible program items" ON public.program_item
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.program p
      WHERE p.id = program_ref
        AND public.is_group_member(p.group_ref, auth.uid())
    )
  );

CREATE POLICY "Group managers can insert program items" ON public.program_item
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.program p
      WHERE p.id = program_ref
        AND public.can_manage_group_programs(p.group_ref, auth.uid())
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

CREATE POLICY "Group managers can update program items" ON public.program_item
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM public.program p
      WHERE p.id = program_ref
        AND public.can_manage_group_programs(p.group_ref, auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.program p
      WHERE p.id = program_ref
        AND public.can_manage_group_programs(p.group_ref, auth.uid())
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

CREATE POLICY "Group managers can delete program items" ON public.program_item
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM public.program p
      WHERE p.id = program_ref
        AND public.can_manage_group_programs(p.group_ref, auth.uid())
    )
  );

GRANT ALL ON TABLE public.program TO anon;
GRANT ALL ON TABLE public.program TO authenticated;
GRANT ALL ON TABLE public.program TO service_role;
GRANT ALL ON TABLE public.program_item TO anon;
GRANT ALL ON TABLE public.program_item TO authenticated;
GRANT ALL ON TABLE public.program_item TO service_role;

CREATE OR REPLACE FUNCTION public.sync_get_programs(
  p_user_id uuid,
  p_after_timestamp timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 1000,
  p_offset integer DEFAULT 0
) RETURNS SETOF public.program
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
  SELECT p.*
  FROM public.program p
  WHERE p.group_ref IN (SELECT id FROM accessible_group_ids)
    AND (
      p_after_timestamp IS NULL
      OR p.last_modified_at > p_after_timestamp
      OR p.group_ref IN (SELECT group_ref FROM changed_membership_group_ids)
    )
  ORDER BY p.last_modified_at ASC, p.id ASC
  LIMIT p_limit
  OFFSET p_offset;
$$;

GRANT ALL ON FUNCTION public.sync_get_programs(uuid, timestamp with time zone, integer, integer) TO anon;
GRANT ALL ON FUNCTION public.sync_get_programs(uuid, timestamp with time zone, integer, integer) TO authenticated;
GRANT ALL ON FUNCTION public.sync_get_programs(uuid, timestamp with time zone, integer, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.sync_get_program_items(
  p_user_id uuid,
  p_genre_ids text[],
  p_after_timestamp timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 1000,
  p_offset integer DEFAULT 0
) RETURNS SETOF public.program_item
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
  SELECT pi.*
  FROM public.program_item pi
  JOIN public.program p ON p.id = pi.program_ref
  LEFT JOIN public.tune t ON t.id = pi.tune_ref
  LEFT JOIN public.tune_set ts ON ts.id = pi.tune_set_ref
  WHERE p.group_ref IN (SELECT id FROM accessible_group_ids)
    AND (
      (pi.item_kind = 'tune'
        AND t.id IS NOT NULL
        AND t.deleted = FALSE
        AND t.private_for IS NULL
        AND t.genre = ANY (p_genre_ids)
      )
      OR (
        pi.item_kind = 'tune_set'
        AND ts.id IS NOT NULL
        AND ts.deleted = FALSE
      )
    )
    AND (
      p_after_timestamp IS NULL
      OR pi.last_modified_at > p_after_timestamp
      OR p.last_modified_at > p_after_timestamp
      OR p.group_ref IN (SELECT group_ref FROM changed_membership_group_ids)
    )
  ORDER BY pi.last_modified_at ASC, pi.id ASC
  LIMIT p_limit
  OFFSET p_offset;
$$;

GRANT ALL ON FUNCTION public.sync_get_program_items(uuid, text[], timestamp with time zone, integer, integer) TO anon;
GRANT ALL ON FUNCTION public.sync_get_program_items(uuid, text[], timestamp with time zone, integer, integer) TO authenticated;
GRANT ALL ON FUNCTION public.sync_get_program_items(uuid, text[], timestamp with time zone, integer, integer) TO service_role;

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
  visible_program_tune_set_ids AS (
    SELECT DISTINCT pi.tune_set_ref AS id
    FROM public.program_item pi
    JOIN public.program p ON p.id = pi.program_ref
    WHERE pi.item_kind = 'tune_set'
      AND pi.tune_set_ref IS NOT NULL
      AND p.group_ref IN (SELECT id FROM accessible_group_ids)
  ),
  changed_visible_program_tune_set_ids AS (
    SELECT DISTINCT pi.tune_set_ref AS id
    FROM public.program_item pi
    JOIN public.program p ON p.id = pi.program_ref
    WHERE pi.item_kind = 'tune_set'
      AND pi.tune_set_ref IS NOT NULL
      AND p.group_ref IN (SELECT id FROM accessible_group_ids)
      AND (
        p_after_timestamp IS NULL
        OR pi.last_modified_at > p_after_timestamp
        OR p.last_modified_at > p_after_timestamp
        OR p.group_ref IN (SELECT group_ref FROM changed_membership_group_ids)
      )
  )
  SELECT ts.*
  FROM public.tune_set ts
  WHERE (
      ts.owner_user_ref = p_user_id
      OR ts.group_ref IN (SELECT id FROM accessible_group_ids)
      OR ts.id IN (SELECT id FROM visible_program_tune_set_ids)
    )
    AND (
      p_after_timestamp IS NULL
      OR ts.last_modified_at > p_after_timestamp
      OR ts.group_ref IN (SELECT group_ref FROM changed_membership_group_ids)
      OR ts.id IN (SELECT id FROM changed_visible_program_tune_set_ids)
    )
  ORDER BY ts.last_modified_at ASC, ts.id ASC
  LIMIT p_limit
  OFFSET p_offset;
$$;

GRANT ALL ON FUNCTION public.sync_get_tune_sets(uuid, timestamp with time zone, integer, integer) TO anon;
GRANT ALL ON FUNCTION public.sync_get_tune_sets(uuid, timestamp with time zone, integer, integer) TO authenticated;
GRANT ALL ON FUNCTION public.sync_get_tune_sets(uuid, timestamp with time zone, integer, integer) TO service_role;

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
  visible_program_tune_set_ids AS (
    SELECT DISTINCT pi.tune_set_ref AS id
    FROM public.program_item pi
    JOIN public.program p ON p.id = pi.program_ref
    WHERE pi.item_kind = 'tune_set'
      AND pi.tune_set_ref IS NOT NULL
      AND p.group_ref IN (SELECT id FROM accessible_group_ids)
  )
  SELECT tsi.*
  FROM public.tune_set_item tsi
  JOIN public.tune_set ts ON ts.id = tsi.tune_set_ref
  JOIN public.tune t ON t.id = tsi.tune_ref
  WHERE (
      ts.owner_user_ref = p_user_id
      OR ts.group_ref IN (SELECT id FROM accessible_group_ids)
      OR ts.id IN (SELECT id FROM visible_program_tune_set_ids)
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
      OR ts.id IN (SELECT id FROM visible_program_tune_set_ids)
    )
    AND t.deleted = FALSE
  ORDER BY tsi.last_modified_at ASC, tsi.id ASC
  LIMIT p_limit
  OFFSET p_offset;
$$;

GRANT ALL ON FUNCTION public.sync_get_tune_set_items(uuid, text[], timestamp with time zone, integer, integer) TO anon;
GRANT ALL ON FUNCTION public.sync_get_tune_set_items(uuid, text[], timestamp with time zone, integer, integer) TO authenticated;
GRANT ALL ON FUNCTION public.sync_get_tune_set_items(uuid, text[], timestamp with time zone, integer, integer) TO service_role;

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
  visible_program_tune_set_owner_ids AS (
    SELECT DISTINCT ts.owner_user_ref AS profile_id
    FROM public.program_item pi
    JOIN public.program p ON p.id = pi.program_ref
    JOIN public.tune_set ts ON ts.id = pi.tune_set_ref
    WHERE pi.item_kind = 'tune_set'
      AND ts.owner_user_ref IS NOT NULL
      AND p.group_ref IN (SELECT id FROM accessible_group_ids)
  ),
  changed_program_tune_set_owner_ids AS (
    SELECT DISTINCT ts.owner_user_ref AS profile_id
    FROM public.program_item pi
    JOIN public.program p ON p.id = pi.program_ref
    JOIN public.tune_set ts ON ts.id = pi.tune_set_ref
    WHERE pi.item_kind = 'tune_set'
      AND ts.owner_user_ref IS NOT NULL
      AND p.group_ref IN (SELECT id FROM accessible_group_ids)
      AND (
        p_after_timestamp IS NULL
        OR pi.last_modified_at > p_after_timestamp
        OR p.last_modified_at > p_after_timestamp
        OR ts.last_modified_at > p_after_timestamp
        OR p.group_ref IN (SELECT group_ref FROM changed_membership_group_ids)
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
    FROM visible_program_tune_set_owner_ids
  )
  SELECT up.*
  FROM public.user_profile up
  WHERE up.id IN (SELECT id FROM candidate_ids)
    AND (
      p_after_timestamp IS NULL
      OR up.last_modified_at > p_after_timestamp
      OR up.id IN (SELECT author_id FROM changed_visible_author_ids)
      OR up.id IN (SELECT profile_id FROM changed_visible_group_profile_ids)
      OR up.id IN (SELECT profile_id FROM changed_program_tune_set_owner_ids)
    )
  ORDER BY up.last_modified_at ASC, up.id ASC
  LIMIT p_limit
  OFFSET p_offset;
$$;

GRANT ALL ON FUNCTION public.sync_get_user_profiles(uuid, text[], timestamp with time zone, integer, integer) TO anon;
GRANT ALL ON FUNCTION public.sync_get_user_profiles(uuid, text[], timestamp with time zone, integer, integer) TO authenticated;
GRANT ALL ON FUNCTION public.sync_get_user_profiles(uuid, text[], timestamp with time zone, integer, integer) TO service_role;

COMMIT;