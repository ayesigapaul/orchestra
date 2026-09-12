---
title: "ADR-0022: A Tenant User Management service owns Tenants, Persons and Principals"
adr_id: ADR-0022
status: Accepted
date: 2026-09-13
deciders: [product-owner, platform-architecture]
consulted: []
informed: []
supersedes: []
superseded_by: []
tags: [tenancy, identity, architecture, services]
depends_on: [ADR-0011, ADR-0016, ADR-0017, ADR-0020, ADR-0021]
---

# ADR-0022: A Tenant User Management service owns Tenants, Persons and Principals

## Status

Accepted.

## Context

[`containers.md`](../10-architecture/containers.md) section 3 gives *Tenancy and Principals* to the
Control Plane API, together with definition authoring, Policy publish, the Tool Catalog, Model
Bindings, approvals and audit reads. Two facts make that the wrong home for these records.

First, **every authenticated request needs them before tenant context exists.** Gateway rule G7 in
[`gateway-api.md`](../30-protocol/gateway-api.md) resolves the Tenant from the presented credential,
and [ADR-0017](adr-0017-keycloak-for-identity.md) requires every credential to resolve to exactly one
Principal and one Tenant. `containers.md` section 8 calls the tenant directory an ordering problem
and leaves where it lives open, and `multi-tenancy.md` section 10 registers the same question. Under
[ADR-0020](adr-0020-monorepo-with-enforced-service-boundaries.md) rule B4 no service reads another's
tables, so whichever service owns these records is one the Gateway calls on every request. In the
Control Plane API, that would put the whole administrative API on the authentication path.

Second, **person data has no single home.** The domain model has Platform Users and End Users,
each a Principal subtype, but no record of the human behind them. A human's name and email would be
copied onto every Principal that refers to them, and again into any service that displays them —
the duplication the product owner has ruled out.

They are needed now: Phase 1 is the isolation floor, and its first tenant-scoped tables are these.

## Decision drivers

- A credential resolves to one Principal and one Tenant on every request, before tenant context
  exists, and a failed resolution must reject the request.
- One owner for records nearly every service refers to, so that B4 can be satisfied at all.
- A single source of truth for a person's attributes, without a record that spans Tenants, which
  invariant I1 and ADR-0011's row-level security do not allow.
- The administrative API should not sit on the Data Plane's authentication path.
- A hexagonal structure inside the service, so its core is reused across use cases and tested
  without infrastructure; across services, B5 still applies.
- Cheap to extract and to move, as ADR-0020 intends.

## Considered options

1. **The Control Plane API owns them**, as `containers.md` has it. The Gateway calls the
   administrative API on every request.
2. **The Gateway owns them.** No network hop for resolution, but a Data Plane container would hold
   administrative records the Control Plane writes, and the tables would move once the Control Plane
   API is built.
3. **A dedicated service owns them** — a small Control Plane container that the Gateway and the
   Control Plane API both call.
4. **Keycloak holds them.** Keycloak already stores Platform User identities, but End Users are
   asserted by the customer's backend and never exist in Keycloak, and ADR-0017 keeps Orchestra's
   authorization decisions and End User Session Tokens out of it.

## Decision

**Option 3. A service named Tenant User Management, in `services/tenant-user-management`, owns
Tenants, Workspaces, Persons and Principals.**

| Record | Scope | Row-level security |
| --- | --- | --- |
| Tenant directory: tenant identifier, status, Keycloak Organization, placement | Identifies a Tenant rather than belonging to one | Exempt — the structural exemption `multi-tenancy.md` section 5 names, holding routing facts only |
| Tenant profile: every other attribute of a Tenant | Tenant | Forced |
| Workspace | Tenant | Forced |
| Person | Tenant | Forced |
| Principal, with its subtypes Platform User, End User and Service Account | Tenant | Forced |

The Connector subtype joins when
[ADR-0007](adr-0007-outbound-connector-for-enterprise-reachability.md) binds. Administrative grants
are not included: their shape is registered as ADR-required in
[`identity-and-access.md`](../10-architecture/identity-and-access.md) section 12.

**One Person per Tenant is the single source of a human's attributes.** A Platform User and an End
User each refer to exactly one Person, and a Person has at most one of each. A Service Account and a
Connector are not people and refer to none. Actions still resolve to the Principal, never to the
Person, so invariant I2 is unchanged. The same human in two Tenants is two Persons: no record spans
Tenants, and correlating one human across them stays the identity provider's job, as
`identity-and-access.md` section 2 already holds. No other service stores a person's attributes; it
holds a Principal identifier and asks this service.

**Resolution is a contract, and it fails closed.** The Gateway resolves every presented credential to
exactly one Principal and one Tenant by calling this service through a versioned internal contract
documented in [`../30-protocol/`](../30-protocol/), as B3 requires. A resolution that is unavailable,
ambiguous or unmatched rejects the request; it never admits an unattributed one. The Control Plane
API calls the same service to administer tenancy and no longer owns these records.

