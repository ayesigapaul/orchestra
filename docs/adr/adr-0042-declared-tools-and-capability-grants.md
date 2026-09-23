---
title: "ADR-0042: Versions declare the Tools they may call, and capability grants are separate acts, read at every invocation and revocable at once"
adr_id: ADR-0042
status: Accepted
date: 2026-09-13
deciders: [product-owner, platform-architecture]
consulted: []
informed: []
supersedes: []
superseded_by: []
tags: [governance, security, domain, workflows]
depends_on: [ADR-0001, ADR-0011, ADR-0012, ADR-0020, ADR-0023, ADR-0040]
---

# ADR-0042: Versions declare the Tools they may call, and capability grants are separate acts, read at every invocation and revocable at once

## Status

Accepted.

## Context

Invariant I5 of [`domain-model.md`](../20-domain/domain-model.md) separates registering a Tool from
permitting a definition to call it: two relationships, two administrative acts, audited separately,
and deny-by-default, as [ADR-0001](adr-0001-product-shape-multi-tenant-saas.md) requires before any
Tool executes. [`tool-authorization.md`](../40-governance/tool-authorization.md) calls the second act
a *capability grant*, and makes a missing one a recorded `deny` naming no Policy (TA6,
[`policy-model.md`](../40-governance/policy-model.md) A4). It could not say what a grant names, how
long it lasts or how it is withdrawn, and registered those questions as needing an ADR. The product
owner has decided them.

- **The subject, and the pin.** The glossary lists *permitted tools* among the contents of an Agent
  definition. [`VERSIONING.md`](../VERSIONING.md) W1 freezes a published version, and I3 pins it for
  a Run's life. Read together, a grant carried in the version is frozen at publication, so
  withdrawing a capability means publishing a new version, which does nothing for a Run suspended
  at an Approval Request.
- **Revocation.** [`threat-model.md`](../40-governance/threat-model.md) section 14 calls an
  immediately effective revocation path what an incident response asks first. P6 pins a Run's
  Policy versions at admission ([ADR-0012](adr-0012-policy-decisions-are-audit-records.md)), and
  whether a revocation may cross a pin of that kind was open.
- **Workflows.** A `tool` Step names its Tool directly, and the domain model draws no grant edge from
  a Workflow version. [`workflow-dsl.md`](../50-workflows/workflow-dsl.md) section 11 warns that if
  naming were granting, any Platform User who may publish would hold every grant a definition can
  name.
- **A changed Side-Effect Class.** [`control-plane.md`](../10-architecture/control-plane.md)
  section 10 derives that a class never changes in place, only by re-registration. What that does
  to existing grants was left to this decision.
- **Tool schema majors.** W5 pins the major of each Tool schema a Workflow version references.
  VERSIONING section 8 extends W1 to W4 to Agent definitions, and leaves W5 out.
- **Restrictions on a call.** Whether *refunds below a value* belongs on the grant or in a Policy
  rule on the call's arguments decides whether a grant is an edge or an object with conditions.

Three facts already hold. Every attempt at a Tool invocation crosses the enforcement point again
([`execution-semantics.md`](../50-workflows/execution-semantics.md) X12). Catalog registration state
is an evaluation input that a Run does not pin, so de-registering a Tool stops the next attempt of a
Run in flight (X4, X29, X31). And grants on a de-registered Tool are retained but unsatisfiable, and
surface as a warning on the definitions holding them (X30).

Nothing here settles how a grant combines with the initiating Principal's own authority, or what
identity a Tool's origin sees. Both wait on a design partner, and `tool-authorization.md` section 6
keeps them.

## Decision drivers

- I5 holds uniformly: authoring a definition and permitting it to call a Tool are separate acts, for
  Agents and Workflows alike, and publishing grants nothing.
- Nothing a Run relies on widens under it after admission, the property I3 and P6 already give
  definitions and Policies.
- A withdrawn capability stops a Run in flight, including one suspended for days.
- A grant is consent to a Tool as it was registered, and the registered Side-Effect Class is
  authoritative at evaluation (TA9).
- A refusal under a restriction names the rule that refused, and every such rule is versioned in one
  place.
- A published version's behaviour never changes without a new version (W1).
- A choice that stays cheap to reverse before the first customer (working rule 8).

