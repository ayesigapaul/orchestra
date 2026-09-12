---
title: "ADR-0019: The run supervisor is built on PostgreSQL; Temporal is the named fallback"
adr_id: ADR-0019
status: Accepted
date: 2026-09-12
deciders: [product-owner, platform-architecture]
consulted: []
informed: []
supersedes: []
superseded_by: []
tags: [runtime, architecture, operations]
depends_on: [ADR-0011, ADR-0013, ADR-0014]
---

# ADR-0019: The run supervisor is built on PostgreSQL; Temporal is the named fallback

## Status

Accepted.

## Context

[ADR-0014](adr-0014-run-supervisor-is-orchestras.md) established that the run supervisor is
Orchestra's to build — run lifecycle, work distribution, per-Tenant concurrency, scheduling, failure
handling and drain — and deliberately left two things open: what it is built on, and how large it is.
[`../10-architecture/tech-stack.md`](../10-architecture/tech-stack.md) section 4 recommended starting
on PostgreSQL and named Temporal as the alternative. A Temporal Cloud account now exists, which makes
the choice real rather than hypothetical.

Three facts constrain it. [ADR-0011](adr-0011-tenant-isolation-shared-schema-rls.md) already requires
a datastore that enforces row-level security, so a Postgres-class database is on the critical path
whatever else is chosen. [ADR-0013](adr-0013-fail-closed-policy-decision-writes.md) puts a durable
Policy Decision write ahead of every gated action, on that same path. And
[ADR-0017](adr-0017-keycloak-for-identity.md) and [ADR-0018](adr-0018-apisix-at-the-edge.md) have
just added two stateful services to operate; a third is not free.

## Decision drivers

- The enqueue should commit in the same transaction as the state change that causes it. That is what
  makes handoff exactly-once rather than best-effort, and it is available only when the queue lives
  in the same database as the state.
- Operating cost is already rising. Keycloak and APISIX are new; a Temporal cluster is a third
  stateful system, and Temporal Cloud is a vendor on the execution path of every Run.
- [ADR-0015](adr-0015-governed-action-positioning.md) notes that a platform mostly building — or
  mostly operating — someone else's distributed runtime has a positioning problem either way.
- Nothing has been measured. No concurrency, contention or history-volume figure exists for this
  platform, so the decision should be the one that is cheapest to reverse.

## Considered options

1. **PostgreSQL-native.** `SELECT ... FOR UPDATE SKIP LOCKED` for the queue, a lease with an expiry
   for liveness, a table of scheduled wake-ups. No new infrastructure.
2. **Temporal**, self-hosted or Cloud. Durable execution, in-flight patching, a visibility store
   built for querying across many runs — at the cost of several services or a vendor dependency.
3. **Hybrid** — Postgres for the queue, Temporal for scheduling. Rejected: two sources of truth for
   run state is the failure mode both options exist to avoid.

## Decision

**The run supervisor is built on PostgreSQL. Temporal is the named fallback, with the triggers below
recorded in advance.**

The supervisor owns what ADR-0014 gives it, implemented as:

| Concern | Mechanism |
| --- | --- |
| Queue and work distribution | `SELECT ... FOR UPDATE SKIP LOCKED`, so workers pull concurrently without a broker |
| Worker liveness | A lease column with an expiry; a lease not renewed is reclaimed, and the Run is re-dispatched |
| Enqueue | In the same transaction as the state change that causes it |
| Per-Tenant concurrency | Admission counted against the Tenant's limit before a lease is granted |
| Scheduling | A wake-up table polled on an interval, for `wait` Steps and resumed approvals |
| Job-level retry | Distinct from Step Execution retry, which stays where `execution-semantics.md` puts it |

**The supervisor's interface is narrow on purpose.** Nothing above the supervisor may depend on the
queue being a table: persist the run intent, enqueue runnable work, lease it, invoke the compiled
graph, observe the outcome, schedule the next work or finalise. That contract is what keeps the
fallback affordable, and it is a requirement of this decision rather than a style preference.

## Rationale

