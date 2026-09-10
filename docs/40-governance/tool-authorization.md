---
title: Tool Authorization
doc_id: DOC-053
version: 0.7.0
status: Draft
last_updated: 2026-09-09
owners: [platform-architecture]
depends_on: [ADR-0001, ADR-0003, ADR-0005, ADR-0007, ADR-0008, ADR-0009, ADR-0011, ADR-0012, ADR-0013]
---

# Tool Authorization

**Normative.** This document fixes which Agent may invoke which Tool, and on whose behalf. It
composes with [`policy-model.md`](policy-model.md) rather than duplicating it: a capability grant
is an input to a Policy Enforcement Point, never a parallel mechanism that decides on its own. It
composes likewise with
[`../20-domain/lifecycle-state-machines.md`](../20-domain/lifecycle-state-machines.md), which owns
what a Run does after a verdict. Requirement keywords carry their
[RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) meanings, and numbered rules are labelled
`TA1`–`TA18` so other documents can cite them.

Orchestra is pre-implementation and pre-customer. Everything below either follows from an Accepted
ADR, from [`../GLOSSARY.md`](../GLOSSARY.md), or from
[`../20-domain/domain-model.md`](../20-domain/domain-model.md), or is marked unmade and registered
in section 10. No grant syntax, threshold, retry count or retention period appears here, because
none has been decided. The term is **capability grant**, as the domain model names it and as
[`policy-model.md`](policy-model.md) rule A2 uses it; **grant** is its short form here and not a
second term. [`../GLOSSARY.md`](../GLOSSARY.md) has no entry for either and should gain one, with
*grant* recorded there as the short form so the two cannot drift into synonyms.

## 1. Scope

**In scope.** The separation of registration from permission; deny-by-default; the Side-Effect
Class as a declared, non-negotiable input; where authorization is evaluated; the two authorities
that bear on an invocation; and the enforcement points on the connector path.

**Out of scope, and where it lives.** The policy language and verdict semantics —
[`policy-model.md`](policy-model.md). Routing, delegation and escalation of a `require_approval`
verdict — [`approval-workflows.md`](approval-workflows.md). What is recorded and for how long —
[`audit-model.md`](audit-model.md). Prompt injection, tool poisoning, egress and SSRF —
[`threat-model.md`](threat-model.md). How a Principal authenticates — the unwritten
`identity-and-access.md` in [`../10-architecture/`](../10-architecture/).

## 2. Two relationships, two questions

Invariant **I5** of [`../20-domain/domain-model.md`](../20-domain/domain-model.md) states it: *a
Tool existing in a Tenant's Tool Catalog and an Agent being permitted to call it are two
relationships, created by two administrative acts and audited separately. Authorization is
deny-by-default: registration grants nothing.* Collapsing them is the likeliest way to build a
platform that believes it is governed and is not.

| Relationship | Question it answers | Administrative act |
| --- | --- | --- |
| Tool Catalog registers Tool | Does this capability exist and is it available for binding in this Tenant? | Registration by a Platform User, recording the Side-Effect Class and the origin |
| Agent version is permitted to call Tool | May this Agent invoke it? | A capability grant, a separate act with its own record |

**TA1.** Registration MUST NOT imply permission. An implementation in which registering a Tool
makes it callable by any Agent violates I5 and ADR-0001's requirement for a tenant-scoped,
deny-by-default authorization model before any tool executes.

**TA2.** A capability grant MUST name a Tool registered in the same Tenant's Tool Catalog, and a
grant MUST NOT be creatable against a Tool outside the granting Tenant. There is one Catalog per
Tenant and every record is tenant-scoped (I1,
[ADR-0011](../adr/adr-0011-tenant-isolation-shared-schema-rls.md)), which places isolation below
application code rather than in it. By what structure a cross-tenant grant is kept out of the
datastore — tenant-qualified keys, check constraints, or how row-level security interacts with
referential integrity — is not decided here: ADR-0011 names `multi-tenancy.md` in
[`../10-architecture/`](../10-architecture/) as its home, and section 10 carries the question.

