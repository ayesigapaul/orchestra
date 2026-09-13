-- migrate:up

-- RFC 9562's Nil UUID marks telemetry for work that belongs to no Tenant (ADR-0028), so no Tenant may
-- have it as its identifier. The directory is where every Tenant is created.
ALTER TABLE tenant_user_management.tenant_directory
  ADD CONSTRAINT tenant_directory_tenant_id_is_not_nil
  CHECK (tenant_id <> '00000000-0000-0000-0000-000000000000');

-- migrate:down

ALTER TABLE tenant_user_management.tenant_directory
  DROP CONSTRAINT tenant_directory_tenant_id_is_not_nil;
