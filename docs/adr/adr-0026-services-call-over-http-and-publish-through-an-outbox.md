---
title: "ADR-0026: Services call each other over HTTP under the JSON:API contract, and publish facts through an outbox"
adr_id: ADR-0026
status: Accepted
date: 2026-09-13
deciders: [product-owner, platform-architecture]
consulted: []
informed: []
supersedes: []
superseded_by: []
tags: [architecture, protocol, services, security]
depends_on: [ADR-0017, ADR-0020, ADR-0025]
---

# ADR-0026: Services call each other over HTTP under the JSON:API contract, and publish facts through an outbox

## Status

Accepted.

## Context

[ADR-0020](adr-0020-monorepo-with-enforced-service-boundaries.md) rule B3 has services talk over the
network, through versioned contracts. Its consequences name the two ways a guarantee may cross a
service's edge: a synchronous call that returns only after the owner's durable write, or an outbox,
never a shared transaction. It does not say what a call is. The first call now exists in design:
the Gateway resolves every credential through Tenant User Management on every request
([`containers.md`](../10-architecture/containers.md) section 1). The Control Plane will call the
same service to administer Tenants.

The product owner asked which method services use to talk to each other — REST, gRPC, or both —
and why. The archived vision answered "REST/gRPC as appropriate", which is a way of not deciding: two
contract formats, two toolchains, and no rule for choosing between them.

Several decisions already constrain the answer.

- [ADR-0025](adr-0025-json-api-http-contract.md) makes every HTTP API, internal ones included, a
  JSON:API 1.1 API described in OpenAPI, with an error contract whose `meta.retry` carries retry
  safety.
- ADR-0020 rules B2 and B5 forbid shared code. The services are already Python and TypeScript, so any
  generated client is generated, and regenerated, inside each service.
- Working rule 6 forbids blindly retrying a side effect. Retry safety has to survive every hop, not
  only the public one.
- [`data-plane.md`](../10-architecture/data-plane.md) section 5 shows a synchronous network call on
  the enforcement path stacking a second availability ceiling on the one
  [ADR-0013](adr-0013-fail-closed-policy-decision-writes.md) accepts. How a call travels does not
  change that.
- Every governed action has exactly one accountable Principal
  ([`vision.md`](../00-overview/vision.md)). A service's own identity may authenticate a call, but it
  may never be the actor of one.

## Decision drivers

- One contract and one error model inside and out, so codes and retry safety cross every hop
  unchanged.
- No code-generation toolchain that ADR-0020 would have every service carry separately.
- Latency spent where it matters. Model calls and durable writes take hundreds of milliseconds to
  seconds.
- Calls testable with the tools the public API already uses, on a local topology that matches
  production (ADR-0020 rule B6).
- Nothing trusted because of where on the network it came from.
- Pre-customer, a choice that stays cheap to reverse (working rule 8).

## Considered options

1. **HTTP carrying JSON:API documents for calls, and a transactional outbox for facts other services
   react to**, with gRPC as a named fallback.
2. **gRPC with Protocol Buffers for every internal call**, and JSON:API only at the public boundary.
3. **A message broker as the only channel**, request and reply included.
4. **Either, chosen for each pair of services**, the archived vision's position.

## Decision

**Option 1.**

**Calls.** A call between services is an HTTP request under
[`http-conventions.md`](../30-protocol/http-conventions.md), which gains the rules below.

- The callee's internal operations are in its OpenAPI document like any other (ADR-0025). The
  caller's tests check what it sends, and what it expects back, against that document.
- Every call is authenticated. The calling service presents an access token that the identity
  provider ([ADR-0017](adr-0017-keycloak-for-identity.md)) issued to it through the OAuth 2.0 client
  credentials grant, with the callee as its audience. The callee verifies the token's signature,
  issuer, audience and lifetime, as the Gateway does. Being on the same network is never a
  credential, and outside the local stack every hop is encrypted.
- A service's credential authenticates the service and is never the Principal of an action. When a
  callee acts for a Principal in a Tenant, it takes both from a signed token it verifies, never from
  a header or body member it would have to take on trust. Which token that is, and who signs it, is
  not decided here. An operation that needs it waits for that decision.
- Every call has a deadline. A caller repeats a failed call only when the error says `safe`. It
  never repeats one marked `unsafe`, and repeats one marked `indeterminate` only after reconciling.
  A deadline reached without an answer leaves a read safe to repeat and anything else indeterminate.
  Every state-changing internal operation accepts `Idempotency-Key`, as
  [`VERSIONING.md`](../VERSIONING.md) section 4 requires of the Gateway.
- A callee's error reaches the caller's own client only through the caller's error layer: as
  `upstream.unavailable`, as `upstream.outcome_unknown`, or as a code the caller's contract
  documents. The callee's detail and request identifier go to the caller's log.
- A stream between services is a streamed HTTP response.

**Facts.** A fact another service reacts to, such as a Membership granted or a Tenant suspended,
leaves its owner through a transactional outbox.

- The event is written to an outbox table in the owner's own schema, in the same transaction as the
  change it records, so neither exists without the other.
- It is delivered at least once, and its consumer processes it idempotently by event identifier.
  Order across events is not promised.
- It carries the Tenant it concerns, like every record (working rule 7). The only exceptions are
  those an Accepted ADR already makes, such as the global Person of
  [ADR-0024](adr-0024-global-person-with-tenant-memberships.md).
