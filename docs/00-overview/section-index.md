---
title: Overview
doc_id: DOC-010
version: 0.13.0
status: Draft
last_updated: 2026-09-11
owners: [platform-architecture]
---

# Overview

Vision, product thesis, personas, scope and roadmap. Start here.

## Documents

| Document | What it answers |
| --- | --- |
| [`vision.md`](vision.md) | What Orchestra is, what it is not, and who it is for |
| [`product-thesis.md`](product-thesis.md) | Why the claim is governed, accountable actions rather than connectivity, per [ADR-0015](../adr/adr-0015-governed-action-positioning.md) |
| [`personas.md`](personas.md) | Who it serves, how they map to identity types, and who holds the veto |
| [`scope-and-non-goals.md`](scope-and-non-goals.md) | What is built, what is refused, and what is only deferred |
| [`roadmap.md`](roadmap.md) | Sequencing by entry and exit criteria, with no invented dates |

Read them in that order. Each is written against the decisions in [`../adr/`](../adr/) and the
vocabulary in [`../GLOSSARY.md`](../GLOSSARY.md); where a decision has not been made, the documents
say so rather than implying one.

> **Status.** Three of the fifteen ADRs are **Proposed**, not binding — AG-UI adoption
> ([ADR-0004](../adr/adr-0004-adopt-ag-ui-event-protocol.md)), the outbound connector
> ([ADR-0007](../adr/adr-0007-outbound-connector-for-enterprise-reachability.md)) and A2UI
> ([ADR-0010](../adr/adr-0010-a2ui-genui-interchange.md)). Anything resting on them is marked as
> such. Two are **Superseded**: ADR-0003 by
> [ADR-0015](../adr/adr-0015-governed-action-positioning.md), which moves the claim from
> connectivity to governed actions, and ADR-0008 by
> [ADR-0014](../adr/adr-0014-run-supervisor-is-orchestras.md), which adds the run supervisor to what
> Orchestra builds. This section is written against both. The project is pre-implementation and
> pre-customer, so every enterprise assumption in it is unvalidated.
