BEGIN;

CREATE TABLE IF NOT EXISTS public.user_group (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_user_ref uuid NOT NULL REFERENCES public.user_profile(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  deleted boolean DEFAULT false NOT NULL,
  created_at timestamp without time zone DEFAULT now() NOT NULL,
  sync_version integer DEFAULT 1 NOT NULL,
  last_modified_at timestamp without time zone DEFAULT now() NOT NULL,
  device_id text,
  CONSTRAINT user_group_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_user_group_owner_user_ref ON public.user_group USING btree (owner_user_ref);

COMMENT ON TABLE public.user_group IS 'Collaborative groups for shared tune sets and setlists.';
COMMENT ON COLUMN public.user_group.owner_user_ref IS 'User who owns and administers the group.';
COMMENT ON COLUMN public.user_group.deleted IS 'Soft-delete flag for the group.';

CREATE TABLE IF NOT EXISTS public.group_member (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  group_ref uuid NOT NULL REFERENCES public.user_group(id) ON DELETE CASCADE,
  user_ref uuid NOT NULL REFERENCES public.user_profile(id) ON DELETE CASCADE,
  role text DEFAULT 'member'::text NOT NULL,
  deleted boolean DEFAULT false NOT NULL,
  joined_at timestamp without time zone DEFAULT now() NOT NULL,
  sync_version integer DEFAULT 1 NOT NULL,
  last_modified_at timestamp without time zone DEFAULT now() NOT NULL,
  device_id text,
  CONSTRAINT group_member_pkey PRIMARY KEY (id),
  CONSTRAINT group_member_group_user_unique UNIQUE (group_ref, user_ref),
  CONSTRAINT group_member_role_check CHECK (role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text]))
);

CREATE INDEX IF NOT EXISTS idx_group_member_group_ref ON public.group_member USING btree (group_ref);
CREATE INDEX IF NOT EXISTS idx_group_member_user_ref ON public.group_member USING btree (user_ref);

COMMENT ON TABLE public.group_member IS 'Membership rows and roles for collaborative groups.';
COMMENT ON COLUMN public.group_member.role IS 'Membership role within the group: owner, admin, or member.';
COMMENT ON COLUMN public.group_member.deleted IS 'Soft-delete flag for the membership row.';

