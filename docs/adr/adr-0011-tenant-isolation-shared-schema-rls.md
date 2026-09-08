---
title: "ADR-0011: Tenant isolation by shared schema with row-level security"
adr_id: ADR-0011
status: Accepted
date: 2026-09-09
deciders: [product-owner, platform-architecture]
consulted: []
informed: []
supersedes: []
superseded_by: []
tags: [tenancy, security, data, architecture]
depends_on: [ADR-0001]
---

# ADR-0011: Tenant isolation by shared schema with row-level security

## Status

Accepted

## Context

[ADR-0001](adr-0001-product-shape-multi-tenant-saas.md) fixed Orchestra as a hosted multi-tenant
SaaS platform and made Tenant a first-class entity from the first commit. It deliberately did not
choose *how* tenants are isolated, recording that as a separate decision and naming
`10-architecture/multi-tenancy.md` as its home. That document cannot be written until this is
settled, and neither can deployment topologies.

Two constraints come from ADR-0001 and are not reopened here. Cross-tenant data leakage is
existential rather than merely serious. And isolation is to be enforced at the storage layer rather
than in application code — an application bug MUST NOT be sufficient on its own to cross a tenant
boundary.

The project is pre-implementation and pre-customer. No datastore has been chosen, no scale figure
exists, and no customer has stated a residency or dedicated-infrastructure requirement. Every
argument from volume or from buyer demand below is therefore an assumption, and is marked as one.

## Decision drivers

- Isolation must hold below the application. A missing `WHERE tenant_id = ?` must not be a breach.
- Nothing pre-customer justifies paying per-tenant infrastructure cost for a hypothetical buyer.
- An enterprise security review will ask what enforces isolation and what happens when a developer
  forgets. The answer must be structural.
- Some regulated buyers do ask for dedicated storage. Foreclosing that permanently would forfeit
  deals that the enterprise segment in [ADR-0002](adr-0002-enterprise-segment-and-byok.md) exists
  to win.
- Metering under [ADR-0009](adr-0009-meter-first-defer-tiering.md) and operational tooling need
  cross-tenant aggregation by the operator, which per-tenant databases make expensive.
- Decisions that stay cheap to reverse are preferred while every enterprise assumption is a guess.

## Considered options

1. **Shared schema, row-level security** — one logical database; every tenant-scoped row carries a
   tenant identifier; the engine filters.
2. **Schema-per-tenant** — one database, one namespace per Tenant.
3. **Database-per-tenant** — physical separation per Tenant.
4. **Tiered from day one** — shared by default, dedicated database as a paid option, both built now.

## Decision

Tenant isolation is by **shared schema with row-level security enforced by the datastore**.

- Every tenant-scoped table carries a non-nullable tenant identifier.
- Row-level security is enabled *and forced*, so it applies to the table owner as well. The
  application connects as a role that is neither superuser nor table owner and therefore cannot
  bypass it.
- The tenant context is set per transaction, and the mechanism MUST be safe under connection
  pooling: a pooled or multiplexed connection MUST NOT be able to carry one request's tenant
  context into another's.
- CI MUST fail if a tenant-scoped table exists without row-level security enabled and forced. This
  is the load-bearing control, not developer discipline.

**This constrains, but does not make, the datastore decision.** The engine chosen MUST enforce
row-level security itself. PostgreSQL is the obvious candidate and satisfies this, but no datastore
is selected here; that decision is still unmade and belongs in `10-architecture/`.

**The promotion path is part of the decision.** Schema, keys and data-access paths MUST be designed
so that a single Tenant can later be relocated to a dedicated database without a schema change and
without any change to a public contract. Nothing may assume that all tenants share one connection.

## Rationale

Option 1 is the only one of the four whose cost is proportional to what is known today. It puts
enforcement in the engine, which is what ADR-0001 asked for, and leaves one migration path, one
backup path and one connection pool to operate.

Options 2 and 3 buy a smaller blast radius with costs that are certain and immediate — migrations
fanned out across every namespace or database, catalog and connection pressure, provisioning on the
onboarding path, and cross-tenant aggregation becoming a distributed query — in exchange for a
benefit that is real but currently hypothetical, since no customer has asked for it.

Option 4 builds two isolation models, and therefore two sets of bugs, before a single customer has
requested the second.

The promotion path is what makes this cheap to reverse. A buyer who requires physically separate
storage is served by moving that Tenant, not by rebuilding the platform — provided nothing in the
code assumes a single shared connection. That assumption is easy to avoid now and expensive to
remove later, which is why it is part of this decision rather than a later concern.

## Consequences

### Positive

- One schema, one migration path, one backup and restore procedure.
- Onboarding a Tenant is an insert, not an infrastructure provisioning step.
- Operator-side aggregation for metering, quotas and support is an ordinary query.
- Isolation is enforced by the engine, which is a short and credible answer in a security review.

### Negative

- **A new tenant-scoped table without a policy is a cross-tenant exposure.** This is the single
  largest risk the choice carries, and it is why the CI check above is normative rather than
  advisory.
- Any path that connects as owner or superuser silently bypasses row-level security unless it is
  forced. Migration tooling and administrative scripts are the realistic offenders.
- Noisy-neighbour effects are shared. This decision provides no per-tenant resource isolation, and
  quota work under ADR-0006 does not substitute for it.
- A buyer requiring physically separate storage is not satisfied by the default and must be moved
  through the promotion path, which is designed for but not built.

### Neutral / follow-on work

- `10-architecture/multi-tenancy.md` specifies the tenant context mechanism, the CI control, and
  the promotion procedure. It is now unblocked.
- Per-tenant deletion for erasure requests is materially different from dropping a database and
  needs designing against the audit-retention obligations ADR-0001 raises.
- Whether per-tenant encryption keys apply to data at rest is not decided here. Note that
  ADR-0002 already requires per-tenant data keys for *credentials*, which is a narrower scope.
- The datastore decision remains open, constrained as stated above.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| A table ships without a row-level security policy | High | Existential | CI fails the build; the check is on the tenant-scoped table set, not a reviewer's memory |
| Migration or admin tooling connects as owner and bypasses policy | Medium | Existential | Force row-level security so ownership does not exempt; separate roles; audit privileged access paths |
| Tenant context leaks across a pooled connection | Medium | Existential | Set context per transaction; test explicitly against the pooler in use, not only against a direct connection |
| A design partner requires physically separate storage | Medium | Medium | Exercise the promotion path; the schema is built for it |
| Shared tables become operationally unwieldy at volume | Low | Medium | Unquantifiable pre-customer; revisit with real figures rather than guesses |

## Revisit criteria

Reopen if a cross-tenant incident is traced to row-level security rather than to a missing policy;
if measured tenant count or data volume makes shared tables operationally unworkable; or if the
segment turns out to require physically separate storage as a routine contractual condition rather
than an exception. A single buyer asking for dedicated storage is not a reason to reopen — it is
what the promotion path is for.

## References

- [ADR-0001](adr-0001-product-shape-multi-tenant-saas.md) — multi-tenant SaaS; isolation deferred
  to this decision
- [ADR-0002](adr-0002-enterprise-segment-and-byok.md) — per-tenant data keys for credential custody
- [ADR-0009](adr-0009-meter-first-defer-tiering.md) — metering needs operator-side aggregation