**Structure.** TypeScript on the Node.js LTS line, since this is a Control Plane container and
[ADR-0016](adr-0016-compile-to-the-langgraph-library.md) puts the control plane in TypeScript.
HTTP is served with Hono, the option [`tech-stack.md`](../10-architecture/tech-stack.md) section 5
named for a second TypeScript service. The code is hexagonal: a domain core that imports no
framework, driver or SDK; the use cases and the ports they need; and adapters for HTTP, PostgreSQL
and Keycloak around them. Reuse happens inside the service. Across services, B5 stands.

**Storage.** Its own PostgreSQL schema and roles, per B4 and
[ADR-0021](adr-0021-postgresql-is-the-datastore.md): an owner role for migrations, and an application
role created `NOBYPASSRLS` that owns nothing. Tenant context is set with `SET LOCAL` inside each
transaction, and every tenant-scoped policy takes ADR-0021's `NULLIF` form.

## Rationale

Option 1 makes authentication depend on the largest container in the Control Plane, whose release
cadence is set by definition authoring and Policy work rather than by identity. Option 2 saves a hop
but gives a Data Plane container administrative records, and guarantees a later migration of live
identity data. Option 4 cannot hold End Users at all.

Option 3 makes the owner of the records exactly the thing both callers need, and nothing more. Its
interface is small — resolve a credential; administer Tenants, Workspaces, Persons and Principals —
so it can be kept fast, reasoned about for isolation, and extracted or moved without touching its
callers. Putting the Person in it settles duplication where the data is written, instead of asking
every other service to be disciplined about copies.

## Consequences

### Positive

- Where the tenant directory lives, registered in `multi-tenancy.md` section 10 and `containers.md`
  section 12, is answered.
- A human's attributes are written once per Tenant, and no other service can drift from them.
- The Control Plane API loses a responsibility, and authentication loses a dependency on it.
- Phase 1's first tenant-scoped tables have an owner, a schema and a role before they are written.

### Negative

- **A synchronous Data Plane dependency on a Control Plane container.** `containers.md` section 1
  allowed a synchronous dependency between the planes only where the durable Policy Decision write
  makes one; authentication is now a second. An outage of this service stops every authenticated
  request, deliberately, because resolution fails closed.
- A network hop on every request's authentication path. Caching in the Gateway is the obvious
  answer and carries its own risk — a revoked Principal or a suspended Tenant stays resolvable for as
  long as the cache holds it — so no cache lifetime is decided here.
- A second language in `services/`, with its own toolchain and CI job.
- Workspaces and Persons are modelled before any customer has asked for either.

### Neutral / follow-on work

- Specify the resolution contract in `30-protocol/`, including what the Gateway may cache and how
  revocation and suspension reach it.
- Decide how a Keycloak identity and Organization map to a Principal and a Tenant — ADR-0017's
  follow-on, whose mapping records now live here.
- Choose the migration tool, as ADR-0021's follow-on requires.
- Design how a Platform User is deprovisioned and what becomes of their grants, which
  `identity-and-access.md` section 3 leaves undesigned.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| The service is unavailable and authentication stops | Medium | High | Fail closed by design; its availability is engineered as an authentication-path property, not a Control Plane one |
| A cached resolution outlives a revocation or a Tenant suspension | Medium | High | The resolution contract fixes cache semantics and how revocation reaches the Gateway before any cache ships |
| The tenant directory accretes attributes and becomes an unfiltered copy of tenant data | Medium | High | Routing facts only; the CI control's exemption names that one table and nothing else |
| Another service starts storing names or emails for convenience | Medium | Medium | The single source of truth is stated here; review holds services to Principal identifiers |
| The service grows into a general administrative API | Low | Medium | Its scope is the records in the table above; everything else is the Control Plane API's |

## Revisit criteria

Reopen if resolution latency or availability on the authentication path cannot be met by a service
call with bounded caching — the next step would be replicating directory and resolution facts into
the Data Plane, an ADR of its own; if a customer requires one person record across Tenants, which
would also reopen ADR-0011's position on cross-tenant records; or if these records change together
with the Control Plane API so often that the separation costs more than it isolates.

## References

- [ADR-0011](adr-0011-tenant-isolation-shared-schema-rls.md) — row-level security, and why no record
  spans Tenants
- [ADR-0016](adr-0016-compile-to-the-langgraph-library.md) — TypeScript on the control plane side
- [ADR-0017](adr-0017-keycloak-for-identity.md) — an Organization per Tenant, and identity resolution
- [ADR-0020](adr-0020-monorepo-with-enforced-service-boundaries.md) — rules B3, B4 and B5
- [ADR-0021](adr-0021-postgresql-is-the-datastore.md) — schema, roles and the policy form
- [`../10-architecture/containers.md`](../10-architecture/containers.md) sections 1, 3, 8 and 12
- [`../30-protocol/gateway-api.md`](../30-protocol/gateway-api.md) rule G7
