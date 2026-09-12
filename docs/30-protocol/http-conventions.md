---
title: HTTP Conventions
doc_id: DOC-096
version: 0.1.0
status: Draft
last_updated: 2026-09-13
owners: [platform-architecture]
depends_on: [ADR-0025]
---

# HTTP Conventions

The response contract, error contract and documentation rules every Orchestra HTTP API follows —
public, administrative and internal — as [ADR-0025](../adr/adr-0025-json-api-http-contract.md)
decides. This section is **normative**. MUST, MUST NOT, SHOULD and MAY carry their
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
| `governance` | A refusal on its merits by Policy or a missing capability grant — never a fault |
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
appears in this table.

| Code | Status | `meta.retry` | When |
| --- | --- | --- | --- |
| `request.malformed` | 400 | `unsafe` | The body is not JSON, or not a JSON:API document |
| `request.invalid_parameter` | 400 | `unsafe` | A query parameter is unknown or malformed; `source.parameter` names it |
| `request.validation_failed` | 422 | `unsafe` | A member is missing or invalid; `source.pointer` names it |
| `request.method_not_allowed` | 405 | `unsafe` | The path exists but not for this method; `Allow` lists the methods it accepts |
| `request.not_acceptable` | 406 | `unsafe` | HC1 |
| `request.unsupported_media_type` | 415 | `unsafe` | HC1 |
| `request.idempotency_conflict` | 409 | `unsafe` | An `Idempotency-Key` was reused with a different request |
| `auth.unauthenticated` | 401 | `unsafe` | No credential, or one that failed verification; `WWW-Authenticate` accompanies it |
| `auth.forbidden` | 403 | `unsafe` | Authenticated, but without the administrative grant the operation needs |
| `governance.policy_denied` | 403 | `unsafe` | A Policy refused the action; `meta.decision_ref` may accompany it |
| `governance.precondition_denied` | 403 | `unsafe` | No Tool Catalog registration or no capability grant; names no Policy |
| `resource.not_found` | 404 | `unsafe` | No such resource, or none this caller may know exists — including an unknown path |
| `resource.conflict` | 409 | `unsafe` | The resource is in a state that forbids the operation |
| `quota.exceeded` | 429 | `safe` | A limit was reached; `Retry-After` says when to try again |
| `upstream.unavailable` | 503 | `safe` | A dependency refused or was unreachable before anything took effect |
| `upstream.outcome_unknown` | 502 | `indeterminate` | A dependency may have acted before the failure |
| `server.decision_not_durable` | 503 | `safe` | A Policy Decision could not be recorded, so the action did not proceed (ADR-0013) |
| `server.unavailable` | 503 | `safe` | This service is not ready to serve |
| `server.internal` | 500 | HC10 | An unhandled fault |

## 5. Headers

**HC12 — Every response carries `Orchestra-Request-Id`**, equal to the `id` of any error it contains.
A request carrying a W3C `traceparent` has its trace continued, not replaced. `WWW-Authenticate`
accompanies 401, `Allow` accompanies 405, `Retry-After` accompanies 429 and may accompany 503, and
`Location` accompanies 201.

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

## 8. Open questions

| Question | What would decide it | ADR required? |
| --- | --- | --- |
| Pagination details — page size limits, and whether a JSON:API cursor profile is adopted | The first collection endpoint, with this document | No |
| Whether any JSON:API extension or profile is adopted, such as atomic operations | A use case that needs one | No — additive under JSON:API 1.1 |
| Whether `links.type` resolves to a published page per code, and on what host | Domain registration, which also governs schema `$id`s ([`../VERSIONING.md`](../VERSIONING.md) section 6) | No |
