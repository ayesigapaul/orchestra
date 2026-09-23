---
title: "ADR-0034: A Policy Decision is written in the enforcing service's own transaction, and reaches the audit store through that service's outbox"
adr_id: ADR-0034
status: Accepted
date: 2026-09-13
deciders: [product-owner, platform-architecture]
consulted: []
informed: []
supersedes: []
superseded_by: []
tags: [governance, audit, reliability, services, data]
depends_on: [ADR-0011, ADR-0012, ADR-0013, ADR-0014, ADR-0019, ADR-0020, ADR-0021, ADR-0026, ADR-0029]
---

# ADR-0034: A Policy Decision is written in the enforcing service's own transaction, and reaches the audit store through that service's outbox

## Status

Accepted.

## Context

[ADR-0013](adr-0013-fail-closed-policy-decision-writes.md) requires a Policy Decision to be durable
before the gated action is attempted, and defines durable as surviving a crash, not as reaching the
audit store. It leaves the mechanism open.
[`data-plane.md`](../10-architecture/data-plane.md) section 11 registers the mechanism as needing an
ADR and names three candidates: a shared transaction, a durable outbox and a node-local append.
[`observability.md`](../60-operations/observability.md) section 9 and
[`reliability.md`](../60-operations/reliability.md) section 13 repeat the row. Whether replication
lag exists, how a process is drained, and what the bracket of a degraded period rides on all wait on
it.

Five facts bear on the choice.

- **The datastore is PostgreSQL** ([ADR-0021](adr-0021-postgresql-is-the-datastore.md)), and each
  service owns its tables in a schema of its own
  ([ADR-0020](adr-0020-monorepo-with-enforced-service-boundaries.md) rule B4).
  [ADR-0019](adr-0019-postgres-run-supervisor.md) already commits run state and the work that
  follows it in one transaction.
- **No transaction crosses a service's edge.** ADR-0020 meets a guarantee that spans services with a
  synchronous call that returns after the owner's durable write, or with an outbox.
- **The outbox has a transport.**
  [ADR-0026](adr-0026-services-call-over-http-and-publish-through-an-outbox.md) gives each service a
  transactional outbox, and [ADR-0029](adr-0029-kafka-carries-facts-captured-by-debezium.md) has
  Debezium capture it from the write-ahead log into Kafka, keyed by Tenant. ADR-0029 names a
  conflict between that capture and the decision write as a reason to reopen it.
- **A decision cannot be regenerated.** Evaluating again later produces a new decision, not the one
  that gated the action ([`policy-model.md`](../40-governance/policy-model.md) D5), so lost audit
  is not a delayed version of stale audit.
- **Every tenant-scoped table is under forced row-level security**, and CI fails one that is not
  ([ADR-0011](adr-0011-tenant-isolation-shared-schema-rls.md)).

## Decision drivers

- Durable before the gated action, in the sense ADR-0013 gives the word.
- No network round trip on the enforcement path beyond the commit the gated state change needs
  anyway.
- No durable state held by a process, so any process can be drained, restarted or replaced.
- No decision lost: a trail that is behind can be read honestly, and a trail with a hole cannot.
- Isolation by the engine for a decision at rest, as for every tenant-scoped record.
- No transaction across services, and no service reading another's tables (ADR-0020).
- One transport for what leaves a service (ADR-0029).

## Considered options

1. **The enforcing service's own transaction**, together with the state change the decision gates,
   then delivery to the audit store through that service's transactional outbox.
2. **A synchronous write to a service that owns the audit store**, returning before the action.
3. **A node-local append** made durable on the node, replicated to the audit store later.

A single audit schema that every enforcing service writes into, in the transaction of its own state
change, is excluded by ADR-0020 rule B4 and is not an option.

## Decision

We chose option 1.

**The enforcing service writes the decision with what it gates.** The enforcing service is the
service whose transaction commits the state change a Policy Decision gates, and it writes the
decision in that transaction:

