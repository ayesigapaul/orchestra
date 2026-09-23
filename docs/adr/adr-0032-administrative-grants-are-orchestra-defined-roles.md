---
title: "ADR-0032: An administrative grant is a role from a closed set Orchestra defines, and an identity-provider group holds one only through a mapping the Tenant administers"
adr_id: ADR-0032
status: Accepted
date: 2026-09-13
deciders: [product-owner, platform-architecture]
consulted: []
informed: []
supersedes: []
superseded_by: []
tags: [identity, security, governance, tenancy]
depends_on: [ADR-0001, ADR-0012, ADR-0017, ADR-0023, ADR-0024, ADR-0030, ADR-0031]
---

# ADR-0032: An administrative grant is a role from a closed set Orchestra defines, and an identity-provider group holds one only through a mapping the Tenant administers

## Status

Accepted.

## Context

Two authorizations sit in the path of one Tool call, and
[`identity-and-access.md`](../10-architecture/identity-and-access.md) section 1 keeps them apart. A
capability grant lets an Agent version call a Tool. An *administrative grant* lets a Principal
administer something through the Control Plane. Section 5 of that document settled the
administrative grant's posture, and sent its shape to an ADR.

- Being a Platform User confers nothing, and an absent administrative grant is a refusal.
- Granting or removing one is an administrative act with exactly one acting Principal, audited on
  its own.
- It is tenant-scoped, and may be narrowed to a Workspace but never widened beyond the Tenant
  (section 4).
- No Policy Enforcement Point sits on the administrative path, so checking an administrative grant
  produces no Policy Decision, and an administrative act is fully audited without one
  ([ADR-0012](adr-0012-policy-decisions-are-audit-records.md)).

Other rules already wait on the shape. `auth.forbidden` refuses a caller without the administrative
grant an operation needs ([`http-conventions.md`](../30-protocol/http-conventions.md) section 4).
Identity-and-access section 6 has one administrative grant decide who reads the audit surface and a
narrower one who reads an Evidence Set, and [`gateway-api.md`](../30-protocol/gateway-api.md) G15
has one decide who cancels a Run.

A second question travels with the first. [`control-plane.md`](../10-architecture/control-plane.md)
section 13 asks whether an identity-provider group may hold an administrative grant. Enterprise
buyers require SSO against their own identity provider and user lifecycle through SCIM
([ADR-0017](adr-0017-keycloak-for-identity.md)), so their joiners, movers and leavers are managed in
their own directory, and a grant held person by person makes each of them a manual act in Orchestra.
ADR-0017 also forbids Keycloak roles from standing in for Orchestra's authorization decisions.

## Decision drivers

- Who may do what in a Tenant is answered by reading records, not by evaluating rules.
- Administrative authorization stays Orchestra's, with the identity provider an input at most
  (ADR-0017).
- No Policy Enforcement Point on the administrative path, and no wait on the policy language
  [`policy-model.md`](../40-governance/policy-model.md) section 8 leaves undecided.
