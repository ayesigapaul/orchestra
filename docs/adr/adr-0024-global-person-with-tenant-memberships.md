---
title: "ADR-0024: One global Person per human, with a Membership per Tenant"
adr_id: ADR-0024
status: Accepted
date: 2026-09-13
deciders: [product-owner, platform-architecture]
consulted: []
informed: []
supersedes: [ADR-0022]
superseded_by: []
tags: [tenancy, identity, security, architecture, services]
depends_on: [ADR-0011, ADR-0016, ADR-0017, ADR-0020, ADR-0021, ADR-0023]
---

# ADR-0024: One global Person per human, with a Membership per Tenant

## Status

Accepted. Supersedes [ADR-0022](adr-0022-tenant-user-management-owns-tenancy.md), whose service
ownership, fail-closed resolution and structure this record carries forward unchanged. What it
replaces is the person model: ADR-0022 held one Person per Tenant.

## Context

ADR-0022 gave Tenants, Workspaces, Persons and Principals to the Tenant User Management service and
made the Person tenant-scoped, so the same human in two Tenants was two Persons that nothing in
Orchestra joined. The product owner has reversed that: a human is to have **one global Person
record, with the Tenants they belong to attached as memberships**, because a single identity that
spans organisations is what future trust between them will rest on.

That collides with three positions the set holds, each for isolation reasons:

- Domain model invariant I1 puts a tenant identifier on every persisted record and exempts nothing.
- [`identity-and-access.md`](../10-architecture/identity-and-access.md) section 2 holds that no
  record joins one human across Tenants, because such a record could not be read under a tenant
  predicate without a bypass.
- [`threat-model.md`](../40-governance/threat-model.md) T4 requires every tenant-scoped table to
  carry a tenant identifier under forced row-level security.

[ADR-0017](adr-0017-keycloak-for-identity.md) already models people this way: one realm, a Keycloak
user per human, and an Organization per Tenant that the user is a member of. A global Person mirrors
the identity provider rather than inventing a new shape.

The design was checked against PostgreSQL 18.6 before being written, and its first version failed in
a way that shaped the result: when two Tenants linked the same person, the second saw the name the
first had supplied. A global record whose attributes any Tenant can set lets one Tenant decide what
every other Tenant sees.

## Decision drivers

- One record per human across Tenants, as the basis for trust between organisations.
- Isolation still enforced by PostgreSQL rather than by the service: a Tenant must not see a person,
  or a person's other memberships, without a Membership of its own.
- No Tenant may create, claim or alter what another Tenant sees about a person.
- Trust may rest only on identity Orchestra has verified, never on what a Tenant asserts.
- Everything else ADR-0022 decided still holds.

## Considered options

1. **Keep one Person per Tenant**, as ADR-0022 has it. Isolation stays simple, and no
   cross-organisation identity exists.
2. **A global Person table without row-level security**, read by the service on trust. Visibility
   would be enforced in application code, which ADR-0011 refuses.
3. **A global Person under forced row-level security** whose policy admits a row only through the
   current Tenant's Membership, written only through database functions, with global attributes taken
   only from the identity provider.

## Decision

**Option 3.**

**Carried forward from ADR-0022, unchanged.** Tenant User Management, in
`services/tenant-user-management`, owns the tenant directory, tenant profiles, Workspaces, Persons,
Memberships and Principals. The Gateway resolves every credential to exactly one Principal and one
Tenant by calling it through a versioned contract, and a resolution that is unavailable, ambiguous or
unmatched rejects the request. The service is TypeScript on Hono, hexagonal inside, with its own
schema, an owner role for migrations and a `NOBYPASSRLS` application role that owns nothing.

| Record | Scope | Row-level security |
| --- | --- | --- |
| Tenant directory | Identifies a Tenant | Exempt, holding routing facts only, as before |
| Person — one per human | Global: no tenant identifier | Forced; a row is visible only while the current Tenant has a Membership for it |
| Membership — a Person's place in one Tenant | Tenant | Forced |
| Principal — a Platform User or End User on a Membership, or a Service Account on none | Tenant | Forced |
| Tenant profile, Workspace | Tenant | Forced |

Every action still resolves to a tenant-scoped Principal, so invariant I2 and audit rule A1 are
unchanged. A Tenant sees its own Memberships and never learns which other Tenants a person belongs
to.

**Writes go through functions, never tables.** The application role has no `INSERT` on Person or
Membership and no `UPDATE` on Person. A Membership is created only by `SECURITY DEFINER` functions
owned by a dedicated `NOLOGIN` role that holds `BYPASSRLS` and owns nothing else. Each function reads
the Tenant from the transaction's context, refuses to run without one, and creates the Membership for
that Tenant only. None returns anything that differs by whether the person already existed
elsewhere.

**Two kinds of Person, and only one of them joins.**

- **Identity-provider** Persons are keyed by the subject Orchestra's identity provider verified. Two
  Tenants that link the same verified subject share one Person. This is the only way a Person spans
  Tenants.
- **Tenant-asserted** Persons, for End Users a customer's backend vouches for, are keyed by the
  asserted subject *and* the asserting Tenant. Two Tenants asserting the same subject get two
  Persons, and an asserted subject can never claim an identity-provider Person.

**Global attributes come only from the identity provider.** A Person's name and email are recorded
by an identity-sync role, which the application role cannot act as, from what the identity provider
holds. No Tenant's assertion becomes a global attribute. Anything a Tenant records about a person
within its own organisation belongs on the Membership.

