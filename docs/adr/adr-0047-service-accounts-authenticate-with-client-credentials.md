---
title: "ADR-0047: A Service Account authenticates with OAuth 2.0 client credentials, interim, and resolves through a record Tenant User Management holds"
adr_id: ADR-0047
status: Accepted
date: 2026-09-23
deciders: [product-owner, platform-architecture]
consulted: []
informed: []
supersedes: []
superseded_by: []
tags: [identity, security, tenancy, services]
depends_on: [ADR-0017, ADR-0024, ADR-0026, ADR-0027, ADR-0031, ADR-0039]
---

# ADR-0047: A Service Account authenticates with OAuth 2.0 client credentials, interim, and resolves through a record Tenant User Management holds

## Status

Accepted, and **interim**. The credential class is recorded to unblock work that cannot proceed
without one, and is to be revisited with the first design partner; the revisit criteria name that
conversation. What is interim is the class — a client secret at Orchestra's identity provider.
Where the Tenant and the Principal come from is not: that is a record Orchestra holds, and a later
class changes what the record is keyed on rather than where tenancy is decided.

## Context

Two things that already exist cannot be finished without a Service Account credential class, and the
class has been open since the domain model routed it to
[`identity-and-access.md`](../10-architecture/identity-and-access.md) section 3.

- **Credential resolution has a hole in it.**
  [`credential-resolution.md`](../30-protocol/credential-resolution.md) CR5 says a Service Account's
  credential is not specified yet and resolves to nothing until it is, and section 5 registers *how
  a Service Account's credential resolves* as needing an ADR, repeating the classification
  `identity-and-access.md` gives the class itself. A contract that resolves every credential to
  exactly one Principal and one Tenant ([`gateway-api.md`](../30-protocol/gateway-api.md) G7)
  currently resolves one Principal subtype.
- **A metered dimension has no act behind it.**
  [ADR-0039](adr-0039-seats-count-platform-users.md) adds *Service Accounts* — distinct Service
  Accounts authenticating in a billing period, measured and never billed — and requires the matching
  audited act, because
  [`audit-model.md`](../40-governance/audit-model.md) section 7 reconciles every metered occurrence
  against the trail. With no credential class there is no authentication to audit, and the dimension
  counts nothing.

Five facts bear on the choice.