CREATE TABLE IF NOT EXISTS public.tune_set (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_user_ref uuid REFERENCES public.user_profile(id) ON DELETE CASCADE,
  group_ref uuid REFERENCES public.user_group(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  set_kind text NOT NULL,
  deleted boolean DEFAULT false NOT NULL,
  created_at timestamp without time zone DEFAULT now() NOT NULL,
  sync_version integer DEFAULT 1 NOT NULL,
  last_modified_at timestamp without time zone DEFAULT now() NOT NULL,
  device_id text,
  CONSTRAINT tune_set_pkey PRIMARY KEY (id),
  CONSTRAINT tune_set_single_owner_scope CHECK ((owner_user_ref IS NULL) <> (group_ref IS NULL)),
  CONSTRAINT tune_set_kind_check CHECK (set_kind = ANY (ARRAY['practice_set'::text, 'group_setlist'::text]))
);

CREATE INDEX IF NOT EXISTS idx_tune_set_owner_user_ref ON public.tune_set USING btree (owner_user_ref);
CREATE INDEX IF NOT EXISTS idx_tune_set_group_ref ON public.tune_set USING btree (group_ref);
CREATE INDEX IF NOT EXISTS idx_tune_set_set_kind ON public.tune_set USING btree (set_kind);

COMMENT ON TABLE public.tune_set IS 'Ordered tune collections owned by a user or shared with a group.';
COMMENT ON COLUMN public.tune_set.set_kind IS 'practice_set for personal grouping, group_setlist for collaborative performance ordering.';
COMMENT ON COLUMN public.tune_set.deleted IS 'Soft-delete flag for the tune set.';

CREATE TABLE IF NOT EXISTS public.tune_set_item (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  tune_set_ref uuid NOT NULL REFERENCES public.tune_set(id) ON DELETE CASCADE,
  tune_ref uuid NOT NULL REFERENCES public.tune(id) ON DELETE CASCADE,
  position integer NOT NULL,
  deleted boolean DEFAULT false NOT NULL,
  sync_version integer DEFAULT 1 NOT NULL,
  last_modified_at timestamp without time zone DEFAULT now() NOT NULL,
  device_id text,
  CONSTRAINT tune_set_item_pkey PRIMARY KEY (id),
  CONSTRAINT tune_set_item_set_tune_unique UNIQUE (tune_set_ref, tune_ref),
  CONSTRAINT tune_set_item_set_position_unique UNIQUE (tune_set_ref, position),
  CONSTRAINT tune_set_item_position_nonnegative CHECK (position >= 0)
);

CREATE INDEX IF NOT EXISTS idx_tune_set_item_tune_set_ref ON public.tune_set_item USING btree (tune_set_ref);
CREATE INDEX IF NOT EXISTS idx_tune_set_item_tune_ref ON public.tune_set_item USING btree (tune_ref);

COMMENT ON TABLE public.tune_set_item IS 'Ordered membership rows for tune sets and group setlists.';
COMMENT ON COLUMN public.tune_set_item.position IS 'Zero-based position of the tune within the set.';

CREATE OR REPLACE FUNCTION public.is_group_member(
  p_group_id uuid,
  p_user_id uuid
) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_group ug
    WHERE ug.id = p_group_id
      AND (
        ug.owner_user_ref = p_user_id
        OR EXISTS (
          SELECT 1
          FROM public.group_member gm
          WHERE gm.group_ref = p_group_id
            AND gm.user_ref = p_user_id
            AND gm.deleted = FALSE
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_group_owner(
  p_group_id uuid,
  p_user_id uuid
) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_group ug
    WHERE ug.id = p_group_id
      AND ug.owner_user_ref = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_group_sets(
  p_group_id uuid,
  p_user_id uuid
) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_group ug
    WHERE ug.id = p_group_id
      AND ug.owner_user_ref = p_user_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.group_member gm
    WHERE gm.group_ref = p_group_id
      AND gm.user_ref = p_user_id
      AND gm.deleted = FALSE
      AND gm.role IN ('owner', 'admin')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_group_sets(uuid, uuid) TO authenticated;

ALTER TABLE public.user_group ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_member ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tune_set ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tune_set_item ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view groups they belong to" ON public.user_group
  FOR SELECT USING (public.is_group_member(id, auth.uid()));

CREATE POLICY "Users can insert own groups" ON public.user_group
  FOR INSERT WITH CHECK (owner_user_ref = auth.uid());

CREATE POLICY "Owners can update groups" ON public.user_group
  FOR UPDATE USING (owner_user_ref = auth.uid())
  WITH CHECK (owner_user_ref = auth.uid());

CREATE POLICY "Owners can delete groups" ON public.user_group
  FOR DELETE USING (owner_user_ref = auth.uid());

CREATE POLICY "Users can view group members for visible groups" ON public.group_member
  FOR SELECT USING (public.is_group_member(group_ref, auth.uid()));

CREATE POLICY "Group owners can insert members" ON public.group_member
  FOR INSERT WITH CHECK (public.is_group_owner(group_ref, auth.uid()));

CREATE POLICY "Group owners can update members" ON public.group_member
  FOR UPDATE USING (public.is_group_owner(group_ref, auth.uid()))
  WITH CHECK (public.is_group_owner(group_ref, auth.uid()));

CREATE POLICY "Group owners can delete members" ON public.group_member
  FOR DELETE USING (public.is_group_owner(group_ref, auth.uid()));

CREATE POLICY "Users can view visible tune sets" ON public.tune_set
  FOR SELECT USING (
    owner_user_ref = auth.uid()
    OR (group_ref IS NOT NULL AND public.is_group_member(group_ref, auth.uid()))
  );

CREATE POLICY "Users can insert personal or managed group tune sets" ON public.tune_set
  FOR INSERT WITH CHECK (
    (owner_user_ref = auth.uid() AND group_ref IS NULL)
    OR (
      owner_user_ref IS NULL
      AND group_ref IS NOT NULL
      AND public.can_manage_group_sets(group_ref, auth.uid())
    )
  );

CREATE POLICY "Users can update personal or managed group tune sets" ON public.tune_set
  FOR UPDATE USING (
    owner_user_ref = auth.uid()
    OR (group_ref IS NOT NULL AND public.can_manage_group_sets(group_ref, auth.uid()))
  )
  WITH CHECK (
    (owner_user_ref = auth.uid() AND group_ref IS NULL)
    OR (
      owner_user_ref IS NULL
      AND group_ref IS NOT NULL
      AND public.can_manage_group_sets(group_ref, auth.uid())
    )
  );

CREATE POLICY "Users can delete personal or managed group tune sets" ON public.tune_set
  FOR DELETE USING (
    owner_user_ref = auth.uid()
    OR (group_ref IS NOT NULL AND public.can_manage_group_sets(group_ref, auth.uid()))
  );

CREATE POLICY "Users can view tune set items for visible sets" ON public.tune_set_item
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.tune_set ts
      WHERE ts.id = tune_set_ref
        AND (
          ts.owner_user_ref = auth.uid()
          OR (ts.group_ref IS NOT NULL AND public.is_group_member(ts.group_ref, auth.uid()))
        )
    )
    AND EXISTS (
      SELECT 1
      FROM public.tune t
      WHERE t.id = tune_ref
        AND (t.private_for IS NULL OR t.private_for = auth.uid())
    )
  );

CREATE POLICY "Users can insert tune set items for managed sets" ON public.tune_set_item
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.tune_set ts
      WHERE ts.id = tune_set_ref
        AND (
          ts.owner_user_ref = auth.uid()
          OR (ts.group_ref IS NOT NULL AND public.can_manage_group_sets(ts.group_ref, auth.uid()))
        )
    )
    AND EXISTS (
      SELECT 1
      FROM public.tune t
      WHERE t.id = tune_ref
        AND (t.private_for IS NULL OR t.private_for = auth.uid())
    )
  );

