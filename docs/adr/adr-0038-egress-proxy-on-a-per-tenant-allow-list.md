---
title: "ADR-0038: Tenant-configured egress leaves through one proxy, on a per-tenant allow-list derived from configuration"
adr_id: ADR-0038
status: Accepted
date: 2026-09-13
deciders: [product-owner, platform-architecture]
consulted: []
informed: []
supersedes: []
superseded_by: []
tags: [security, architecture, connectivity, boundaries]
depends_on: [ADR-0002, ADR-0006, ADR-0011, ADR-0021]
---

# ADR-0038: Tenant-configured egress leaves through one proxy, on a per-tenant allow-list derived from configuration

## Status

Accepted. It covers the Model Broker and Tool Invocation. The Connector's share of the same question
waits on [ADR-0007](adr-0007-outbound-connector-for-enterprise-reachability.md), which is
**Proposed**.

## Context

[ADR-0006](adr-0006-model-layer-as-credential-broker.md) requires a generic OpenAI-compatible base
URL so a Tenant can reach its own internal gateway, and a Tool is registered with an origin the
Tenant supplies. [`threat-model.md`](../40-governance/threat-model.md) T6 states the consequence
without softening it: **a customer-configurable endpoint is an SSRF primitive by construction**
([CWE-918](https://cwe.mitre.org/data/definitions/918.html)), the feature and the vulnerability are
one mechanism, and it cannot be designed away without removing the capability the enterprise segment
requires.

T6 is normative and already binds four things: egress defaults to deny; every outbound request made
on tenant-supplied input has its destination resolved and validated **at connection time** and
**re-validated on every redirect**; cloud instance metadata endpoints are unreachable from any
component making tenant-configured outbound requests; and a credential is never attached to a request
whose destination failed validation. **The posture is not reopened here.**

What T6 leaves open, in its own words, is the allow-list's **shape** — "per tenant or platform-wide,
hostnames or address ranges, in the application or by an egress proxy identity" — and it says the
question spans the Model Broker, Tool invocation and the Connector, so it needs one ADR rather than
three local answers. Five registers carry the row: `threat-model.md` section 14,
[`containers.md`](../10-architecture/containers.md) section 12,
[`data-plane.md`](../10-architecture/data-plane.md) section 11,
[`system-context.md`](../10-architecture/system-context.md) section 7 and
[`connector.md`](../10-architecture/connector.md) section 13. `containers.md` names what it gates:
two container boundaries, and a stable egress identity customers can allow-list.

Two constraints bound the answer.

- **Destinations are per Tenant by construction.** A Model Binding and a Tool registration are
  tenant-scoped records ([ADR-0011](adr-0011-tenant-isolation-shared-schema-rls.md)), so a
  platform-wide list cannot express what one Tenant configured without exposing it to another.
- **The Connector's share cannot close.** ADR-0007 is Proposed, and `connector.md` section 9 notes
  that the Connector's own restriction and Orchestra's allow-list point in opposite directions, sit
  in different trust domains and are administered by different parties. Conflating them would leave
  one unowned.

T6's residual risk stands whatever shape is chosen: Orchestra cannot distinguish "the Tenant's own
internal gateway" from "an internal address this configurer should not reach" by network property
alone. That distinction is administrative — who may configure a Model Binding — and is the Tenant's
own separation of duties.

## Decision drivers

- Validation that a compromised or buggy calling process cannot skip, which is what "structural"
  means here.
- Entries a Tenant cannot author directly, so the only way to widen reachability is an audited
  administrative act.
- Connection-time resolution and re-validation on redirect, which T6 already requires.
- One denied set that no configuration can override.
- A stable egress identity a customer can allow-list on their own perimeter.
- Nothing that breaks when a provider changes its addresses.
- The Connector's share left open rather than pre-empted while ADR-0007 is Proposed.

## Considered options

1. **A platform-wide list Orchestra curates**, the same for every Tenant.
2. **Per-tenant hostnames checked in each service's HTTP client**, before the request is made.
3. **A per-tenant list derived from configuration, enforced at an egress proxy** that is the only
   outbound route.
4. **Address-range lists**, per tenant or platform-wide.

## Decision

**Option 3.**

**One outbound route.** The Model Broker and Tool Invocation reach a tenant-configured destination
only through an egress proxy. At the network level those components have no other outbound path —
no default route to the internet and no direct name resolution for external names — so a request
that does not go through the proxy does not leave. The proxy is the stable egress identity a customer
allow-lists on their own perimeter.

**The allow-list is per Tenant, and derived rather than authored.** There is no allow-list editor.
An entry exists for each Model Binding endpoint and each registered Tool origin the Tenant holds, by
**scheme, host and port**, and for nothing else. A destination that does not match an entry of the
requesting Tenant exactly is refused. Widening what a Tenant can reach therefore means configuring a
Model Binding or registering a Tool in the Tool Catalog — administrative acts that already cross a
Policy Enforcement Point and are already audited
([`audit-model.md`](../40-governance/audit-model.md) section 3, invariant I5). T6's residual is left
exactly where T6 puts it, and nowhere else.

**The proxy carries the Tenant on every request**, verified rather than asserted, and matches against
that Tenant's entries alone. A request that arrives with no verified Tenant is refused.

**Where a name resolves is checked at connection time, and again on each new connection.** The proxy
resolves the host itself, checks every address the name resolves to, and connects to an address it
checked, so a name that answers differently a moment later cannot be substituted. The proxy does not
follow redirects: a redirect is returned to the caller, and the caller's next request is a new
connection through the proxy, resolved and checked again. Because the proxy is the only route, a
redirect cannot be followed around it. This is T6's "at connection time, and re-validated on every
redirect", made structural by being outside the calling process.

**A denied set that nothing overrides.** These are refused whatever a Tenant has configured, and no
entry, override or support action can admit them:

| Denied | Covering |
| --- | --- |
| Loopback | `127.0.0.0/8`, `::1` |
| Private-use and unique-local | `10/8`, `172.16/12`, `192.168/16`, `fc00::/7` |
| Link-local, which includes the addresses cloud providers serve instance metadata on | `169.254.0.0/16`, `fe80::/10` |
| Every other special-purpose range | The IANA IPv4 and IPv6 special-purpose address registries ([RFC 6890](https://www.rfc-editor.org/rfc/rfc6890)) |
| Orchestra's own internal ranges | Whatever the deployment assigns them |

A destination given as a literal address is checked against the same set.

**TLS is tunnelled, not terminated.** The proxy sets up the connection and passes bytes; it does not
intercept, so no BYOK credential and no model traffic is readable there. What the proxy enforces is
which origin a connection may reach, which is what T6 asks of it.

**A refusal is a loud, tenant-visible configuration error**, as T6 requires, and never a silent
fallback to a default endpoint. The credential is not attached to a request whose destination was
refused; the proxy never holds one.

**The Connector is out of scope, deliberately.** When ADR-0007 binds, the Connector's tunnel is a
fourth outbound edge and its share extends this record. Its own inbound restriction — what the
Connector may reach inside the customer's network — stays the customer's control and is not this
list.

**What this amends.**

- `threat-model.md` T6: the shape is decided; the bullet that leaves it open goes, and the register
  row narrows to the Connector's share.
- `data-plane.md` section 8: the plane's egress paragraph states the shape rather than registering
  it, and section 11's row narrows to the Connector's share.
- `containers.md` section 12: the row narrows, and the two container boundaries it gated are
  unblocked — the Model Broker and Tool Invocation each reach a destination only through the proxy.
- `system-context.md` section 7 and `connector.md` sections 12 and 13: the same row, narrowed to what
  ADR-0007 still gates.

## Rationale

**Option 1 cannot serve the product.** ADR-0006 exists so a Tenant can name its own endpoint, and
ADR-0002 assumes the Tenant's own provider account. A list Orchestra curates either refuses those
endpoints or grows a ticket queue in front of every Model Binding.

**Option 2 is bypassed by the thing it defends against.** A check inside the calling process is
skipped by any defect or compromise in that process, and T6's threat is precisely a request the
process was tricked into making. It also re-implements resolution, redirect handling and
address-range checks in every HTTP client, where they drift apart. `data-plane.md` section 11 says
the same thing from the other side: validation is structural only outside the calling process.

**Option 3 makes the check unskippable and the entries unforgeable.** The proxy is the only route, so
there is nothing to remember to call; the entries come from records the Tenant already configured
under an enforcement point, so there is no second authorization surface to design, and no Tenant can
widen its own reach without an audited act. It gives `containers.md` the stable egress identity it
asked for, and it is the one shape that satisfies T6's connection-time requirement structurally.

**Option 4 breaks on address churn.** Model providers and SaaS Tool origins move between addresses
constantly, so a range list is either wrong or perpetually maintained. Ranges are the right shape for
the *denied* set, which is stable and standards-defined, and the wrong shape for the allowed set.

## Consequences

### Positive

- An SSRF attempt from a compromised Model Broker or Tool Invocation process still meets the check,
  because the check is not in that process.
- Metadata, private, link-local and Orchestra-internal addresses are unreachable from the components
  that make tenant-configured requests, which is T6's hard requirement.
- The reachable set follows configuration automatically, so it cannot drift from what a Tenant
  actually has, and no allow-list ever has to be reconciled against the Model Bindings and Tools.
- Customers get one egress identity to allow-list on their own perimeter.
- Two container boundaries `containers.md` section 12 held open are settled.

### Negative

- **The proxy is on the path of every model call and every Tool invocation.** Its availability bounds
  theirs, and its latency is added to both. It has to scale with model traffic.
- **A new component to operate**, with its own configuration, its own failure modes and its own
  telemetry, and it is a component a compromise of which weakens every tenant's egress control at
  once.
- A Tenant whose own gateway sits behind a name that resolves into a private range cannot be reached
  at all. That is the intended refusal, and it will be reported as a product limitation.
- The proxy must learn the allow-list from tenant configuration, which is a read path from
  configuration into the network layer that did not exist before, and it must stay current as
  configuration changes.
- Tunnelled TLS means the proxy cannot see a redirect inside a connection to the same origin. A
  same-origin redirect is already within an allowed entry, so nothing is lost, but the enforcement is
  per connection rather than per request.

### Neutral / follow-on work

- Specify the proxy: how it is given the Tenant, how it learns entries and how current they must be,
  what it logs, and its failure behaviour. That belongs in `docs/10-architecture/` with the Model
  Broker and Tool Invocation designs.
- Choose the proxy implementation with the deployment target; nothing here names one.
- Decide whether an egress refusal is also an Audit Record. `audit-model.md` section 3 owns the
  enumeration, and a refusal today is a tenant-visible configuration error and proxy telemetry.
- Whether the Connector fabric routes through the same proxy is part of the Connector's share, after
  ADR-0007 binds.
- The local stack needs a proxy, or a stand-in, before the first outbound call is built.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| A component is deployed with a route around the proxy | Medium | High | The absence of any other route is a deployment control, tested as an isolation test is tested, not a configuration convention |
| The proxy becomes a single point of failure for all outbound traffic | Medium | High | It is scaled and monitored as a data-plane component; queue depth and refusals are first-class signals |
| The proxy's view of the allow-list lags a configuration change | Medium | Medium | Entries are read from the configuration records themselves; staleness bounds are specified with the proxy and are visible |
| A Tenant configures a destination that reaches Orchestra's own network | Low | High | Orchestra-internal ranges are in the denied set, which no entry overrides |
| A hostname resolves to an allowed address, then to a private one | Medium | High | The proxy connects to an address it checked, and each new connection is resolved and checked again |
| A compromised proxy weakens every Tenant's egress at once | Low | High | It holds no credential and terminates no TLS, so a compromise reaches reachability rather than content; it is in the same blast radius as the components it serves |

## Revisit criteria

Reopen this decision in any of these cases:

- ADR-0007 binds, and the Connector's share turns out not to compose with this shape.
- A design partner requires an egress path Orchestra cannot express as a configured Model Binding or
  a registered Tool origin.
- Measured proxy latency or availability proves material against the model and Tool paths.
- A deployment target offers an egress control with the same properties, making a proxy of Orchestra's
  own redundant.

## References

- [`../40-governance/threat-model.md`](../40-governance/threat-model.md) T6: the posture, settled,
  and the shape this record decides
- [ADR-0006](adr-0006-model-layer-as-credential-broker.md): the configurable base URL that makes this
  necessary
- [`../10-architecture/data-plane.md`](../10-architecture/data-plane.md) section 8: the plane's egress
- [`../10-architecture/containers.md`](../10-architecture/containers.md) section 12: the two container
  boundaries this unblocks
- [`../10-architecture/connector.md`](../10-architecture/connector.md) section 9: why the two lists
  are not one list
- [CWE-918](https://cwe.mitre.org/data/definitions/918.html): server-side request forgery
- [RFC 6890](https://www.rfc-editor.org/rfc/rfc6890): special-purpose address registries
