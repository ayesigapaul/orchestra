---
title: "ADR-0021: PostgreSQL is the datastore"
adr_id: ADR-0021
status: Accepted
date: 2026-09-13
deciders: [product-owner, platform-architecture]
consulted: []
informed: []
supersedes: []
superseded_by: []
tags: [data, tenancy, security, architecture]
depends_on: [ADR-0011]
---

# ADR-0021: PostgreSQL is the datastore

## Status

Accepted.

## Context

[ADR-0011](adr-0011-tenant-isolation-shared-schema-rls.md) fixed tenant isolation as a shared schema
with row-level security enforced by the datastore, and deliberately selected no engine: PostgreSQL
was "the obvious candidate", but the decision was left unmade. Two registers still carry it as an
open question that needs an ADR —
[`multi-tenancy.md`](../10-architecture/multi-tenancy.md) section 10, and
[`threat-model.md`](../40-governance/threat-model.md) section 14, which notes that every T4 control
depends on it.

Meanwhile three accepted decisions have been built on PostgreSQL without that choice being
recorded. [ADR-0016](adr-0016-compile-to-the-langgraph-library.md) pins the PostgreSQL checkpointer,
[ADR-0019](adr-0019-postgres-run-supervisor.md) puts the run supervisor's queue in the same database
as run state, and [ADR-0020](adr-0020-monorepo-with-enforced-service-boundaries.md) gives each
service its own PostgreSQL schema and role. The local stack already runs PostgreSQL. The decision is
being made in practice; this record makes it explicitly, and against the requirements
`multi-tenancy.md` sets rather than by momentum.

It is needed now because Phase 1 of implementation is the isolation floor — forced row-level
security, the CI control over tenant-scoped tables, and the two-Tenant test through the pooler — and
none of that can be written without an engine.

## Decision drivers

- `multi-tenancy.md` sections 2 to 5 state capabilities, not a product. The engine must enforce
  row-level security itself, force it so ownership does not exempt, admit an application role that
  neither owns the tables nor holds an attribute bypassing the policy, scope session context to a
  transaction, and let an unset context deny.
- The CI control of section 5 must enumerate every table, and assert every role's posture, from
  the engine's own catalog — never from a list someone maintains.
- One datastore for tenant data, run state, the supervisor's queue, the checkpointer and the audit
  trail keeps available the transactional enqueue ADR-0019 depends on and the shared transaction
  [`audit-model.md`](../40-governance/audit-model.md) describes.
- Keycloak and APISIX have just been added to operate. Nothing pre-customer justifies a distributed
  database as well.
- ADR-0011's promotion path already answers a Tenant that outgrows shared storage, so the engine
  does not have to answer it too.

## Considered options

1. **PostgreSQL** — native row-level security with forced policies, a role attribute that bypasses
   them and can be withheld, and transaction-scoped settings.
2. **A PostgreSQL-compatible distributed database** — CockroachDB or YugabyteDB, both of which
   document row-level security.
3. **A commercial engine with row-level security** — SQL Server security policies or Oracle Virtual
   Private Database.
4. **An engine without engine-enforced row-level security** — excluded by ADR-0011, and listed so
   the exclusion is visible.

## Decision

**PostgreSQL is the datastore, at the major version
[`tech-stack.md`](../10-architecture/tech-stack.md) section 1.1 pins — 18 today.**

The capabilities `multi-tenancy.md` requires have these PostgreSQL spellings, which are normative
for implementation:

| Requirement in `multi-tenancy.md` | PostgreSQL mechanism |
| --- | --- |
| Row-level security enforced by the engine | `ENABLE ROW LEVEL SECURITY` and a policy on every tenant-scoped table |
| Forced, so ownership does not exempt | `FORCE ROW LEVEL SECURITY` on the same tables |
| An application role that neither owns tables nor bypasses policy | A login role created `NOSUPERUSER NOBYPASSRLS`, owning nothing, granted only the DML it needs |
| Context scoped to a transaction | `SET LOCAL`, or `set_config(name, value, true)`, inside an explicit transaction |
| An unset context denies | Every policy compares against `NULLIF(current_setting(name, true), '')`, so a missing or reset setting yields NULL and matches no row |
| The CI control reads the engine, not a list | `pg_class.relrowsecurity` and `relforcerowsecurity`, `pg_policy`, and `pg_roles.rolsuper` and `rolbypassrls` |

**The `NULLIF` is not decoration.** A setting never defined on a connection reads as NULL, but
once a transaction that used `SET LOCAL` ends, the same setting reads as an empty string for the
rest of that connection's life. Under a pooler that connection is the next request's. Without
normalising both, the policy fails on a cast rather than filtering, and the failure mode depends on
connection history. Every spelling in the table, and that failure, was checked against PostgreSQL
18.6 when this record was written; the Phase 1 isolation test is what keeps it checked.

**The pooler is part of the mechanism.** Transaction-mode pooling is assumed, through PgBouncer at
the version `tech-stack.md` pins. Nothing may rely on session state beyond a transaction, and the
two-Tenant isolation test runs through the pooler, never around it.

