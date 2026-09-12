---
title: "ADR-0025: HTTP APIs speak JSON:API 1.1, and each is described in OpenAPI"
adr_id: ADR-0025
status: Accepted
date: 2026-09-13
deciders: [product-owner, platform-architecture]
consulted: []
informed: []
supersedes: []
superseded_by: []
tags: [protocol, api, errors, documentation]
depends_on: [ADR-0006, ADR-0020]
---

# ADR-0025: HTTP APIs speak JSON:API 1.1, and each is described in OpenAPI

## Status

Accepted.

## Context

Orchestra's HTTP surfaces — the Gateway's public contract, the Control Plane's administrative API,
and internal contracts such as Tenant User Management's credential resolution — have no response or
error format. [`gateway-api.md`](../30-protocol/gateway-api.md) section 7 leaves the envelope, the
code vocabulary and the status mapping undecided, deliberately shows no example body, and marks the
choice ADR-required: a permanent public contract on every endpoint and in every SDK, which customers
branch on. Meanwhile the two running services answer with their frameworks' defaults, so the
contract is being decided by accident.

The product owner has asked for three things together: API documentation whose endpoints can be
exercised from Postman and similar tools; one standard and consistent response contract and error
contract across every endpoint, with proper error handling; and JSON:API as the reference.

Section 7 already binds whatever is chosen. G21 requires a three-value retry safety on every
failure, G22 a governance refusal distinguishable from a fault, G23 no Policy rule text in a refusal,
and G24 at least two levels of code so that an unrecognised code degrades to a recognised class.
[`VERSIONING.md`](../VERSIONING.md) rule R3 requires every consumer to ignore members it does not
recognise, and section 4 fixes the `/v1` path and the `Orchestra-Version` header.

## Decision drivers

- One document shape for every response, success or failure, from every service, so a client or an
  SDK handles all of them with one parser.
- Errors a program can branch on, meeting G21 to G24, that never leak a secret, a stack trace, Policy
  text or the existence of another Tenant's resource.
- A published standard with existing tooling, rather than an Orchestra invention.
- Documentation a developer can import into Postman, Insomnia or Bruno and run, and that the
  published site renders.
- Contracts checked in CI, so documentation and behaviour cannot drift apart.

## Considered options

1. **JSON:API 1.1** for every document, success and error.
2. **RFC 9457 problem details** for errors, with an Orchestra-defined success shape.
3. **An Orchestra-defined envelope** for both.

## Decision

**Option 1. Every Orchestra HTTP API — public, administrative and internal — exchanges JSON:API 1.1
documents, and each service's API is described in an OpenAPI document that is the source of its
documentation.** [`http-conventions.md`](../30-protocol/http-conventions.md) is the normative
specification. What it must say:

**Documents.** The media type is `application/vnd.api+json`, negotiated as JSON:API 1.1 requires,
with 415 and 406 for unsupported media type parameters. Every body is a JSON:API document that
carries `jsonapi` with version `1.1` and exactly one of `data` or `errors`. Resource `type` values are
plural kebab-case, and attribute names are snake_case to match the wire schemas and
[`event-protocol.md`](../30-protocol/event-protocol.md) rule EG4. JSON:API 1.2 is still in
development and is not used.

**Errors.** Every failure is an `errors` document. Each error object carries `id`, `status`, `code`,
`title` and `meta.retry`, and may carry `detail`, `source` and `links.type`.

- `id` is the request's identifier, which every response also returns as `Orchestra-Request-Id`.
- `code` is `class.name`, over the classes `request`, `auth`, `governance`, `resource`, `quota`,
  `upstream` and `server`, so an unknown code degrades to its class (G24), and a governance refusal
  is never a `server` fault (G22).
- `meta.retry` is `safe`, `unsafe` or `indeterminate` (G21).
- A governance refusal carries at most an opaque `meta.decision_ref`, never rule text (G23).
- A reference to another Tenant's resource returns the same `resource.not_found` as one that does
  not exist (G8).