## Considered options

### What a grant names, and whether it is pinned

1. **Grants carried in the version and pinned**, so that publishing grants.
2. **Live grants naming an Agent version**, revocable at once.
3. **A declared ceiling and live grants**: the version declares the Tools it may call, and a grant is
   a separate act naming the definition and a registered Tool, read at every Tool enforcement point.
4. **Grants per Workspace.**

### Revocation

1. **None**: publish a new version instead.
2. **Immediate at the next Tool enforcement point**, Runs in flight included.
3. **Immediate only for Runs admitted after the revocation.**

### What permits a Workflow's `tool` Step

1. **Naming the Tool is the permission.**
2. **Workflows hold capability grants** on the same terms as Agents.
3. **The Step borrows the publishing Principal's authority.**

### Grants on a Tool re-registered with a different Side-Effect Class

1. **They carry over.**
2. **They stop satisfying**: retained, unsatisfiable, warned, and granted again.
3. **They carry over only to a less consequential class.**

### Whether an Agent version pins a Tool's schema major

1. **Extend W5 to Agent versions**: a bump warns, and an unserved major is a precondition deny.
2. **No pin.**
3. **Pin, and a bump suspends the version's grants** until it is republished.

### Where a restriction on a call's arguments lives

1. **A Policy rule on the arguments**, with grants on or off.
2. **An attribute of the grant.**
3. **Both.**

## Decision

**Option 3 on what a grant names**, option 2 on revocation, on Workflows and on a changed class, and
option 1 on schema majors and on restrictions.

### A version declares its Tools

An Agent version declares every Tool it may call. A Workflow version declares a Tool by naming it,
in a `tool` Step or in a compensating action declared on one
([`execution-semantics.md`](../50-workflows/execution-semantics.md) X21). The declaration is part of
the version: authored in a Draft, frozen by publication (W1) and pinned with the version by every
Run (I3). It is a ceiling. No Run invokes a Tool its pinned version does not declare, whatever is
granted. Declaring grants nothing, and naming a Tool in a `tool` Step is a declaration, never a
grant. The glossary's *permitted tools* becomes *declared tools*.

### A capability grant is a separate administrative act

A capability grant names one definition, an Agent or a Workflow, and one Tool registered in the same
Tenant's Tool Catalog (TA2). It names the definition and never a version, so a new version needs no
new grant for a Tool already granted, and a Tool a version declares for the first time needs one.
Authoring declares and administration grants: each grant and each revocation is an administrative
act with exactly one Principal and its own Audit Record (TA3). A Workflow holds grants on exactly
the terms an Agent does.

The calls the model chooses inside an `agent` Step belong to the Agent version it delegates to, and
the `tool` Steps inside a `subworkflow` Step belong to the child Workflow version. That version's
declaration bounds them, and grants naming its definition satisfy them.

### What a Tool enforcement point requires

An invocation proceeds only when every one of these holds:

1. The Tool is registered in the Tenant's Tool Catalog.
2. The version the Run pinned declares it.
3. A capability grant naming that definition and the Tool stood when the Run was admitted, still
   stands, and was given for the Side-Effect Class the Tool is registered with now.
4. The Tool's origin still serves the schema major the version pins.
5. Policy permits it.

A failure of any of the first four is a precondition `deny` naming no Policy, recorded like every
other Policy Decision ([`policy-model.md`](../40-governance/policy-model.md) A4). A grant and a
verdict stay ordered, never alternatives (TA10).

**No Run gains a capability after admission.** The grant is read afresh at every Tool enforcement
point, every attempt included (X12), and it satisfies only while it stands. A grant made after a Run
was admitted does not reach that Run, even for a Tool its version declares, so a Run's capabilities
can narrow over its life and never grow. Which grants stood at admission is recorded when the Run is
admitted, and the enforcement point decides from that record, never by comparing clocks
(`policy-model.md` N3, [`audit-model.md`](../40-governance/audit-model.md) A7).

### Revocation takes effect at once