Option 2 is better at three things Orchestra cannot yet show it needs: patching executions in
flight, querying history across many runs, and throughput at a concurrency nobody has measured.
Buying it now would put a vendor on the execution path of every Run and add an operational surface
on top of two services adopted the same week, to solve problems that are currently hypothetical.

Option 1 is not merely cheaper to start. The transactional enqueue is a genuine correctness
advantage: with the queue in the same database as the state, the record of what happened and the
work that follows from it commit together or not at all. Temporal's own durability does not remove
the two-system write that Orchestra would otherwise be doing between its audit store and its
orchestrator.

What makes this reversible is the interface. The supervisor is a narrow contract over run intent and
work handoff, so replacing the substrate is a rewrite of one component rather than of the platform —
which is the same argument [ADR-0016](adr-0016-compile-to-the-langgraph-library.md) makes for the
compilation boundary.

## Consequences

### Positive

- One datastore for run state, the queue, the audit trail and the checkpointer, and one transaction
  where it matters.
- No vendor and no additional cluster on the execution path of every Run.
- The cheapest option to reverse, provided the interface stays narrow.

### Negative

- **Orchestra owns leasing, liveness, backpressure and recovery correctness** — precisely the class
  of distributed-systems work where subtle bugs are most expensive, which ADR-0014 already flagged.
- **Visibility is the known weak point.** Querying across many Runs — filtered, sorted, at volume —
  is what a dedicated visibility store exists for, and a history table in Postgres will need
  deliberate work before it answers those queries well.
- Lock contention and autovacuum pressure on hot queue and history tables are real at high
  concurrency, and will arrive without warning if nobody measures.
- In-flight patching is not available. A Run executes the definition version it pinned, which
  [VERSIONING.md](../VERSIONING.md) W2 and W3 already require, so this costs nothing today — but it
  removes an option Temporal would have given.

### Neutral / follow-on work

- **M2 still has to size it.** This record fixes the substrate, not the effort.
  [`../70-delivery/milestones.md`](../70-delivery/milestones.md) M2 remains: enumerate the
  supervisor's responsibilities precisely enough to estimate, now against a known substrate.
- Define the supervisor's interface explicitly, since the fallback's affordability depends on it.
- Decide the lease duration, the renewal interval and the wake-up poll interval. No interval,
  timeout or threshold is decided anywhere in this repository.
- Measure contention under concurrent Tenants before the first production load, so a trigger below
  is observed rather than inferred.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Leasing or recovery bugs lose or duplicate work | Medium | High | Failure-injection tests: kill a worker mid-Run, assert the lease is reclaimed and no side effect repeats |
| Queue contention at concurrency nobody measured | Medium | Medium | Measure before it matters; the fallback triggers below exist for this |
| The supervisor leaks its implementation upward, making the fallback unaffordable | Medium | High | The narrow interface is part of this decision, not an aspiration |
| History table growth degrades the audit and visibility surfaces together | Medium | Medium | Retention is undecided repository-wide; `audit-model.md` section 11 owns it |

## Revisit criteria

Switch to Temporal if any of these is observed rather than argued:

- Queue contention or autovacuum pressure bounds throughput at a concurrency the product needs.
- Visibility queries across Runs cannot be served acceptably from the history tables.
- A requirement to patch executions in flight appears — which would mean W2 and W3 are being
  reconsidered, and that is an ADR of its own.
- Scheduling needs outgrow a wake-up table, which ADR-0008's revisit criteria already name as the
  signal for a dedicated process engine: long timers and complex event correlation.

## References

- [ADR-0014](adr-0014-run-supervisor-is-orchestras.md) — the supervisor is Orchestra's; this record
  answers the substrate half of its first follow-on
- [ADR-0011](adr-0011-tenant-isolation-shared-schema-rls.md) — the datastore this builds on
- [ADR-0013](adr-0013-fail-closed-policy-decision-writes.md) — the durable write already on this path
- [`../10-architecture/tech-stack.md`](../10-architecture/tech-stack.md) section 4
