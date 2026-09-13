-- migrate:up

-- Tenant User Management's tables (ADR-0021, ADR-0023, ADR-0024). Provisioning creates the schema and
-- four roles before this runs, as infra/compose/postgres/initdb does for the local stack:
--
--   tenant_user_management_owner          runs migrations and owns the tables
--   tenant_user_management_app            the service's connection: no bypass, owns nothing
--   tenant_user_management_identity_sync  records identity-provider attributes, and nothing else
--   tenant_user_management_linker         cannot log in; owns the linking functions, with a bypass
--
-- Every policy reads tenant context as NULLIF(current_setting('app.tenant_id', true), ''), so a
-- missing or reset setting matches no row (ADR-0021). No table carries a foreign key constraint
-- (ADR-0023): a reference is an identifier, checked by a write policy, or by the functions that are
-- the only way to write it.

-- The routing facts that identify a Tenant, readable before tenant context exists. It is exempt from
-- row-level security, so it holds nothing else (multi-tenancy.md section 7).
CREATE TABLE tenant_user_management.tenant_directory (
  tenant_id uuid PRIMARY KEY,
  status text NOT NULL CHECK (status IN ('active', 'suspended')),
  identity_provider_organization text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One row per human, with no tenant identifier: a Tenant sees a Person only through its own
-- Membership (ADR-0024). A verified subject is global; an asserted one belongs to the Tenant that
-- asserted it and carries no global attributes. There is deliberately no creation timestamp, because
-- a Tenant linking an existing Person would read in it that the person was already known elsewhere.
CREATE TABLE tenant_user_management.person (
  id uuid PRIMARY KEY,
  verification text NOT NULL CHECK (verification IN ('identity-provider', 'tenant-asserted')),
  subject text NOT NULL CHECK (btrim(subject) <> ''),
  asserting_tenant_id uuid,
  display_name text,
  email text,
  CHECK ((verification = 'tenant-asserted') = (asserting_tenant_id IS NOT NULL)),
  CHECK (verification = 'identity-provider' OR (display_name IS NULL AND email IS NULL))
);
CREATE UNIQUE INDEX person_verified_subject ON tenant_user_management.person (subject)
  WHERE verification = 'identity-provider';
CREATE UNIQUE INDEX person_asserted_subject ON tenant_user_management.person (asserting_tenant_id, subject)
  WHERE verification = 'tenant-asserted';

-- A Person's place in one Tenant.
CREATE TABLE tenant_user_management.membership (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  person_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, person_id)
);

-- An authenticated actor. A Platform User or an End User stands on a Membership, at most one of each
-- per Membership; a Service Account stands on none and has a name.
CREATE TABLE tenant_user_management.principal (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('platform-user', 'end-user', 'service-account')),
  membership_id uuid,
  name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, membership_id, kind),
  CHECK ((kind = 'service-account') = (membership_id IS NULL)),
  CHECK ((kind = 'service-account') = (name IS NOT NULL AND btrim(name) <> ''))
);

ALTER TABLE tenant_user_management.person ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_user_management.person FORCE ROW LEVEL SECURITY;
ALTER TABLE tenant_user_management.membership ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_user_management.membership FORCE ROW LEVEL SECURITY;
ALTER TABLE tenant_user_management.principal ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_user_management.principal FORCE ROW LEVEL SECURITY;

-- A Person is visible to the service while the current Tenant holds a Membership for it, and only then.
CREATE POLICY visible_through_membership ON tenant_user_management.person
  FOR SELECT TO tenant_user_management_app
  USING (EXISTS (
    SELECT 1 FROM tenant_user_management.membership m
     WHERE m.person_id = person.id
       AND m.tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  ));

-- Identity sync has no tenant context. It reads and updates verified Persons, and no others.
CREATE POLICY identity_sync_reads_verified ON tenant_user_management.person
  FOR SELECT TO tenant_user_management_identity_sync
  USING (verification = 'identity-provider');
CREATE POLICY identity_sync_updates_verified ON tenant_user_management.person
  FOR UPDATE TO tenant_user_management_identity_sync
  USING (verification = 'identity-provider')
  WITH CHECK (verification = 'identity-provider');

CREATE POLICY tenant ON tenant_user_management.membership
  FOR SELECT TO tenant_user_management_app
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY tenant ON tenant_user_management.principal
  FOR SELECT TO tenant_user_management_app
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- ADR-0023: a Principal names a Membership of its own Tenant. The lookup runs as the service's role,
-- so another Tenant's Membership is invisible to it and refused exactly as a missing one is.
CREATE POLICY tenant_insert ON tenant_user_management.principal
  FOR INSERT TO tenant_user_management_app
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND (membership_id IS NULL OR EXISTS (
      SELECT 1 FROM tenant_user_management.membership m
       WHERE m.tenant_id = principal.tenant_id AND m.id = principal.membership_id
    ))
  );

