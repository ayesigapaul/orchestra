---
title: "ADR-0018: Apache APISIX is the edge, in front of the Gateway"
adr_id: ADR-0018
status: Accepted
date: 2026-09-12
deciders: [product-owner, platform-architecture]
consulted: []
informed: []
supersedes: []
superseded_by: []
tags: [architecture, protocol, security, operations]
depends_on: [ADR-0001, ADR-0017]
---

# ADR-0018: Apache APISIX is the edge, in front of the Gateway

## Status

Accepted.

## Context

**Gateway** is an Orchestra term with a fixed meaning: the Data Plane's only ingress, which
authenticates the calling Principal, resolves exactly one Principal and one Tenant, admits Runs and
terminates the Run event stream
([`../30-protocol/gateway-api.md`](../30-protocol/gateway-api.md),
[`../10-architecture/data-plane.md`](../10-architecture/data-plane.md)). That component is
Orchestra's and this record does not replace it. What was unrecorded is what sits in front of it:
TLS termination, routing, rate limiting and the first authentication check.

Facts as of 2026-09-12. [Apache APISIX](https://apisix.apache.org/) 3.18.0 was released on
2026-08-20. Its `openid-connect` plugin integrates with OIDC providers including Keycloak, which
[ADR-0017](adr-0017-keycloak-for-identity.md) makes Orchestra's identity provider. Streaming needs
explicit handling: nginx proxy buffering must be disabled per route for Server-Sent Events, which
the `proxy-buffering` plugin does, and a dedicated `sse` plugin exists for that traffic.

## Decision drivers

- The Run event stream is SSE, long-lived, and MUST NOT be buffered — a proxy that buffers it breaks
  the product's most visible surface.
- ADR-0017 puts Keycloak in the authentication path, and an edge that speaks OIDC natively avoids
  hand-rolling token verification at the perimeter.
- ADR-0001's product is multi-tenant and metered; per-Tenant rate limiting and quota signalling need
  somewhere to live that is not the application.
- Self-hosting the edge matches the self-hosted identity decision: no third party terminates
  customer traffic.

## Considered options

1. **No edge proxy** — the Gateway is exposed directly behind a cloud load balancer. Fewest moving
   parts; every cross-cutting concern becomes application code.
2. **A managed API gateway** (AWS API Gateway or equivalent). No operations, but it prices per
   request, its SSE and long-connection behaviour is constrained, and it puts the cloud vendor in the
   authentication path.
3. **Apache APISIX, self-hosted.** Native OIDC against Keycloak, per-route streaming control,
   per-consumer rate limiting, and no per-request pricing — at the cost of another stateful
   component to run.

## Decision

**Apache APISIX is Orchestra's edge proxy, deployed in front of the Gateway.** The split is
normative:

| Concern | Owner |
| --- | --- |
| TLS termination, routing, request size limits | APISIX |
| First-pass token verification against Keycloak (`openid-connect`) | APISIX |
| Per-Tenant and per-consumer rate limiting | APISIX |
| Resolving a credential to **exactly one Principal and one Tenant** | **The Gateway** (G3 to G7) |
| Run admission, idempotency keys, the event stream contract | **The Gateway** |
| Every Policy Decision, at every enforcement point | **Orchestra's policy evaluation**, never the edge |

**Three prohibitions, each following from a record that already binds.**

- **The edge MUST NOT be the authorization boundary.** Policy is evaluated at the enforcement points
  [`../40-governance/policy-model.md`](../40-governance/policy-model.md) E1 fixes, and a verdict
  MUST NOT vary by how a request arrived. An APISIX plugin that allowed or denied a business action
  would be an unaudited Policy Decision, which
  [ADR-0012](adr-0012-policy-decisions-are-audit-records.md) does not admit.
- **The edge MUST NOT set the Tenant.** G7 forbids a caller-settable tenant identifier anywhere on
  the contract; a header injected by a proxy is exactly that. The Tenant is resolved from the
  credential, by the Gateway.
- **Proxy buffering MUST be disabled on the event-stream route.** An SSE stream that buffers
  arrives in bursts or not at all, and the profile's ordering and gap-detection guarantees
  ([`../30-protocol/event-protocol.md`](../30-protocol/event-protocol.md)) are unobservable behind a
  buffer.

## Rationale

Option 1 pushes TLS, routing, rate limiting and token verification into the application, which is
where they are most expensive to change and least testable. Option 2 removes operations but prices
per request — the wrong shape for a metered platform whose own pricing is unmade
([ADR-0009](adr-0009-meter-first-defer-tiering.md)) — and managed gateways constrain exactly the
long-lived streaming connection this product depends on.

Option 3 costs another component to operate, and the operational bill is already being paid for
Keycloak under ADR-0017; the same team, the same deployment story. What it buys is the OIDC
integration as configuration rather than code, and per-route control over buffering, which the SSE
requirement makes non-negotiable.

## Consequences

### Positive

- Token verification at the perimeter is configuration against Keycloak rather than application code.
- Per-Tenant rate limiting has a home outside the application, ahead of the Quota Envelope.
- No per-request pricing, and no third party terminating customer traffic.

### Negative

- **A second stateful component to operate**, on the critical path of every request, with its own
  upgrade cadence and CVE response.
- **Buffering is a footgun.** The default proxies buffer; the event stream breaks quietly if a route
  is added without disabling it. This needs a test, not a runbook note.
- Two places now inspect a token — the edge and the Gateway — and a difference between them is a
  security bug. The Gateway's resolution stays authoritative.
- APISIX configuration becomes deployment state that must be versioned and reviewed like code.

### Neutral / follow-on work

- Decide how APISIX configuration is declared and versioned, so routes are reviewable.
- Decide whether the edge passes the verified token through unchanged, and what the Gateway re-checks.
- A test that the event-stream route is unbuffered end to end belongs with the guarantees
  [`../70-delivery/testing-strategy.md`](../70-delivery/testing-strategy.md) section 2 names, since
  buffering fails silently and looks like latency.
- The error envelope stays the Gateway's, so an APISIX-generated error must not invent a second
  vocabulary — `gateway-api.md` section 9 marks that envelope ADR-required and unmade.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| A route is added with buffering on and breaks the event stream | High | High | Disable buffering explicitly on the stream route; test it end to end rather than by inspection |
| Authorization logic drifts into edge plugins | Medium | High | The prohibition above is normative; the audit trail is the check — an allowed action with no Policy Decision is the defect |
| Edge and Gateway disagree about an identity | Medium | High | The Gateway's resolution is authoritative and re-derives Principal and Tenant from the credential |
| Operating two new stateful components at once outruns the team | Medium | Medium | Both are pre-customer decisions and reversible; revisit below |

## Revisit criteria

Reopen if operating APISIX costs more than the managed alternative saves; if its streaming behaviour
proves unreliable for long-lived connections under load; or if the edge's responsibilities shrink far
enough that a cloud load balancer would do.

## References

- [ADR-0017](adr-0017-keycloak-for-identity.md) — the identity provider the edge verifies against
- [`../30-protocol/gateway-api.md`](../30-protocol/gateway-api.md) — the Gateway contract this record
  does not change
- [Apache APISIX openid-connect plugin](https://apisix.apache.org/docs/apisix/plugins/openid-connect/)
- [Apache APISIX proxy-buffering plugin](https://apisix.apache.org/docs/apisix/plugins/proxy-buffering/)
