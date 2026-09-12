---
title: Protocol
doc_id: DOC-040
version: 0.16.0
status: Draft
last_updated: 2026-09-11
owners: [platform-architecture]
---

# Protocol

Normative wire contracts. **Implementations must conform.** Requirement keywords carry their
[RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) meanings.

These contracts evolve additively. [`../VERSIONING.md`](../VERSIONING.md) rule R3 requires every
consumer to silently ignore fields, events, enum values and component types it does not recognise,
and section 6 forbids `additionalProperties: false` on any wire-facing object. A contract published
here is far harder to correct than a rule written anywhere else in this set — which is why this
section and [`../40-governance/`](../40-governance/) are the two that bind.

## Documents

| Document | Specifies |
| --- | --- |
| [`event-protocol.md`](event-protocol.md) | The Orchestra Agent Event Profile: what the Run event stream carries, its ordering and its replay |
| [`gateway-api.md`](gateway-api.md) | The resource-oriented HTTP surface, its two authenticating entry points and its error taxonomy |
| [`http-conventions.md`](http-conventions.md) | The response and error contract every HTTP API follows — JSON:API 1.1 documents, codes and retry safety (ADR-0025) |
| [`openapi/`](openapi/) | One OpenAPI document per service, importable into Postman and rendered as the API reference |
| [`ui-protocol.md`](ui-protocol.md) | Declarative agent-produced UI, the allow-listed catalog, and the approval surface |
| [`schemas/`](schemas/) | JSON Schema — the source of truth for every contract above |

## The profile is Orchestra's, not an upstream format's

The client-facing event contract is the **Orchestra Agent Event Profile**. It pins an upstream draft
event format by commit and re-exports none of it as a promise, because no upstream version has ever
been frozen and its publisher asks that the draft not be cited as a stable reference. Orchestra
cannot offer an enterprise compatibility promise stronger than the artefact it derives from unless
the derivation is Orchestra's own — see
[ADR-0004](../adr/adr-0004-adopt-ag-ui-event-protocol.md), which is **Proposed**.

Two consequences worth stating here rather than leaving to the document. Ordering and replay are
**built, not inherited**: the upstream format supplies neither, and states that arrival order is its
order. And the four per-event guarantees — a per-Run monotonic `seq`, `run_id`, `tenant_id` and a
server-assigned `event_id` — travel in the profile's vendor-prefixed metadata and never as top-level
fields, which one transport binding silently drops.

> **Status.** [ADR-0004](../adr/adr-0004-adopt-ag-ui-event-protocol.md) and
> [ADR-0010](../adr/adr-0010-a2ui-genui-interchange.md) are both **Proposed**. Every claim resting on
> them is marked in place, and the conformance suite the profile requires does not exist yet.
>
> The seven schemas under [`schemas/`](schemas/) are written, and CI now enforces the rules of
> [`../VERSIONING.md`](../VERSIONING.md) section 6 over them. Two things they do not settle. The
> profile's pin is still unset — section 3.1 requires `agent-event.v1` to carry one full upstream
> commit identifier, and none exists to pin against — so that schema matches two streamed families by
> prefix where it owes an exhaustive constant list. And seven contracts this section describes in
> prose have no schema yet; [`schemas/README.md`](schemas/README.md) says why each must wait. The
> error envelope, once the eighth, is now specified by [`http-conventions.md`](http-conventions.md)
> and described in the shared OpenAPI components under [`openapi/`](openapi/).