**TA3.** Each act MUST resolve to exactly one Principal (I2) and MUST be audited independently. A
trail showing that a Tool was registered but not who granted it answers half the question.

**TA4.** A Workspace is not an isolation boundary (domain model, section 3), and MUST NOT be
treated as a substitute for a grant in either direction: sharing a Workspace confers no
capability, and a Workspace boundary is not what stops one.

## 3. Deny by default

**TA5.** An Agent MUST NOT invoke a Tool for which no capability grant is held; an Agent holds
exactly the capabilities granted to it and no others. This is invariant I5 and
[ADR-0001](../adr/adr-0001-product-shape-multi-tenant-saas.md)'s deny-by-default precondition
stated over grants, as [`policy-model.md`](policy-model.md) rule A1 states the same posture over
Policies.

**TA6.** The absence of a matching capability grant MUST yield a recorded `deny` Policy Decision,
not a missing record. Catalog registration state and the Agent version's grant set are inputs to
the enforcement point rather than gates in front of it, so a failed precondition is decided there
like any other outcome; the shape of the record — a `deny` naming no Policy, because no Policy was
reached — is specified by [`policy-model.md`](policy-model.md) rule A4 and is not restated here.
*No grant matched* is an outcome, and a trail silent in that case cannot distinguish a refusal from
an invocation that never happened.

**TA7.** The grant set is closed at evaluation time. An Agent MUST NOT acquire a capability from
model output, Tool output, retrieved content, a UI Action, or an origin's own advertisement of
what it can do. This is [ADR-0003](../adr/adr-0003-governance-layer-positioning.md) applied to
authorization — policy, not prompts, is the security boundary — and one of the commitments
[`../00-overview/product-thesis.md`](../00-overview/product-thesis.md) section 3 defers here.

**TA8.** Reachability is not authority. Orchestra holding a credential for an origin, or a
Connector holding an open session to one, MUST NOT be read as permission to invoke anything
through it. The domain model keeps reachability on a third axis precisely so the two cannot merge.

## 4. The Side-Effect Class

Every Tool declares a Side-Effect Class — `read`, `write`, `destructive`, `financial`,
`external-communication` — and it is a primary input to Policy. It is an enumerated value, and
adding one is a contract change under [`../VERSIONING.md`](../VERSIONING.md) rules R2 and R3.

**TA9.** The class is declared at registration, and the value recorded in the Catalog is
authoritative at evaluation. It MUST NOT be supplied, overridden or influenced at invocation time
by model output, by the Run, or by the origin's advertised metadata. A Tool that could call itself
`read` on the call that mattered would make every rule keyed on the class advisory. The same holds
of the rest of the registered record: divergence between the name, description, schema and class
captured at registration and what the origin now serves MUST NOT be adopted silently
([`threat-model.md`](threat-model.md) T2). How such drift is detected, and what follows from
detecting it, is unmade and registered in section 10.

**TA10.** The Side-Effect Class MUST NOT be treated as a substitute for a capability grant, and a
grant MUST NOT be treated as a policy verdict ([`policy-model.md`](policy-model.md) rule A2). A
`read` Tool needs a grant like any other; a grant on a `financial` Tool does not authorize the
invocation, because the enforcement point still evaluates Policy and may return `require_approval`
or `deny`. The two are ordered, not alternatives.

An origin's MAJOR schema bump is settled for one case only. Under
[`../VERSIONING.md`](../VERSIONING.md) rule W5 a workflow version pins the *major* version of each
Tool schema it references, so a bump does not retroactively alter published workflows and surfaces
as a control-plane warning. W5 is pointedly excluded where that document extends W1–W4 to Agent
definitions, so whether an Agent version pins a Tool's major schema version, and what a bump does
to that version's grants, is not settled — which bears directly here, since the relationship this
document governs is Agent version to Tool. Whether a *registered* Tool's class may be changed once
grants exist is not settled either. Both are in section 10.

## 5. Where authorization is evaluated

A Policy Enforcement Point is a place in the execution path, not a record. One sits before any
Tool invocation ([`policy-model.md`](policy-model.md) rule E1), and the compiler emits it
structurally, so it cannot be bypassed by how a definition is written (rule E2). Neither rule is
restated here. What this document adds is where that evaluation may happen, and that the two
authorization preconditions reach it as inputs.

