---
title: "ADR-0033: The Gateway contract follows JSON:API's recommended URL layout, and a command is a resource that is created"
adr_id: ADR-0033
status: Accepted
date: 2026-09-13
deciders: [product-owner, platform-architecture]
consulted: []
informed: []
supersedes: []
superseded_by: []
tags: [protocol, api]
depends_on: [ADR-0011, ADR-0024, ADR-0025]
---

# ADR-0033: The Gateway contract follows JSON:API's recommended URL layout, and a command is a resource that is created

## Status

Accepted.

## Context

[`gateway-api.md`](../30-protocol/gateway-api.md) gives the Gateway's resource model in prose, and
its section 9 registers the endpoint shape — the path layout and how a resource is addressed — as
needing an ADR. The shape lasts for the life of `/v1` and every SDK reproduces it, which is the test
[ADR-0025](adr-0025-json-api-http-contract.md) applied to the error envelope. JSON Schema cannot
carry it. [`VERSIONING.md`](../VERSIONING.md) section 4 fixes only the `/v1` prefix, and ADR-0025
chose JSON:API 1.1 while leaving the path layout open.

Three things wait on it.

- The Gateway serves a probe route and no resource of its contract.
- [`schemas/README.md`](../30-protocol/schemas/README.md) records that none of the seven schemas the
  prose describes can be written before the endpoint shape exists.
- [`ui-protocol.md`](../30-protocol/ui-protocol.md) section 7 carries an approval decision as the
  *decide* operation on an Approval Request, a verb nothing yet spells.

Five facts bear on the choice.

- **The Tenant comes from the credential.** `gateway-api.md` G7 forbids a tenant identifier a caller
  can set, in a path segment, a query parameter, a body member or a header.
- **A Workspace is scope, not isolation.** G9 has a Workspace narrow visibility and administration,
  enforced in application code, and never act as an isolation boundary.
- **Replays return what was stored.** G10 and G11 make `Idempotency-Key` return the original
  response, so a replayed submission creates no second Run and a replayed approval decision records
  no second decision.