- at Run admission, with the Run's creation or its refusal;
- at a Step boundary, with the start of the Step Execution or its refusal;
- before a Tool invocation, with the record of the attempt it permits, committed before the
  invocation leaves the platform;
- on `require_approval`, with the Run's suspension and the Approval Request's raise.

The commit makes the decision durable. If the transaction does not commit, the gated action does not
proceed, and neither the decision nor the change it gates exists.

**It leaves through the outbox of the same transaction.** The same transaction writes the decision
to that service's outbox. Debezium captures it and Kafka carries it to the audit store as a
CloudEvent keyed by its Tenant (ADR-0029). The audit store stays the system of record every audit
read uses ([`event-protocol.md`](../30-protocol/event-protocol.md) X2).

**It is protected while it waits.** The table that holds it, the outbox included, stays under forced
row-level security like every tenant-scoped table, and the CI control of
[`multi-tenancy.md`](../10-architecture/multi-tenancy.md) section 5 checks it. The role that writes
it holds no update or delete privilege on it ([`audit-model.md`](../40-governance/audit-model.md)
A2).

**Nothing is removed before the audit store has it.** ADR-0029 lets a service delete an outbox row
in the transaction that inserts it, and a Policy Decision is never deleted that way. It stays in the
enforcing service's schema until the audit store has recorded it. A stalled connector, a replication
slot invalidated past its bound or a topic past its retention then delays the trail and loses
nothing, because what capture missed can be delivered again from the rows that remain. How the
enforcing service learns that the audit store has a decision, what removes the decision afterwards,
and how a gap is delivered again are not decided here.

**The audit view lags, and says so.** A decision is durable when its transaction commits, and
readable once the audit store records it. The completeness horizon
[`observability.md`](../60-operations/observability.md) section 4 defines is therefore built: every
audit answer carries the point up to which it is known complete, and absence behind that point is
not read as non-occurrence ([`reliability.md`](../60-operations/reliability.md) F15). No lag budget
is set; its figure stays registered in `observability.md` section 9.

**The Run Supervisor admits Runs.** The Gateway stays the public boundary and nothing more of
admission: it authenticates the calling Principal and forwards the submission over HTTP under the
same contract (ADR-0026), keeps no durable state of its own, and evaluates no Policy. The Run
Supervisor is the enforcing service at admission. It evaluates admission in process
([ADR-0035](adr-0035-cel-profile-for-policies-and-workflow-expressions.md)) and commits the Run, or
its refusal, with the admission Policy Decision in one transaction of its own schema
([ADR-0014](adr-0014-run-supervisor-is-orchestras.md),
[ADR-0019](adr-0019-postgres-run-supervisor.md)), and that decision leaves through its own outbox.
No schema is invented for admission: the supervisor already holds Run intent, and the Run's creation
or refusal is the state change the decision gates.
[ADR-0018](adr-0018-apisix-at-the-edge.md) put Run admission and the submission's idempotency
key with the Gateway rather than with the edge, and that division stands — neither is APISIX's.
What this record fixes is where inside the platform they land. A replayed submission is recognised
there rather than at the edge, the supervisor holding the `Idempotency-Key` with the Run and
returning the stored response, so no second Run is created and admission is not evaluated again
([`gateway-api.md`](../30-protocol/gateway-api.md) G11).

**A new Audit service owns the audit store.** It is a Control Plane container. It consumes Policy
Decisions and the other Audit Records from Kafka (ADR-0029), keeps the append-only store under its
own roles ([`audit-model.md`](../40-governance/audit-model.md) A2), and answers the audit reads the
Control Plane API serves, no other service reading its tables (ADR-0020 rule B4). The completeness
horizon, the retention rule and erasure are its. How it tells an enforcing service that a decision
has been recorded, so that the copy waiting in that service's schema can be removed, is not designed
here and stays registered in `containers.md` section 12 and
[`reliability.md`](../60-operations/reliability.md) section 13.

