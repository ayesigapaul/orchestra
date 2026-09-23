---
title: "ADR-0041: A nested Agent or Workflow version executes inside its parent Run, pinned when the parent version is published"
adr_id: ADR-0041
status: Accepted
date: 2026-09-13
deciders: [product-owner, platform-architecture]
consulted: []
informed: []
supersedes: []
superseded_by: []
tags: [workflows, runtime, governance, metering, domain]
depends_on: [ADR-0009, ADR-0012, ADR-0014, ADR-0019]
---

# ADR-0041: A nested Agent or Workflow version executes inside its parent Run, pinned when the parent version is published

## Status

Accepted.

## Context

A Workflow reaches another definition through two Step types. An `agent` Step delegates to an Agent
version, and a `subworkflow` Step executes another Workflow version
([`step-types.md`](../50-workflows/step-types.md) sections 5 and 12). The domain model draws no edge
from a Step to either, and holds that a Run targets exactly one definition
([`domain-model.md`](../20-domain/domain-model.md) section 4).

`step-types.md` section 13 registers three rows that it calls one question in two guises: whether
the nested execution is a separate Run, whether the Step pins the version it names or resolves the
Active one at run time, and whether a Step may name an Agent version at all.
[`workflow-dsl.md`](../50-workflows/workflow-dsl.md) section 11 and
[`execution-semantics.md`](../50-workflows/execution-semantics.md) section 11 carry the same
questions. The worked example in `workflow-dsl.md` section 3 shows `procurement-analyst@2` pinned,
and says the pin is undecided.

Four facts bear on the choice.

- **Published versions are frozen.** W1 makes a published version immutable, and W2 pins a Run to
  its version at admission. [`VERSIONING.md`](../VERSIONING.md) section 8 calls customer-authored
  workflows the most dangerous versioning problem in the platform. A nested version resolved after
  publication would let a published version change behaviour without a new version.
- **Runs are the primary metered dimension.** [ADR-0009](adr-0009-meter-first-defer-tiering.md)
  meters Runs by outcome. If a nested execution is a Run, an author changes the customer's bill by
  dividing one process between two definitions, and metering cannot be applied retroactively.
- **Governance is pinned at admission.** A Run holds the Policy versions in force at its admission
  for its whole life ([ADR-0012](adr-0012-policy-decisions-are-audit-records.md),
  [`policy-model.md`](../40-governance/policy-model.md) P6), and the compiler emits an enforcement
  point at every Step boundary (E1, E2). A nested Run would cross a second admission and pin Policy
  versions of its own.
- **The run supervisor needs a unit of work.** [ADR-0014](adr-0014-run-supervisor-is-orchestras.md)
  makes run lifecycle, work distribution, scheduling and cancellation Orchestra's, and
  [ADR-0019](adr-0019-postgres-run-supervisor.md) builds them on PostgreSQL. What the supervisor
  leases, and what a cancellation reaches, depend on whether nesting creates Runs.

No compiler, run supervisor or definition exists yet, so the choice is cheapest now. The product
owner has decided it.

## Decision drivers

- A published version never changes behaviour without a new version (W1), and a Run never reaches
  logic published after its admission (invariant I3, W2).
- How an author divides a process between definitions never changes how many Runs are metered, and
  never hides a definition from the meter.
- Nesting never removes, skips or defers an enforcement point, and never moves a Step out of the
  reach of a Policy (E2, E3).
- One unit of work for the run supervisor, and one thing to cancel.
- A Run still targets exactly one definition.
- A choice that stays cheap to reverse before the first customer (working rule 8).

## Considered options

1. **A separate child Run**, resolving the child's Active version at its own admission.
2. **Inside the parent Run**, resolving the child's Active version at the parent's admission.
3. **Inside the parent Run**, pinned when the parent version is published.
4. **A separate child Run**, pinned when the parent version is published.

## Decision

**Option 3.** An `agent` or `subworkflow` Step executes the version it names inside the Run that
reached the Step, and that version is pinned when the Workflow version declaring the Step is
published.

### One Run, one definition

A Run still targets exactly one Agent version or Workflow version. The versions its Steps name are
pinned references inside that version, not further targets.

- A nested execution creates no Run. Its Step Executions belong to the Run that reached the Step,
  and no Run has a parent Run.
