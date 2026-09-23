---
title: "ADR-0030: Operator access to a Tenant's records is a time-boxed act by a Platform Operator, and a transition caused by an observed condition records its cause and no Principal"
adr_id: ADR-0030
status: Accepted
date: 2026-09-13
deciders: [product-owner, platform-architecture]
consulted: []
informed: []
supersedes: []
superseded_by: []
tags: [identity, audit, governance, security, tenancy]
depends_on: [ADR-0001, ADR-0011, ADR-0012, ADR-0015, ADR-0017, ADR-0024, ADR-0026, ADR-0027]
---

# ADR-0030: Operator access to a Tenant's records is a time-boxed act by a Platform Operator, and a transition caused by an observed condition records its cause and no Principal

## Status

Accepted.

## Context

Invariant I2 of [`domain-model.md`](../20-domain/domain-model.md) admits no unattributed action, and
rule A3 of [`audit-model.md`](../40-governance/audit-model.md) requires every Audit Record to
resolve to exactly one Principal. Two kinds of fact have none. Audit-model section 9 owns both, as
one decision together with whether platform-operator work crosses a Policy Enforcement Point at all.

- **A transition caused by an observed condition.** An Approval Request expires, if a deadline
  exists, or is withdrawn because its Run ended. A `wait` Step elapses. A Workflow version moves
  from `Retired` to `Archived` when the last Run pinned to it reaches a terminal state. A refusal
  happens that no Principal caused, such as an agent-produced UI Surface refused against the
  component catalog, where that check is not an enforcement point
  ([`ui-protocol.md`](../30-protocol/ui-protocol.md) US4). Nobody acted.
- **Platform-operator work.** Support, incident response, migration tooling and metering aggregation
  are none of the four Principal subtypes.
  [`identity-and-access.md`](../10-architecture/identity-and-access.md) section 11 separates their
  needs: aggregation needs aggregates rather than rows, maintenance and migration need schema rather
  than content, and support needs one Tenant's rows, the only one of the three that reads customer
  content.

Six facts bear on the choice.

- **Nothing may be attributed to a Principal who did not act.** Audit-model section 9 makes that
  normative, and its section 3 already records archival with its cause and no Principal. Yet
  [`lifecycle-state-machines.md`](../20-domain/lifecycle-state-machines.md) section 4.1 requires
  archival to record the acting Principal, and [`gateway-api.md`](../30-protocol/gateway-api.md)
  G16 records that one of the two has to give.
- **ADR-0012 lists a Principal among what every Audit Record has.**
  [ADR-0012](adr-0012-policy-decisions-are-audit-records.md) makes a Policy Decision a class of Audit
  Record, and states that everything true of an Audit Record, including resolving to exactly one
  Principal, is true of a Policy Decision.
- **Operator work is blocked where it is governed, and unrecorded where it is not.**
  [`policy-model.md`](../40-governance/policy-model.md) N2 fails closed every evaluation with no
  Principal, so no operator path crosses an enforcement point, and an incident response cannot stop
  a Run (identity-and-access section 7). What an operator can reach is the datastore, where a read
  of a Tenant's records produces no record at all (section 11).
- **One accountable Principal per action is the product's claim.**
  [ADR-0015](adr-0015-governed-action-positioning.md) names one accountable Principal per action,
  with no unattributed path, among the choices a superseding record would have to attack.
- **A service is never the Principal of an action**
  ([ADR-0026](adr-0026-services-call-over-http-and-publish-through-an-outbox.md)). Neither the
  service that notices a deadline passing nor a migration job can be the actor of what it does.
- **The Principal Token already names a kind.**
  [ADR-0027](adr-0027-tenant-user-management-signs-principal-tokens.md) carries `principal_kind`,
  naming a Platform User, an End User or a Service Account.

## Decision drivers

- A record never names a Principal who did not act, because a false attribution is worse than an
  acknowledged gap (audit-model section 9).
- Every act still resolves to exactly one accountable Principal, with no unattributed path
  (ADR-0015, invariant I2).
- A customer asking who touched their records gets one answer, from their own trail.
- A Tenant's trail records what happened to that Tenant's records, not Orchestra's housekeeping.
- Operator access is an exception with a reason and an end, not a standing privilege.
- No service, job or "platform" stands in for a Principal (ADR-0026).
- One mechanism for every person who acts: the Principal model, the enforcement points,
  administrative grants and the Principal Token, with nothing built beside them.
