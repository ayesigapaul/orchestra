---
title: "ADR-0028: Telemetry goes to a self-hosted Grafana stack, keeps every trace until volume demands sampling, and gives work with no Tenant the Nil UUID"
adr_id: ADR-0028
status: Accepted
date: 2026-09-13
deciders: [product-owner, platform-architecture]
consulted: []
informed: []
supersedes: []
superseded_by: []
tags: [architecture, operations, tenancy, security]
depends_on: [ADR-0011, ADR-0017, ADR-0018, ADR-0024]
---

# ADR-0028: Telemetry goes to a self-hosted Grafana stack, keeps every trace until volume demands sampling, and gives work with no Tenant the Nil UUID

## Status

Accepted.

## Context

Every request is traced across the edge, the Gateway and Tenant User Management under W3C Trace
Context, and every hop logs it once
([`http-conventions.md`](../30-protocol/http-conventions.md) HC12). Spans leave over OTLP for an
OpenTelemetry Collector, which in the local stack only prints them.
[`tech-stack.md`](../10-architecture/tech-stack.md) section 7 fixes OpenTelemetry and OTLP, and
keeps the backend replaceable.

When that tracing shipped, [`observability.md`](../60-operations/observability.md) section 9
registered three questions, and the product owner has decided them.

- **Where telemetry goes** outside the local stack, and who operates what receives it.
- **What is sampled.** Keeping every trace costs storage in proportion to traffic. A decision taken
  from the sampled flag in a caller's own `traceparent` would let any caller switch tracing off for
  its requests, or force it on.
- **What a line with no Tenant carries.** Invariant I1 of
  [`domain-model.md`](../20-domain/domain-model.md) puts a tenant identifier on every log line. A
  request refused before its credential resolves, a refusal at the edge, a health check and a line
  about a global Person have no Tenant to name. Yet
  [`multi-tenancy.md`](../10-architecture/multi-tenancy.md) section 8 makes the tenant identifier
  part of the addressing key of any store outside the datastore.

Telemetry is not the audit trail ([`audit-model.md`](../40-governance/audit-model.md) A6). Nothing
here changes what is audited, or the rule that an audited act is never sampled.

## Decision drivers

- Telemetry carries tenant identifiers, and threat-model T5 names it as a path by which credential
  material can leak. Where it is stored is a residency and security question as well as an
  operational one.
- The backend stays replaceable, because everything already leaves over OTLP.
- Open source and self-hosted, as the identity provider
  ([ADR-0017](adr-0017-keycloak-for-identity.md)), the edge
  ([ADR-0018](adr-0018-apisix-at-the-edge.md)) and the datastore already are.
- Pre-customer, nothing is sampled away that a first incident might need, and no rate is invented
  before there is volume to size it against (observability.md section 1).
- Every line and span keeps a tenant field a store can partition on, in a standard format.

## Considered options

### Where telemetry goes

1. **A self-hosted Grafana stack**: Tempo for traces, Loki for logs and Prometheus for metrics,
   read through Grafana, behind the Collector.
2. **Deferred** until the deployment target is chosen.
3. **A managed OTLP vendor**, such as Grafana Cloud or Honeycomb.
4. **Jaeger**, for traces only.

### What is sampled

1. **Every trace now, and tail sampling in the Collector later**, with the edge deciding.
2. **A fixed head-sampling ratio** at the edge.
3. **Tail sampling from the start.**

### What a line with no Tenant carries

1. **The Nil UUID** as its tenant identifier.
2. **No tenant field**, as a second exception to I1.
3. **A separate platform-only stream** for such lines.

## Decision

**Option 1 in each.**