- An `agent` Step names exactly one Agent version, and a `subworkflow` Step exactly one Workflow
  version. The domain model gains that edge.
- A Step identifier is unique only within the version that declares it
  ([`workflow-dsl.md`](../50-workflows/workflow-dsl.md) L6). A contract that names a Step inside a
  Run therefore identifies a nested Step by the path of Step identifiers that reaches it.

### Pinned at publication

The reference names an exact version, as `procurement-analyst@2` does in the worked example.

- Publication freezes the reference with the rest of the version (W1). Nothing resolves it again,
  at admission or at the Step, so every Run of a version executes exactly the versions it names.
- The compiler rejects a reference that names no exact version, and a reference to a version that
  is not published in the Tenant or is `Archived`.
- A reference can only name a version published before the one that makes it, so no chain of
  references returns to where it started. A reference cycle across definitions cannot be formed,
  and every chain of nesting is finite. No bound on its depth is decided.

### Enforcement

Nesting adds no enforcement point and removes none.

- The `agent` or `subworkflow` Step's own boundary is evaluated, with the version it names as part
  of the proposed action.
- Every Step inside a nested Workflow version crosses its own Step-boundary enforcement point, and
  every Tool call inside a nested Agent version crosses the Tool enforcement point (E1).
- A nested execution crosses no Run admission enforcement point, because it is not a Run. Every
  evaluation inside it runs under the Policy versions the Run pinned at admission (P6), and it pins
  none of its own.
- Every evaluation inside a nested execution receives, beside the version the Run pinned, each
  version on the path to the one executing. A Policy that matches a definition therefore reaches it
  wherever it is nested.
- A refusal, a failure or a rejected gate inside a nested execution does to the Run what it would do
  anywhere else in the Run. This record adds no rule of its own for nesting, and changes nothing
  about capability grants.

### Archival and upgrades

- A version cannot be archived while a version that names it has not been. `Retired → Archived`
  stays an observed condition, reached once the last Run pinned to the version has reached a
  terminal state and every version naming it is archived.
- Retiring a version stops new Runs that would target it (W4). It does not stop that version
  executing inside the Runs of a version that names it, which W1 keeps unchanged.
- A named definition moves on when a newer version of it is set current, or when the named version
  is retired. Every version naming the older one that still admits Runs then surfaces an actionable
  warning in the Control Plane, and is never altered. Adopting the newer version means publishing a
  new version, as W5 has it for a Tool's MAJOR bump.
- A force-drain cancels the Runs pinned to the version it drains, and nothing else
  ([`execution-semantics.md`](../50-workflows/execution-semantics.md) X6). A version that another
  version still names is archived only after that version is.

### The run supervisor

For ADR-0014 and ADR-0019, the unit of work is the Run, with every execution nested in it.

- The supervisor leases, schedules, wakes and finalises the Run. It persists no Run for a nested
  execution, and no relationship between Runs.
- A `wait` Step or an Approval Request inside a nested execution suspends the Run, and the Run
  resumes when the wait elapses or the request resolves.
- Per-Tenant concurrency limits count Runs, and a nested execution is not one.
- Cancelling the Run cancels its nested executions. X24 to X28 apply to each nested Step Execution
  exactly as to any other, and no nested execution can be cancelled apart from its Run. Who may
  cancel is unchanged ([`gateway-api.md`](../30-protocol/gateway-api.md) G15).

### Metering

- A Run counts once in the *Runs* dimension, by its outcome, however many versions it nests. A
  nested execution is not a second Run to count, so how an author divides a process between
  definitions never changes the *Runs* count.
- A nested Step's execution is a Step Execution of the Run, and a Tool invocation inside a nested
  execution is counted as any other.
- *Active Agents / Workflows*, which ADR-0009 defines as definitions with at least one run in the
  period, counts every definition that ran, whether a Run targeted it or it executed nested inside
  another definition's Run ([`domain-model.md`](../20-domain/domain-model.md) section 9).
  Restructuring cannot hide a definition from the meter. Dividing a process into more definitions
  raises this count, as it raises *Step Executions*, while the *Runs* count stays unchanged.
- That count stays a derivation over Run records. The version a Run pinned fixes every version it
  can execute, and the Run's Step Executions show which of them did.

### Audit