- A choice that stays cheap to reverse before the first customer (working rule 8).

## Considered options

1. **A fifth Principal subtype for all platform action**, operator work and elapsed time alike.
2. **A separate operator attribution path**, outside the Principal model.
3. **Attribute a time-caused transition to the act that configured it**, which covers no operator
   work.
4. **Split by kind.** Operator access to a Tenant's records is an act by a tenant-scoped Platform
   Operator Principal. A transition caused by an observed condition records its cause and no
   Principal. Maintenance that reads no tenant content stays out of tenant trails.

## Decision

**Option 4.**

### Operator access is an act by a Platform Operator

**A fifth Principal subtype.** A *Platform Operator* is a person acting for Orchestra on one
Tenant's records. It is tenant-scoped like every Principal: an operator who acts in three Tenants is
three Platform Operator Principals, one in each, as a person administering two Tenants is two
Platform Users. Tenant User Management owns it with every other Principal
([ADR-0024](adr-0024-global-person-with-tenant-memberships.md)). It is not a Platform User.

**Operator access is work that reads a Tenant's content or changes it**: support reading a Run, the
audit trail or an Evidence Set, incident response cancelling a Run, a correction to a Tenant's
records. Every such act:

- is performed as a Platform Operator Principal of the Tenant it touches, with one record for each
  Tenant affected, as audit-model A1 requires;
- travels the paths every Principal travels and crosses the Policy Enforcement Points on them, where
  the Principal's subtype is an input a Policy may match (policy-model N1);
- happens only under an administrative grant with an end time, issued on Orchestra's side and never
  by the Tenant, for a recorded support case or incident; without one, being a Platform Operator
  confers nothing, by the deny-by-default of [ADR-0001](adr-0001-product-shape-multi-tenant-saas.md);
- produces an Audit Record in that Tenant's trail, attributed to the Platform Operator with the
  authenticated identity behind it (audit-model A3).

No operator path reads or changes a Tenant's content except as a Platform Operator, and a path that
does is a defect rather than an exception. The datastore's operator role
([`multi-tenancy.md`](../10-architecture/multi-tenancy.md) section 4) keeps only the work that reads
no content, described below.

**No consent, and nothing around the grant.** The Tenant's consent is not required. The Tenant sees
the grant, the case it names and every act under it in its own trail. Per-Tenant consent can be
added later as an additive control, and no break-glass path exists around the grant.

**What a Tenant sees of the operator.** A Platform Operator Principal stands on no Membership. The
operator never holds a Membership in the Tenant and never appears among its people. The Tenant's
trail names the operator as the identity provider holds them, with the authenticated identity behind
the Principal (audit-model A3), as values recorded with each act rather than through a Membership.

**The Principal Token carries it unchanged.** ADR-0027's `principal_kind` gains the Platform
Operator, spelled `platform-operator` as `platform-user` is. ADR-0027 is not edited: it named the
kinds that existed, and its token needs no new claim. `audit-record.v1` adds `platform_operator` to
its Principal types.

### A transition caused by an observed condition records its cause and no Principal

An Approval Request expiring or withdrawn, a `wait` elapsing, `Retired → Archived`, and a refusal
no Principal caused are not actions. Nobody acted, so nobody is named.

- The Audit Record carries its **cause**: the condition observed, and the records it was observed
  on, by identifier.
- It carries **no Principal**, and MUST NOT be attributed to one: not to the last approver of an
  expired request, not to the author of the Policy that set its deadline, and not to the service
  that noticed. The records a cause names are its evidence, never its actor.
- A Policy Decision is never in this class. It records an evaluation for the Principal a Run acts
  for, whoever proposed the action, as policy-model D2 requires.

Invariant I2 and ADR-0015 hold as written, because both concern acts. Every act, every Policy
Decision among them, still resolves to exactly one Principal.

**This narrows ADR-0012, without editing it.** ADR-0012 counts resolving to exactly one Principal
among what is true of every Audit Record. This record narrows that statement to records of acts. A
Policy Decision always records an act, so everything ADR-0012 decides about Policy Decisions stands.

Archival records its cause and no Principal, so `lifecycle-state-machines.md` section 4.1 gives way
to `audit-model.md` section 3.

