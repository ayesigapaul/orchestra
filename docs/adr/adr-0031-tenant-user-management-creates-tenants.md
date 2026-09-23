---
title: "ADR-0031: A Tenant is created by an internal Tenant User Management operation that only Orchestra's provisioning client may call, for a Platform Operator"
adr_id: ADR-0031
status: Accepted
date: 2026-09-13
deciders: [product-owner, platform-architecture]
consulted: []
informed: []
supersedes: []
superseded_by: []
tags: [tenancy, identity, services, security]
depends_on: [ADR-0009, ADR-0011, ADR-0017, ADR-0024, ADR-0026, ADR-0027, ADR-0030, ADR-0032]
---

# ADR-0031: A Tenant is created by an internal Tenant User Management operation that only Orchestra's provisioning client may call, for a Platform Operator

## Status

Accepted.

## Context

Nothing creates a Tenant today. [`gateway-api.md`](../30-protocol/gateway-api.md) G7 resolves the
Tenant from the presented credential, so no caller of the Gateway contract can create the Tenant its
own credential presupposes, and section 5 gives the Tenant resource no create operation. Section 9
registers which surface provisions a Tenant as needing an ADR, because a route that runs before a
Tenant exists is the one [ADR-0011](adr-0011-tenant-isolation-shared-schema-rls.md)'s isolation
argument excludes. In the local stack, `infra/compose/seed-local-tenant.sh` writes the tenant
directory as the schema's owner, the privileged path
[`multi-tenancy.md`](../10-architecture/multi-tenancy.md) section 4 warns about, with no Principal
and no Audit Record.

Five facts bear on the choice.

- **Tenant User Management owns the tenant directory**
  ([ADR-0024](adr-0024-global-person-with-tenant-memberships.md)), and each Tenant maps to one
  Keycloak Organization ([ADR-0017](adr-0017-keycloak-for-identity.md)). Resolution accepts only an
  active Tenant that the credential's Organization names
  ([`credential-resolution.md`](../30-protocol/credential-resolution.md) CR4).
- **A call between services is authenticated as its caller**, and a callee never takes a Principal
  or a Tenant on its caller's word ([`http-conventions.md`](../30-protocol/http-conventions.md) HC17
  and HC18).
- **A person acting for Orchestra now has a Principal.**
  [ADR-0030](adr-0030-platform-operator-and-observed-conditions.md) makes operator access an act
  by a Platform Operator Principal of the Tenant it touches, recorded in that Tenant's trail.
- **A Person's name and email come only from the identity provider** (ADR-0024), and only a verified
  email is recorded ([`identity-and-access.md`](../10-architecture/identity-and-access.md)
  section 2).
- **Tenant User Management's Keycloak client can only read users** (identity-and-access section 2).
  In Keycloak 26.7.3, which the local stack pins, creating an Organization and inviting a person to
  one by email address both need the realm-management role `manage-organizations`, or
  `manage-realm`.

## Decision drivers

- Creating a Tenant is an attributed, audited act, like every other administrative act
  ([`audit-model.md`](../40-governance/audit-model.md) section 3).
- No public route exists before a Tenant does (ADR-0011, G7).
- The service that owns the tenant directory creates what is in it (ADR-0024).
- Onboarding a Tenant stays an insert, not an infrastructure step (ADR-0011).
- The identity provider supplies identity, never tenancy (ADR-0017, ADR-0024).
- A new Tenant reaches its own administrator without an operator holding a lasting role in it.
- Contracts are priced by hand ([ADR-0009](adr-0009-meter-first-defer-tiering.md)), so nothing needs
  self-serve signup.

## Considered options

1. **An internal Tenant User Management operation** that only Orchestra's provisioning client may
   call, for a Platform Operator.
2. **Public self-serve signup.**
3. **Scripts that write the directory as the schema's owner**, as the local stack does today.
4. **The Keycloak Organization first**, with the Tenant appearing on its first resolution.

## Decision

**Option 1.**

### The operation

Tenant User Management gains one internal operation, which creates a Tenant. It is not on the
Gateway contract, so G7 and the Tenant row of gateway-api section 5 stand: no caller of that
contract creates a Tenant.

- **Only Orchestra's provisioning client may call it.** The client authenticates with its own access
  token (HC17). Tenant User Management records which clients may create Tenants, as it records which
  may resolve credentials (CR2), and refuses any other with 403 `auth.forbidden`. Orchestra operates
  the client, and no Tenant holds or reaches it.
- **The client acts for a Platform Operator, and is never one.** A service is never the Principal of
  an action ([ADR-0026](adr-0026-services-call-over-http-and-publish-through-an-outbox.md)). The
  request carries the credential of the person acting for Orchestra, and Tenant User Management
  verifies it itself, as it verifies a credential it resolves (CR3). It refuses a person it does not
  record as an Orchestra operator, and that record is Orchestra's, never a Keycloak role (ADR-0017).