Revoking a capability grant takes effect at the next Tool enforcement point, Runs in flight included.
A Run suspended at an Approval Request resumes into an enforcement point that refuses the call, and
the approval authorizes nothing the grant no longer permits, as `execution-semantics.md` section 9
finds for a de-registered Tool. P6's pin stops an edit changing a verdict mid-Run. It was never meant
to preserve a capability an administrator has withdrawn, and a revocation only narrows. Granting the
Tool again makes a new grant, which reaches only Runs admitted after it.

A revocation is not refused or deferred because a Run in flight holds a side effect it may still need
to compensate. A compensating action needs a grant like any other invocation (X16). Where a
revocation strands one, the Run's compensation outcome is `unresolved`, under ADR-0040.

### A changed Side-Effect Class stales grants

When a Tool is re-registered with a different Side-Effect Class, every existing grant on it stops
satisfying. The grants are retained, unsatisfiable, flagged with a staleness warning on the
definitions holding them, and must be granted again: the shape X30 gives grants on a de-registered
Tool. The registered class is authoritative (TA9) and Policy keys on it, so a grant is consent to the
Tool as it was classed, and consent to a `read` Tool is not consent to a `financial` one. A stale
grant never satisfies again, even if the class is changed back.

### W5 extends to Agent versions

An Agent version pins the schema major of each Tool it declares, as a Workflow version pins each
Tool it references. A Tool's major bump surfaces as an actionable warning in the Control Plane and
never alters a published version, its declaration or a grant. When a Tool's origin no longer serves
the major a Run's version pins, the invocation is a precondition `deny` (A4). The remedy is a new
version pinning a major the origin serves.

### A restriction on a call is a Policy rule

A parameter-level or row-level restriction, such as *refunds below a value* or *orders in a region*,
is a Policy rule on the proposed action's arguments (`policy-model.md` S2). A capability grant is an
on-or-off edge, and carries no condition on an invocation.

### What this does not decide

- **Syntax.** How a declaration and a grant are written, their schemas, and how a grant is addressed
  on the Gateway contract. [`gateway-api.md`](../30-protocol/gateway-api.md) section 8 lists both
  schemas as unplanned, and its section 9 registers the endpoint shape.
- **The live read.** How a Tool enforcement point reads current grant and registration state at every
  attempt: a call to the owning service, or a view kept current from its facts. Where the owner is
  another service, [ADR-0020](adr-0020-monorepo-with-enforced-service-boundaries.md) rule B4 rules
  out reading its tables. A view satisfies this decision only if it never serves a grant its owner
  has recorded as revoked.
- **Revival.** Whether a grant left unsatisfiable by de-registration satisfies again when the Tool is
  registered again, and whether a re-registration that changes a Tool's origin but not its class
  leaves grants satisfying.
- **Detection.** How Orchestra learns which schema major an origin serves. That is the drift
  detection TA9 registers, and nobody has designed it (`threat-model.md` T2).
- **How a restriction is written.** A rule on arguments waits on the policy language, which
  `policy-model.md` section 8 reserves for an ADR.
- **Delegated authority.** How a grant combines with the initiating Principal's authority, and what
  identity the origin sees (`tool-authorization.md` section 6).
- **What a Run does next.** What a Run does after a refusal at a Tool enforcement point.
- **Step classes.** What Side-Effect Class an `agent` or `subworkflow` Step carries. The declaration
  makes the Tools its delegation can reach knowable at publication, and nothing more is decided here.

### What this amends

- `tool-authorization.md` gains rules TA19 to TA26 in a rewritten section 8. Sections 1 and 2, TA5,
  TA6, section 4, the section 5 diagram and TA14 follow, and section 10 loses the rows this decision
  answers.
- `domain-model.md` I5 and sections 5, 6, 8 and 11, and the glossary's Agent and Tool Catalog
  entries, beside a new entry for *capability grant*.
- VERSIONING section 8: W5, and the line extending W1 to W4 to Agent definitions.
- `policy-model.md` P6, the section 3 diagram, N1, A2, A4 and S2, and two rows of its section 9.
- `execution-semantics.md` X4, X12, X13's closing paragraph, section 9 and X31, and two rows of its
  section 11.
- `step-types.md` sections 5, 6 and 13, and `workflow-dsl.md` L7 and section 11.
- `control-plane.md` sections 4, 10 and 13, `identity-and-access.md` sections 1, 8 and 12, and
  `gateway-api.md` sections 5, 7 and 9.
