-- The CI control multi-tenancy.md section 5 requires, read from the engine rather than from a list of
-- what is scoped (ADR-0011, ADR-0021, ADR-0023, ADR-0024). Run against a migrated database, it fails
-- on any of:
--
--   - a tenant-scoped table without row-level security enabled and forced, without tenant_id in its
--     primary key, without a policy, or with a policy that does not read tenant context as
--     NULLIF(current_setting('app.tenant_id', true), '')
--   - a foreign key constraint in a service schema
--   - a reference column the service's role can write, with no write policy whose EXISTS names it
--   - a service or identity-sync role that is a superuser, bypasses row-level security, or owns
--     anything
--   - a service's role that may use another service's schema (ADR-0020 rule B4)
--   - a linker role that can log in, or owns anything but functions
--   - a role other than a linker or a superuser that bypasses row-level security
--   - a global Person table the service's role can write, or that no policy admits through a
--     Membership of the current Tenant
--   - finding no tenant-scoped table at all, because a check that scans nothing is not a check
--
-- A service schema is one owned by a role named <service>_owner, never by a built-in pg_ role such as
-- pg_database_owner, which owns public. Every table in one is tenant-scoped unless the list below
-- exempts it, so a new table is scoped by omission. The list is reviewed like code.
DO $check$
DECLARE
  exempt constant text[] := ARRAY[
    -- Routing facts, read before tenant context exists (multi-tenancy.md section 7).
    'tenant_user_management.tenant_directory',
    -- Migration bookkeeping.
    'tenant_user_management.schema_migrations'
  ];
  -- ADR-0024: a Person carries no tenant identifier, and is checked by its own rules.
  global_persons constant text[] := ARRAY['tenant_user_management.person'];
  tenant_context constant text := 'NULLIF(current_setting(''app.tenant_id''::text, true), ''''::text)';
  problems text[] := '{}';
  scoped integer := 0;
  t record;
  p record;
  r record;
BEGIN
  FOR t IN
    SELECT c.oid, n.nspname || '.' || c.relname AS qualified, c.relrowsecurity AS enabled,
           c.relforcerowsecurity AS forced,
           regexp_replace(pg_get_userbyid(n.nspowner), '_owner$', '') || '_app' AS service_role
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relkind IN ('r', 'p')
       AND pg_get_userbyid(n.nspowner) LIKE '%\_owner'
       AND pg_get_userbyid(n.nspowner) NOT LIKE 'pg\_%'
  LOOP
    CONTINUE WHEN t.qualified = ANY (exempt);

    IF NOT (t.enabled AND t.forced) THEN
      problems := problems || format('%s: row-level security is not both enabled and forced', t.qualified);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = t.oid) THEN
      problems := problems || format('%s: has no policy', t.qualified);
    END IF;

    IF t.qualified = ANY (global_persons) THEN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policy
         WHERE polrelid = t.oid
           AND pg_get_expr(polqual, polrelid) LIKE '%membership%'
           AND pg_get_expr(polqual, polrelid) LIKE '%' || tenant_context || '%'
      ) THEN
        problems := problems || format('%s: no policy admits a row through a Membership of the current Tenant', t.qualified);
      END IF;
      IF has_any_column_privilege(t.service_role, t.oid, 'INSERT')
         OR has_any_column_privilege(t.service_role, t.oid, 'UPDATE') THEN
        problems := problems || format('%s: %s can write it, where only the linking functions may', t.qualified, t.service_role);
      END IF;
      CONTINUE;
    END IF;

    scoped := scoped + 1;

    IF NOT EXISTS (
      SELECT 1 FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey)
     WHERE i.indrelid = t.oid AND i.indisprimary AND a.attname = 'tenant_id'
    ) THEN
      problems := problems || format('%s: tenant_id is not in its primary key', t.qualified);
    END IF;

    FOR p IN
      SELECT polname, coalesce(pg_get_expr(polqual, polrelid), '') AS using_clause,
             coalesce(pg_get_expr(polwithcheck, polrelid), '') AS check_clause
        FROM pg_policy WHERE polrelid = t.oid
    LOOP
      IF p.using_clause NOT LIKE '%' || tenant_context || '%'
         AND p.check_clause NOT LIKE '%' || tenant_context || '%' THEN
        problems := problems || format('%s: policy %s does not read tenant context in the NULLIF form', t.qualified, p.polname);
      END IF;
    END LOOP;

    -- ADR-0023: a reference the service's role can write is checked by an EXISTS in a write policy.
    FOR r IN
      SELECT a.attname FROM pg_attribute a
       WHERE a.attrelid = t.oid AND a.attnum > 0 AND NOT a.attisdropped
         AND a.attname LIKE '%\_id' AND a.attname <> 'tenant_id'
    LOOP
      IF has_column_privilege(t.service_role, t.oid, r.attname, 'INSERT')
         OR has_column_privilege(t.service_role, t.oid, r.attname, 'UPDATE') THEN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policy
           WHERE polrelid = t.oid
             AND pg_get_expr(polwithcheck, polrelid) ~ ('EXISTS.*\m' || r.attname || '\M')
        ) THEN
          problems := problems || format('%s.%s: a writable reference with no EXISTS in a write policy', t.qualified, r.attname);
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  FOR r IN
    SELECT n.nspname || '.' || c.relname || ' (' || con.conname || ')' AS what
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE con.contype = 'f'
       AND pg_get_userbyid(n.nspowner) LIKE '%\_owner'
       AND pg_get_userbyid(n.nspowner) NOT LIKE 'pg\_%'
  LOOP
    problems := problems || format('%s: a foreign key constraint (ADR-0023)', r.what);
  END LOOP;

  FOR r IN
    SELECT oid, rolname, rolsuper, rolbypassrls FROM pg_roles
     WHERE rolname LIKE '%\_app' OR rolname LIKE '%\_identity\_sync'
  LOOP
    IF r.rolsuper OR r.rolbypassrls THEN
      problems := problems || format('role %s: is a superuser or bypasses row-level security', r.rolname);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class WHERE relowner = r.oid)
       OR EXISTS (SELECT 1 FROM pg_proc WHERE proowner = r.oid)
       OR EXISTS (SELECT 1 FROM pg_namespace WHERE nspowner = r.oid) THEN
      problems := problems || format('role %s: owns an object', r.rolname);
    END IF;
  END LOOP;

  -- ADR-0020 rule B4: a service's roles reach no other service's schema.
  FOR r IN
    SELECT roles.rolname, n.nspname
      FROM pg_roles roles
      CROSS JOIN pg_namespace n
     WHERE roles.rolname ~ '_(app|identity_sync|linker)$'
       AND pg_get_userbyid(n.nspowner) LIKE '%\_owner'
       AND pg_get_userbyid(n.nspowner) NOT LIKE 'pg\_%'
       AND regexp_replace(pg_get_userbyid(n.nspowner), '_owner$', '')
           <> regexp_replace(roles.rolname, '_(app|identity_sync|linker)$', '')
       AND has_schema_privilege(roles.oid, n.oid, 'USAGE')
  LOOP
    problems := problems || format('role %s: may use schema %s, which belongs to another service (ADR-0020 B4)', r.rolname, r.nspname);
  END LOOP;

  FOR r IN SELECT oid, rolname, rolcanlogin FROM pg_roles WHERE rolname LIKE '%\_linker' LOOP
    IF r.rolcanlogin THEN
      problems := problems || format('role %s: a linker can log in', r.rolname);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class WHERE relowner = r.oid)
       OR EXISTS (SELECT 1 FROM pg_namespace WHERE nspowner = r.oid) THEN
      problems := problems || format('role %s: a linker owns something other than functions', r.rolname);
    END IF;
  END LOOP;

  FOR r IN
    SELECT rolname FROM pg_roles
     WHERE rolbypassrls AND NOT rolsuper AND rolname NOT LIKE '%\_linker' AND rolname NOT LIKE 'pg\_%'
  LOOP
    problems := problems || format('role %s: bypasses row-level security, which only a linker may', r.rolname);
  END LOOP;

  IF scoped = 0 THEN
    problems := problems || 'no tenant-scoped table found: a check that scans nothing is not a check'::text;
  END IF;

  IF cardinality(problems) > 0 THEN
    RAISE EXCEPTION E'row-level security control failed:\n  %', array_to_string(problems, E'\n  ');
  END IF;
  RAISE NOTICE 'row-level security control passed: % tenant-scoped table(s), % exemption(s)', scoped, cardinality(exempt);
END
$check$;