CREATE POLICY "Users can update tune set items for managed sets" ON public.tune_set_item
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM public.tune_set ts
      WHERE ts.id = tune_set_ref
        AND (
          ts.owner_user_ref = auth.uid()
          OR (ts.group_ref IS NOT NULL AND public.can_manage_group_sets(ts.group_ref, auth.uid()))
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.tune_set ts
      WHERE ts.id = tune_set_ref
        AND (
          ts.owner_user_ref = auth.uid()
          OR (ts.group_ref IS NOT NULL AND public.can_manage_group_sets(ts.group_ref, auth.uid()))
        )
    )
    AND EXISTS (
      SELECT 1
      FROM public.tune t
      WHERE t.id = tune_ref
        AND (t.private_for IS NULL OR t.private_for = auth.uid())
    )
  );

CREATE POLICY "Users can delete tune set items for managed sets" ON public.tune_set_item
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM public.tune_set ts
      WHERE ts.id = tune_set_ref
        AND (
          ts.owner_user_ref = auth.uid()
          OR (ts.group_ref IS NOT NULL AND public.can_manage_group_sets(ts.group_ref, auth.uid()))
        )
    )
  );

GRANT ALL ON TABLE public.user_group TO anon;
GRANT ALL ON TABLE public.user_group TO authenticated;
GRANT ALL ON TABLE public.user_group TO service_role;
GRANT ALL ON TABLE public.group_member TO anon;
GRANT ALL ON TABLE public.group_member TO authenticated;
GRANT ALL ON TABLE public.group_member TO service_role;
GRANT ALL ON TABLE public.tune_set TO anon;
GRANT ALL ON TABLE public.tune_set TO authenticated;
GRANT ALL ON TABLE public.tune_set TO service_role;
GRANT ALL ON TABLE public.tune_set_item TO anon;
GRANT ALL ON TABLE public.tune_set_item TO authenticated;
GRANT ALL ON TABLE public.tune_set_item TO service_role;

CREATE OR REPLACE FUNCTION public.sync_get_user_groups(
  p_user_id uuid,
  p_after_timestamp timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_limit integer DEFAULT 1000,
  p_offset integer DEFAULT 0
) RETURNS SETOF public.user_group
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
  SELECT ug.*
  FROM public.user_group ug
  WHERE ug.id IN (SELECT id FROM accessible_group_ids)
    AND (
      p_after_timestamp IS NULL
      OR ug.last_modified_at > p_after_timestamp
      OR ug.id IN (SELECT group_ref FROM changed_membership_group_ids)
    )
  ORDER BY ug.last_modified_at ASC, ug.id ASC
  LIMIT p_limit
  OFFSET p_offset;
$$;