- **The Tenant comes from the credential's Organization, and a client has none.** CR4 resolves the
  Tenant from an `organization` claim naming exactly one Keycloak Organization, which the tenant
  directory records by alias, and the alias must map to an **active** Tenant. A Keycloak
  Organization's members are users, onboarded by invitation or by brokering
  ([Organizations](https://www.keycloak.org/2024/06/announcement-keycloak-organizations)); a client
  is not one of them, and an access token issued to a client names no Organization. CR4 cannot carry
  a machine caller, and making a client's service-account user a member of an Organization would put
  tenancy in the identity provider — which [ADR-0017](adr-0017-keycloak-for-identity.md) keeps to
  identity, and which [ADR-0031](adr-0031-tenant-user-management-creates-tenants.md) refuses in as
  many words.
- **Orchestra already records what a client may do.** CR2 records which clients may resolve
  credentials, ADR-0031 records which may create Tenants, and
  [ADR-0024](adr-0024-global-person-with-tenant-memberships.md) gives Tenant User Management the
  tenant directory, the Persons, the Memberships and the Principals. Its schema already has a
  Service Account Principal: tenant-scoped, on no Membership, and named.
- **The class is narrowed but not chosen.** `identity-and-access.md` section 3 fixes that a Service
  Account's credential is **not** a Session Token, because a Session Token is a per-interaction
  authority minted per End User while a Service Account is durable between interactions, and G4
  forbids either credential from appearing in a browser or mobile bundle, in client source, or in
  any artifact shipped to a device ([`threat-model.md`](../40-governance/threat-model.md) T5). What
  it leaves open is a long-lived secret, an asymmetric key, or workload identity federated from the
  customer's cloud.
- **The same grant already runs between services, and is not this.**
  [ADR-0026](adr-0026-services-call-over-http-and-publish-through-an-outbox.md) authenticates every
  call between services with the calling service's own access token, issued through the OAuth 2.0
  client credentials grant. That credential says which service is calling and nothing more; it is
  never the accountable Principal of an action and is not a Service Account.
- **Nothing is built, and no customer has spoken.** Orchestra is pre-customer (working rule 8), no
  backend has said how it would rather authenticate, and no lifetime or rotation interval is decided
  anywhere in this repository (`identity-and-access.md` section 9).

## Decision drivers

- Something to build resolution and the metered act against now, rather than a fourth open question.
- Exactly one Principal and one Tenant per credential, decided by a record Orchestra holds and never
  by the identity provider's model of tenancy.
- No new credential machinery invented before a customer has said what they need.
- Verification unchanged: whoever resolves a credential verifies it itself, and takes nothing on a
  caller's word (CR3).
- A choice whose reversal costs a re-keying rather than a redesign (working rule 8).
- A class a design partner can refuse without the rest of the design moving.

## Considered options

1. **The OAuth 2.0 client credentials grant at Orchestra's identity provider**
   ([RFC 6749](https://www.rfc-editor.org/rfc/rfc6749#section-4.4) section 4.4), one confidential
   client per Service Account, authenticating with a client secret.
2. **Asymmetric client authentication at the same provider** — a private key JWT
   ([RFC 7523](https://www.rfc-editor.org/rfc/rfc7523)) or mutual TLS
   ([RFC 8705](https://www.rfc-editor.org/rfc/rfc8705)) instead of a secret.
3. **Workload identity federated from the customer's cloud**, so the customer's backend presents a
   token its own platform issued and Orchestra holds no secret at all.
4. **An Orchestra-minted long-lived key**, verified by Orchestra.
5. **Decide nothing until a design partner speaks.**

## Decision

**Option 1, recorded as interim.**

### The credential

A Service Account authenticates with the **OAuth 2.0 client credentials grant**
([RFC 6749](https://www.rfc-editor.org/rfc/rfc6749#section-4.4) section 4.4) at Orchestra's identity
provider (Keycloak, ADR-0017). One confidential client stands for one Service Account. The client
obtains an access token and presents it to the Gateway as a bearer token in the `Authorization`
header ([RFC 6750](https://www.rfc-editor.org/rfc/rfc6750)), exactly as every other credential on
that contract arrives.

Orchestra mints nothing here and runs no verifier of its own. **The tenant's own identity provider
does not authenticate a Service Account**: federation under ADR-0017 covers human sign-in, and a
machine caller has no sign-in to federate. That answers the question
[`system-context.md`](../10-architecture/system-context.md) section 7 routes to
`identity-and-access.md` — the credential is issued by Orchestra's identity provider, on the
relationship R2 describes for people, and is not a separate credential type Orchestra invents.

### The token, and how it is verified

Verification is CR3's, unchanged. Tenant User Management verifies the credential's signature,
issuer, audience and lifetime against the identity provider's signing keys itself, takes no subject
or organization from its caller, and never logs, stores or echoes the credential. Two rules that
were already implied are stated, because a machine credential presented continuously makes them
load-bearing.

- **The verifier fixes the algorithm.** It accepts only the signature algorithms Orchestra accepts,
  matched against the identity provider's published key set, and never the algorithm the token's own
  `alg` header names ([RFC 8725](https://www.rfc-editor.org/rfc/rfc8725) section 3.1). A verifier
  that reads `alg` accepts whatever the presenter chose.
- **A credential that cannot be judged is not rejected.** CR8 stands: when the signing keys cannot
  be reached the answer is 503 `upstream.unavailable`, safe to retry, never `rejected`.

Nothing else about the token is Orchestra's to specify. It is the identity provider's access token,
and Orchestra reads from it only what the rules below name.

### Where the mapping is recorded

**The client-to-Tenant and client-to-Principal mapping is Orchestra's record, held by Tenant User
Management** — the service that owns the tenant directory and the Principals (ADR-0024), that
already records which clients may resolve credentials (CR2), and that ADR-0031 already has recording
which clients may create Tenants. It is one more record of the same kind.

A **Service Account record** names three things: the identity provider's client, the Tenant that
owns it, and that Tenant's Service Account Principal. It is keyed on the subject the identity
provider issues for the client, and carries the client identifier beside it.

- **It identifies a Tenant rather than belonging to one**, so it sits where the tenant directory
  sits: readable before tenant context exists, holding routing facts and nothing else, and a
  reviewed exemption entry in the row-level-security control
  ([`multi-tenancy.md`](../10-architecture/multi-tenancy.md) sections 5 and 7). No name, no secret
  and no attribute of the customer's is in it.
- **The Principal is unchanged.** It stays a tenant-scoped row under forced row-level security, a
  Service Account on no Membership (ADR-0024), read after the Tenant is known and the transaction's
  tenant context is set ([ADR-0021](adr-0021-postgresql-is-the-datastore.md)).
- **The mapping is one to one.** One client resolves to one Service Account Principal in one Tenant.
  A client named by two records is refused by the record's own uniqueness, not by a tie-break.

### How a client credential resolves

Credential resolution gains one rule, CR9, alongside CR5 rather than inside it.

1. **The credential is verified first**, as CR3 and CR8 require and as stated above.
2. **CR4 does not apply, and MUST NOT be worked around.** A client credentials token carries no
   `organization` claim, because an Organization holds users. A client's service-account user MUST
   NOT be made a member of an Organization to produce one.
3. **The subject matches exactly one Service Account record.** `sub` is the matching key for both
   classes, as CR5 already has it; what differs is what the subject stands on — a Membership in the
   credential's Tenant for a Platform User, a Service Account record for a Service Account. A
   subject that matches both is a rejection, never a choice between them.
4. **The client identifier must agree with the record's.** The two facts come from different places
   — the identity provider's token and Orchestra's record — so a disagreement means one of them has
   moved, and it is a rejection. Which claim carries the client identifier is the protocol
   document's to fix against the pinned Keycloak release:
   [RFC 9068](https://www.rfc-editor.org/rfc/rfc9068) section 2.2 registers `client_id` for a JWT
   access token, and Keycloak also carries the authorized party as `azp`.
5. **The Tenant the record names must be active.** That requirement of CR4 holds for every
   credential, however the Tenant is reached.
6. **A resolved Service Account answers `principal_kind` set to `service-account`**, with the Tenant
   and the Principal. Every other outcome — no record, two records, a suspended or unknown Tenant, a
   mismatch, a subject in both classes — is a rejection under CR6, with the reason in Tenant User
   Management's log and never in the answer.

### What this does not change

- **A Service Account is never a seat and never a Platform User.** ADR-0039 makes a seat a Platform
  User and counts a Service Account on a dimension of its own, measured and never billed.
  Authenticating is the audited act that dimension reconciles against, and this record supplies the
  act without changing what it costs. Whether it is audited per authentication or per credential
  resolution stays where ADR-0039 left it, with the metering design.
- **Nothing about what a Service Account may do.** This is authentication. What a Service Account
  may administer is an administrative grant
  ([ADR-0032](adr-0032-administrative-grants-are-orchestra-defined-roles.md)); what an Agent or
  Workflow may call is a capability grant
  ([ADR-0042](adr-0042-declared-tools-and-capability-grants.md),
  [`tool-authorization.md`](../40-governance/tool-authorization.md)); whether an invocation proceeds
  is a Policy Decision ([`policy-model.md`](../40-governance/policy-model.md)). A Service Account is
  never eligible at an approval position
  ([ADR-0043](adr-0043-approval-chains-and-separation-of-duties.md),
  [`approval-workflows.md`](../40-governance/approval-workflows.md) C5).
- **Nothing about which surface admits one.** A Service Account is a machine caller into the
  Gateway ([`../GLOSSARY.md`](../GLOSSARY.md), `identity-and-access.md` section 3), and no surface
  is added here.
- **Nothing about calls between services.** A client's credential stops at the Gateway and Tenant
  User Management (CR3); what travels inward is a Principal Token
  ([ADR-0027](adr-0027-tenant-user-management-signs-principal-tokens.md)), whose `principal_kind`
  already admits a Service Account and whose issuance starts from whatever resolution accepted.
- **A service's own token is still not a Service Account.** Two uses of one grant now exist in one
  realm, and the record is what tells them apart: only a client with a Service Account record
  resolves to a Principal, and no Orchestra service client has one.

### What stays undecided

- **Rotation, expiry and secret custody.** How the client's secret is generated, who holds it, how
  it reaches the customer's backend, how it is replaced without an outage, how long it and the
  access tokens it obtains live, and whether a Service Account may hold two secrets while one is
  being replaced. `identity-and-access.md` section 9 gives the forces and decides none of it, and
  its register carries custody beside the lifetimes it already carried.
- **How a Service Account is created.** Which operation creates the client, the Principal and the
  record, and who may call it. It has the shape ADR-0031 gives Tenant creation and it is not built.
  One cost has to be named before it is: creating a client in Keycloak needs a realm-management role
  over clients, which is wider than the `view-users` and `manage-organizations` Tenant User
  Management's client holds today, and a role that can change every client in the realm includes
  Orchestra's own service clients. Narrowing it with fine-grained admin permissions, or keeping
  client creation off that client entirely, is part of that design.
- **What the design-partner conversation settles**: whether a shared secret is acceptable at all,
  whether asymmetric client authentication or workload identity federation is required, whether a
  Service Account is one per backend or one per integration, and the lifetimes above.
- **The executable form.** `principal_kind` is `enum: [platform-user]` in the Gateway's and Tenant
  User Management's OpenAPI sources today. It gains `service-account` with CR9's specification,
  before the rule ships (`http-conventions.md` HC14).

### What this amends

- `credential-resolution.md`: CR5 stops saying a Service Account resolves to nothing, CR9 carries
  the rule, and the section 5 row is discharged.
- `identity-and-access.md` sections 2, 3 and 12: the class is named as interim, the credential-class
  row goes, and the lifetimes row carries the secret's custody with them.
- `gateway-api.md` G4 and section 9: the class is no longer open between three candidates, and the
  row keeps its lifetimes half.
- `containers.md` section 12, `system-context.md` section 7, and `domain-model.md` sections 3 and
  11: the rows routed to `identity-and-access.md` are answered.
- `multi-tenancy.md` section 5: the exempt set gains the Service Account record.
- `GLOSSARY.md`: the Service Account entry says how one authenticates, as the Platform User and End
  User entries do.

## Rationale

**Option 1 adds no machinery.** The grant already runs in this realm for every call between services
(ADR-0026), the local stack already obtains a client-credentials token for the Gateway, and the
verification Tenant User Management needs for a Platform User's credential verifies this one
unchanged. What was missing was never a mechanism; it was a place to record which Tenant a machine
caller belongs to, and ADR-0024 already says which service owns that.

**Its reversal cost is a re-keying, not a redesign.** Under options 2 and 3 the Tenant and the
Principal still come from a record Tenant User Management holds; what changes is how the client
proves itself and which claim the record is keyed on. Everything downstream — one Principal and one
Tenant, the Principal Token, the audited act, the metered dimension — is untouched.

**Option 2 is the upgrade, not the start.** Keycloak authenticates a client by secret, by private
key JWT or by mutual TLS as a per-client setting, so moving a Service Account to an asymmetric
credential is configuration plus an enrolment step for the customer's key. Requiring it now would
decide for a customer that has not been asked, and would need the enrolment design that does not
exist.

**Option 3 is the likeliest answer a design partner gives, and the one that needs the conversation
most.** Federating the customer's own workload identity removes the secret entirely, which is
exactly what a cloud-native buyer will want. It also needs per-customer trust configuration, a
subject-to-Service-Account mapping that is not the client's, and an enrolment path — all shaped by
whose cloud, which issuer and which claim, none of which is knowable pre-customer. Recording it as
the named alternative and revisiting is cheaper than guessing it.

**Option 4 is the shape the set already refuses.** An Orchestra-minted long-lived key is what a
tenant API key would be, a term the glossary carries only in the negative. It makes Orchestra the
custodian and the verifier of a secret whose compromise is a Tenant's entire machine access, buys
nothing the identity provider does not already do, and adds a second credential format to the one
place in the platform that must fail closed.

**Option 5 keeps two built things unfinishable.** CR5 would keep resolving a Service Account to
nothing and ADR-0039's dimension would keep counting an act nobody can perform, for as long as the
first design-partner conversation takes to happen. Recording an interim class costs a migration of
whatever Service Accounts exist by then, and pre-customer that is none.

## Consequences

### Positive

- Credential resolution covers a second Principal subtype, and CR5's hole closes.
- The *Service Accounts* dimension has an audited act behind it, as ADR-0039 requires.
- No new credential machinery: one grant, one issuer, one key set, and the verification path Tenant
  User Management needs anyway.
- Tenancy stays Orchestra's. The identity provider authenticates the client and says nothing about
  which Tenant it belongs to.
- The upgrade path is per-client configuration, so a stronger class does not move the mapping.
- The local stack can prove the whole flow, including that a service's own client does not resolve
  to a Principal.

### Negative

- **A shared secret now exists** in a customer's backend and in Keycloak, with its custody, rotation
  and replacement undecided. Interim is not free: every Service Account issued under this class has
  to be migrated if the class changes.
- **A second record readable before tenant context.** The exempt set is deliberately tiny and
  structural; this makes it two, and the row-level-security control gains an entry a reviewer must
  agree to.
- **Creating a Service Account needs a Keycloak role over clients**, wider than anything Tenant User
  Management holds today, or a separate privileged path — and the operation does not exist yet, so
  until it does a Service Account is created by hand.
- **Two uses of one grant in one realm.** A Service Account record created for an Orchestra service
  client would turn a service into a Principal, which is the failure ADR-0026 exists to prevent.
- **Recording an interim class invites treating it as settled.** A decision nobody revisits is
  indistinguishable from one nobody took.

### Neutral / follow-on work

- Specify CR9's members and the Service Account record in [`../30-protocol/`](../30-protocol/), and
  add `service-account` to `principal_kind` in both OpenAPI sources, before the rule ships.
- Design the creation operation, with the Keycloak role question above, on ADR-0031's shape.
- Seed a Service Account in the local stack and prove resolution end to end in `smoke.sh`, including
  that a client with no record is rejected and that a rejection says nothing about why.
- Add the Service Account authentication act to the audit enumeration — ADR-0039's follow-on,
  unchanged by this record and now buildable.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| A client secret leaks from a customer's backend | Medium | High | Two independent revocations, either of which is immediate: disabling the client at the identity provider, and removing the Service Account record, which fails resolution closed under CR6. Until rotation intervals are decided, revocation is the only bound, and saying so is part of the interim status |
| A Service Account record is created for an Orchestra service client | Low | High | Records are created only by the operation that creates a Service Account, which no Tenant reaches; the local stack proves a service client resolving to nothing, and it is a test rather than a convention |
| Tenancy creeps into the identity provider through Organization membership of a service-account user | Medium | Medium | CR9 forbids it in as many words, and ADR-0017 and ADR-0031 already forbid tenancy in Keycloak |
| The interim class becomes permanent by default | Medium | Medium | It is recorded as interim here and in every document this amends, and the revisit criterion names the conversation rather than a condition nobody watches for |
| The claim naming the client moves between Keycloak releases | Medium | Low | The protocol document fixes the claim against the pinned release, the record cross-checks it against the subject, and the local stack reads a real token rather than a remembered one |
| A customer's security review refuses a shared secret before the revisit | Medium | Medium | Option 2 is a per-client setting, and migrating one Service Account changes how its client proves itself, not the mapping or anything downstream of resolution |

## Revisit criteria

The class is interim, so the first criterion is a date with a person rather than a condition.

- **The first design-partner conversation about machine access to Orchestra**, which is expected to
  settle whether a shared secret is acceptable at all, whether asymmetric client authentication or
  workload identity federation is required instead, whether a Service Account is one per backend or
  one per integration, and the lifetimes and rotation intervals `identity-and-access.md` section 9
  leaves open. Until it happens the class stands; when it happens it is reopened whatever it says.

Reopen sooner in any of these cases:

- A security review refuses a client secret, or a customer cannot hold one.
- One client has to act for more than one Tenant or more than one Principal, which is the assumption
  the one-to-one record makes.
- A Service Account has to reach the Control Plane, which `identity-and-access.md` section 3 reserves
  for the Platform User.
- Orchestra's identity provider changes, which is ADR-0017's own revisit criterion; the grant, the
  subject and the claim are all its.

## References

- [`../30-protocol/credential-resolution.md`](../30-protocol/credential-resolution.md) CR2 to CR9:
  permitted callers, verifying the credential, the Organization a Tenant maps to, the Principal, a
  rejection as an answer, and failing closed
- [`../10-architecture/identity-and-access.md`](../10-architecture/identity-and-access.md) sections
  2, 3, 9 and 12: the Principal model, what the class is not, the forces on a lifetime, and the
  register this discharges
- [`../30-protocol/gateway-api.md`](../30-protocol/gateway-api.md) G4, G5 and G7: the credential a
  Service Account presents, the mint it performs, and the Tenant resolved from a credential
- [ADR-0017](adr-0017-keycloak-for-identity.md): the identity provider, one realm, an Organization
  per Tenant, and identity rather than tenancy
- [ADR-0024](adr-0024-global-person-with-tenant-memberships.md): the tenant directory, the
  Principals, and a Service Account on no Membership
- [ADR-0026](adr-0026-services-call-over-http-and-publish-through-an-outbox.md) and
  [ADR-0027](adr-0027-tenant-user-management-signs-principal-tokens.md): a service's own token, and
  the Principal Token that carries a resolved Principal inward
- [ADR-0031](adr-0031-tenant-user-management-creates-tenants.md): the shape of an internal operation
  only Orchestra's own client may call, and Tenant User Management's Keycloak roles
- [ADR-0039](adr-0039-seats-count-platform-users.md): a seat is a Platform User, and the *Service
  Accounts* dimension this record gives an act
- [RFC 6749](https://www.rfc-editor.org/rfc/rfc6749#section-4.4) section 4.4: the client credentials
  grant
- [RFC 6750](https://www.rfc-editor.org/rfc/rfc6750): presenting an access token as a bearer token
- [RFC 8725](https://www.rfc-editor.org/rfc/rfc8725) section 3.1: fixing the algorithm at the
  verifier
- [RFC 9068](https://www.rfc-editor.org/rfc/rfc9068) section 2.2: `client_id` in a JWT access token
- [RFC 7523](https://www.rfc-editor.org/rfc/rfc7523) and
  [RFC 8705](https://www.rfc-editor.org/rfc/rfc8705): the asymmetric client authentication option 2
  names
- [Keycloak Organizations](https://www.keycloak.org/2024/06/announcement-keycloak-organizations):
  an Organization's members are users
