---
title: MVP Definition
doc_id: DOC-081
version: 0.17.0
status: Draft
last_updated: 2026-09-11
owners: [platform-architecture]
depends_on: [ADR-0001, ADR-0002, ADR-0009, ADR-0010, ADR-0011, ADR-0012, ADR-0013, ADR-0014, ADR-0015]
---

# MVP Definition

The first vertical slice: what it must demonstrate, what it deliberately omits, and what has to be
settled before it can be committed to.

## 1. What the slice has to prove

[ADR-0015](../adr/adr-0015-governed-action-positioning.md) fixes what Orchestra claims, and the slice
follows from it directly. The claim is not that agents can reach systems — two model vendors ship
that — but that a consequential action is a governed state transition with an accountable Principal,
an applicable Policy, an explicit approval state where one is required, and durable evidence of the
decision.

So the slice is **one Workflow, executed end to end, whose every consequential step is provably
governed.** Concretely: a definition is authored and published; a Run starts against a pinned
version; a Step reaches an enforcement point the author did not place and could not remove; a
`require_approval` verdict suspends the Run; a Platform User decides on the Evidence Set the model
relied on; the Run resumes; and afterwards the whole of it can be reconstructed from the audit trail
alone.

**A connectivity demonstration is not the slice.** It would have been under
[ADR-0003](../adr/adr-0003-governance-layer-positioning.md), and that record is superseded. A demo
that shows an agent calling a system behind a firewall now shows something a buyer can get free.

## 2. What is in the slice

| Capability | Why it is in | Decided by |
| --- | --- | --- |
| Tenant, Workspace, Principal, Platform User, Service Account | Multi-tenancy cannot be retrofitted, and approval and audit both need an identity to name | [ADR-0001](../adr/adr-0001-product-shape-multi-tenant-saas.md), [ADR-0009](../adr/adr-0009-meter-first-defer-tiering.md) |
| Isolation by shared schema with forced row-level security, and the CI control on tenant-scoped tables | The control is the build, not a reviewer's memory | [ADR-0011](../adr/adr-0011-tenant-isolation-shared-schema-rls.md) |
| A Workflow definition language, a validating compiler, and enforcement points emitted at every Step boundary | The unbypassable enforcement point is the differentiation, so the slice cannot omit it | [ADR-0014](../adr/adr-0014-run-supervisor-is-orchestras.md) |
| A run supervisor sufficient for one Run at a time | Without it nothing executes; scope and sizing are in section 5 | [ADR-0014](../adr/adr-0014-run-supervisor-is-orchestras.md) |
| Policy evaluation yielding `allow`, `deny`, `require_approval`, with every decision recorded | The claim | [`../40-governance/policy-model.md`](../40-governance/policy-model.md) |
| Approval Requests carrying the Evidence Set, and a schema-validated approval surface | The one GenUI surface the first slice ships | [ADR-0010](../adr/adr-0010-a2ui-genui-interchange.md), **Proposed** |
| Audit records, append-only, tenant-scoped, one Principal each, durable before the gated action | ADR-0012 and ADR-0013 are the evidence semantics ADR-0015 claims | [ADR-0012](../adr/adr-0012-policy-decisions-are-audit-records.md), [ADR-0013](../adr/adr-0013-fail-closed-policy-decision-writes.md) |
| Metering across the dimensions ADR-0009 names | Unrecorded usage is unrecoverable; unset prices are not | [ADR-0009](../adr/adr-0009-meter-first-defer-tiering.md) |
| One Model Binding under BYOK, with credential custody | Nothing runs without a model, and custody is not deferrable | [ADR-0002](../adr/adr-0002-enterprise-segment-and-byok.md) |
| Tools reached over direct HTTPS | Sufficient to execute the slice; see section 3 | — |

## 3. What is deliberately out

| Omitted | Why |
| --- | --- |
| The Connector | [ADR-0007](../adr/adr-0007-outbound-connector-for-enterprise-reachability.md) is **Proposed**, its premise is contested by shipped vendor tunnels, and ADR-0015 demotes it from differentiation to plumbing. The slice reaches Tools over direct HTTPS and the transport seam stays designed-for rather than built |
| The general GenUI component catalog | ADR-0010 defers it; text plus the approval surface is the slice |
| A visual workflow designer | Schema-first authoring, reviewed as code. Carried forward unanswered from superseded ADR-0008 |
| The tier builder and self-serve packaging | ADR-0009 prices the first contracts by hand |
| Capability-based and preference-based model routing | Removed by [ADR-0006](../adr/adr-0006-model-layer-as-credential-broker.md), not deferred |
| A hybrid or customer-deployed Data Plane | Contingent on the BYOK question; see [`../10-architecture/deployment-topologies.md`](../10-architecture/deployment-topologies.md) |
| Horizontal scale, autoscaling, multi-worker concurrency | The supervisor ships at the smallest scope that executes the slice. Scaling it is post-MVP work and section 5 says why that is a risk rather than a simplification |