- **No Principal Token carries the act.** Tenant User Management is the only issuer of one
  ([ADR-0027](adr-0027-tenant-user-management-signs-principal-tokens.md)), and the Tenant a token
  would name does not exist until this operation creates it. HC18 is amended to say so: the
  Principal comes from a credential Tenant User Management verified, and the Tenant is the one it
  creates.
- **Creation is the one act a Platform Operator performs in a Tenant without a grant there.**
  ADR-0030 has a Platform Operator act in a Tenant only under an administrative grant with an end
  time, and no grant can exist in a Tenant before the Tenant does. The provisioning client and
  Orchestra's record of its operators authorize creation instead.

### What the operation creates

- The Tenant's record in the tenant directory.
- The Tenant's Keycloak Organization, which the directory records by alias (CR4).
- The acting person's Platform Operator Principal, in the new Tenant (ADR-0030).
- An invitation of the customer's first administrator to that Organization, below.
- The first Audit Record in the new Tenant's trail: the creation, attributed to that Platform
  Operator (audit-model A1 and A3).

A Tenant resolves only once its directory record, Organization, Platform Operator Principal and
first Audit Record exist. The operation accepts `Idempotency-Key` (HC19), and repeating a request
that failed part-way completes the creation rather than making a second Tenant, Organization or
invitation. A failure between the tenant directory and Keycloak is completed, never retried blindly.

### The first administrator

The creation request names the customer's first administrator by email address, and Tenant User
Management invites that address to the Tenant's Keycloak Organization.

- **Naming is the audited act.** The Platform Operator's naming of the address at creation is what
  grants the Tenant's administrator role, and it is recorded with the creation.
- **The first sign-in completes it, with no operator step.** When the person first signs in through
  the Organization with that address verified by the identity provider, they hold the Tenant's
  administrator role. That sign-in is a transition caused by an observed condition, recorded with
  its cause and no Principal (ADR-0030).
