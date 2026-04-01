-- Drop TuneTrees-owned objects from the public schema while preserving
-- extension-owned objects such as PostGIS artifacts.
DO $$
DECLARE
        drop_stmt text;
BEGIN
        FOR drop_stmt IN
                SELECT format('DROP VIEW IF EXISTS %I.%I CASCADE;', n.nspname, c.relname)
                    FROM pg_class c
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    LEFT JOIN pg_depend dep
                        ON dep.classid = 'pg_class'::regclass
                     AND dep.objid = c.oid
                     AND dep.deptype = 'e'
                 WHERE n.nspname = 'public'
                     AND c.relkind = 'v'
                     AND c.relname <> 'spatial_ref_sys'
                     AND dep.objid IS NULL
                 ORDER BY c.relname
        LOOP
                EXECUTE drop_stmt;
        END LOOP;

        FOR drop_stmt IN
                SELECT format('DROP MATERIALIZED VIEW IF EXISTS %I.%I CASCADE;', n.nspname, c.relname)
                    FROM pg_class c
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    LEFT JOIN pg_depend dep
                        ON dep.classid = 'pg_class'::regclass
                     AND dep.objid = c.oid
                     AND dep.deptype = 'e'
                 WHERE n.nspname = 'public'
                     AND c.relkind = 'm'
                     AND dep.objid IS NULL
                 ORDER BY c.relname
        LOOP
                EXECUTE drop_stmt;
        END LOOP;

        FOR drop_stmt IN
                SELECT format('DROP FOREIGN TABLE IF EXISTS %I.%I CASCADE;', n.nspname, c.relname)
                    FROM pg_class c
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    LEFT JOIN pg_depend dep
                        ON dep.classid = 'pg_class'::regclass
                     AND dep.objid = c.oid
                     AND dep.deptype = 'e'
                 WHERE n.nspname = 'public'
                     AND c.relkind = 'f'
                     AND dep.objid IS NULL
                 ORDER BY c.relname
        LOOP
                EXECUTE drop_stmt;
        END LOOP;

        FOR drop_stmt IN
                SELECT format('DROP TABLE IF EXISTS %I.%I CASCADE;', n.nspname, c.relname)
                    FROM pg_class c
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    LEFT JOIN pg_depend dep
                        ON dep.classid = 'pg_class'::regclass
                     AND dep.objid = c.oid
                     AND dep.deptype = 'e'
                 WHERE n.nspname = 'public'
                     AND c.relkind IN ('r', 'p')
                     AND c.relname <> 'spatial_ref_sys'
                     AND dep.objid IS NULL
                 ORDER BY c.relname
        LOOP
                EXECUTE drop_stmt;
        END LOOP;

        FOR drop_stmt IN
                SELECT format('DROP SEQUENCE IF EXISTS %I.%I CASCADE;', n.nspname, c.relname)
                    FROM pg_class c
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    LEFT JOIN pg_depend dep
                        ON dep.classid = 'pg_class'::regclass
                     AND dep.objid = c.oid
                     AND dep.deptype = 'e'
                 WHERE n.nspname = 'public'
                     AND c.relkind = 'S'
                     AND dep.objid IS NULL
                 ORDER BY c.relname
        LOOP
                EXECUTE drop_stmt;
        END LOOP;

        FOR drop_stmt IN
                SELECT format(
                                     'DROP %s IF EXISTS %I.%I(%s) CASCADE;',
                                     CASE p.prokind
                                             WHEN 'p' THEN 'PROCEDURE'
                                             WHEN 'a' THEN 'AGGREGATE'
                                             ELSE 'FUNCTION'
                                     END,
                                     n.nspname,
                                     p.proname,
                                     pg_get_function_identity_arguments(p.oid)
                             )
                    FROM pg_proc p
                    JOIN pg_namespace n ON n.oid = p.pronamespace
                    LEFT JOIN pg_depend dep
                        ON dep.classid = 'pg_proc'::regclass
                     AND dep.objid = p.oid
                     AND dep.deptype = 'e'
                 WHERE n.nspname = 'public'
                     AND dep.objid IS NULL
                 ORDER BY p.proname, pg_get_function_identity_arguments(p.oid)
        LOOP
                EXECUTE drop_stmt;
        END LOOP;

        FOR drop_stmt IN
                SELECT format('DROP DOMAIN IF EXISTS %I.%I CASCADE;', n.nspname, t.typname)
                    FROM pg_type t
                    JOIN pg_namespace n ON n.oid = t.typnamespace
                    LEFT JOIN pg_depend dep
                        ON dep.classid = 'pg_type'::regclass
                     AND dep.objid = t.oid
                     AND dep.deptype = 'e'
                 WHERE n.nspname = 'public'
                     AND t.typtype = 'd'
                     AND dep.objid IS NULL
                 ORDER BY t.typname
        LOOP
                EXECUTE drop_stmt;
        END LOOP;

        FOR drop_stmt IN
                SELECT format('DROP TYPE IF EXISTS %I.%I CASCADE;', n.nspname, t.typname)
                    FROM pg_type t
                    JOIN pg_namespace n ON n.oid = t.typnamespace
                    LEFT JOIN pg_class tc ON tc.oid = t.typrelid
                    LEFT JOIN pg_depend dep
                        ON dep.classid = 'pg_type'::regclass
                     AND dep.objid = t.oid
                     AND dep.deptype = 'e'
                 WHERE n.nspname = 'public'
                     AND t.typtype IN ('c', 'e', 'r', 'm')
                     AND (t.typtype <> 'c' OR tc.relkind = 'c')
                     AND dep.objid IS NULL
                 ORDER BY t.typname
        LOOP
                EXECUTE drop_stmt;
        END LOOP;
END $$;