## 4. Scope has grown three times, and this is the accounting

`roadmap.md` records it and this document owes the detail, because an MVP scoped against the
original brief would be wrong by a wide margin.

| Change | Record | Direction |
| --- | --- | --- |
| Multi-tenancy, RBAC, tenant administration and secret management moved out of a later phase into MVP | ADR-0001 | Increase |
| A definition language and validating compiler added | ADR-0008, superseded by ADR-0014 | Increase |
| A Connector added as a distinct product | ADR-0007, **Proposed** | Increase, now deferred out of the slice |
| A run supervisor added | ADR-0014 | Increase |
| Capability and preference model routing removed | ADR-0006 | **The only decrease** |

One of those four increases has been taken back out of the slice — the Connector — and that is a
consequence of ADR-0015 rather than a scoping choice. The other three stand.

## 5. What must be settled before this is committed to

**The supervisor's size.** [ADR-0014](../adr/adr-0014-run-supervisor-is-orchestras.md) names this as
its first follow-on and does not answer it: whether the run supervisor is glue around an executor or
a substantial distributed runtime. The distinction changes the delivery plan materially, and it
changes something else — ADR-0015's revisit criteria note that a platform mostly building a
distributed runtime is not a governance layer. **This document cannot be committed to as a plan
until that is sized.** It is stated here rather than estimated because no estimate exists.

**The BYOK question.** Whether it means control of spend or that data must not transit Orchestra
infrastructure. The slice assumes the first. If the second holds, the topology changes and the slice
changes with it ([ADR-0002](../adr/adr-0002-enterprise-segment-and-byok.md)).

**The two Proposed ADRs the slice touches.** ADR-0010's remaining validation step is whether the
approval surface is expressible without extension; the slice depends on it and would need an
Orchestra-defined surface schema if it fails. ADR-0004's remaining step is a prototype of the
approval lifecycle through a disconnect.

## 6. The Control Plane surface question

[`../10-architecture/control-plane.md`](../10-architecture/control-plane.md) assigns this document a
question: whether the Control Plane ships as one duplicated front-end surface or several.

**For the slice, one.** The repository's front-end rule is duplicate-never-share, and each surface
owns its copy — but duplication is justified when surfaces diverge, and at MVP there is one
administrative audience doing one workflow: publish a definition, watch a Run, decide an approval,
read the trail. Splitting before divergence exists pays the cost of duplication without its benefit.

What would change it: a second audience with genuinely different needs — an auditor who only reads,
or an approver who only decides and should not see administration. Both are plausible and neither is
decided. The register carries it.

## 7. Exit criteria

The slice is done when all of these hold, and not when a date passes.

- A Workflow definition is published, a Run executes against the pinned version, and editing the
  definition does not change that Run's behaviour.
- Every Step boundary produced a Policy Decision, including the ones that returned `allow`.
- A `require_approval` verdict suspended the Run, an Approval Request carried the Evidence Set, a
  named Principal decided it, and the Run resumed.
- The entire Run can be reconstructed from the audit trail alone, with every action resolving to
  exactly one Principal and naming the Policy version that governed it.
- A Policy Decision that could not be made durable stopped the action rather than proceeding
  (ADR-0013), demonstrated deliberately rather than observed by accident.
- Two Tenants ran concurrently and neither appears in the other's trail, with isolation enforced by
  the datastore rather than by application code.
- Meter records exist for the dimensions ADR-0009 names and reconcile against the audit log.
- CI fails when a tenant-scoped table is added without a row-level security policy.

The sixth and the last are the ones worth being strict about. They are the difference between a
system that governs and one that appears to.

## 8. Open questions

| Question | Decided by | ADR required? |
| --- | --- | --- |
| The supervisor's size, and whether it threatens the positioning | [ADR-0014](../adr/adr-0014-run-supervisor-is-orchestras.md)'s first follow-on, before this document becomes a plan | **Yes** |
| Whether the Control Plane later splits into several surfaces | This document, once a second audience exists; section 6 answers it for the slice only | No |
| Whether BYOK means spend control or data non-egress | Design-partner validation, per ADR-0002 and ADR-0007 | **Yes** |
| What a demonstrable governed action looks like to a buyer, as distinct from what it is technically | A design partner; ADR-0015 names undemonstrability as a revisit criterion. [`../50-workflows/examples/invoice-payment.md`](../50-workflows/examples/invoice-payment.md) is the candidate | No |
| Whether the slice needs a second Model Binding to be credible | A design partner | No |