- **The invited address is not a Person attribute.** It is held with the invitation, and matched
  against the address the identity provider verified (ADR-0024): the local part exactly, and only
  the domain case-insensitively, as [RFC 5321](https://www.rfc-editor.org/rfc/rfc5321#section-2.4)
  section 2.4 treats them.
- **The role exists.** The role set
  [ADR-0032](adr-0032-administrative-grants-are-orchestra-defined-roles.md) leaves to
  `identity-and-access.md` contains the Tenant's administrator role.

How Tenant User Management observes the first sign-in is specification. Credential resolution
changes nothing ([`credential-resolution.md`](../30-protocol/credential-resolution.md) CR1), so
either the observation happens outside it or its specification amends that rule.

### Tenant User Management's Keycloak client

Beside `view-users`, the client gains the narrowest role that creates an Organization and invites a
person to it. In Keycloak 26.7.3 that is the realm-management role `manage-organizations`, never
`manage-realm`, which administers the whole realm. `manage-organizations` also updates and deletes
every Organization in the realm, and its members. Keycloak sends the invitation by email, so the
realm needs outgoing mail.

### The local stack

`seed-local-tenant.sh` keeps writing the directory as the schema's owner until the operation exists.
When the operation is built, the script calls it instead, and the owner-role write goes.

### What stays undecided

- The operation's specification: its path, members and codes, how the operator's credential and the
  first administrator's address travel, how Tenant User Management observes the first sign-in, and
  the Organization's alias, name and domains. It is written in `docs/30-protocol/` and in Tenant
  User Management's OpenAPI document before the operation ships (HC14, HC16).
- Whether an invitation expires, and how one sent to a wrong or unused address is replaced.
- What the provisioning client is, such as a console or a job, and where it runs.
- Suspending and removing a Tenant. This record covers creation only, and removal waits on the
  erasure design `multi-tenancy.md` section 10 registers.

### What this amends

- `gateway-api.md`: the Tenant row of section 5 names this operation, and the section 9 row on which
  surface provisions a Tenant is discharged.
- `http-conventions.md` HC18 covers creating a Tenant, which no Principal Token can name.
- `control-plane.md`: section 12 records where a Tenant is created and how its first administrator
  arrives, and section 13 registers what stays undecided above.
- `audit-model.md` section 3: the creation record names the first administrator.
- `identity-and-access.md` section 2: Tenant User Management's client gains a role once the
  operation is built.
- Tenant User Management's OpenAPI source names the provisioning client among its callers, and
  `seed-local-tenant.sh` says what replaces its owner-role write.

## Rationale

**Option 2 is the route the isolation argument excludes.** Self-serve signup is a public operation
that runs before a Tenant exists, which G7 and ADR-0011 rule out, and ADR-0009's hand-priced
contracts do not need it.

**Option 3 creates Tenants nobody is accountable for.** A script writing as the schema's owner has
no Principal and writes no Audit Record, on the privileged path multi-tenancy.md section 4 warns
about. The first fact about every Tenant would be the one its trail cannot show.

**Option 4 makes the identity provider the source of tenancy.** A Tenant that appears on first
resolution exists because someone created an Organization in Keycloak, against ADR-0024, which gives
the tenant directory to Tenant User Management, and ADR-0017, which keeps Keycloak to identity.

**Option 1 puts creation where the directory is, and makes it an ordinary act.** The service that
owns Tenants creates them, its caller authenticates as itself, and the person behind the caller
becomes the first Principal recorded in the new Tenant's trail. Inviting the first administrator by
address lets the customer's own person, verified by the identity provider, take the Tenant over
without a second operator act or an operator keeping a role in it. Onboarding stays an insert, one
Organization and one invitation, with no infrastructure step.

## Consequences

### Positive

- Every Tenant's trail begins with its own creation, attributed to a named person.
- A new Tenant's first administrator arrives through the customer's own verified sign-in, with no
  operator step after creation.
- No public route exists before a Tenant does.
- The schema owner's write leaves the provisioning path.
- A Tenant's Organization is created by the service that records it, in the same operation.

### Negative

- **Tenant User Management's Keycloak client can change every Organization.**
  `manage-organizations` updates and deletes Organizations and their members across the realm, not
  only those the service created.
- **One operation writes to two systems**, so a failure between the tenant directory and Keycloak
  has to be completed on repeat.
- **A new Tenant has no administrator until the invited person signs in.** An invitation sent to a
  wrong or unused address leaves the Tenant without one until it is replaced.
- The invitation travels by email, so the realm needs outgoing mail, and the address is held as
  personal data before any Person exists for it.
- The provisioning client is a new privileged caller to guard.

### Neutral / follow-on work

- Specify the operation, and document it in Tenant User Management's OpenAPI document, before it
  ships.
- Build it, register the provisioning client in the local realm, give the realm outgoing mail, and
  replace the seed script's owner-role write with a call to the operation.
- Include the Tenant's administrator role in the set `identity-and-access.md` lists.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Tenant User Management's client is used to alter another Tenant's Organization | Low | High | The narrowest role that creates an Organization and invites to it, never `manage-realm`; Keycloak's fine-grained admin permissions can narrow what it may change in an existing Organization |
| A creation fails between the tenant directory and Keycloak | Medium | Medium | `Idempotency-Key`, a repeat that completes the creation, and no Tenant resolving until every part exists |
| Someone other than the intended administrator accepts the invitation | Low | High | The role takes effect only for the address the identity provider verified, compared as RFC 5321 compares it, and the naming is in the Tenant's trail with the Platform Operator who made it |
| An address is mistyped at creation | Medium | Medium | No role takes effect for an address nobody verifies, so the mistake leaves the Tenant without an administrator rather than giving it the wrong one |
| A client other than the provisioning client creates a Tenant | Low | High | A recorded list of permitted callers, 403 `auth.forbidden` for any other, and tests that call with another client's token |
| A Tenant is created with no accountable person | Low | High | The operation refuses a request without an operator credential it verified, and the creation is the Tenant's first Audit Record |

## Revisit criteria

Reopen this decision in any of these cases:

- A segment emerges that buys through self-serve signup rather than a contract.
- Keycloak cannot give Tenant User Management's client a role narrow enough for a security review,
  which would move Organization creation elsewhere.
- A Tenant's identity provider has to be enrolled before the Tenant exists, or a customer cannot
  receive an invitation by email.

## References

- [`../30-protocol/gateway-api.md`](../30-protocol/gateway-api.md) G7 and sections 5 and 9: the
  Tenant resolved from the credential, and the register row this discharges
- [ADR-0011](adr-0011-tenant-isolation-shared-schema-rls.md): onboarding a Tenant is an insert
- [ADR-0024](adr-0024-global-person-with-tenant-memberships.md) and
  [ADR-0017](adr-0017-keycloak-for-identity.md): the tenant directory, and a Tenant's Organization
- [`../30-protocol/credential-resolution.md`](../30-protocol/credential-resolution.md) CR1 to CR4:
  resolution changes nothing, permitted callers, verifying a credential, and the Organization a
  Tenant maps to
- [`../30-protocol/http-conventions.md`](../30-protocol/http-conventions.md) HC14 to HC19:
  documenting and authenticating an internal operation, and repeating one safely
- [ADR-0030](adr-0030-platform-operator-and-observed-conditions.md): the Platform Operator, and
  observed conditions
- [ADR-0032](adr-0032-administrative-grants-are-orchestra-defined-roles.md): roles
- [Keycloak 26.7.0 release](https://www.keycloak.org/2026/07/keycloak-2670-released): the
  `manage-organizations` role
- [RFC 5321](https://www.rfc-editor.org/rfc/rfc5321#section-2.4) section 2.4: a mailbox's local part
  and domain
- [RFC 6749](https://www.rfc-editor.org/rfc/rfc6749#section-4.4) section 4.4: the client credentials
  grant
