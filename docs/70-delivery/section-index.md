---
title: Delivery
doc_id: DOC-080
version: 0.14.0
status: Draft
last_updated: 2026-09-11
owners: [platform-architecture]
---

# Delivery

How the platform gets built and proven.

## Documents

| Document | Answers |
| --- | --- |
| [`mvp-definition.md`](mvp-definition.md) | What the first vertical slice must prove, what it omits, and what must be settled before it is a plan |
| [`milestones.md`](milestones.md) | What blocks what, and the one piece of work bound by a calendar |
| [`testing-strategy.md`](testing-strategy.md) | Which guarantees fail silently, and therefore need a test as the control rather than a check |
| [`compliance-roadmap.md`](compliance-roadmap.md) | SOC 2 and enterprise review readiness, and why it is sequencing rather than paperwork |

## Two things this section says that the rest of the set does not

**The slice is not a connectivity demonstration.** Under
[ADR-0015](../adr/adr-0015-governed-action-positioning.md) the claim is governed, accountable
actions, so the first slice is one Workflow whose every consequential step is provably governed —
published definition, pinned version, an enforcement point the author could not remove, an approval
carrying the Evidence Set, and a Run reconstructable from the audit trail alone. A demo showing an
agent reach a system behind a firewall would demonstrate something a buyer can now get free.

**MVP scope has grown three times and shrunk once.** Multi-tenancy was pulled forward by
[ADR-0001](../adr/adr-0001-product-shape-multi-tenant-saas.md), a definition language and compiler
added, a Connector added by **Proposed**
[ADR-0007](../adr/adr-0007-outbound-connector-for-enterprise-reachability.md), and a run supervisor
added by [ADR-0014](../adr/adr-0014-run-supervisor-is-orchestras.md). Only model routing was ever
removed. The Connector has since left the slice — a consequence of ADR-0015 rather than a scoping
choice. `mvp-definition.md` carries the accounting rather than leaving it to be rediscovered.

> **Status.** `mvp-definition.md` is **not yet a plan** and says so. ADR-0014 leaves the run
> supervisor's size open — glue around an executor, or a substantial distributed runtime — and that
> answer changes the delivery sequence and, if it lands badly, the positioning. Sizing it is the
> cheapest high-value work available and is M2 in [`milestones.md`](milestones.md).
>
> No date, coverage target, audit window, conformance level or certification commitment appears
> anywhere in this section, because none is decided. Where a figure is load-bearing the documents
> say what bounds it and register the question.
