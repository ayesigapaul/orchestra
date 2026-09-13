-- The schema and roles Tenant User Management's migrations expect (ADR-0021, ADR-0024). Creating a
-- role needs a superuser, so provisioning creates these, and the service's own migrations create
-- everything inside the schema. Local development only: every password is a throwaway value.

-- Runs the migrations and owns the tables. Forced row-level security binds it like any other role.
CREATE ROLE tenant_user_management_owner LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE
  PASSWORD 'tenant-user-management-owner-local-dev';

-- The service's own connection: no bypass, owns nothing, and granted only the statements it needs.
CREATE ROLE tenant_user_management_app LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE
  PASSWORD 'tenant-user-management-app-local-dev';

-- Records the name and email the identity provider holds for a verified Person, and nothing else.
CREATE ROLE tenant_user_management_identity_sync LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE
  PASSWORD 'tenant-user-management-identity-sync-local-dev';

-- Owns the linking functions, which run with its bypass so they can find a Person another Tenant
-- already linked. It cannot log in, and owns nothing else.
CREATE ROLE tenant_user_management_linker NOLOGIN NOSUPERUSER BYPASSRLS NOCREATEDB NOCREATEROLE;

-- The owner creates the linking functions as the linker. It may become the linker to do that, and
-- never inherits the bypass otherwise.
GRANT tenant_user_management_linker TO tenant_user_management_owner WITH INHERIT FALSE, SET TRUE;

GRANT CONNECT ON DATABASE orchestra
  TO tenant_user_management_owner, tenant_user_management_app, tenant_user_management_identity_sync;

\connect orchestra
CREATE SCHEMA tenant_user_management AUTHORIZATION tenant_user_management_owner;