- `threat-model.md` C1, T3 and section 14, `audit-model.md` section 3,
  `lifecycle-state-machines.md` section 4, and `data-plane.md` section 4, with a row in its
  section 11 for the live read.
- `http-conventions.md` HC9 and the `governance.precondition_denied` registration.
- *Permitted tools* becomes *declared tools* in `vision.md`, and the invoice-payment example names
  the declaration and the grants its Tool enforcement point checks.
- The `$comment` members of `run.v1`, `policy-rule.v1` and `workflow-definition.v1`, with no change
  to what they validate.

## Rationale

**The declared ceiling keeps two acts apart and still revokes at once.** Option 1 makes publishing a
grant, so anyone who may publish holds every grant they can name, and withdrawal needs a separate
kill switch. Option 2 revokes at once, but a new grant widens a Run already in flight, and every
republish means granting again. Option 3 keeps the half of each that holds. The declaration is
frozen with the version, so what a Run can reach is fixed when it is admitted. The grant is
administrative and read at every attempt, so it can be withdrawn the way X29 withdraws a Tool.
Naming the definition rather than the version spares a new grant on every republish. Option 4 would
let sharing a Workspace confer a capability, which TA4 forbids. The cost is two things to author per
Tool.

**A grant made after admission does not reach a Run, because no Run gains a capability after
admission.** A ceiling alone would let a grant inside it reach a Run suspended since before the grant
existed. That is a widening under a Run in flight, which is what P6 stops for Policies. Reading grants
live serves withdrawal, and withdrawal only narrows.

**Revocation is immediate because an incident cannot wait for Runs to end.** Option 1 leaves a Run
suspended at an approval holding the capability. Option 3 leaves exactly the Runs in flight open, and
those are the ones an incident is about. A revocation never widens anything, so crossing a Run's
admission is safe in the one direction it goes. Its cost, a stranded compensation, is recorded as
`unresolved` under ADR-0040 rather than hidden.

**Workflows hold grants because naming is authoring.** Option 1 would make publication an
authorization-granting act for Workflows alone, the weakening `workflow-dsl.md` section 11 warns
about. Option 3 would confuse an administrative grant held by a Platform User with a capability grant
held by a definition, which [`identity-and-access.md`](../10-architecture/identity-and-access.md)
section 1 keeps apart. Option 2 keeps I5 uniform.

**A class change stales grants because the class is what was consented to.** TA9 makes the
registered class authoritative, and Policy keys on it. Option 1 lets a grant given for a `read` Tool
silently cover a `financial` one. Option 3 needs an ordering of classes nothing defines. Option 2
reuses X30's shape, so a stale grant is neither lost to audit nor honoured.

**W5 extends to Agent versions because W1 already applies to them.** Without a pin, a published Agent
version's behaviour changes when its Tools' schemas change, which W1 forbids. Suspending grants on a
bump would turn a schema change into an outage. A precondition deny on an unserved major refuses only
the call that can no longer be made as published.

**Restrictions live in Policy because Policy already matches arguments and is versioned for audit.**
S2 lets a rule match a payee, an amount or a record, and ADR-0012 versions Policies and pins them. A
restriction on a grant would refuse through a precondition deny naming no Policy, so the trail could
not say which rule refused. Allowing both would let a restriction hide in two places.

## Consequences

### Positive

- Publishing grants nothing, for Agents and Workflows alike, and I5 holds without an exception.
- An administrator withdraws a capability in one act, and it stops Runs in flight at their next call.
- What a Run can reach is fixed at admission and can only narrow.
- A new version of a definition keeps its grants for the Tools it still declares.
- A class change can never extend consent silently.
- Every restriction on arguments sits in a versioned Policy, and a refusal under one names the
  version.

### Negative

- **Two things to author per Tool**: a declaration in the version and a grant for the definition.
  Unless something shows the gap earlier, a missing grant appears first as a refusal at run time.
- A grant made while a Run is in flight never reaches it, even for a declared Tool. An administrator
  who grants late, or grants again after a revocation, has to start a new Run.
- A revocation can strand compensation, and leave a known side effect `unresolved`.
- Every Tool enforcement point reads live grant state at every attempt, beside registration state.
  The mechanism is undecided, and it may add a dependency to the enforcement path.