### Maintenance that reads no tenant content stays out of tenant trails

Schema migration, index and storage work, and metering aggregation, which needs aggregates rather
than rows, read no Tenant's content. They produce no Audit Record in any Tenant's trail. The test is
the content, not the tool: a job that reads what a Tenant's records say, or changes it, is operator
access to that Tenant, and the section above applies.

- **A backup of the whole database is maintenance.** It copies records without reading what any
  Tenant's records say.
- **Restoring a Tenant's records, or reading a backup's contents for a Tenant, is operator access**
  to that Tenant, recorded in its trail like any other.

What Orchestra keeps of its own maintenance is not decided here, and it is never presented as a
Tenant's audit trail.

### What stays undecided

- How a Platform Operator authenticates, and how Tenant User Management knows which verified
  subjects may act as one. That list is an Orchestra record, never a Keycloak role
  ([ADR-0017](adr-0017-keycloak-for-identity.md)).
- How Orchestra authorizes issuing a Platform Operator's administrative grant, and who may issue one.

`identity-and-access.md` section 12 registers both.

### What this amends

- `domain-model.md`: invariant I2, section 3 and both diagrams gain the Platform Operator and a
  record with no Principal, and the section 11 row is discharged. The glossary's Principal entry
  changes, and a Platform Operator entry joins it.
- `audit-model.md`: A3, section 3's enumeration, section 5, section 9, which records this decision,
  section 10's test, and the section 13 row.
- `lifecycle-state-machines.md` sections 3, 4.1 and 6.
- `audit-record.v1`: a record carries a Principal or a cause, and `platform_operator` joins the
  Principal types.
- The rules that leaned on the gap now state the answer: `policy-model.md` N1 and N2,
  `tool-authorization.md` TA14, `approval-workflows.md` D2, `threat-model.md` B6, `gateway-api.md`
  G9, G15 and G16, and `identity-and-access.md` sections 2, 3, 7 and 11.
- The register rows that sent the question to audit-model section 9 are discharged, in
  `policy-model.md`, `approval-workflows.md`, `threat-model.md`, `tool-authorization.md`,
  `identity-and-access.md`, `control-plane.md`, `multi-tenancy.md`, `system-context.md`,
  `gateway-api.md`, `ui-protocol.md`, `step-types.md` and `observability.md`.
- ADR-0012's statement that an Audit Record resolves to exactly one Principal is narrowed to records
  of acts, and ADR-0027's `principal_kind` values are extended. Neither ADR is edited.

## Rationale

**Option 1 gives the passage of time an actor.** One subtype for all platform action would name an
identity for every deadline, every `wait` and every archival although that identity did nothing, and
would make a service the actor ADR-0026 says it never is. Scoped to each Tenant, as audit-model A1
requires, it would also fill every customer's trail with maintenance.

**Option 2 gives "who touched my data" two answers.** A second attribution path keeps customer
trails clean, but a reviewer then joins Orchestra's operator log to the Tenant's trail to learn what
happened to the Tenant's records. That is the answer a security review likes least, and the second
mechanism that making the Connector a Principal avoided.

**Option 3 is half an answer, and the half it gives is false.** Naming the author of a deadline as
the actor of an expiry attributes a transition to a Principal who did not act, which audit-model
section 9 forbids, and it says nothing about operator work.

**Option 4 treats each kind as what it is.** A person reading a customer's records is an accountable
act, so it becomes an ordinary one: attributed to a Principal, governed on the same paths, and
recorded in the trail the customer reads, with nothing ADR-0027's token cannot already carry. A
grant with an end time and a recorded case keeps that access an exception the customer can read,
without making the customer an approver of Orchestra's support. A condition is not an act, so its
record says what caused it, as audit-model already requires of archival. Work that reads no content
has nothing to tell a Tenant about its records, so it stays out of the Tenant's trail, which keeps
that trail about the Tenant.

## Consequences

### Positive

- A support read, an incident cancellation or a correction appears in the affected Tenant's own
  trail, attributed to a named person: the record identity-and-access section 11 said this design
  could not produce.
- Operator access ends when its grant does, and every grant names the case it serves.
- Operator work is governed rather than blocked. N2 has a Principal to evaluate, so an incident
  response can stop a Run under an administrative grant.