- A scope that narrows to a Workspace and never widens beyond the Tenant.
- A customer's own directory drives joiners, movers and leavers, without deciding a grant.
- Established vocabulary: role-based access control as
  [INCITS 359-2012](https://webstore.ansi.org/standards/incits/incits3592012) models it, and the
  `groups` and `roles` attributes of SCIM.
- The reversible direction first (working rule 8): a closed set can open later, and an open one
  cannot close.

## Considered options

### The shape of an administrative grant

1. **A closed set of Orchestra-defined roles**, tenant-scoped, optionally narrowed to a Workspace.
2. **Attribute-based rules** over the attributes of a Principal.
3. **Grants written in the policy language**, checked at an administrative enforcement point.
4. **Tenant-defined custom roles** from the start.

### Whether an identity-provider group may hold one

1. **No.** Individual Principals only.
2. **Yes, read from the credential.** A group claim confers the role directly.
3. **Yes, through a group-to-role mapping** that each Tenant administers in Orchestra.

## Decision

**Option 1 for the shape, and option 3 for groups.**

### An administrative grant is a role

- An administrative grant gives one Principal one **role**, in one Tenant, optionally narrowed to
  one Workspace. A role is one of a closed set Orchestra defines, and names the administrative
  operations it permits. Permissions attach to roles and roles to Principals, as INCITS 359 models
  role-based access control.
- Roles and administrative grants are Orchestra records. A role in this sense is never a Keycloak
  role and never a database role, and no Keycloak role, credential claim or attribute a customer's
  backend asserts confers one (ADR-0017).
- **Tenant User Management holds administrative grants and group-to-role mappings**, beside the
  Principals, Workspaces and Memberships they name
  ([ADR-0024](adr-0024-global-person-with-tenant-memberships.md)).
- An administrative grant can carry an end time, after which it confers nothing. A Platform
  Operator's always carries one, and is issued on Orchestra's side for a recorded support case or
  incident, never by the Tenant ([ADR-0030](adr-0030-platform-operator-and-observed-conditions.md)).
  Being a Principal of any subtype confers no role.
- Checking an administrative grant produces no Policy Decision, and no Policy Enforcement Point is
  added to the administrative path. Cancelling a Run is authorized this way (G15). An enforcement
  point on that path would need an ADR superseding this one.
- Deciding an Approval Request stays where
  [`approval-workflows.md`](../40-governance/approval-workflows.md) C1 puts it: the Approval Chain
  is derived from Policy, not conferred by a role.

**The set.** Which roles the set holds, and which operations each permits, is specified in
`identity-and-access.md` before the first operation that checks an administrative grant. The set
contains the Tenant's administrator role, which
[ADR-0031](adr-0031-tenant-user-management-creates-tenants.md) gives a new Tenant's first
administrator. This record fixes the shape, not the rest of the list.

**Custom roles can come later without breaking anything.** An administrative grant names its role
by identifier. Tenant-defined roles can be added later as further identifiers beside Orchestra's,
and no administrative grant, mapping or check written against the closed set changes.

### A group holds a role only through a mapping the Tenant administers

*Group membership* below is a person's place in an identity-provider group, and never a Membership,
which is a Person's place in a Tenant.

- A **group-to-role mapping** is an Orchestra record in one Tenant. It names a group as the identity
  provider identifies it, one role, and optionally one Workspace. A Principal whose group membership
  the mapping names holds that role in that scope, for as long as the group membership holds.
- Each Tenant administers its own mappings in the Control Plane. Creating, changing or removing one
  is an administrative act that needs a role permitting it, and is audited with the group, the role
  and the scope before and after.
- A group confers nothing on its own. A group claim with no mapping is ignored for authorization, so
  a change in the customer's directory can move a person between mapped groups but can never create
  a role.
- Group membership counts only as the identity provider asserts it for a Principal it authenticated,
  never as a customer's backend asserts it (ADR-0024 rests trust on verified identity).
- **Every audited act authorized through a mapping records the group membership it relied on.** Its
  Audit Record's basis ([`audit-model.md`](../40-governance/audit-model.md) A4) carries the role and
  scope, the mapping, and the group membership observed at the check, so an administrative grant
  that arrived through a group stays reconstructible after the group changes.

**How group membership reaches Orchestra is not decided here.** A `groups` claim in the credential,
as [RFC 9068](https://www.rfc-editor.org/rfc/rfc9068#section-2.2.3.1) section 2.2.3.1 registers it
from [RFC 7643](https://www.rfc-editor.org/rfc/rfc7643#section-4.1.2) section 4.1.2, provisioning
over [SCIM](https://www.rfc-editor.org/rfc/rfc7644), and the identity provider's admin API are the
candidates. The choice stays with the design-partner row that owns the federation protocol in
`control-plane.md` section 13. It also bounds how stale a group membership may be when a check
relies on it, and so how quickly a leaver loses a role.

### What stays undecided

- The rest of the roles in the set, and the operations each permits.
- How a check reaches the administrative grants Tenant User Management holds: a call, or the
  Principal Token. `identity-and-access.md` specifies it with the first operation that checks one.
- How a Platform User is deprovisioned, and what becomes of administrative grants held directly,
  which `control-plane.md` section 13 still carries.

### What this amends

- `identity-and-access.md` sections 1, 5 and 7, and its section 12 register: the shape row is
  discharged, the federation row narrows to how group membership is delivered, and the role set and
  the path of a check are registered as questions for that document.
- `control-plane.md` sections 3 and 12, and its section 13 rows on groups and federation.
- `containers.md` section 3: Tenant User Management holds administrative grants and mappings.
- `gateway-api.md` G15, whose administrative grants are roles, with no enforcement point added.
- `audit-model.md` A4 and section 3: an administrative act's basis names its administrative grant
  and any group membership, and a mapping change is audited.
- `personas.md` section 5, and the glossary, which gains an entry for administrative grant.
- `audit-record.v1`, which gains an optional administrative basis.

## Rationale

**Option 1 is the shape an auditor can read.** Who may cancel a Run in a Finance Workspace is a list
of administrative grants. Under attribute rules it is a computation over attributes that change
elsewhere. In the policy language it is an evaluation in a language nobody has chosen, with a Policy
Decision on every administrative act, which undoes what identity-and-access section 5 decided.
Custom roles from the start make a permission vocabulary a contract before anyone has used the
closed one. A closed set can gain custom roles later without changing a grant, and the reverse is
not true.

**Option 3 keeps the decision Orchestra's and the lifecycle the customer's.** Individual grants only
turn every joiner and leaver into a manual act in Orchestra, which is what the SSO and SCIM
requirement of ADR-0017 exists to avoid. Reading a group claim as a grant lets whoever edits the
customer's directory, or its federation mapping, create a role in Orchestra unaudited: authorization
resting on a claim Orchestra does not own, which ADR-0017 forbids. A mapping puts the decision in a
record the Tenant administers and Orchestra audits, while group membership still flows from the
customer's directory. Recording the group membership with each audited act is what makes the
decision reconstructible afterwards.

**Grants live beside what they name.** An administrative grant names a Principal and perhaps a
Workspace, and a mapping names a role and perhaps a Workspace. Held in Tenant User Management's
schema, each reference is checked by a write policy in the same schema
([ADR-0023](adr-0023-no-foreign-key-constraints.md)), which a grant held in another service could
not do without reading that service's tables.

## Consequences

### Positive

- `auth.forbidden`, audit and Evidence Set reads, and cancellation have a concrete grant to check.
- Who holds what in a Tenant is a query over administrative grants and mappings in one service, and
  every change is in the Tenant's trail.
- Joiners and leavers flow from the customer's directory, without the directory deciding a grant.
- No Policy Decision volume on the administrative path, and no wait on the policy language.

### Negative

- **A closed set may be too coarse** for a customer's separation of duties until custom roles exist,
  which tempts a Tenant to grant a broad role.
- **A role held through a group depends on a directory Orchestra does not own.** A stale group
  membership keeps a leaver's role for as long as the staleness lasts.
- **Tenant User Management is on the path of every administrative check**, by a call or through the
  token it signs.
- Every audited act through a mapping records a group membership, adding to audit volume.
- Two authorization mechanisms stay in the platform, roles and Policy, and the audit surface has to
  keep them apart (identity-and-access section 5).

### Neutral / follow-on work

- List the roles and their operations in `identity-and-access.md`, the Tenant's administrator role
  among them, before the first operation that checks an administrative grant.
- Specify how a check reaches Tenant User Management's grants.
- Settle, with a design partner, how group membership is delivered and how stale it may be.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Tenants over-grant a broad role because the set is too coarse | Medium | Medium | Workspace narrowing; the audit surface shows who holds what; custom roles can be added without changing a grant |
| A leaver keeps a role through a stale group membership | Medium | High | Each audited act records the group membership it relied on; the delivery decision bounds staleness; a Tenant can remove a mapping at once |
| A group claim or a Keycloak role is read as an administrative grant | Low | High | Only an administrative grant or a mapping confers a role; tests present a group with no mapping and a Keycloak role with no grant |
| A mapping is changed to escalate privilege unseen | Low | High | Changing a mapping is an administrative act that needs its own role, and is audited in the Tenant's trail |
| Checking grants slows every administrative request | Medium | Medium | The specification weighs a call against carrying the grant in the Principal Token Tenant User Management already signs |
| The closed set becomes a vocabulary nobody can change | Low | Medium | Adding a role is additive, and custom roles remain the named extension |

## Revisit criteria

Reopen this decision in any of these cases:

- A design partner's separation of duties cannot be expressed with the closed set and Workspace
  narrowing, which would bring custom roles forward.
- Administrative authorization needs a condition a role cannot carry, such as the time of day or an
  attribute of the thing administered, which would reopen attribute rules, the policy language and
  an enforcement point on the administrative path.
- No delivery of group membership is fresh enough for a leaver to lose a role within the time a
  customer's security review requires.

## References

- [`../10-architecture/identity-and-access.md`](../10-architecture/identity-and-access.md) sections
  1 and 4 to 7: the two grants, scope, the posture, audit reads and cancellation
- [`../10-architecture/control-plane.md`](../10-architecture/control-plane.md) sections 12 and 13:
  the identity provider's enrolment, and the group and federation rows
- [ADR-0017](adr-0017-keycloak-for-identity.md): SSO and SCIM as requirements, and Keycloak roles as
  an input at most
- [ADR-0023](adr-0023-no-foreign-key-constraints.md) and
  [ADR-0024](adr-0024-global-person-with-tenant-memberships.md): references checked in their own
  schema, and what Tenant User Management owns
- [`../30-protocol/http-conventions.md`](../30-protocol/http-conventions.md) section 4:
  `auth.forbidden`
- [`../40-governance/audit-model.md`](../40-governance/audit-model.md) A4 and section 3: the basis
  of a record, and the enumeration of audited acts
- [INCITS 359-2012](https://webstore.ansi.org/standards/incits/incits3592012): role-based access
  control
- [RFC 7643](https://www.rfc-editor.org/rfc/rfc7643#section-4.1.2) section 4.1.2 and
  [RFC 7644](https://www.rfc-editor.org/rfc/rfc7644): SCIM's `groups` and `roles`, and its protocol
- [RFC 9068](https://www.rfc-editor.org/rfc/rfc9068#section-2.2.3.1) section 2.2.3.1: `groups` and
  `roles` as claims in an access token