**TA11.** Authorization MUST be evaluated at a Policy Enforcement Point in Orchestra's Data Plane
([`../GLOSSARY.md`](../GLOSSARY.md)), before the invocation leaves the platform. The gate composed
of the grant and the Policy verdict MUST NOT be delegated to the client, to the Agent, or to the
Tool origin. An origin may enforce its own controls as well, and should; whether Orchestra may
*rely* on an origin's own per-caller check, or whether it is strictly defence in depth, is one of
the open questions in section 6 and is not decided by this rule.

**TA12.** Every evaluation that completes MUST produce a Policy Decision, recorded whether the
verdict is `allow`, `deny` or `require_approval`. That requirement is
[`policy-model.md`](policy-model.md) rule D1, cited rather than restated, and it holds because
recording only refusals yields evidence of enforcement rather than of what happened. What an
evaluation that cannot complete records is left open by rule A3. The record is durable before the
invocation is attempted: a Policy Decision is a class of Audit Record
([ADR-0012](../adr/adr-0012-policy-decisions-are-audit-records.md)) whose write is fail-closed
([ADR-0013](../adr/adr-0013-fail-closed-policy-decision-writes.md)), so an invocation whose
decision could not be written MUST NOT proceed.

```mermaid
flowchart TD
  subgraph ACTS["Two administrative acts — I5: neither implies the other"]
    REG["Register Tool in the Tool Catalog"]
    GRANT["Capability grant: this Agent version may call this Tool"]
  end
  RUN["Run proposes a Tool invocation"] --> IN
  IN["Evaluation inputs: registration state, grant set, Side-Effect Class, Principal, proposed action"]
  REG -.->|"registration state, an input"| IN
  GRANT -.->|"grant set, an input"| IN
  PRIN["Initiating Principal — how its own authority combines is UNDECIDED, section 6"] -.-> IN
  DENY["Policy Decision: deny — audited. A failed precondition names no Policy, policy-model A4"]
  subgraph PEP["Policy Enforcement Point — before the call leaves Orchestra"]
    POL["Evaluate: preconditions and Policy, one verdict"] --> V{"Verdict"}
  end
  IN --> POL
  V -->|"deny"| DENY
  V -->|"require_approval"| APPR["Approval Request — the Run suspends"]
  V -->|"allow"| CONN{"Reached through a Connector?"}
  CONN -->|"no"| INVOKE["Invoke the Tool"]
  CONN -->|"yes — ADR-0007 is Proposed"| ALLOW["Connector's tool allow-list, if it carries one"]
  ALLOW -->|"refused"| REF["Governance-visible refusal, not a transport error"]
  ALLOW -->|"permitted"| INVOKE
```

Authorization is evaluated per invocation, whether or not that invocation has a Step Execution to
key on — the domain model records that a Tool call inside an Agent Run has none under the current
model, and marks it that document's most consequential gap. The enforcement point does not wait on
the answer; the record it writes does.

What a Run does after a `deny` is settled at admission and only there.
[`../20-domain/lifecycle-state-machines.md`](../20-domain/lifecycle-state-machines.md) section 2
takes `Pending` to the terminal `Denied` on an admission deny, and section 2.1 requires that
decision audited whichever way it goes. That state machine has no transition out of `Running` for a
refusal, so a `deny` at a Tool enforcement point mid-Run has no defined effect on the Run. Section
10 registers it, next to the adjacent question [`policy-model.md`](policy-model.md) rule V1 already
carries.

## 6. On whose behalf — the confused deputy

[ADR-0003](../adr/adr-0003-governance-layer-positioning.md) names the confused deputy as requiring
threat modelling. The concrete case: an End User who may not issue a refund asks an Agent that
holds a grant on the refund Tool. If the grant alone decides, Orchestra has laundered authority
the End User never held, and every per-user control in the origin is bypassed by asking politely.