**Telemetry goes to a self-hosted Grafana stack.** Every component exports over OTLP to an
OpenTelemetry Collector, and only the Collector names the backend.
[Grafana Tempo](https://grafana.com/oss/tempo/) stores traces,
[Grafana Loki](https://grafana.com/oss/loki/) stores logs and [Prometheus](https://prometheus.io/)
stores metrics, and [Grafana](https://grafana.com/oss/grafana/) reads all three. Orchestra operates
them in its own infrastructure, beside the services whose telemetry they hold. The local stack runs
Tempo and Grafana, and adds Loki and Prometheus when something sends them logs or metrics.

**Every trace is kept until volume demands otherwise.**

- The edge takes the sampling decision for every request, and ignores the sampled flag a caller
  sends. Every service follows the edge.
- While Orchestra is pre-customer, every trace is recorded.
- When keeping every trace costs more than it is worth, the Collector samples by tail. It keeps every
  trace that holds an error and every slow trace, and a share of the rest.
- That share, and what counts as slow, are figures set then, against the volume they are sized for.
  `observability.md` section 9 registers them, and whether an Agent Run's trace may be sampled at
  all stays registered there.
- Audited acts are never sampled, as [`audit-model.md`](../40-governance/audit-model.md) section 3
  requires.

**Work with no Tenant carries the Nil UUID.** A log line or span for work that belongs to no Tenant
carries the Nil UUID of [RFC 9562](https://www.rfc-editor.org/rfc/rfc9562#section-5.9),
`00000000-0000-0000-0000-000000000000`, as its tenant identifier. That covers a request before its
credential resolves, a refusal at the edge, a health check, a line about a global Person
([ADR-0024](adr-0024-global-person-with-tenant-memberships.md)), and a service's own lines outside
any request. Work in a Tenant names that Tenant.

- The Nil UUID is a telemetry marker only. A persisted record and an emitted event always name a
  real Tenant, apart from I1's existing exception for the global Person.
- No Tenant ever has the Nil UUID as its identifier, and Tenant User Management refuses to create
  one that would.
- The edge never resolves a Tenant (ADR-0018), so every line it logs carries the Nil UUID.

**What this amends.**

- I1 in `domain-model.md` gains the Nil UUID rule.
- In `observability.md`, section 8 records the rules. Section 9's rows for where telemetry goes and
  for what a line with no Tenant carries are discharged, and its sampling row narrows to the figures
  and the Agent Run question.
- `multi-tenancy.md` section 8's telemetry row records the Nil UUID.
- `tech-stack.md` section 7 names the backend, and section 1.1 pins it.

## Rationale

**The backend.** Telemetry holds tenant identifiers and is a named path for leaked credential
material (T5). Keeping it inside Orchestra's own infrastructure keeps data residency one question
rather than two. Among the self-hosted options, the Grafana stack is the one that covers traces,
logs and metrics with one reader. All its stores are open source and accept OTLP, so replacing any
of them changes the Collector's configuration and nothing else.

A managed vendor is less to operate, but would send tenant-scoped data to a third party before any
customer has agreed to it. Deferring to the deployment target would leave the local stack and the
services with nothing to build against, though nothing in this choice depends on the cloud. Jaeger
covers traces alone.

**Sampling.** Before there are customers, there is too little volume for keeping every trace to
cost much, and too little history to know which traces matter. The trace sampled away is often the
one a first incident needs. A caller-controlled flag would let anyone switch tracing off for their
own requests, or force it on for all of them, so the edge decides. Tail sampling, when it comes,
keeps what head sampling would lose at random: the errors and the slow requests.

**The Nil UUID.** It keeps I1 literally true, and every store's addressing key present. A store
partitions every line on one field, and lines with no Tenant form one partition. RFC 9562 defines
the value, it cannot collide with a generated identifier, and every UUID library parses it.
Omitting the field would push a special case into every store and every query. A separate stream
would be a second store to register and operate, for lines that differ only in having no Tenant.

## Consequences

### Positive

- Tenant-scoped telemetry stays in Orchestra's infrastructure, readable in one place.
- No incident before there are customers is missing the trace that would explain it.
- A caller can neither switch tracing off nor force it on from a header.
- Every line and span has a tenant field, so no store needs a special case.

### Negative

- Once deployed, Orchestra operates four more stateful systems: Tempo, Loki, Prometheus and
  Grafana, with their storage.
- Keeping every trace costs storage in proportion to traffic, until tail sampling is configured.
- The Nil UUID is a reserved value. Code that reads a line's tenant identifier as a real Tenant has
  to recognise it.
- nginx's own error log at the edge has a fixed format, so its lines carry no fields. It records the
  edge's own faults, each with nginx's request identifier.

### Neutral / follow-on work

- Put the Nil UUID on every log line and span in the Gateway, Tenant User Management and the edge,
  and refuse it as a Tenant's identifier.
- Run Tempo and Grafana in the local stack, with the Collector exporting to Tempo.
- Configure tail sampling in the Collector when volume demands it, with the figures section 9
  registers.
- Decide who may read which telemetry in Grafana, with the operator-access question
  `audit-model.md` section 9 owns.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Keeping every trace grows storage faster than expected | Medium | Medium | Retention is an operational setting, and tail sampling in the Collector is named and changes no service |
| A self-hosted stack is under-operated and loses telemetry | Medium | Medium | Telemetry is best effort and never on a governed path, and only the Collector changes to move to another backend |
| The Nil UUID is taken for a real Tenant | Low | Medium | No Tenant can have it, and it appears only in telemetry, never on a persisted record or an emitted event |
| Credential material reaches telemetry | Low | High | Unchanged: threat-model C6 and T5 redaction, and telemetry never carries a Principal |

## Revisit criteria

Reopen this decision in any of these cases:

- Operating the stack costs more than a managed backend would, once data residency allows telemetry
  to leave Orchestra's infrastructure.
- A customer's residency requirement needs telemetry held per region in a way the stack cannot
  serve.
- A store that telemetry must reach cannot partition on the Nil UUID.

## References

- [`../30-protocol/http-conventions.md`](../30-protocol/http-conventions.md) HC12: trace context at
  every hop
- [`../60-operations/observability.md`](../60-operations/observability.md) sections 2, 8 and 9: what
  telemetry carries, and the register this discharges
- [`../20-domain/domain-model.md`](../20-domain/domain-model.md) I1 and
  [`../10-architecture/multi-tenancy.md`](../10-architecture/multi-tenancy.md) section 8: the tenant
  field as an addressing key
- [`../40-governance/audit-model.md`](../40-governance/audit-model.md) A6 and section 3: telemetry is
  not the trail, and audited acts are never sampled
- [RFC 9562](https://www.rfc-editor.org/rfc/rfc9562#section-5.9) section 5.9: the Nil UUID
- [OTLP](https://opentelemetry.io/docs/specs/otlp/): the OpenTelemetry protocol
- [W3C Trace Context](https://www.w3.org/TR/trace-context/): the sampled flag
