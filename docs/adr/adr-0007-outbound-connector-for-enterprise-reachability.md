---
title: "ADR-0007: Outbound connector for enterprise tool reachability"
adr_id: ADR-0007
status: Proposed
date: 2026-09-08
deciders: [platform-architecture]
tags: [connectivity, security, deployment]
depends_on: [ADR-0001, ADR-0002]
---

# ADR-0007: Outbound connector for enterprise tool reachability

## Status

**Proposed** — binding after design-partner validation.

## Context

The platform's value is that an agent can invoke the customer's own business capabilities. v0.1 §12
draws MCP servers hanging off an MCP Client Manager as though they were reachable. Under
[ADR-0001](adr-0001-product-shape-multi-tenant-saas.md) they generally are not: the runtime is in
Orchestra's cloud and the customer's ERP, WMS and core systems are inside their network.

There is no line between those two boxes in the v0.1 architecture diagram. Drawing it is a product,
not a configuration flag — and it is the single largest unscoped item in the platform.

The requirement now spans finance, logistics and procurement, which means SAP, Oracle, WMS and TMS —
systems that are effectively never internet-exposed.

## Decision drivers

- Enterprise networks do not accept inbound connections from third-party SaaS without a lengthy and
  frequently unsuccessful security review.
- Tool reachability is a precondition for every other capability in the platform.
- Version skew is unavoidable for software running inside a customer's network.

## Considered options

1. **Customer exposes MCP servers over public HTTPS with OAuth.** Architecturally clean; frequently
   refused by regulated enterprises.
2. **Customer-deployed connector establishing an outbound session to Orchestra.** No inbound firewall
   rule required.
3. **Bring-your-own-cloud** — customer-deployed data plane, Orchestra-hosted control plane.
4. **Cloud-only tools** — integrate SaaS APIs exclusively. A different product.

## Decision

Support option 1 as the fast path, and build **option 2, the outbound connector, as the primary
mechanism.** The MCP Client Manager MUST be transport-abstracted from the outset so that a
connection is either a direct HTTPS session or a multiplexed connector tunnel, indistinguishable to
everything above it.

Option 3 remains a possible later topology for customers who refuse third-party data processing.

## Rationale

Assuming option 1 is assuming the sales cycle away. The seam between direct and tunnelled transport
is inexpensive to design now and extremely expensive to retrofit — it touches timeouts, retries,
cancellation, streaming and error taxonomy.

Building the connector before design partners exist is premature; designing the *seam* before them
is not.

## Consequences

### Positive

- Removes the largest deployment blocker in the target segment.
- Establishes a trust boundary inside the customer's network that later enables stronger options —
  including proxying model traffic so credentials never leave their perimeter.

### Negative

- The connector is a distinct product: installation, enrolment, credential provisioning, health,
  observability, signed releases and upgrade. It is not a library.
- Tool invocation becomes multi-hop. New failure modes — connector offline, tunnel drop mid-call,
  version skew — MUST be added to the reliability model, which v0.1 §23 does not contain.
- Software running inside customer networks cannot be force-upgraded. See
  [VERSIONING.md](../VERSIONING.md) §9.

### Neutral / follow-on work

- Connector security is its own threat model: enrolment and identity, mutual authentication, egress
  restriction, tool allow-listing at the connector, and tamper-evident local audit.
- Deployment must accommodate Kubernetes, VM and container form factors.

## Validation before this ADR becomes Accepted

1. Confirm with at least two design partners whether public MCP exposure is achievable for them.
2. Confirm what their security teams require of software running inside their network.
3. Establish whether "BYOK" means spend control or data non-egress — see
   [ADR-0002](adr-0002-enterprise-segment-and-byok.md).

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Connector itself fails security review | Medium | High | Signed releases, minimal privileges, egress allow-list, local audit, third-party review |
| Version skew causes silent degradation | High | Medium | Explicit negotiation; refuse unsupported versions loudly rather than degrading |
| Connector built before requirements are known | High | Medium | Design the transport seam now; build the connector with a design partner |

## Revisit criteria

Reopen if design partners can in fact expose MCP endpoints publicly, which would demote the
connector to a later differentiator rather than an MVP requirement.