This is how ADR-0013's requirement is met: the enforcing service's commit is the durable write, and
the audit store is reached after it.

### What this amends

- `data-plane.md`: section 2's Gateway and its new Run Supervisor row, the durable decision write,
  sections 3, 4 and 6, and section 11, whose mechanism row is discharged.
- `containers.md`: sections 1, 2, 3, 5, 8 and 11 stop describing the mechanism as open; sections 2
  and 3 gain the Audit container and put admission in the Run Supervisor; and section 12 registers
  only how an enforcing service learns that a decision it keeps has been recorded.
- `reliability.md`: F11, F13 and section 10 follow the mechanism, drain becomes ordinary for every
  process, and section 13's mechanism row is discharged.
- `observability.md`: section 3's bracket and section 4's lagging branch follow the mechanism, and
  section 9's mechanism row is discharged.
- `gateway-api.md`: G11 names the Run Supervisor as the service that honours it, and G13 names the
  commit that makes an admission decision durable.
- `audit-model.md` A6, the record-class comment in `audit-record.v1`, `control-plane.md` sections 3
  and 8, `multi-tenancy.md` section 8, `deployment-topologies.md` sections 7 and 10,
  `testing-strategy.md` section 3 and `tech-stack.md` section 1 record the mechanism.

## Rationale

**Option 1 uses the transaction the gated action already needs.** A gated action is itself a state
change — a Run created, a Step Execution started, an attempt recorded — and that change commits
somewhere. Writing the decision in the same commit adds no hop and no store, and makes the decision
and what it permits indivisible, as ADR-0019 does for run state and the work that follows it.
ADR-0020 allows two ways across a service's edge; this takes a transaction inside the edge and the
outbox across it, and ADR-0029 has already built the outbox's path. ADR-0029's revisit criterion,
a conflict with this mechanism, is therefore not met: the mechanism is its capture path.

**Option 2 stacks a second availability ceiling.** Every enforcement point would wait on a call to
another service before acting, at enforcement-point volume, which `data-plane.md` section 5 shows
stacks a second ceiling on the one ADR-0013 accepts. It removes lag by spending availability, where
the horizon makes lag honest instead.

**Option 3 turns stale audit into lost audit.** A node-local append makes every process that can
gate an action the owner of durable storage, so draining, replacing and scaling each must account
for it (`reliability.md` F22 and F23). A node lost before replication loses decisions that cannot be
regenerated.

## Consequences

### Positive

- No network round trip on the enforcement path beyond the commit the gated action already makes.
- A decision and what it permits commit together or not at all.
- No process holds durable state, so drain, restart and replacement are ordinary.
- A decision waits under forced row-level security in its owner's schema, and a capture failure
  delays the trail without losing it.
- Decisions and facts leave on one transport, under one security model (ADR-0029).

### Negative

- **The audit view is behind the truth.** An approver, auditor or support engineer reading a Run in
  flight reads a trailing view, and the completeness horizon has to exist before that is safe.
- **The enforcing service's datastore bounds every governed action it gates.** That is ADR-0013's
  accepted cost, stated for this mechanism. An outage of the audit store behind the outbox halts
  nothing and holds the horizon back, while an outage of the datastore an enforcing service commits
  to halts every action it gates.
- Every enforcing service keeps decisions until the audit store has them, which costs storage and
  needs a receipt and a removal mechanism nobody has designed.
- The capture path — replication slot lag, write-ahead log retention and topic retention — now sits
  on the way to a complete audit trail, not only on the way to a fact's consumer.
- Until delivery, decisions sit in several services' schemas that no audit read may join
  (ADR-0020 rule B4), so an audit read waits for the Audit service to hold them.

### Neutral / follow-on work

- Build the completeness horizon of `observability.md` section 4 with the first audit read of a Run
  in flight.