**One logical datastore, many owners.** Each service owns a schema, and the roles for it, as ADR-0020
B4 requires. No service is granted another service's schema.

This record does not decide hosting or topology, which belong to the planned
`deployment-topologies.md`; the migration tool; or pool sizing.

## Rationale

Option 1 meets every requirement with mechanisms that are native, documented and long established.
It is also already the substrate of three accepted decisions, so choosing anything else would reopen
ADR-0016's checkpointer, ADR-0019's queue and ADR-0020's ownership model at the same time.

Option 2 buys horizontal write scaling and multi-region replication that nothing pre-customer needs,
at the cost of operating a distributed cluster beside Keycloak and APISIX. Its compatibility with
PostgreSQL is partial by design. **It is unverified** whether the checkpointer, the driver and the
supervisor's `SKIP LOCKED` queue behave identically on either, and that would have to be proven
before anything could depend on it. ADR-0011's promotion path already relieves a Tenant that
outgrows shared storage without changing engines.

Option 3 satisfies the isolation requirements, since both engines enforce row-level security, but
adds licence cost to every deployment, and the checkpointer ADR-0016 pins targets PostgreSQL.

Option 4 fails ADR-0011 outright.

## Consequences

### Positive

- Every control in `multi-tenancy.md` has a concrete spelling that can be implemented and asserted
  in CI, which is what Phase 1 needs.
- One engine, one backup path and one transaction boundary for tenant data, run state, the queue,
  checkpoints and audit.
- ADR-0016, ADR-0019 and ADR-0020 no longer rest on an unrecorded choice.
- Every major cloud provider offers PostgreSQL as a managed service, so the hosting question stays
  open rather than narrowed.

### Negative

- **Isolation now depends on PostgreSQL details that are easy to get subtly wrong.** `SET` in place
  of `SET LOCAL` carries context through the pooler; a policy without the `NULLIF` misbehaves on a
  reused connection; a role created as owner, as superuser or with `BYPASSRLS` bypasses every policy
  silently. These are why the CI control and the pooled two-Tenant test are mandatory, not advisory.
- Writes scale on a single primary. Vertical scaling and the promotion path are the answers, and
  neither is built.
- Concentrating every stateful concern on one engine concentrates load: queue churn, checkpoint
  writes and audit appends compete for the same I/O and autovacuum, as ADR-0019 already warns.
- Major upgrades recur. PostgreSQL 18 is supported until 2030-11-14, and the latest-stable rule
  moves the pin well before that.

### Neutral / follow-on work

- Implement Phase 1 against this record: a schema and roles per service, the policy form above, the
  CI control of `multi-tenancy.md` section 5 against the catalog, and the two-Tenant test through
  PgBouncer.
- Choose the migration tool. It runs as the owner role and never as the application role.
- Decide how prepared statements behave through the transaction-mode pooler — the pooler's own
  support, or preparation disabled in the driver — before the first load test.
- Where the tenant directory lives, listed in `multi-tenancy.md` section 10, is unblocked.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Context set with `SET` rather than `SET LOCAL` leaks across a pooled connection | Medium | Existential | One helper sets context for every transaction; the two-Tenant test runs through PgBouncer in transaction mode |
| A role is created as owner, superuser or with `BYPASSRLS` | Medium | Existential | The CI control asserts role posture from `pg_roles` as well as table posture |
| A policy mishandles a reset setting on a reused connection | Medium | High | One policy form with `NULLIF`; a test that queries on a connection whose previous transaction set another Tenant |
| Queue, checkpoint and audit load contend on one instance | Medium | Medium | ADR-0019's triggers; measure under concurrent Tenants before production load |
| A major version changes row-level security or setting semantics | Low | High | The CI control and the isolation test gate every version upgrade |

## Revisit criteria

Reopen if a cross-tenant incident is traced to PostgreSQL's row-level security itself rather than to
a missing or wrong policy; if write volume on a single primary bounds the product at a scale the
promotion path cannot relieve; or if a deployment target the business requires cannot run a
supported PostgreSQL major version. A preference for another engine is not a criterion.

## References

- [ADR-0011](adr-0011-tenant-isolation-shared-schema-rls.md) — the constraint this record satisfies
- [ADR-0016](adr-0016-compile-to-the-langgraph-library.md) — the checkpointer that targets PostgreSQL
- [ADR-0019](adr-0019-postgres-run-supervisor.md) — the supervisor's queue in the same database
- [ADR-0020](adr-0020-monorepo-with-enforced-service-boundaries.md) — a schema and role per service
- [`../10-architecture/multi-tenancy.md`](../10-architecture/multi-tenancy.md) sections 2 to 5 — the
  capabilities mapped above
- [`../40-governance/threat-model.md`](../40-governance/threat-model.md) section 8 — the T4 controls
  that depend on this
- [`../10-architecture/tech-stack.md`](../10-architecture/tech-stack.md) sections 1.1 and 3 — the
  pinned versions and the pooling rule