**Checked against PostgreSQL 18.6**, as the application role, with no foreign key in the database:

| Case | Result |
| --- | --- |
| Tenant A links a verified subject | A sees the Person, carrying no attribute any Tenant supplied |
| Tenant B, with no Membership | Sees no Person |
| Tenant C, searching by the person's subject | No row |
| Tenant B links the same verified subject | One shared Person, carrying the identity provider's name |
| The application role sets global attributes | Refused |
| The application role inserts a Membership or edits a Person | Refused |
| Two Tenants assert the same End User subject | Two Persons |
| A Tenant asserts a verified person's subject | A separate tenant-asserted Person, not the verified one |
| Linking with no tenant context | Refused |

**What this amends.**

- Invariant I1 gains one exception: a Person carries no tenant identifier, and its visibility is
  derived from Memberships instead.
- `identity-and-access.md` section 2: a Person, not a Principal, is what joins one human across
  Tenants, and each Tenant sees it only through its own Membership.
- `threat-model.md` T4 and `multi-tenancy.md` sections 4, 5 and 7: the Person table's policy form,
  the linking role as a named privileged path, the CI control's treatment of both, and the Person
  store staying behind when a Tenant is promoted to its own database.
- [ADR-0023](adr-0023-no-foreign-key-constraints.md)'s rule that a reference is checked by its
  table's write policy is met here by the linking functions, since the application role cannot write
  those tables at all.

## Rationale

Option 1 cannot give the product owner a cross-organisation identity. Option 2 gives it at the price
ADR-0011 refuses: isolation in application code. Option 3 keeps the engine as the boundary. The
Person table's policy consults the Membership table, whose own policy is tenant-scoped, so what a
Tenant can see of the global table is exactly what it holds a Membership for, as PostgreSQL decides.
Routing every write through functions closes the two ways a global record leaks across Tenants:
linking an arbitrary Person by identifier, and one Tenant writing attributes another reads.
Restricting joining to verified identity is what makes the record worth trusting at all.

## Consequences

### Positive

- One Person per human across every Tenant, mirroring the identity provider's own model.
- Isolation is still decided by PostgreSQL, and each property in the table above is testable.
- No Tenant can shape what another sees about a person.
- Service ownership, resolution and structure carry over from ADR-0022 without change.

### Negative

- **A privileged path now exists by design.** The linking role holds `BYPASSRLS`. It cannot log in
  and owns only the functions, but a defect in one of them crosses Tenants, so the functions are as
  security-critical as the policies.
- **Personal data spans customers.** One record describes a human in every organisation they belong
  to. Erasing a Person reaches every Tenant, deleting a Tenant must not delete a Person who belongs
  elsewhere, and a Person left with no Membership is visible to nobody and must still be removed.
- **Promotion is no longer purely per Tenant.** The Person store is global, so a Tenant moved to its
  own database keeps its Memberships and reads Persons from the shared store.
- The same human signing in through two different customer identity providers is two Keycloak users,
  and so two Persons, unless the identity provider links them.
- More moving parts than ADR-0022: three roles, several functions, and a policy form the CI control
  has to learn.

### Neutral / follow-on work

- Rework the service's domain: a global Person, a Membership, and Principals built from a Membership.
- Specify how identity-provider attributes are synced, and by what.
- Design Person erasure and orphan removal across Tenants, against the audit-retention obligations
  `audit-model.md` holds open.
- Everything ADR-0022 listed as follow-on still stands: the resolution contract, the Keycloak
  mapping, the migration tool and Platform User deprovisioning.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| A linking function crosses Tenants through a defect | Low | Existential | Functions stay minimal, read the Tenant only from context, pin `search_path`, and every case above is an isolation test |
| A Tenant-asserted attribute becomes global | Medium | High | Only the identity-sync role writes Person attributes, and the application role cannot act as it |
| A Tenant learns a person's other Memberships | Low | High | Memberships are tenant-scoped under forced row-level security, and no function returns a cross-Tenant fact |
| An unverified identity is merged into a global Person | Medium | High | Only identity-provider subjects join; asserted subjects are keyed to their Tenant |
| Erasure of a global Person is mishandled | Medium | High | Designed as follow-on work before any customer data exists |

## Revisit criteria

Reopen if a buyer requires that no record about their people be shared with any other customer even
under engine-enforced visibility, which would return that Tenant, or all of them, to option 1; if a
linking function is ever found to have crossed Tenants; or if trust between organisations turns out
to need a verified identity other than the identity provider's.

## References

- [ADR-0022](adr-0022-tenant-user-management-owns-tenancy.md) — superseded; its service decision is
  carried forward
- [ADR-0011](adr-0011-tenant-isolation-shared-schema-rls.md) — isolation enforced by the engine
- [ADR-0017](adr-0017-keycloak-for-identity.md) — one realm, an Organization per Tenant
- [ADR-0021](adr-0021-postgresql-is-the-datastore.md) — roles and the policy form
- [ADR-0023](adr-0023-no-foreign-key-constraints.md) — references without foreign keys
- [`../10-architecture/identity-and-access.md`](../10-architecture/identity-and-access.md) section 2
- [`../10-architecture/multi-tenancy.md`](../10-architecture/multi-tenancy.md) sections 4, 5 and 7
- [`../40-governance/threat-model.md`](../40-governance/threat-model.md) T4