- Design how the Audit service tells an enforcing service that it has recorded a decision, what
  then removes the copy that service kept, and how a capture gap is delivered again, with
  `reliability.md`.
- Specify the Audit service: what it consumes, the reads it answers for the Control Plane API, and
  the roles its store is held under (`containers.md`, `control-plane.md`, `audit-model.md` A2).
- Specify the decision's event type in `docs/30-protocol/schemas/` with the first enforcing service,
  as ADR-0029 requires of every event.
- Verify with the first outbox that capture works on a table under forced row-level security:
  PostgreSQL documents that row security policies can execute for a replication role that does not
  bypass them.
- Change the failure-injection tests of `testing-strategy.md` section 3: make the enforcing
  service's datastore fail and assert that the action did not proceed; stop capture and assert that
  the action proceeds and the horizon stops advancing.
- The lag budget stays a figure to set, registered in `observability.md` section 9.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| A connector past its slot bound loses write-ahead log before capture | Medium | High | Decisions stay in the owner's schema until the audit store records them, and the gap is delivered again from there |
| A reader takes absence behind the horizon as non-occurrence | Medium | High | Every audit answer carries its horizon (`observability.md` section 4, `reliability.md` F15) |
| Retained decisions grow without bound while delivery stalls | Medium | Medium | Lag is watched, and receipt and removal are designed before the first production load |
| The commit at every enforcement point slows governed Steps | Medium | Medium | The cost ADR-0013 accepts, measured with the first enforcing service |
| Forced row-level security on the outbox table obstructs capture | Medium | Medium | Verified with the first outbox, before the connector's role and connection options are fixed |
| The hop from the Gateway to the Run Supervisor delays every submission | Medium | Low | It replaces a call the Gateway made to start the Run in any case, admission is once per Run rather than once per Step, and the hop is measured with the first submission |
| A commit that fails is taken for a recorded decision | Low | High | Nothing committed means no decision exists; the next attempt evaluates again and writes its own (`reliability.md` F2) |

## Revisit criteria

Reopen this decision in any of these cases:

- The commit at the enforcement points is measured to dominate governed Step latency in a way a
  synchronous or local mechanism would not.
- The capture path loses a decision despite its retention in the owner's schema.
- A design partner cannot accept an audit view that trails execution by the lag observed.
- ADR-0029 is reopened in favour of an HTTP relay. The outbox table and this rule hold under either
  transport, so only delivery changes.

## References

- [ADR-0013](adr-0013-fail-closed-policy-decision-writes.md): durable before the gated action, and
  durable does not mean remote
- [ADR-0014](adr-0014-run-supervisor-is-orchestras.md) and
  [ADR-0019](adr-0019-postgres-run-supervisor.md): the Run Supervisor, which admits Runs, and the
  schema its transaction commits in
- [ADR-0020](adr-0020-monorepo-with-enforced-service-boundaries.md) rule B4 and
  [ADR-0021](adr-0021-postgresql-is-the-datastore.md): one transaction inside a service, none
  across services
- [ADR-0026](adr-0026-services-call-over-http-and-publish-through-an-outbox.md) and
  [ADR-0029](adr-0029-kafka-carries-facts-captured-by-debezium.md): the outbox and its transport
- [`../10-architecture/data-plane.md`](../10-architecture/data-plane.md) sections 5, 6 and 11: the
  three candidates and their costs
- [`../60-operations/observability.md`](../60-operations/observability.md) section 4 and
  [`../60-operations/reliability.md`](../60-operations/reliability.md) sections 8 and 10: the
  horizon, the bracket and drain
- [`../40-governance/audit-model.md`](../40-governance/audit-model.md) A2 and A6, and
  [`../40-governance/policy-model.md`](../40-governance/policy-model.md) D3 and D5
- [PostgreSQL logical replication security](https://www.postgresql.org/docs/current/logical-replication-security.html):
  row security and the replication role