The trail carries the nesting. A Step Execution inside a nested Workflow version is recorded with
the Step Execution it executes under and the version that declares its Step. A Tool invocation
inside a nested Agent version is recorded with the Step Execution of the `agent` Step, as
[`audit-model.md`](../40-governance/audit-model.md) section 3 already requires. One Run's trail
therefore reconstructs the whole process.

### What stays undecided

- A bound on nesting depth.
- Whether a newly published version may name a version that is already `Retired`.
- The member that carries a reference in a Workflow definition. The object shape in the worked
  example stays notation.
- What the Side-Effect Class declared on an `agent` or `subworkflow` Step means, which
  `step-types.md` section 13 still registers.

### What this amends

- `domain-model.md` section 4 draws the edge from a Step to the version it names, and sections 8 and
  9 say what pins it and that a nested definition counts as active. `quotas-and-metering.md`
  section 8 records that grain.
- `step-types.md` sections 2, 4, 5 and 12 state the semantics, and three rows leave its section 13.
  `workflow-dsl.md` sections 3, 5 and 10 state the pin and the compiler's check, and its section 11
  loses the pinning row and registers what stays undecided. `execution-semantics.md` X2, X6, X30
  and section 7 state pinning, draining and cancellation, and its section 11 loses its row. The pin
  in `examples/purchase-approval.md` is no longer open.
- `VERSIONING.md` section 8 gains rule W6, and `lifecycle-state-machines.md` sections 2.3 and 4,
  `gateway-api.md` G16, `audit-model.md` section 3 and `control-plane.md` section 5 follow it.
- `policy-model.md` N1 gains the nested versions as inputs, and `event-protocol.md` section 3.2
  says why nesting has no subagent attribution.
- `run.v1` and `approval-request.v1` gain an optional `step_path`, and the glossary's Run and
  Workflow entries state the rule.

## Rationale

**Option 1 breaks W1 and the bill.** A child Run resolving its Active version at its own admission
can start days after its parent, on a version published after the parent was admitted. A published
parent then changes behaviour with no version of its own, and a Run reaches logic published after
its admission, which I3 exists to prevent. Dividing one process between two definitions doubles its
Runs, and the child's own admission pins a second set of Policy versions for the same process.

**Option 2 keeps one Run and still loses W1.** Resolving at the parent's admission is consistent
within one Run, but two Runs of the same published parent can execute different children. The
compiler would check the reference against a version that may never be the one that executes.

**Option 4 pins, but keeps two Runs.** W1 holds. Every nested execution still crosses a second
admission and pins Policy versions at a later moment than its parent, so one process can be
governed by two sets of Policy versions. The *Runs* dimension still depends on how definitions are
divided, and the run supervisor has to relate Runs to each other and cascade cancellation across
them.

**Option 3 meets every driver.** W1 and I3 hold completely. A published version fixes every version
it names, so one pinned version reconstructs the exact process an audit asks about. One process is
one Run, admitted once under one set of Policy versions, while every Step and Tool call inside it is
still evaluated. The run supervisor has one unit of work, and cancellation has one target. The cost
is the one `workflow-dsl.md` section 11 named: a named version stays undrainable while a version
naming it lives, and a newer child reaches a parent only through a new version of the parent. Both
are the price of W1, and W5 already charges it for Tool schemas.

## Consequences

### Positive

- A published version's behaviour is fixed completely, the versions it names included.
- The *Runs* dimension counts processes rather than definitions, however an author divides them.
- No definition escapes *Active Agents / Workflows* by being nested inside another.
- One admission and one Policy pin per process, with every Step and Tool call still evaluated.
- The run supervisor leases, suspends, wakes and cancels one Run, and keeps no relationship between
  Runs.
- A reference cycle across definitions cannot be formed, so the compiler needs no check for one.

### Negative

- **A fix to a named version reaches no published version by itself.** A defective version keeps
  executing inside every version that names it until each is republished. The immediate stops are a
  Policy that refuses it in new Runs, and retiring or force-draining the versions that name it.
- A version cannot be archived while any version naming it is unarchived, so a widely named version
  can stay undrainable for as long as the versions naming it do.
- A Retired version keeps executing inside the Runs of a version that names it, which W4 read alone
  does not suggest.
