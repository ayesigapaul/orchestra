-- The database services will use, and a login role that exists only so smoke.sh can prove how the
-- pooler treats tenant context. The role is created as ADR-0021 requires of an application role:
-- not a superuser, unable to bypass row-level security, and owning nothing.
-- Local development only: the password is a throwaway value.
CREATE ROLE pooler_probe LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD 'pooler-probe-local-dev';
CREATE DATABASE orchestra;
GRANT CONNECT ON DATABASE orchestra TO pooler_probe;