- Each event type is a versioned wire contract in `docs/30-protocol/schemas/`, evolving additively
  under [`VERSIONING.md`](../VERSIONING.md) rule R3.
- No service reads another service's outbox table (ADR-0020 rule B4). The transport from an outbox to
  its consumers is not decided here. A relay pushing events to the consumer over HTTP, under the call
  rules above, and a broker are the candidates. An ADR chooses between them when the first
  cross-service consumer exists.

**gRPC is the named fallback, not a default.** An ADR adopts it for one pair of services when either
condition holds:

- A call on a per-request path is measured to spend a material share of its latency on serialization
  or connection setup, after caching has been tried. Credential resolution from the Gateway is the
  first candidate.
- Two services need bidirectional streaming or flow control that a streamed HTTP response cannot
  provide.

A gRPC contract would then live in `docs/30-protocol/` as Protocol Buffers, and carry the same
registered codes and retry safety in its error details.

**Out of scope.** The mechanism that makes a Policy Decision durable stays ADR-0013's to decide, and
it is still open. `data-plane.md` section 6 lists a durable outbox among its candidates, but the
outbox here carries facts between services, so choosing it does not choose that mechanism. Where
Policy evaluation executes is unchanged.

## Rationale

Option 1 is the only one that keeps one contract. ADR-0025 already requires JSON:API and OpenAPI of
internal APIs, so option 2 would add a second format and a second error model. Every hop between the
two would then translate `meta.retry`, and that translation is exactly where working rule 6 is
easiest to lose. Option 2 would also put a Protocol Buffers toolchain and generated stubs in every
service, which ADR-0020 forbids sharing. The saving would be microseconds on payloads this small, on
paths dominated by model calls and durable writes.

Option 3 turns a question that has an answer now, whether this Principal is who they claim to be,
into eventual consistency, and makes a broker a dependency of authentication. Option 4 is how a
system ends up with both formats and no rule.

Option 1's costs are real and bounded. JSON over HTTP is slower per call than Protocol Buffers over
HTTP/2, which matters only on a measured hot path, and the fallback names exactly that case. Keeping
gRPC out until then is also the reversible direction: adding it to one pair of services is additive,
while removing it from many is not.

The outbox is the pattern ADR-0020 already named. Writing the event in the owner's own transaction is
what makes "no change without its event" hold without a distributed transaction. Choosing the
transport now would choose a broker before there is a single event to carry.

## Consequences

### Positive

- One document shape, one error model and one set of tools — OpenAPI, Postman and contract tests —
  for every call, public or internal.
- Retry safety survives every hop, so a side effect is never repeated blindly two services away.
- No trust by network location, and no service identity standing in for the accountable Principal.
- An event cannot be lost between a change and its announcement, and no broker is operated before
  one is needed.

### Negative

- Each call pays JSON and HTTP overhead, and there is no generated client: each caller writes a small
  client and checks it against the callee's document.
- Token verification exists once per service, which ADR-0020 rule B5 already accepts.
- Every service that publishes events carries an outbox, and a relay until the transport is decided.
- An internal operation that acts for a Principal waits for the token decision.

### Neutral / follow-on work

- Add the rules for calls between services to `http-conventions.md`.
- Decide, by ADR, how a call carries the originating Principal and Tenant verifiably, before the
  first internal operation that acts for one. The question is registered in
  [`identity-and-access.md`](../10-architecture/identity-and-access.md).
- Decide, by ADR, the transport from an outbox to its consumers, when the first cross-service
  consumer exists. The question is registered in
  [`containers.md`](../10-architecture/containers.md).
- Register a client in the local identity provider realm for each service that makes a call, when
  the first internal call lands.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| A per-request internal call is too slow over HTTP | Medium | Medium | Measure it; cache resolution within the credential's lifetime; then the gRPC fallback for that pair, by ADR |
| A callee trusts a call because of where it came from | Medium | High | Every callee verifies the caller's credential, and its tests call without one |
| Tenant context is asserted rather than verified | Medium | High | Forbidden here; an operation that needs it waits for the token decision |
| An event is lost, or processed twice | Medium | High | Written in the owner's transaction, delivered at least once, consumed idempotently by event identifier |
| A failed call is retried into a duplicate side effect | Medium | High | A call is repeated only when marked `safe`, and every state-changing operation accepts `Idempotency-Key` |

## Revisit criteria

Reopen if the fallback's criterion is met for more than one pair of services, which would suggest
gRPC as the internal default rather than an exception. Also reopen if services are deployed across
networks where per-call cost dominates, or if event volume or fan-out makes a broker the default
transport rather than a candidate.

## References

- [ADR-0020](adr-0020-monorepo-with-enforced-service-boundaries.md): rules B2 to B6, and the
  consequence naming a synchronous call or an outbox
- [ADR-0025](adr-0025-json-api-http-contract.md) and
  [`../30-protocol/http-conventions.md`](../30-protocol/http-conventions.md): the contract every call
  follows
- [`../10-architecture/containers.md`](../10-architecture/containers.md) section 1: the synchronous
  dependencies between the planes
- [`../10-architecture/data-plane.md`](../10-architecture/data-plane.md) sections 5 and 6: the
  enforcement path and the durable decision write
- [RFC 6749](https://www.rfc-editor.org/rfc/rfc6749#section-4.4) section 4.4: the client credentials
  grant
- [gRPC](https://grpc.io/docs/what-is-grpc/introduction/): the named fallback