**TA13.** Policy MUST be able to discriminate on the initiating Principal and its subtype. A rule
language that cannot express *this Agent version, for this class of requester* cannot express the
deputy problem at all ([`threat-model.md`](threat-model.md) T3). This is a requirement on
expressiveness, which the platform can meet from inputs it holds; it is not a claim that Orchestra
knows what the caller could have done unaided, and it settles nothing about how the two
authorities combine.

A capability grant is a ceiling on what an Agent version can ever do. It is not a statement about
what this caller could have done alone, and it MUST NOT be recorded as the sole basis for an
invocation made on another Principal's behalf — a negative that follows from I5 without deciding
the combination rule. Whether authorization must additionally *weigh* the initiating Principal's
own authority is the open question below, not a requirement of this section, because what Orchestra
knows of that authority is itself undecided.

**TA14.** The initiating Principal MUST be an input available at the enforcement point and MUST be
recorded in the resulting Policy Decision ([`policy-model.md`](policy-model.md) rules N1 and D2).
By I2 there is always exactly one, so *no caller* is not a case to design for: a scheduled Run
resolves to a Service Account, and traffic arriving through the connector fabric resolves to the
Connector, a disjoint Principal subtype (domain model section 3). The deputy problem has the same
shape for every subtype — a Platform User or Service Account with narrow rights invoking an Agent
version that holds a broad grant is the same laundering — so the End User above is the
illustration, not the boundary. The acknowledged hole is platform-operator action, which the domain
model marks as having no Principal subtype; policy-model rule N2 fails such an evaluation closed,
so no operator path may cross an enforcement point until attribution is decided. Section 10 carries
it.

**How the two authorities combine is a design choice nobody has made, and this document does not
make it.** Intersection is the intuitive answer and is not obviously right: an Agent whose purpose
is to perform, under approval, an action its caller cannot perform unaided is a legitimate and
probably common pattern. Three connected questions are open, and they are one decision rather than
three.

- What Orchestra knows of an End User's authority at all. It lives in the customer's systems, and
  Orchestra meets the End User through a Session Token the glossary calls *narrowly scoped*
  without saying what a scope contains.
- What identity the origin sees: Orchestra's own service identity, a delegated End User identity,
  or an exchanged on-behalf-of credential. This decides whether the origin can apply its per-user
  controls, and so whether the deputy problem is solved or merely described.
- Whether an origin's own check may be relied upon, or is strictly defence in depth.

The decision spans the Gateway, the Tool Catalog, credential custody, the connector path and
audit, and is expensive to reverse once tokens are minted one way. It needs an ADR, informed by
[`threat-model.md`](threat-model.md) and by a design partner.

## 7. Tools reached through a Connector

> **This section rests on a Proposed decision.**
> [ADR-0007](../adr/adr-0007-outbound-connector-for-enterprise-reachability.md) binds only after
> design-partner validation. If it is rejected, this section leaves the specification and Tools are
> reached only over direct HTTPS — nothing in sections 2 to 6 changes, which is the point of
> keeping reachability on an axis of its own.

ADR-0007 lists tool allow-listing at the connector among the controls its own threat model must
carry, and [`threat-model.md`](threat-model.md) T7 makes it normative: the Connector MUST enforce a
local Tool allow-list. That requirement is conditional on ADR-0007 binding and void with it, like
the rest of this section — but its existence is not in question while the ADR stands. Authorization
is therefore enforced twice on this path: at Orchestra's enforcement point, and at the customer's
connector. The duplication is deliberate rather than redundant, because the second enforcement is
the customer's own control and survives a compromise of the first.

**That would be deliberate, and it would not be redundancy.** The two lists sit in different trust
domains, are authored by different parties, and change under different control. The connector's
list would be the customer's last control if Orchestra's Control Plane is misconfigured or
compromised — precisely what a security review asks about, and not answerable by a control
Orchestra alone administers. Whether the list exists at all rides on ADR-0007 binding, and section
10 routes it to `connector.md` with the rest.

**TA15.** A decision MUST NOT vary by transport. ADR-0007 requires a direct HTTPS session and a
tunnelled one to be indistinguishable to everything above the transport, so the same grant and the
same Policy MUST produce the same verdict either way.

