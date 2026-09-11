---
title: Compliance Roadmap
doc_id: DOC-084
version: 0.14.0
status: Draft
last_updated: 2026-09-11
owners: [platform-architecture]
depends_on: [ADR-0001, ADR-0002, ADR-0011, ADR-0012, ADR-0013, ADR-0015]
---

# Compliance Roadmap

SOC 2 and enterprise review readiness — what is bound by a calendar, what is bound by a decision,
and what this document deliberately does not commit to.

## 1. Why this is sequencing rather than paperwork

[ADR-0001](../adr/adr-0001-product-shape-multi-tenant-saas.md) states it directly: SOC 2 becomes a
gating requirement for the first deal, it is **calendar-bound rather than effort-bound**, and the
clock should start before the product is finished. Its risk table rates the likelihood High and the
impact High.

Calendar-bound is the operative phrase. A Type II report attests to controls operating over an
observation window, and a window cannot be shortened by adding people to it. A team that begins when
the product feels ready has already spent the window it needed.

[`milestones.md`](milestones.md) therefore runs this work in parallel from M1, not after M4. That is
the whole contribution of this document to the plan; everything else here is detail.

## 2. What Orchestra already owes a customer

[ADR-0001](../adr/adr-0001-product-shape-multi-tenant-saas.md) makes Orchestra a processor of
customer data, which carries data-processing-agreement, residency, retention and subprocessor
obligations from the first enterprise conversation — before any certification is at issue.

[ADR-0002](../adr/adr-0002-enterprise-segment-and-byok.md) adds the sharpest of them: Orchestra
custodies enterprise model credentials under envelope encryption, with per-tenant data keys,
rotation, and provably no plaintext in logs, traces or backups. Its risk table rates credential
compromise **existential**.

Neither depends on SOC 2. Both are true the moment a customer exists.

## 3. What the platform already does that a review asks about

This is worth stating plainly, because several controls a SOC 2 or a security review probes are
already decided rather than pending — and they were decided as governance rules rather than as
compliance work.

| What a review asks | What is already decided |
| --- | --- |
| How is tenant data isolated, and what stops a bug crossing it? | Row-level security enabled and forced in the datastore, with CI failing on a tenant-scoped table that lacks a policy ([ADR-0011](../adr/adr-0011-tenant-isolation-shared-schema-rls.md)) |
| Who did what, and under what authority? | Every action resolves to exactly one Principal; every Policy Decision is an Audit Record naming the Policy version that governed it ([ADR-0012](../adr/adr-0012-policy-decisions-are-audit-records.md)) |
| Can the trail be incomplete without anyone noticing? | No. A Policy Decision is durable before the gated action, and a degraded period for other records is bracketed and recoverable rather than silent ([ADR-0013](../adr/adr-0013-fail-closed-policy-decision-writes.md)) |
| Are approvals real controls or advisory? | An `approval` Step's boundary cannot return `allow` ([`../40-governance/policy-model.md`](../40-governance/policy-model.md) V4) |
| What stops an agent being talked into an action? | Policy the model cannot argue past, at an enforcement point the definition author cannot write around ([ADR-0015](../adr/adr-0015-governed-action-positioning.md)) |

[ADR-0015](../adr/adr-0015-governed-action-positioning.md) makes those the product rather than its
compliance overhead. A review conversation is the one place where that claim is tested directly.

## 4. Accessibility

[`../10-architecture/control-plane.md`](../10-architecture/control-plane.md) assigns this document
the accessibility conformance target for the approval surface, and who attests to it.

What is established: the approval surface is the one interactive surface the first slice ships, it
is shown to a Platform User acting as an approver, and
[`../80-reference/ag-ui-evaluation.md`](../80-reference/ag-ui-evaluation.md) records that the client
bindings evaluated for it carried no accessibility position at all — no conformance claim, no live
region on a streaming transcript, no focus management on a modal — and that this was one of three
grounds for not adopting them.

What is not established, and this document will not invent: **the conformance level, the standard
version, and who attests.** Those are procurement facts that follow from the buyer and the
jurisdiction, not from an engineering preference, and no customer exists. Naming a level here would
read as a commitment nobody has made.

What can be said now is the shape of the obligation: an approval surface is a control, a control a
person cannot operate is not a control for that person, and an enterprise buyer in a regulated
sector will ask for an attestation rather than an assurance. The register carries the rest.

## 5. What this document does not commit to

No certification date, no audit window length, no Type I or Type II choice, no framework beyond
SOC 2, no accessibility conformance level, and no assessor. None is decided, and each is the kind of
figure that, once written, gets quoted back.

What is decided is the sequencing: readiness work starts at M1 and runs alongside engineering,
because the alternative is discovering a calendar constraint after it has already bound.

## 6. Open questions

| Question | Decided by | ADR required? |
| --- | --- | --- |
| Type I or Type II, the observation window, and the control scope | An assessor, once engaged | No |
| The accessibility conformance target for the approval surface, and who attests to it | This document with a design partner and the buyer's jurisdiction; section 4 states why it is not set here | No |
| Whether frameworks beyond SOC 2 are needed — ISO 27001, sector-specific regimes | The first enterprise conversations | No |
| The audit-retention period, which a compliance obligation may fix rather than leave to design | [`../40-governance/audit-model.md`](../40-governance/audit-model.md), which registers it as ADR-required | **Yes** |
| Data residency, which is a third axis distinct from topology and from the ADR-0011 promotion path | [`../10-architecture/deployment-topologies.md`](../10-architecture/deployment-topologies.md) | **Yes** |
| Whether per-tenant encryption keys extend beyond credentials to data at rest | [ADR-0011](../adr/adr-0011-tenant-isolation-shared-schema-rls.md)'s follow-on | **Yes** |
