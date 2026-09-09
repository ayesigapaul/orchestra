---
title: Architecture
doc_id: DOC-020
version: 0.8.0
status: Draft
last_updated: 2026-09-09
owners: [platform-architecture]
---

# Architecture

C4 views and the design of each major subsystem. Architecture views follow the
[C4 model](https://c4model.com): Level 1 system context, Level 2 containers, Level 3 components
where warranted. No Level 4.

**This section is not normative.** Per [`../README.md`](../README.md) section 3, only
[`../30-protocol/`](../30-protocol/) and [`../40-governance/`](../40-governance/) bind an
implementation. Where a rule binds, these documents link to it rather than restating it — a
restated rule is a second copy that drifts.

## Documents

| Document | Answers |
| --- | --- |
| [`system-context.md`](system-context.md) | C4 Level 1: who Orchestra talks to, and where the boundaries fall |
| [`containers.md`](containers.md) | C4 Level 2: the deployable pieces and what each may never do |
| [`control-plane.md`](control-plane.md) | The administrative surface the customer's platform team buys |
| [`data-plane.md`](data-plane.md) | The execution path, and where each control sits along it |
| [`multi-tenancy.md`](multi-tenancy.md) | Isolation made implementable, per [ADR-0011](../adr/adr-0011-tenant-isolation-shared-schema-rls.md) |
| [`identity-and-access.md`](identity-and-access.md) | Principals, federation, Session Tokens and administrative authorization |

Read `system-context.md` first; the boundary it draws is what the other five decompose.

## Planned documents

- `connector.md` — enterprise reachability, per [ADR-0007](../adr/adr-0007-outbound-connector-for-enterprise-reachability.md)
- `deployment-topologies.md` — hosted, and the hybrid data-plane variant

Both are deliberately unwritten. `connector.md` rests on ADR-0007, which is **Proposed**: its form
factor and the security requirements for software running inside a customer network cannot be
specified before the design-partner conversations that ADR names. `deployment-topologies.md` waits
on the same question ADR-0002 raises — whether BYOK means control of spend or that data must not
transit Orchestra infrastructure. Only the second implies a customer-deployed data plane, and
hosted-only and hybrid are different documents rather than one document with a branch.

> **Status.** No datastore engine is chosen anywhere in this section; ADR-0011 constrains it to one
> enforcing row-level security and selects none. The Connector appears in these views as planned,
> never as settled architecture.