**TA16.** A refusal at the connector MUST surface as a governance-visible outcome rather than a
transport error. Reported as a transport failure it is indistinguishable from an outage, and the
trail then records a fault where a control operated.

**TA17.** A connector refusal MUST NOT be worked around by choosing another route to the same Tool.
Route-shopping past the second list is the one way the customer's last control can be undone from
inside Orchestra.

**TA18.** A connector refusal, or a tunnel drop mid-call, MUST NOT be retried blindly: the
invocation is in an unknown state, and unknown is not the same as not done. This is invariant I4
and [ADR-0008](../adr/adr-0008-declarative-workflow-definitions.md)'s prohibition on blind retry of
a side effect, applied to the connector path; idempotency, retry and compensation live at Step
Execution and not here.

How divergence between the two lists is detected, reported and reconciled is undecided, as is
whether Orchestra may read the connector's list at all; both belong to `connector.md` in
[`../10-architecture/`](../10-architecture/), after ADR-0007 binds.

## 8. What a grant does not say

**Syntax and subject.** No grant syntax exists, and whether a grant is authored per Agent, per
Agent version, per Workspace, or at several levels and composed, is unmade — and sharper than it
looks. [`../GLOSSARY.md`](../GLOSSARY.md) lists *permitted tools* among the contents of the
versioned Agent definition; [`../VERSIONING.md`](../VERSIONING.md) rule W1 makes a published
version immutable; invariant I3 pins a Run to its version for life. Read together, a
definition-carried grant is frozen at publication and a Run in flight keeps the set it started
with — defensible, with an uncomfortable corollary: withdrawing a capability means publishing a
new version, which does nothing for a Run already suspended on an approval. Whether a separate,
immediately effective revocation path exists, and whether it overrides the pin, is what an
incident response asks first.
[ADR-0012](../adr/adr-0012-policy-decisions-are-audit-records.md) has since settled the analogous
question for Policies — immutably versioned, pinned at admission for the life of the Run — which
makes the same shape the obvious candidate here. It does not decide it: ADR-0012 governs Policies,
and the grant subject is still unfixed.

**A Workflow Step that names a Tool.** A `tool` Step names exactly one Tool, and the domain model
draws no grant edge from a Workflow version to a Tool at all. So either authoring the Step is
itself the permission — which weakens I5 for Workflows, since one act would both name and permit —
or Workflows need a grant subject the model lacks. Unmade, and it moves the authorization data
model and the Workflow schema together.

**Parameter-level and row-level restriction.** Whether a grant can say *this Tool, but only for
refunds below a value*, or *only for orders in this region*, is undecided, and the prior question
is where such a constraint belongs: an attribute of the grant, or a Policy rule keyed on the
invocation arguments. The answer decides whether a grant is a boolean edge or a
constraint-carrying object, which is why it is an ADR rather than a schema detail.

**De-registration.** What happens to existing grants, and to Runs in flight, when a Tool is
removed from the Catalog is unspecified; the domain model covers Tenant deletion and version
retirement and is silent here.

## 9. Audit and metering

Every authorization decision is a Policy Decision, and a Policy Decision is a class of Audit Record
rather than a neighbour of one
([ADR-0012](../adr/adr-0012-policy-decisions-are-audit-records.md)). Everything
[`audit-model.md`](audit-model.md) requires of an Audit Record therefore holds of it without
restatement — append-only, immutable, tenant-scoped, one Principal, allows included — including
that it stays readable after the Tool, Agent version or Principal it names is deleted, which is
that document's rule A5. The Policy version evaluated is referenced, not embedded, and a Run pins
the Policy versions in force at admission for its life, so editing a Policy never changes the
verdict a Run already in flight receives.

The write is fail-closed
([ADR-0013](../adr/adr-0013-fail-closed-policy-decision-writes.md)): a Policy Decision MUST be
durable before the gated invocation is attempted, and an invocation whose decision cannot be
written MUST NOT proceed. Other Audit Records may degrade — buffered, retried, written behind the
action — provided the degraded period is recoverable from the trail rather than silent, and the
classification is a property of the record class and MUST NOT be a runtime choice. Both
administrative acts in section 2 are audited separately (TA3).
[ADR-0009](../adr/adr-0009-meter-first-defer-tiering.md) meters Tool invocations by Tool and
Side-Effect Class; whether a refused invocation counts as one is undecided, and metering is not
retroactive, so settle it before the first Run.