GRANT USAGE ON SCHEMA tenant_user_management
  TO tenant_user_management_app, tenant_user_management_identity_sync, tenant_user_management_linker;

-- Column lists rather than whole tables for Person, so a column added later is granted deliberately.
GRANT SELECT ON tenant_user_management.tenant_directory TO tenant_user_management_app;
GRANT SELECT (id, verification, subject, asserting_tenant_id, display_name, email)
  ON tenant_user_management.person TO tenant_user_management_app;
GRANT SELECT ON tenant_user_management.membership TO tenant_user_management_app;
GRANT SELECT, INSERT ON tenant_user_management.principal TO tenant_user_management_app;

GRANT SELECT (id, verification, subject, display_name, email), UPDATE (display_name, email)
  ON tenant_user_management.person TO tenant_user_management_identity_sync;

GRANT SELECT, INSERT ON tenant_user_management.person, tenant_user_management.membership
  TO tenant_user_management_linker;

-- The linking functions are created as the linker, so they run with its bypass. It may create them
-- here and nowhere else: its CREATE privilege is revoked again before this migration commits.
GRANT CREATE ON SCHEMA tenant_user_management TO tenant_user_management_linker;
SET ROLE tenant_user_management_linker;

-- Creates or reuses the Person for a subject the identity provider verified, and gives the current
-- Tenant a Membership for it. The result is the same whether or not the Person existed elsewhere.
CREATE FUNCTION tenant_user_management.link_verified_person(verified_subject text)
RETURNS TABLE (membership_id uuid, person_id uuid)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = tenant_user_management, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  current_tenant uuid := NULLIF(current_setting('app.tenant_id', true), '')::uuid;
  found_person uuid;
BEGIN
  IF current_tenant IS NULL THEN
    RAISE EXCEPTION 'no tenant context' USING ERRCODE = 'insufficient_privilege';
  END IF;
  INSERT INTO tenant_user_management.person (id, verification, subject)
    VALUES (gen_random_uuid(), 'identity-provider', verified_subject)
    ON CONFLICT DO NOTHING;
  SELECT p.id INTO found_person FROM tenant_user_management.person p
   WHERE p.verification = 'identity-provider' AND p.subject = verified_subject;
  INSERT INTO tenant_user_management.membership (tenant_id, id, person_id)
    VALUES (current_tenant, gen_random_uuid(), found_person)
    ON CONFLICT (tenant_id, person_id) DO NOTHING;
  RETURN QUERY
    SELECT m.id, m.person_id FROM tenant_user_management.membership m
     WHERE m.tenant_id = current_tenant AND m.person_id = found_person;
END
$$;

-- Creates or reuses the Person the current Tenant asserts, keyed by that Tenant and the subject, and
-- gives the Tenant a Membership for it. An asserted subject never reaches another Tenant's Person.
CREATE FUNCTION tenant_user_management.link_asserted_person(asserted_subject text)
RETURNS TABLE (membership_id uuid, person_id uuid)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = tenant_user_management, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  current_tenant uuid := NULLIF(current_setting('app.tenant_id', true), '')::uuid;
  found_person uuid;
BEGIN
  IF current_tenant IS NULL THEN
    RAISE EXCEPTION 'no tenant context' USING ERRCODE = 'insufficient_privilege';
  END IF;
  INSERT INTO tenant_user_management.person (id, verification, subject, asserting_tenant_id)
    VALUES (gen_random_uuid(), 'tenant-asserted', asserted_subject, current_tenant)
    ON CONFLICT DO NOTHING;
  SELECT p.id INTO found_person FROM tenant_user_management.person p
   WHERE p.verification = 'tenant-asserted'
     AND p.subject = asserted_subject
     AND p.asserting_tenant_id = current_tenant;
  INSERT INTO tenant_user_management.membership (tenant_id, id, person_id)
    VALUES (current_tenant, gen_random_uuid(), found_person)
    ON CONFLICT (tenant_id, person_id) DO NOTHING;
  RETURN QUERY
    SELECT m.id, m.person_id FROM tenant_user_management.membership m
     WHERE m.tenant_id = current_tenant AND m.person_id = found_person;
END
$$;

REVOKE ALL ON FUNCTION tenant_user_management.link_verified_person(text),
  tenant_user_management.link_asserted_person(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tenant_user_management.link_verified_person(text),
  tenant_user_management.link_asserted_person(text) TO tenant_user_management_app;

RESET ROLE;
REVOKE CREATE ON SCHEMA tenant_user_management FROM tenant_user_management_linker;

-- migrate:down

SET ROLE tenant_user_management_linker;
DROP FUNCTION tenant_user_management.link_asserted_person(text);
DROP FUNCTION tenant_user_management.link_verified_person(text);
RESET ROLE;

DROP TABLE tenant_user_management.principal;
DROP TABLE tenant_user_management.membership;
DROP TABLE tenant_user_management.person;
DROP TABLE tenant_user_management.tenant_directory;
