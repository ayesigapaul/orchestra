---
title: HTTP Conventions
doc_id: DOC-096
version: 0.9.0
status: Draft
last_updated: 2026-09-23
owners: [platform-architecture]
depends_on: [ADR-0025, ADR-0026, ADR-0027, ADR-0029]
---

# HTTP Conventions

The response contract, error contract and documentation rules every Orchestra HTTP API follows —
public, administrative and internal — as [ADR-0025](../adr/adr-0025-json-api-http-contract.md)
decides, and the rules for calls between services that
[ADR-0026](../adr/adr-0026-services-call-over-http-and-publish-through-an-outbox.md) adds. This
section is **normative**. MUST, MUST NOT, SHOULD and MAY carry their
[RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) meanings.

The reference is [JSON:API 1.1](https://jsonapi.org/format/1.1/). Where this document is silent,
JSON:API 1.1 applies; where it is stricter, this document wins. Versioning — the `/v1` path, the
`Orchestra-Version` header, `Idempotency-Key`, `Deprecation` and `Sunset` — stays in
[`../VERSIONING.md`](../VERSIONING.md) section 4, and nothing here changes it.

## 1. Media type

**HC1 — Every request and response body is `application/vnd.api+json`.** A request whose
`Content-Type` carries any media type parameter other than `ext` or `profile` MUST be refused with
415 `request.unsupported_media_type`. A request whose `Accept` lists the JSON:API media type only
with such parameters MUST be refused with 406 `request.not_acceptable`. An `Accept` header without
the JSON:API media type at all — `*/*`, or none — is served JSON:API.

## 2. Documents

**HC2 — Every body is a JSON:API 1.1 document.** It MUST carry `jsonapi` with `version` set to
`1.1`, and exactly one of `data` or `errors`, never both. It MAY carry `meta` and `links`. A consumer
MUST ignore any member it does not recognise ([`../VERSIONING.md`](../VERSIONING.md) rule R3).

**HC3 — Resources are named consistently.** A resource object's `type` is plural kebab-case, such as
`runs` or `approval-requests`, and its `id` is a string. Attribute and relationship names are
snake_case, matching the wire schemas in [`schemas/`](schemas/) and
[`event-protocol.md`](event-protocol.md) rule EG4. No request member names a Tenant: the Tenant is
resolved from the credential ([`gateway-api.md`](gateway-api.md) G7), and a `tenant_id` in a response
is an echo of what the credential established.

**HC4 — Success statuses.**

| Status | When | Body |
| --- | --- | --- |
| 200 | A read, or an update whose result is returned | `data` |
| 201 | A resource was created | `data`, with `Location` naming the new resource |
| 202 | Accepted for asynchronous work, including a Run suspended at an approval gate | `data` describing the accepted work |
| 204 | A removal with nothing to report | None |

An approval gate is never an error ([`gateway-api.md`](gateway-api.md) G22): the Run is created and
suspended, and the response says so.

**HC5 — Collections.** A collection's `data` is an array. Pagination is by opaque cursor, followed
through `links.next` and `links.prev`; a client MUST NOT construct a cursor. The query parameter
families `page[...]`, `filter[...]`, `fields[...]`, `sort` and `include` are reserved for their
JSON:API meanings. An unknown or malformed query parameter is refused with 400
`request.invalid_parameter`, naming it in `source.parameter`.

**HC6 — Health.** `GET /healthz` answers 200 with a document carrying only `jsonapi` and `meta`,
where `meta.status` is `ok`. An unhealthy service answers 503 `server.unavailable`.

```json
{ "jsonapi": { "version": "1.1" }, "meta": { "status": "ok" } }
```

## 3. Errors

**HC7 — Every failure is an `errors` document.** `errors` holds one or more error objects. When they
carry different statuses, the response takes the most general status that covers them: 400 for a mix
of client errors, 500 for a mix that includes a server error.

**HC8 — The error object.**

| Member | Required | Meaning |
| --- | --- | --- |
| `id` | Yes | This occurrence's identifier — the request identifier, also returned as the `Orchestra-Request-Id` header |
| `status` | Yes | The HTTP status, as a string |
| `code` | Yes | A registered code, `class.name` (HC9) — the member a program branches on |
| `title` | Yes | The code's fixed, human-readable summary; the same for every occurrence of the code |
| `detail` | No | What happened this time, for a person. Free to change; a program MUST NOT parse it |
| `source` | No | `pointer` to the offending request member, `parameter` for a query parameter, or `header` |
| `links.type` | No | A link to this code's documentation |
| `meta.retry` | Yes | `safe`, `unsafe` or `indeterminate` (HC10) |
| `meta.decision_ref` | No | For a governance refusal only: an opaque reference to the Policy Decision (HC11) |

```json
{
  "jsonapi": { "version": "1.1" },
  "errors": [
    {
      "id": "<request-id>",
      "status": "422",
      "code": "request.validation_failed",
      "title": "A request member is missing or invalid",
      "detail": "name must not be empty",
      "source": { "pointer": "/data/attributes/name" },
      "meta": { "retry": "unsafe" }
    }
  ]
}
```

**HC9 — Codes have two levels.** A code is `class.name`, both lowercase snake_case. The classes:

| Class | Covers |
| --- | --- |
| `request` | The request itself: its media type, method, parameters or body |
| `auth` | Authentication, or an administrative grant the caller lacks |
| `governance` | A refusal on its merits by Policy, or a failed precondition such as a missing capability grant — never a fault |
| `resource` | The addressed resource: absent, invisible to this caller, or in a conflicting state |
| `quota` | A limit that makes the caller wait |
| `upstream` | A dependency outside this service |
| `server` | A fault in this service |

A client that meets an unknown code MUST treat it as its class. A client that meets an unknown class
MUST treat it as `server` with `meta.retry` of `indeterminate` ([`gateway-api.md`](gateway-api.md)
G24). New codes and classes are added, never renamed or repurposed.

**HC10 — Retry safety has three values** ([`gateway-api.md`](gateway-api.md) G21).

- `safe` — nothing took effect, and the same request may be sent again, after `Retry-After` when
  present.
- `unsafe` — sending the same request again is wrong: it was refused on its merits, or it took
  effect. Change the request, the credential or the state first.
- `indeterminate` — whether it took effect is unknown. Reconcile before any retry, and never retry
  blindly.

A `server` fault on `GET` or `HEAD` is `safe`. On any other method it is `indeterminate` unless the
handler establishes that nothing took effect.

**HC11 — What an error never carries.** No `detail`, `source` or `meta` carries a stack trace, a
query, an internal host name, a file path, credential material, or the text or content of a Policy
([`gateway-api.md`](gateway-api.md) G23). A `server` error's `detail` is generic. An `auth.unauthenticated`
error never says why the credential failed. A reference to another Tenant's resource is answered
exactly as a reference to one that does not exist, with 404 `resource.not_found`
([`gateway-api.md`](gateway-api.md) G8).

## 4. The code registry

Codes are registered here as endpoints need them. A code appears in an OpenAPI document only after it
appears in this table. The title is registered with the code, so every service and the edge send the
same one.

| Code | Status | `meta.retry` | Title | When |
| --- | --- | --- | --- | --- |
| `request.malformed` | 400 | `unsafe` | The request is malformed | The body is not JSON or not a JSON:API document, or the request is not well-formed HTTP |
| `request.invalid_parameter` | 400 | `unsafe` | A query parameter is unknown or malformed | A query parameter is unknown or malformed; `source.parameter` names it |
| `request.validation_failed` | 422 | `unsafe` | A request member is missing or invalid | A member is missing or invalid; `source.pointer` names it |
| `request.method_not_allowed` | 405 | `unsafe` | This method is not allowed on this path | The path exists but not for this method; `Allow` lists the methods it accepts |
| `request.not_acceptable` | 406 | `unsafe` | No acceptable representation | HC1 |
| `request.unsupported_media_type` | 415 | `unsafe` | Unsupported media type | HC1 |
| `request.content_too_large` | 413 | `unsafe` | The request content is too large | The request content is over the edge's limit; send less (RFC 9110, Content Too Large) |
| `request.uri_too_long` | 414 | `unsafe` | The request URI is too long | The request line is over the edge's limit; shorten the path or query (RFC 9110, URI Too Long) |
| `request.header_fields_too_large` | 431 | `unsafe` | The request header fields are too large | A header field, or all of them together, is over the edge's limit (RFC 6585, Request Header Fields Too Large) |
| `request.idempotency_conflict` | 409 | `unsafe` | This Idempotency-Key was used for a different request | An `Idempotency-Key` was reused with a different request |
| `auth.unauthenticated` | 401 | `unsafe` | A valid credential is required | No credential, or one that failed verification; `WWW-Authenticate` accompanies it |
| `auth.forbidden` | 403 | `unsafe` | This operation needs a grant the caller does not hold | Authenticated, but without the administrative grant the operation needs |
| `governance.policy_denied` | 403 | `unsafe` | A Policy refused this action | A Policy refused the action; `meta.decision_ref` may accompany it |
| `governance.precondition_denied` | 403 | `unsafe` | A precondition for this action does not hold | No Tool Catalog registration, a Tool the pinned version does not declare, no capability grant standing for it, or a pinned schema major the origin no longer serves; names no Policy |
| `resource.not_found` | 404 | `unsafe` | The resource does not exist | No such resource, or none this caller may know exists — including an unknown path |
| `resource.conflict` | 409 | `unsafe` | The resource's state forbids this operation | The resource is in a state that forbids the operation |
| `quota.exceeded` | 429 | `safe` | A limit was reached | A limit was reached; `Retry-After` says when to try again |
| `upstream.unavailable` | 503 | `safe` | A dependency is unavailable | A dependency refused or was unreachable before anything took effect |
| `upstream.outcome_unknown` | 502 | `indeterminate` | A dependency failed, and whether it acted is unknown | A dependency may have acted before the failure |
| `server.decision_not_durable` | 503 | `safe` | The decision could not be recorded, so nothing proceeded | A Policy Decision could not be recorded, so the action did not proceed (ADR-0013) |
| `server.unavailable` | 503 | `safe` | The service is not ready | This service is not ready to serve |
| `server.internal` | 500 | HC10 | Something went wrong on our side | An unhandled fault |

## 5. Headers

**HC12 — Every response carries `Orchestra-Request-Id`**, equal to the `id` of any error it contains.
`WWW-Authenticate` accompanies 401, `Allow` accompanies 405, `Retry-After` accompanies 429 and may
accompany 503, and `Location` accompanies 201. A request carrying a valid
[W3C Trace Context](https://www.w3.org/TR/trace-context/) `traceparent` has its trace continued, not
replaced: the edge and each service serve it in a span of their own whose parent is the caller's
span, and every call they make carries a `traceparent` naming the span it is made in, with the
`tracestate` they received. A missing or invalid `traceparent` starts a new trace.

## 6. Error handling in a service

**HC13 — One error layer per service, and no framework default.** Every failure a service can
produce — an unknown route, a wrong method, a refused media type, malformed or invalid input, an
authentication failure, a governance refusal, a failing dependency and an unhandled exception — MUST
be mapped to an HC8 document in one place. A framework's default error body reaching a client is a
defect. The edge ([ADR-0018](../adr/adr-0018-apisix-at-the-edge.md)) MUST shape its own refusals the
same way.

## 7. Documentation and checks

**HC14 — Every operation is documented before it ships.** Each service's API is an OpenAPI 3.1.2
document in [`openapi/`](openapi/), bundled from its source in `openapi/src/` and the shared JSON:API
components by `scripts/build-openapi.mjs`. Every operation carries a success example and a
documented response, with an example, for every status it can return, drawn from section 4.

**HC15 — Documentation and behaviour are checked against each other.** CI fails when a bundled
document is stale or does not lint. Each service's tests validate its actual responses against its
document, including an unknown route, a wrong method and an unacceptable media type.

## 8. Calls between services

[ADR-0026](../adr/adr-0026-services-call-over-http-and-publish-through-an-outbox.md) makes a call
between services an HTTP request under this document, with no second contract format. These rules
add what a call between services needs and a call from outside does not.

**HC16 — An internal operation is documented and tested like a public one.** It appears in the
callee's OpenAPI document (HC14), and the caller's tests check what it sends, and what it expects
back, against that document.

**HC17 — Every call is authenticated, and never by network location.** The caller presents an access
token that the identity provider issued to it through the OAuth 2.0 client credentials grant, with
the callee as its audience. The callee MUST verify the token's signature, issuer, audience and
lifetime, and answers `auth.unauthenticated` otherwise. Being on the same network, host or address
range is not a credential. Outside the local stack, every hop MUST be encrypted.

**HC18 — A service is never the Principal of an action.** A service's credential authenticates the
calling service and nothing more. A callee that acts for a Principal in a Tenant MUST take both from
a signed token it verifies, and MUST NOT take either from a header or body member on the caller's
word. That token is a Principal Token, which Tenant User Management signs for one callee
([ADR-0027](../adr/adr-0027-tenant-user-management-signs-principal-tokens.md)). Creating a Tenant is
the one exception: no Principal Token can name a Tenant that does not exist yet, so Tenant User
Management verifies the acting Platform Operator's credential itself
([ADR-0031](../adr/adr-0031-tenant-user-management-creates-tenants.md)). An operation that needs a
Principal Token does not ship before the token is specified, as section 9 registers.

**HC19 — Deadlines and retries follow `meta.retry`.** Every call has a deadline. A caller MAY repeat
a failed call only when the error's `meta.retry` is `safe`, after `Retry-After` when one is present.
It MUST NOT repeat a call marked `unsafe`, and repeats one marked `indeterminate` only after
reconciling (HC10). A deadline reached without an answer is `safe` for GET and HEAD, and
`indeterminate` otherwise. Every state-changing internal operation MUST accept `Idempotency-Key`,
with the meaning [`../VERSIONING.md`](../VERSIONING.md) section 4 gives it at the Gateway.

**HC20 — A callee's error is the caller's to map, never to relay.** It reaches the caller's own client
only through the caller's error layer (HC13). A callee that failed before acting becomes
`upstream.unavailable`, and one that may have acted becomes `upstream.outcome_unknown`. Otherwise the
error takes a code the caller's own contract documents. The callee's `detail`, `source` and request
identifier go to the caller's log (HC11).

**HC21 — A stream between services is a streamed HTTP response.** Its framing is registered in
section 9.

A fact another service reacts to is not a call. ADR-0026 has it leave its owner through a
transactional outbox, and each event type is a wire contract in [`schemas/`](schemas/).
[ADR-0029](../adr/adr-0029-kafka-carries-facts-captured-by-debezium.md) has Kafka carry it to its
consumers as a CloudEvent keyed by its Tenant, captured from the outbox by Debezium.

## 9. Open questions

| Question | What would decide it | ADR required? |
| --- | --- | --- |
| Pagination details — page size limits, and whether a JSON:API cursor profile is adopted | The first collection endpoint, with this document | No |
| Whether any JSON:API extension or profile is adopted, such as atomic operations | A use case that needs one | No — additive under JSON:API 1.1 |
| Whether `links.type` resolves to a published page per code, and on what host | Domain registration, which also governs schema `$id`s ([`../VERSIONING.md`](../VERSIONING.md) section 6) | No |
| The edge's size limits — 1 MiB of request content, and 8 KiB for the request line and for each header field — which were set with no customer requirement to size them | A design partner's largest legitimate request, set in the edge's configuration in `infra/compose/apisix/` | No — the codes stay whatever the values become |
| The Principal Token's specification: its explicit type, claims, issuance and exchange operations, header, grant for resumed work, and key set (HC18) | A document in this directory, before the first internal operation that acts for a Principal | No — [ADR-0027](../adr/adr-0027-tenant-user-management-signs-principal-tokens.md) decides the mechanism |
| The framing of a stream between services, such as Server-Sent Events (HC21) | The first stream between services, with this document | No |
| The specification of facts between services: topic names, the CloudEvents mapping, the outbox table's columns and the capture connector's configuration | A document in this directory, with the first event type | No — [ADR-0029](../adr/adr-0029-kafka-carries-facts-captured-by-debezium.md) decides the transport |
| Whether internal APIs follow the Gateway's addressing — one collection per type, relationship links, and every command a resource that is created — which the one internal operation, credential resolution, already has | The first internal operation that is not a resolution, with this document and [`gateway-api.md`](gateway-api.md) G26 to G29 | No — an internal operation has no customer to break, and [ADR-0033](../adr/adr-0033-gateway-urls-follow-json-api-and-commands-are-created.md) binds only the Gateway |
