---
title: Governance
doc_id: DOC-050
version: 0.7.0
status: Draft
last_updated: 2026-09-09
owners: [platform-architecture]
---

# Governance

Policy, approval, authorization, audit and threat modelling — the differentiated core of the
platform, per [ADR-0003](../adr/adr-0003-governance-layer-positioning.md).

**This section is normative.** Per [`../README.md`](../README.md) section 3, implementations must
conform to it. Requirement keywords carry their
[RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) meanings.

## Documents

| Document | Specifies |
| --- | --- |
| [`policy-model.md`](policy-model.md) | What a Policy is, where enforcement points sit, what they evaluate over, and what a Policy Decision records |
| [`approval-workflows.md`](approval-workflows.md) | What happens after a `require_approval` verdict: the Approval Chain, the Evidence Set, and resolution |
| [`tool-authorization.md`](tool-authorization.md) | Deny-by-default capability grants, and the separation between registering a Tool and permitting an Agent to call it |
| [`audit-model.md`](audit-model.md) | The Audit Record, what MUST be audited, and what audit does not cover |
| [`threat-model.md`](threat-model.md) | Prompt injection, tool poisoning, confused deputy, cross-tenant access, egress and connector compromise |

Read `policy-model.md` first; the other four compose with it rather than restating it.

## Reading the registers

Every document ends with an open-questions register. A row marked **ADR** means the choice is costly
to reverse or spans components, and must not be settled in prose. A row naming a later document
means that document may settle it directly. Where two registers classify the same question
differently, the document that owns the subject is authoritative.

That the registers are long is deliberate. This section specifies what follows from the decisions
already taken and refuses to invent the rest — no threshold, duration, retention period or quorum
appears anywhere in it, because no decision establishes one.

> **Status.** Three ADRs remain **Proposed** and non-binding —
> [ADR-0004](../adr/adr-0004-adopt-ag-ui-event-protocol.md),
> [ADR-0007](../adr/adr-0007-outbound-connector-for-enterprise-reachability.md) and
> [ADR-0010](../adr/adr-0010-a2ui-genui-interchange.md). Anything resting on them is marked in place.
