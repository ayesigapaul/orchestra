---
title: Architecture
doc_id: DOC-020
version: 0.12.1
status: Draft
last_updated: 2026-09-13
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
| [`connector.md`](connector.md) | Enterprise Tool reachability, the transport seam, and the connector as a product |
| [`deployment-topologies.md`](deployment-topologies.md) | Hosted, and the hybrid variant that exists only if BYOK means non-egress |

Read `system-context.md` first; the boundary it draws is what the other seven decompose.

## The last two are written against an assumption, and say so

`connector.md` and `deployment-topologies.md` were held back while everything else was written,
because both depend on design-partner conversations that have not happened. They are now written
against an **assumed** partner profile, at the repository owner's direction, for demonstration
purposes.

That unblocks the writing. It validates nothing.
[ADR-0007](../adr/adr-0007-outbound-connector-for-enterprise-reachability.md) remains **Proposed**,
and an assumed partner does not make it Accepted. Each document carries a headed table of every
assumption it rests on, what would confirm it, and what changes if it is false — and marks each
assumption again where it is load-bearing, so a reader who lands mid-document is not relying on
having remembered a list.

The asymmetry between the two is worth knowing before reading them. `connector.md` rests on
assumptions almost entirely: from section 3 onward it is conditional on ADR-0007 binding, and if
that ADR is rejected those sections leave the specification. `deployment-topologies.md` rests on far
less, though not on fewer assumptions: the hosted topology is **decided** by
[ADR-0001](../adr/adr-0001-product-shape-multi-tenant-saas.md) and is not in question at all. What
is contingent there is narrower — the hybrid variant, on whether BYOK turns out to mean control of
spend or that data must not transit Orchestra infrastructure; hosted's *completeness* for the target
segment, on ADR-0007's reachability answer; and the residency comparison, on its own assumption. The
asymmetry is in how much of each document collapses, not in how many assumptions each names.

One conflation both documents work to prevent: **ADR-0011's promotion path is not the hybrid
topology.** Moving a single Tenant to a dedicated database is still Orchestra operating the data
plane. Treating it as a step toward a customer-deployed one would make the BYOK question look
half-answered, and that question sits upstream of the connector, the topology and a good deal of the
roadmap.

> **Status.** The datastore engine is PostgreSQL, chosen by
> [ADR-0021](../adr/adr-0021-postgresql-is-the-datastore.md) against the capabilities
> [`multi-tenancy.md`](multi-tenancy.md) requires.