- A class change forces a new grant on every definition holding one, and Runs in flight lose the Tool
  for good.
- A restriction in a Policy is pinned at admission (P6), so tightening one does not reach a Run in
  flight. Only a revocation or a de-registration does, and each removes the Tool outright.
- More failures now produce a `deny` naming no Policy: an undeclared Tool, a grant made after
  admission, a revoked or stale grant, an unserved major. The Policy Decision has to record which.

### Neutral / follow-on work

- Specify the declaration in the Agent definition, and the capability grant resource, with the
  schemas `gateway-api.md` section 8 lists, once the endpoint shape exists.
- Record in each Tool enforcement point's Policy Decision the grant it relied on, or the precondition
  that failed (`policy-model.md` D2 and N3).
- Decide how the enforcement point reads grant and registration state, which `data-plane.md`
  section 11 registers.
- Place the staleness warning beside X30's, on the surface `control-plane.md` section 5 places.
- Check both identifiers a grant holds in its table's write policy, as
  [ADR-0023](adr-0023-no-foreign-key-constraints.md) requires of every reference within a schema.
- Tool registration and component catalog registration stay Tenant-scoped, with a Workspace
  narrowing only which Tools a grant may name when the grant is authored
  (`identity-and-access.md` section 8). That needed no ADR, and `control-plane.md` section 10 and
  `ui-protocol.md` CC1 record it.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| A Run suspended since before a grant is refused a Tool its administrator meant it to use | Medium | Low | The refusal is a recorded precondition deny naming the missing grant, and a new Run picks the grant up |
| The live read lags, and a revoked grant is honoured | Medium | High | A read that cannot complete never yields `allow` (`policy-model.md` A3); no mechanism may serve a grant its owner recorded as revoked, and the choice is registered |
| A revocation during an incident strands compensation | Low | High | The compensation outcome is `unresolved` under ADR-0040, and resolving the effect is a new governed act |
| Authors publish versions whose declared Tools hold no grant | High | Medium | Each first call is a precondition deny naming the missing grant; a Control Plane view of declared Tools with no standing grant is the obvious aid, and is not decided here |
| An origin stops serving a pinned major and nothing notices | Medium | High | Arguments are validated against the registered schema, never one fetched at invocation (`threat-model.md` T2); drift detection is registered under TA9 |
| A Workspace is read as a capability boundary | Low | Medium | TA4 and TA26: a Workspace narrows which Tools a grant may name when it is authored, never at an enforcement point |

## Revisit criteria

Reopen this decision in any of these cases:

- Design partners find two authoring acts per Tool unworkable, and a grant made by a separate
  reviewer at publication would serve them better.
- Administrators routinely need a new grant to reach Runs already suspended, so that holding
  admission as the limit costs more than it protects.
- Reading grant state at every attempt is measured to cost the enforcement path more than immediate
  revocation is worth.
- The design-partner answer on delegated authority (`tool-authorization.md` section 6) needs a grant
  that carries more than an on-or-off edge.

## References

- [`../40-governance/tool-authorization.md`](../40-governance/tool-authorization.md) sections 2 to 8
  and 10: grants, and the register this discharges
- [`../20-domain/domain-model.md`](../20-domain/domain-model.md) I3 and I5, and
  [`../VERSIONING.md`](../VERSIONING.md) section 8: pinning, and W1 to W5
- [`../40-governance/policy-model.md`](../40-governance/policy-model.md) P6, N1, A2, A4 and S2
- [`../50-workflows/execution-semantics.md`](../50-workflows/execution-semantics.md) X12, X16 and X29
  to X31: every attempt evaluated again, and de-registration in flight
- [`../10-architecture/control-plane.md`](../10-architecture/control-plane.md) section 10 and
  [`../10-architecture/identity-and-access.md`](../10-architecture/identity-and-access.md) section 8:
  re-registration, and the Workspace as an authoring constraint
- [`../40-governance/threat-model.md`](../40-governance/threat-model.md) T2, T3 and section 14
- [ADR-0012](adr-0012-policy-decisions-are-audit-records.md): versioned Policies, pinned at admission
- ADR-0040: the Run's compensation outcome