- `detail` never carries a stack trace, a query, an internal host name or credential material, and a
  `server` error's detail is generic.

**One error layer per service.** Every service maps every failure — an unknown route, a wrong
method, an unacceptable media type, malformed or invalid input, authentication, a governance
refusal, a failing dependency and an unhandled exception — to that document in one place, so no
framework default body reaches a client. The edge's own refusals take the same shape.

**Documentation.** Each service's API is an OpenAPI 3.1.2 document in `docs/30-protocol/openapi/`,
bundled from a per-service source and the shared JSON:API components, with an example for every
operation and a documented response for every status it can return. The published site renders them
as an API reference, and the same files import into Postman, Insomnia and Bruno. **OpenAPI 3.2.1 is
the latest release and is not used yet**: Postman imports 2.0, 3.0 and 3.1, and Mintlify renders 3.0
and 3.1. The pin moves when both read 3.2.

**Checks.** CI fails when a bundled document is stale or does not lint, and each service's tests
validate its actual responses, error responses included, against its document.

## Rationale

Option 1 is the only one that standardises both halves. RFC 9457 is a sound error format but says
nothing about success, so option 2 would still invent an envelope for every read, and option 3
invents both — the step section 7 declined to take even by example. JSON:API's error object already
holds what G21 to G24 need: `code` for a two-level vocabulary, `meta` for retry safety and a decision
reference, `source` to point at the offending member, and `links.type` for per-code documentation.
Its documents are extensible by design, which is R3.

The cost of JSON:API — a heavier success shape than bare objects — is paid once per client, and it is
the price of the consistency the product owner asked for. Pinning OpenAPI 3.1.2 rather than 3.2.1
follows the same rule as TypeScript's exception: latest stable, unless the tools that must read it
cannot.

## Consequences

### Positive

- One parser for every response of every service, and errors a program can branch on and a person
  can read.
- The error-taxonomy question registered in `gateway-api.md` section 9 is answered, within G21 to
  G24.
- API documentation exists from the first endpoint, can be run from Postman, and cannot drift from
  behaviour unnoticed.

### Negative

- JSON:API documents are more verbose than bare JSON for simple reads, and some client libraries
  expect plain objects.
- Every service implements media type negotiation and an error layer, which its framework does not
  provide.
- The edge's refusals have to be configured to match; APISIX does not produce them by default.
- The OpenAPI pin lags the latest release until Postman and Mintlify support 3.2.

### Neutral / follow-on work

- Implement the error layer and contract tests in the Gateway and Tenant User Management, and shape
  APISIX's refusals.
- Register codes as endpoints are specified. The path layout, registered in `gateway-api.md`
  section 9, remains open.
- Decide pagination details, and whether any JSON:API extension or profile is adopted.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| A framework default body reaches a client | Medium | Medium | One error layer per service; contract tests request an unknown route, a wrong method and an unacceptable media type |
| Documentation drifts from behaviour | Medium | High | Bundled documents checked in CI, and responses validated against them in tests |
| An error detail leaks something sensitive | Medium | High | The detail rules of `http-conventions.md`; server errors carry generic detail, and tests assert it |
| Clients branch on detail text instead of code | Medium | Medium | Codes and titles are the stable contract; detail is documented as free to change |

## Revisit criteria

Reopen if JSON:API's document shape blocks a required interaction that the specification cannot
express without an extension Orchestra would have to invent; if a significant SDK consumer cannot
use it; or when JSON:API 1.2 is final, to evaluate adopting it additively.

## References

- [JSON:API 1.1](https://jsonapi.org/format/1.1/)
- [OpenAPI Specification 3.1.2](https://spec.openapis.org/oas/v3.1.2.html)
- [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) — the error format option 2 would have used
- [`../30-protocol/http-conventions.md`](../30-protocol/http-conventions.md) — the normative rules
- [`../30-protocol/gateway-api.md`](../30-protocol/gateway-api.md) section 7 — G21 to G24
- [`../VERSIONING.md`](../VERSIONING.md) rule R3 and section 4
