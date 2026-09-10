---
title: Operations
doc_id: DOC-070
version: 0.11.0
status: Draft
last_updated: 2026-09-10
owners: [platform-architecture]
---

# Operations

Running the platform: what is observable, how it fails, and what is counted.

This section is not normative — only [`../30-protocol/`](../30-protocol/) and
[`../40-governance/`](../40-governance/) bind. Where a rule binds, these documents link to it.

## Documents

| Document | Specifies |
| --- | --- |
| [`observability.md`](observability.md) | Traces, metrics, the run explorer, and how the degraded-period and quota signals are surfaced |
| [`reliability.md`](reliability.md) | The failure taxonomy, retry safety, and what a degraded period is |
| [`quotas-and-metering.md`](quotas-and-metering.md) | Quota Envelopes and admission control, and the metered dimensions |

## The distinction the section rests on

**Audit is a product surface, not a log level.** An Audit Record resolves to exactly one Principal
and carries a Policy basis. Telemetry describes the system: no Principal, no Policy basis, sampled,
discardable. They are not two views of one stream, and
[`../40-governance/audit-model.md`](../40-governance/audit-model.md) A6 forbids reconstructing a
record by parsing logs, traces or metrics, or presenting those as the audit trail.

A trace is therefore never the sole record of a governed act. Every Tool invocation produces a
Policy Decision and an Audit Record, ordered by A7. What lives only in the trace is the ungoverned
material between them — intermediate reasoning, timing, and the calls considered but not made.

## Two things this section will not tell you

**No numbers.** No service-level objective, error budget, latency target, alert threshold, retention
period, health-check interval, sampling rate, price, tier boundary or seat cost appears anywhere in
it, because none is decided. Where a figure is load-bearing the documents say what bounds it and
register the question. An operations section is where an invented number reads most like an
authoritative one, which is why the absence is deliberate rather than an omission.

**A quota wait is not an error.** Under BYOK the customer's own provider limit is a steady-state
capacity ceiling ([ADR-0006](../adr/adr-0006-model-layer-as-credential-broker.md)), so waiting is
normal operation with an observable queue, and the delay is surfaced to the user rather than hidden.

> **Status.** [`runbooks/`](runbooks/) is deliberately empty. Procedures for operating a system that
> does not exist would be fiction, and they are written when there is something to operate.
> [ADR-0007](../adr/adr-0007-outbound-connector-for-enterprise-reachability.md) is **Proposed**, so
> every Connector failure mode described here rests on a decision that is not binding.