- Expiry, withdrawal, a `wait` elapsing, archival and a refusal no Principal caused share one record
  shape, and the archival contradiction is gone.
- Every act still has exactly one accountable Principal, so ADR-0015's claim is unchanged.

### Negative

- **A fifth subtype.** The domain model's disjoint and exhaustive subtypes, `audit-record.v1`'s
  Principal types and the token's `principal_kind` all gain a value, and every consumer that
  branches on a subtype must handle it. The value is additive under VERSIONING rule R3.
- **An Audit Record may carry no Principal.** `audit-record.v1` stops requiring `principal` on every
  record, and a consumer that assumed one must read a cause instead.
- **Support waits on a grant.** No operator reads a Tenant's records until a grant with an end time
  is issued for a recorded case, and none reads them around the application while it is down,
  because that read would be recorded nowhere.
- **Maintenance and access are separated by a test, applied tool by tool.** A tool misclassified as
  maintenance leaves a gap in a Tenant's trail.
- Operator access across many Tenants writes a record in each, and a restore of many Tenants'
  records writes one in each of them.

### Neutral / follow-on work

- Specify in `identity-and-access.md`, before the first operator operation, how a Platform Operator
  authenticates, how operators are recorded, how Orchestra authorizes issuing a grant, and when
  Tenant User Management creates a Platform Operator Principal.
- Build the subtype into Tenant User Management, whose Principal `kind` admits three kinds today,
  with no Membership under a Platform Operator.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| An operator reads a Tenant's records around the governed path, and nothing is recorded | Medium | High | Support and incident response hold no datastore role that reads tenant content, and the operator role keeps only work that reads none; the deliberate insider stays excluded, as `threat-model.md` section 13 records |
| An operator's grant outlives its case, or serves another | Low | High | A Platform Operator's grant always carries an end time and names its case, and both appear in the Tenant's trail |
| Work that reads tenant content is classified as maintenance | Medium | High | The test is the content, not the tool; operator tooling, restores included, is reviewed against it, and a tool that reads or changes a Tenant's content acts as a Platform Operator in that Tenant |
| A customer objects to operator access without its consent | Medium | Medium | Every grant and act is in the customer's own trail, and per-Tenant consent can be added as an additive control |
| An observed condition is attributed to a Principal | Low | High | Audit-model A3 forbids naming a Principal who did not act, and `audit-record.v1` gives a record without one its own form |
| A consumer rejects an Audit Record that carries no Principal | Medium | Medium | The cause form is in the schema, VERSIONING rule R3 governs every consumer, and no consumer exists yet |

## Revisit criteria

Reopen this decision in any of these cases:

- A customer's contract requires consent before operator access, which would add per-Tenant consent
  as the additive control this record leaves room for.
- A design partner requires maintenance to appear in its trail too, or refuses Platform Operator
  Principals in its Tenant.
- Support cannot be given through the governed path in practice, because a Tenant's records are
  needed while that path is down.
- A transition turns out to have both an observed cause and an acting Principal that no record can
  separate.

## References

- [`../40-governance/audit-model.md`](../40-governance/audit-model.md) sections 3, 9 and 10: the
  archival record, the attribution class, and the audit test
- [`../20-domain/domain-model.md`](../20-domain/domain-model.md) I2 and section 3: one action, one
  Principal, and the subtypes
- [`../10-architecture/identity-and-access.md`](../10-architecture/identity-and-access.md) sections
  7 and 11: cancellation, and what an operator reaches today
- [`../20-domain/lifecycle-state-machines.md`](../20-domain/lifecycle-state-machines.md) section 4.1
  and [`../30-protocol/gateway-api.md`](../30-protocol/gateway-api.md) G16: the contradiction
  resolved here
- [`../40-governance/policy-model.md`](../40-governance/policy-model.md) N1, N2 and D2: the
  Principal as an evaluation input, failing closed without one, and what a Policy Decision carries
- [ADR-0012](adr-0012-policy-decisions-are-audit-records.md): what is true of every Audit Record
- [ADR-0015](adr-0015-governed-action-positioning.md): one accountable Principal per action
- [ADR-0026](adr-0026-services-call-over-http-and-publish-through-an-outbox.md): a service is never
  the Principal of an action
- [ADR-0027](adr-0027-tenant-user-management-signs-principal-tokens.md): the Principal Token and its
  `principal_kind`
