---
title: "ADR-0023: References are identifiers; no table carries a foreign key constraint"
adr_id: ADR-0023
status: Accepted
date: 2026-09-13
deciders: [product-owner, platform-architecture]
consulted: []
informed: []
supersedes: []
superseded_by: []
tags: [data, tenancy, security, architecture]
depends_on: [ADR-0011, ADR-0020, ADR-0021]
---

# ADR-0023: References are identifiers; no table carries a foreign key constraint

## Status

Accepted.

## Context

[ADR-0020](adr-0020-monorepo-with-enforced-service-boundaries.md) makes extracting a service a
matter of moving a directory, a schema and a deployment, and
[ADR-0011](adr-0011-tenant-isolation-shared-schema-rls.md)'s promotion path moves a single Tenant
to a dedicated database. The product owner has now ruled that no table carries a foreign key
constraint, so that schemas can be split into separate databases whenever that becomes necessary.
A foreign key binds the two tables it joins to one database, which is exactly what both moves have
to undo.

One document depends on foreign keys, and for isolation rather than tidiness.
[`multi-tenancy.md`](../10-architecture/multi-tenancy.md) section 6 answers
[`tool-authorization.md`](../40-governance/tool-authorization.md) rule TA2 — a capability grant must
not be creatable against another Tenant's Tool — with composite foreign keys carrying the tenant
identifier on both sides. Its reasoning holds: row-level security *filters*, and a plain foreign key
admits a cross-tenant row and discloses whether an identifier exists. Removing foreign keys therefore
needs a replacement that still forbids the row in the engine, because ADR-0011 does not accept
application code as the isolation boundary.

The audit side already works this way. `audit-model.md`, `policy-model.md` and the domain model
record identifiers and the values as they stood, never a foreign key a later deletion could null.

## Decision drivers

- A schema must be movable to its own database without dropping constraints first.
- A cross-tenant reference must stay impossible to write, enforced by PostgreSQL, not by a service.
- No existence oracle: a reference to another Tenant's record must fail exactly as a reference to one
  that does not exist.
- The rule must be checkable in CI, like every other isolation control.

## Considered options

1. **Composite foreign keys**, as `multi-tenancy.md` section 6 has them. Engine-enforced, but they tie
   tables to one database and disclose existence through the constraint error.
2. **No constraints; integrity in application code.** Movable, but a missed check writes a
   cross-tenant row, which ADR-0011 forbids.
3. **No foreign keys; tenant-scoped existence checks in row-level security write policies.** A
   policy's `WITH CHECK` clause requires the referenced row to exist, evaluated as the application
   role, so row-level security hides every other Tenant's rows from the check itself.

## Decision

**Option 3. No schema contains a `FOREIGN KEY` constraint. A reference is an identifier column.**

- **Keys stay tenant-qualified.** Every tenant-scoped table's primary key includes the tenant
  identifier, as `multi-tenancy.md` section 6 already requires.
- **A reference within a schema is checked by the write policy.** The referencing table's policy
  requires, in `WITH CHECK`, that its tenant identifier is the transaction's tenant *and* that a row
  with the same tenant identifier and the referenced identifier exists:

  ```sql
  CREATE POLICY tenant ON capability_grant
    USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
                AND EXISTS (SELECT 1 FROM tool t
                            WHERE t.tenant_id = capability_grant.tenant_id
                              AND t.id = capability_grant.tool_id));
  ```

  The subquery runs as the application role, and the referenced table's forced policy applies to it,
  so another Tenant's row is invisible to the check. The clause applies to `UPDATE` as well as
  `INSERT`, so an existing reference cannot be repointed across Tenants.
- **A reference across schemas is not checked in the database.** Rule B4 already forbids one service
  reading another's tables; the referring service holds the identifier and asks the owner through its
  contract.
- **Deletion never cascades.** With no constraint to cascade, removing a referenced record is a
  domain decision in the owning service — a state change rather than a row disappearing where
  references may remain — and a reference that outlives its referent is a case every reader handles.

**Checked against PostgreSQL 18.6** before being written, as the application role, on a schema
with no foreign key constraint at all:

| Case | Result |
| --- | --- |
| A Tenant grants its own Tool | Accepted |
| A Tenant grants another Tenant's Tool | Refused: `new row violates row-level security policy` |
| A Tenant grants a Tool that exists nowhere | Refused, with the identical error |
| A row claiming another Tenant | Refused |
| An existing grant repointed at another Tenant's Tool | Refused |
| An insert with no tenant context | Refused |

The second and third rows returning the same error is the oracle closed.

## Rationale

Option 1 is what the promotion path and service extraction have to dismantle, and its error message
is the existence oracle `multi-tenancy.md` warns about. Option 2 moves isolation into application
code. Option 3 keeps the protection in the engine, moves with the schema because the check lives in
the table's own policy, and reports a foreign and a missing referent identically.

## Consequences

### Positive

- Any schema can be moved to its own database, and any Tenant promoted, with no constraint to drop.
- A cross-tenant reference within a schema is still refused by PostgreSQL, and more quietly than a
  foreign key would refuse it.
- One mechanism — the forced row-level security policy — carries both isolation and referential
  checks, so the CI control that already inspects policies inspects both.

### Negative

- **Nothing stops a referent being deleted while references remain.** Every reference can dangle, so
  deletion is designed per record in the owning service, and every reader treats a missing referent
  as an expected case.
- Each reference adds a subquery to its table's write policy, which costs on every insert and update.
- A policy that forgets its existence clause silently permits a dangling or cross-tenant identifier.
  A foreign key could not be forgotten this way once declared.
- No database cascades; bulk removal is written explicitly.

### Neutral / follow-on work

- Rewrite `multi-tenancy.md` section 6 and the tenant-qualified-keys item of section 7 to this
  mechanism, and close the structure question in `tool-authorization.md` rule TA2.
- Extend the CI control of `multi-tenancy.md` section 5: fail on any `FOREIGN KEY` constraint in a
  service schema, and on a reference column whose table's write policy has no existence clause for
  it.
- Give each record type an explicit deletion model in its owning service.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| A write policy omits the existence clause for a reference | Medium | High | The CI control checks every reference column against its table's policy, and an isolation test writes a cross-tenant reference for each |
| A referent is deleted and references dangle | High | Medium | Deletion is a state change in the owning service; readers handle a missing referent |
| Policy subqueries slow writes at volume | Low | Medium | The referenced primary key is the lookup; measure before the first load test |

## Revisit criteria

Reopen if dangling references cause defects that a per-record deletion model cannot contain; if the
policy subqueries become a measured write bottleneck; or if schemas are confirmed never to leave one
database, in which case the constraints could return within a schema.

## References

- [ADR-0011](adr-0011-tenant-isolation-shared-schema-rls.md) — isolation below application code, and
  the promotion path
- [ADR-0020](adr-0020-monorepo-with-enforced-service-boundaries.md) — extraction, and rule B4
- [ADR-0021](adr-0021-postgresql-is-the-datastore.md) — the policy form and the application role
- [`../10-architecture/multi-tenancy.md`](../10-architecture/multi-tenancy.md) sections 5, 6 and 7
- [`../40-governance/tool-authorization.md`](../40-governance/tool-authorization.md) rule TA2