## 10. Open questions

Every row is a decision this document could not make. The last column says whether it needs an
ADR, because it is costly to reverse or spans components, or whether a later document settles it.

| Question | What would decide it | ADR required? |
| --- | --- | --- |
| Grant syntax, and whether a grant is authored per Agent, per Agent version, per Workspace, or composed across levels | This document once the subject is fixed; it constrains the Agent definition schema and the Control Plane at once | **ADR** |
| Whether the grant set is carried by the immutable Agent version, and so pinned for the life of a Run | The same decision, read against VERSIONING rule W1 and invariant I3 | **ADR** |
| Whether an immediately effective revocation path exists, and whether it overrides a Run's pin | Incident-response requirements and [`threat-model.md`](threat-model.md) | **ADR** |
| How the Agent's grant combines with the calling Principal's own authority | [`threat-model.md`](threat-model.md) plus design-partner validation | **ADR** |
| What identity the Tool origin sees — Orchestra service identity, delegated End User, or an exchanged credential | The same decision; it spans the Gateway, credential custody and the connector path | **ADR** |
| Whether a `tool` Step naming a Tool is itself the permission, or Workflows need a grant subject of their own | This document with the workflow DSL in [`../50-workflows/`](../50-workflows/) | **ADR** |
| Whether parameter-level or row-level restriction is a grant attribute or a Policy rule | Jointly with [`policy-model.md`](policy-model.md) | **ADR** |
| Whether a Workspace constrains which Tools a grant may name | `identity-and-access.md` in [`../10-architecture/`](../10-architecture/) | Later document |
| By what structure a cross-tenant grant is kept out of the datastore, given that row-level security filters rather than forbids (TA2) | `multi-tenancy.md` in [`../10-architecture/`](../10-architecture/), which [ADR-0011](../adr/adr-0011-tenant-isolation-shared-schema-rls.md) names as its home | Later document |
| Whether an Agent version pins a Tool's major schema version, and what a Tool MAJOR bump does to that version's grants | This document, with the grant-subject question; [`../VERSIONING.md`](../VERSIONING.md) is where the outcome is written, not where the choice is made | **ADR** |
| How post-registration drift between the registered Tool record and what the origin now serves is detected, and what follows from detecting it (TA9) | This document with [`threat-model.md`](threat-model.md) T2, once a detection design exists | Later document |
| What a Run does after a mid-Run `deny` at a Tool enforcement point, which the Run state machine has no transition for | [`../20-domain/lifecycle-state-machines.md`](../20-domain/lifecycle-state-machines.md) section 2 with `execution-semantics.md` in [`../50-workflows/`](../50-workflows/), aligned with [`policy-model.md`](policy-model.md) rule V1, which owns it | **ADR** |
| Whether a registered Tool's Side-Effect Class may be changed once grants exist | The Control Plane specification, with [`audit-model.md`](audit-model.md) | Later document |
| What happens to grants and to Runs in flight when a Tool is de-registered | `execution-semantics.md` in [`../50-workflows/`](../50-workflows/) | Later document |
| Divergence between the Connector's local allow-list and Orchestra's grants: detection, reporting, and whether Orchestra may read the list at all. Existence is settled by [`threat-model.md`](threat-model.md) T7 and precedence by TA17 | `connector.md` in [`../10-architecture/`](../10-architecture/), after ADR-0007 binds | Later document |
| Whether a refused invocation is metered as a Tool invocation | `quotas-and-metering.md` in [`../60-operations/`](../60-operations/) | Later document |
| How platform-operator invocation of a Tool is attributed under invariant I2, given that [`policy-model.md`](policy-model.md) rule N2 blocks such a path until it is | [`audit-model.md`](audit-model.md), which already owns the general case | **ADR** |