CREATE OR REPLACE FUNCTION public.sync_get_group_members(
  p_user_id uuid,
  p_after_timestamp timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_limit integer DEFAULT 1000,
  p_offset integer DEFAULT 0
) RETURNS SETOF public.group_member
    LANGUAGE sql STABLE
    AS $$
  WITH accessible_group_ids AS (
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
  SELECT gm.*
  FROM public.group_member gm
  WHERE gm.group_ref IN (SELECT id FROM accessible_group_ids)
    AND (
      p_after_timestamp IS NULL
      OR gm.last_modified_at > p_after_timestamp
    )
  ORDER BY gm.last_modified_at ASC, gm.id ASC
  LIMIT p_limit
  OFFSET p_offset;
$$;

CREATE OR REPLACE FUNCTION public.sync_get_tune_sets(
  p_user_id uuid,
  p_after_timestamp timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_limit integer DEFAULT 1000,
  p_offset integer DEFAULT 0
) RETURNS SETOF public.tune_set
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
  SELECT ts.*
  FROM public.tune_set ts
  WHERE (
      ts.owner_user_ref = p_user_id
      OR ts.group_ref IN (SELECT id FROM accessible_group_ids)
    )
    AND (
      p_after_timestamp IS NULL
      OR ts.last_modified_at > p_after_timestamp
      OR ts.group_ref IN (SELECT group_ref FROM changed_membership_group_ids)
    )
  ORDER BY ts.last_modified_at ASC, ts.id ASC
  LIMIT p_limit
  OFFSET p_offset;
$$;

CREATE OR REPLACE FUNCTION public.sync_get_tune_set_items(
  p_user_id uuid,
  p_genre_ids text[],
  p_after_timestamp timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_limit integer DEFAULT 1000,
  p_offset integer DEFAULT 0
) RETURNS SETOF public.tune_set_item
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
  SELECT tsi.*
  FROM public.tune_set_item tsi
  JOIN public.tune_set ts ON ts.id = tsi.tune_set_ref
  JOIN public.tune t ON t.id = tsi.tune_ref
  WHERE (
      ts.owner_user_ref = p_user_id
      OR ts.group_ref IN (SELECT id FROM accessible_group_ids)
    )
    AND (
      (t.genre = ANY(p_genre_ids) AND t.private_for IS NULL)
      OR t.private_for = p_user_id
    )
    AND (
      p_after_timestamp IS NULL
      OR tsi.last_modified_at > p_after_timestamp
      OR ts.group_ref IN (SELECT group_ref FROM changed_membership_group_ids)
    )
    AND t.deleted = FALSE
  ORDER BY tsi.last_modified_at ASC, tsi.id ASC
  LIMIT p_limit
  OFFSET p_offset;
$$;

GRANT ALL ON FUNCTION public.sync_get_user_groups(uuid, timestamp with time zone, integer, integer) TO anon;
GRANT ALL ON FUNCTION public.sync_get_user_groups(uuid, timestamp with time zone, integer, integer) TO authenticated;
GRANT ALL ON FUNCTION public.sync_get_user_groups(uuid, timestamp with time zone, integer, integer) TO service_role;
GRANT ALL ON FUNCTION public.sync_get_group_members(uuid, timestamp with time zone, integer, integer) TO anon;
GRANT ALL ON FUNCTION public.sync_get_group_members(uuid, timestamp with time zone, integer, integer) TO authenticated;
GRANT ALL ON FUNCTION public.sync_get_group_members(uuid, timestamp with time zone, integer, integer) TO service_role;
GRANT ALL ON FUNCTION public.sync_get_tune_sets(uuid, timestamp with time zone, integer, integer) TO anon;
GRANT ALL ON FUNCTION public.sync_get_tune_sets(uuid, timestamp with time zone, integer, integer) TO authenticated;
GRANT ALL ON FUNCTION public.sync_get_tune_sets(uuid, timestamp with time zone, integer, integer) TO service_role;
GRANT ALL ON FUNCTION public.sync_get_tune_set_items(uuid, text[], timestamp with time zone, integer, integer) TO anon;
GRANT ALL ON FUNCTION public.sync_get_tune_set_items(uuid, text[], timestamp with time zone, integer, integer) TO authenticated;
GRANT ALL ON FUNCTION public.sync_get_tune_set_items(uuid, text[], timestamp with time zone, integer, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.sync_get_user_profiles(
  p_user_id uuid,
  p_genre_ids text[],
  p_after_timestamp timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_limit integer DEFAULT 1000,
  p_offset integer DEFAULT 0
) RETURNS SETOF public.user_profile
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
  candidate_ids AS (
    SELECT p_user_id AS id
    WHERE p_after_timestamp IS NULL

    UNION

    SELECT author_id AS id
    FROM visible_author_ids
    WHERE p_after_timestamp IS NULL

    UNION

    SELECT profile_id AS id
    FROM visible_group_profile_ids
    WHERE p_after_timestamp IS NULL

    UNION

    SELECT p_user_id AS id
    WHERE p_after_timestamp IS NOT NULL

    UNION

    SELECT author_id AS id
    FROM visible_author_ids
    WHERE p_after_timestamp IS NOT NULL

    UNION

    SELECT profile_id AS id
    FROM visible_group_profile_ids
    WHERE p_after_timestamp IS NOT NULL
  )
  SELECT up.*
  FROM public.user_profile up
  WHERE up.id IN (SELECT id FROM candidate_ids)
    AND (
      p_after_timestamp IS NULL
      OR up.last_modified_at > p_after_timestamp
      OR up.id IN (SELECT author_id FROM changed_visible_author_ids)
      OR up.id IN (SELECT profile_id FROM changed_visible_group_profile_ids)
    )
  ORDER BY up.last_modified_at ASC, up.id ASC
  LIMIT p_limit
  OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION public.sync_get_user_profiles(uuid, text[], timestamp with time zone, integer, integer) TO authenticated;

COMMIT;