- **JSON:API mandates no URL design, and recommends one.** Its
  [recommendations](https://jsonapi.org/recommendations/) form a collection's URL from the resource
  type, an individual resource's URL from the collection and the identifier, and relationship and
  related resource URLs from the resource's URL. The specification creates a resource by `POST` to
  a collection.
- **One operation already has that shape.** Tenant User Management's `POST /credential-resolutions`
  creates a resolution rather than calling a verb
  ([`credential-resolution.md`](../30-protocol/credential-resolution.md) CR1).

## Decision drivers

- One pattern for every resource and every operation, which a client and an SDK learn once.
- A published convention, not an Orchestra invention, as ADR-0025 required of the envelope.
- No Tenant anywhere a caller can set it (G7), and no Workspace presented as a boundary (G9).
- Every governed act a caller asks for has an identifier of its own, which its Audit Record carries
  ([`audit-model.md`](../40-governance/audit-model.md) A4) and an `Idempotency-Key` replay returns
  (G11).
- A resource's identity does not depend on where a client found it.
- Evolution stays additive under [`VERSIONING.md`](../VERSIONING.md) rules R2 and R3: a new resource
  or command is a new collection, never a change to an existing path.

## Considered options

1. **JSON:API's recommended layout**: a top-level collection per resource type, relationship links,
   no Tenant or Workspace in a path, and every command a resource that is created.
2. **Hierarchical nesting**, such as a Run's Approval Requests under the Run's path.
3. **Resource paths with custom verbs**, such as a `:cancel` suffix on a Run's path.

## Decision

We chose option 1.

**Resources.** Every resource type has one collection at `/v1/{type}`, named by its JSON:API `type`
in plural kebab-case ([`http-conventions.md`](../30-protocol/http-conventions.md) HC3), and each
resource is at `/v1/{type}/{id}`, such as `/v1/runs/{id}`. The path is resolved within the Tenant
the credential established (G7), so it needs nothing but the type and the identifier.

**Relationships.** A resource names what it relates to in `relationships`, with JSON:API's `self`
and `related` links in the recommended form, `/v1/{type}/{id}/relationships/{relationship}` and
`/v1/{type}/{id}/{relationship}`. No path is nested deeper. A related resource also has its own
path, and a link is a way to reach it, never part of its identity.

**No Tenant and no Workspace in a path.** The credential establishes the Tenant, so no path, query
parameter, body member or header names one (G7). A Workspace is never a path segment either. It is a
relationship of the resources it scopes, and a collection narrowed by it takes a `filter[...]`
parameter (HC5). What a Principal may read inside the Tenant is authorization, and a path never
stands in for it (G9).

**Commands.** An operation that asks the platform to act, rather than to store a representation the
caller supplies, is a command. A command is a resource created by `POST` to a collection of its own.
It names what it acts on in `relationships`, is answered as HC4 answers any creation — 201 with
`Location`, or 202 where the work continues — and stays readable at its own path. A lifecycle
transition a caller asks for is a command, so a caller never writes a resource's state directly,
and no path carries a verb.

- `POST /v1/session-tokens` mints a Session Token (G5). A replay under the same
  `Idempotency-Key` returns the mint resource — its identifier and its expiry — and never the
  bearer value, so no live credential is kept for replay (G30).
- An approval decision is created in its own collection, naming the Approval Request it decides.
- A cancellation is created in its own collection, naming the Run it cancels (G15).

An update of a representation the caller supplies stays an ordinary JSON:API update.

**Every command has its own identifier.** The Audit Record of the act names the command resource by
identifier (A4). A replay under the same `Idempotency-Key` returns the stored response naming the
same resource, so a replayed approval decision is recognisably the same act and records nothing
twice (G11).

**What stays open.**

- The type name, path and relationships of each command beyond the examples above are fixed when the
  operation is specified in `gateway-api.md` and the Gateway's OpenAPI document (HC14).
- The Run event stream is not a JSON:API document. It stays an operation on the Run (G25), and its
  path is fixed with the transport binding `gateway-api.md` section 9 already registers.
- Internal APIs are not bound by this record. The one internal operation shipped already has this
  shape, answered with 200 because a resolution is computed and never stored (CR1).

### What this amends

- `gateway-api.md`: section 1 counts the new rules, section 3's mint stops being illustrative and
  gains G30, section 5 gains the addressing rules and treats deciding an Approval Request and
  cancelling a Run as commands, and section 9's endpoint-shape and mint-replay rows are discharged
  while its transport-binding row gains the stream's path.
- `schemas/README.md`: the endpoint shape no longer holds back the seven schemas, and its register
  row is discharged.
- `ui-protocol.md` section 7: an approval decision is a command created against its Approval Request.
- `http-conventions.md` section 9 registers whether internal APIs follow the same layout.
- `observability.md` section 9 and the Gateway service's README stop describing the endpoint shape
  as open.

## Rationale

**Option 1 is the published answer of the standard already chosen.** ADR-0025 adopted JSON:API 1.1
so that Orchestra would invent no envelope, and the same standard's recommendations answer this
question. Creation by `POST` to a collection, relationship links and filter parameters are all
specified there, so the contract adds rules rather than mechanisms, and a JSON:API client expects
them.

**Option 2 ties identity to one parent.** An Approval Request belongs to a Run, but an approver
reaches it from a queue of requests rather than from the Run. A Tool is named by the capability
grants of many Agent versions, and a Policy version is pinned by many Runs. Nesting makes one parent
the address and every other route a second name for the same resource. It also invites a Tenant or
a Workspace into the hierarchy, which G7 and G9 exclude.

**Option 3 adds a second pattern, and a verb is not a record.** A custom verb is concise, but a
client learns two shapes, JSON:API gives the verb no document to return, and the act has no
identifier until something invents one. Governed, accountable acts are what Orchestra sells
([ADR-0015](adr-0015-governed-action-positioning.md)). An approval decision or a cancellation needs
an identity for its Audit Record and for replay, and a created resource is that identity. Credential
resolution already works this way.

## Consequences

### Positive

- One addressing rule and one creation rule for every resource and every command, in the form
  JSON:API tooling expects.
- Every approval decision, cancellation and mint has an identifier from the moment it is accepted,
  for audit, replay and support.
- A Tenant cannot appear in a path, and a Workspace cannot be mistaken for a boundary.
- The seven schemas `schemas/README.md` holds back can be written against a fixed shape.
- A new command is a new collection: additive under R2, and ignorable under R3.

### Negative

- Every command is a resource type to name, document, store and retain, where a verb would have been
  one route.
- A command that records a governed act stays readable, so its store grows with governed volume, and
  its retention follows an audit-retention period no document has decided.
- A client makes two requests where nesting would have made one, or asks for `include`, which each
  operation must then document.
- Relationship and related resource links multiply the paths the OpenAPI document describes and the
  contract tests check.
- Minting becomes the creation of a stored resource, which forced the replay question rather than
  leaving it to the mint's specification. The answer costs a client something: the stored response
  carries the mint's identifier and expiry and never the bearer value (G30), so a client that lost
  the first response cannot recover the token, mints again, and leaves the first to expire unused.

### Neutral / follow-on work

- Specify each resource's and command's type name, path, relationships and responses in
  `gateway-api.md` and `openapi/src/gateway.yaml` before it ships (HC14).
- Write the seven schemas, now that their endpoint shape is fixed.
- Fix the Run event stream's path with its transport binding (`gateway-api.md` section 9).
- Decide whether internal APIs follow this layout, with the first internal operation that is not a
  resolution (`http-conventions.md` section 9).
- Check in the Gateway's contract tests that no operation writes a lifecycle state directly, and that
  no path carries a verb or a tenant identifier.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| A lifecycle state is exposed to a direct update "just for now" | Medium | High | The rule is normative in `gateway-api.md`, and contract tests assert that no operation writes one |
| A tenant identifier arrives as a query parameter | Low | High | G7 forbids it, and HC5 refuses an unknown parameter with `request.invalid_parameter` |
| Command resources accumulate with no retention rule | High | Medium | Their retention follows the audit-retention decision; volume is measured before a figure is set |
| Clients build related-resource paths by hand and break when a relationship changes | Medium | Medium | Relationships evolve additively and are never renamed (R2); SDKs follow `links` |
| A replayed mint re-issues a live credential | Low | High | No live credential is kept for replay: the stored response carries the mint's identifier and expiry and never the bearer value (`gateway-api.md` G30) |

## Revisit criteria

Reopen this decision in any of these cases:

- JSON:API 1.2 is final and changes its URL recommendations or how it models an operation, which
  ADR-0025 already names as a reason to look again.
- A significant SDK consumer cannot follow relationship links, or reads that nesting would have
  served in one request are measured to dominate client latency.
- An operation is found that cannot be a resource without storing state that neither audit nor
  replay needs.

## References

- [ADR-0025](adr-0025-json-api-http-contract.md) and
  [`../30-protocol/http-conventions.md`](../30-protocol/http-conventions.md) HC3 to HC5: documents,
  creation and collections
- [`../30-protocol/gateway-api.md`](../30-protocol/gateway-api.md) G5, G7 to G11, G15 and section 9:
  the mint, tenant scoping, idempotency, cancellation and the register
- [`../30-protocol/credential-resolution.md`](../30-protocol/credential-resolution.md) CR1: the
  shipped operation in this shape
- [`../30-protocol/schemas/README.md`](../30-protocol/schemas/README.md) and
  [`../30-protocol/ui-protocol.md`](../30-protocol/ui-protocol.md) section 7: what waited on it
- [JSON:API 1.1](https://jsonapi.org/format/1.1/): creating resources, and relationship links
- [JSON:API recommendations](https://jsonapi.org/recommendations/): URL design