- Dividing a process into more definitions raises two counts: *Active Agents / Workflows*, because
  each definition that runs is counted, and *Step Executions*, because an `agent` or `subworkflow`
  Step is a Step with its own Step Execution. Only the *Runs* count is unchanged, so a price keyed
  on either of the other two would charge for how a process is structured.
- Nesting can make one Run large in Step Executions and Policy Decisions, and nothing bounds its
  depth yet.
- A Step identifier no longer locates a Step inside a Run on its own, so every contract that names
  a Step carries its path.

### Neutral / follow-on work

- Add the warning for a named definition that has moved on to the Control Plane, beside W5's, and
  show which versions hold a version back from archival.
- Specify with the compiler how the compiled artifact carries a nested version, traceable to that
  version and its Step identifiers ([`workflow-dsl.md`](../50-workflows/workflow-dsl.md) C6).
- Identify a nested Step by its path wherever a contract names a Step, including the event profile's
  Step transitions once their payload is specified.
- Decide a bound on nesting depth, and whether a new version may name a Retired one, in
  `workflow-dsl.md`.
- Build the run supervisor's suspension, concurrency and cancellation with the Run as the unit.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| A defective named version keeps executing inside published versions after it is fixed | Medium | High | The Control Plane warns on every version naming it; a Policy matching it refuses it in new Runs wherever it is nested; retiring a parent stops its new Runs, and a force-drain cancels those in flight |
| A widely named version is never archived | High | Low | Archival changes nothing about what is retained for audit, and the Control Plane shows which versions hold it |
| Deep or wide nesting makes a Run too large to supervise as one unit | Medium | Medium | Every chain of nesting is finite by construction, and a depth bound can be added to the compiler without altering any published version |
| A Policy scoped to a definition misses a Step nested inside another | Low | High | Every evaluation inside a nested execution receives each version on the path to it (N1) |
| A nested Step is mistaken for a Step of the Run's own definition with the same identifier | Medium | Medium | Contracts identify a nested Step by its path, and `run.v1` and `approval-request.v1` carry it |
| Dividing a process into more definitions raises the *Active Agents / Workflows* and *Step Executions* counts, so how a process is structured shows on the meter | High | Low | The *Runs* count, the primary dimension, stays one per Run; both other counts derive from records of what ran, and ADR-0009 prices contracts by hand, so no price yet keys on either |

## Revisit criteria

Reopen this decision in any of these cases:

- Customers need a fix to a named definition to reach published versions without republishing
  them, and publishing new versions proves too costly in practice.
- A nested execution needs a lifecycle of its own, to be admitted, observed or cancelled apart from
  the Run that reached it.
- Nesting makes Runs too large for the run supervisor to treat as one unit of work.
- The *Runs* dimension is redefined when ADR-0009 is revisited.

## References

- [`../50-workflows/step-types.md`](../50-workflows/step-types.md) sections 5, 12 and 13: the `agent`
  and `subworkflow` Steps, and the register this discharges
- [`../50-workflows/workflow-dsl.md`](../50-workflows/workflow-dsl.md) sections 3, 5 and 11: the
  worked example, the compiler's checks and the pinning row
- [`../VERSIONING.md`](../VERSIONING.md) section 8: rules W1 to W5
- [`../20-domain/domain-model.md`](../20-domain/domain-model.md) I3 and sections 4 and 9: the pin, a
  Run's one target, and the metering grain
- [`../60-operations/quotas-and-metering.md`](../60-operations/quotas-and-metering.md) section 8:
  the grain each metered dimension keys on
- [`../40-governance/policy-model.md`](../40-governance/policy-model.md) E1 to E3, P6 and N1:
  enforcement points, Policy pinning and evaluation inputs
- [`../50-workflows/execution-semantics.md`](../50-workflows/execution-semantics.md) X6 and X24 to
  X28: force-drain and cancellation
- [`../50-workflows/examples/purchase-approval.md`](../50-workflows/examples/purchase-approval.md):
  the worked example as a Run
- [ADR-0009](adr-0009-meter-first-defer-tiering.md),
  [ADR-0012](adr-0012-policy-decisions-are-audit-records.md),
  [ADR-0014](adr-0014-run-supervisor-is-orchestras.md) and
  [ADR-0019](adr-0019-postgres-run-supervisor.md): metering, Policy pinning and the run supervisor
