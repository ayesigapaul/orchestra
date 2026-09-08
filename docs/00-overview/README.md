---
title: Overview
doc_id: DOC-010
version: 0.3.0
status: Draft
last_updated: 2026-09-09
owners: [platform-architecture]
---

# Overview

Vision, product thesis, personas, scope and roadmap. Start here.

## Documents

| Document | What it answers |
| --- | --- |
| [`vision.md`](vision.md) | What Orchestra is, what it is not, and who it is for |
| [`product-thesis.md`](product-thesis.md) | Why it is positioned as a governance layer, per [ADR-0003](../adr/adr-0003-governance-layer-positioning.md) |
| [`personas.md`](personas.md) | Who it serves, how they map to identity types, and who holds the veto |
| [`scope-and-non-goals.md`](scope-and-non-goals.md) | What is built, what is refused, and what is only deferred |
| [`roadmap.md`](roadmap.md) | Sequencing by entry and exit criteria, with no invented dates |

Read them in that order. Each is written against the decisions in [`../adr/`](../adr/) and the
vocabulary in [`../GLOSSARY.md`](../GLOSSARY.md); where a decision has not been made, the documents
say so rather than implying one.

> **Status.** Three of the ten ADRs are **Proposed**, not binding — AG-UI adoption
> ([ADR-0004](../adr/adr-0004-adopt-ag-ui-event-protocol.md)), the outbound connector
> ([ADR-0007](../adr/adr-0007-outbound-connector-for-enterprise-reachability.md)) and A2UI
> ([ADR-0010](../adr/adr-0010-a2ui-genui-interchange.md)). Anything resting on them is marked as
> such. The project is pre-implementation and pre-customer, so every enterprise assumption in this
> section is unvalidated.
