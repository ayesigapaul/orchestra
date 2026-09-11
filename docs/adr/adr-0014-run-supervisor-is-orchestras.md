---
title: "ADR-0014: The run supervisor is Orchestra's; the runtime is an execution substrate"
adr_id: ADR-0014
status: Accepted
date: 2026-09-11
deciders: [product-owner, platform-architecture]
consulted: []
informed: []
supersedes: [ADR-0008]
superseded_by: []
tags: [workflows, runtime, scope, architecture, licensing]
depends_on: [ADR-0001, ADR-0005]
---

# ADR-0014: The run supervisor is Orchestra's; the runtime is an execution substrate

## Status

Accepted. Supersedes [ADR-0008](adr-0008-declarative-workflow-definitions.md), whose decision to
make customer workflows declarative and compiled is carried forward unchanged. What changes is the
boundary of what Orchestra builds.

## Context

ADR-0008 reduced "build a workflow engine" to "build a schema and a compiler", on the grounds that
durability, checkpointing, interrupts and resumption come from the runtime. Its decision text says
Orchestra **does not build** those four things.

The evaluation in [`../80-reference/langgraph-evaluation.md`](../80-reference/langgraph-evaluation.md)
established that this conflates two layers that are licensed differently and solve different
problems.

**Workflow execution semantics** — graph and state semantics, durable execution primitives,
checkpointing, interrupts and resume. These are available under MIT. Verified on 2026-09-11:

| Package | Version | Licence |
| --- | --- | --- |
| `langgraph` | 1.2.11 | MIT |
| `langgraph-checkpoint` | 4.2.0 | MIT |
| `langgraph-sdk` | 0.4.4 | MIT |
| `langgraph-api` | 0.14.0 | Elastic-2.0 |
| `langgraph-runtime-inmem` | 0.34.0 | Elastic-2.0 |

**Run supervision** — accepting a run, persisting its lifecycle, queueing work, dispatching and
recovering workers, concurrency control, scheduling, cancellation, job-level retry, autoscaling,
tenant isolation, and a stable API over all of it. The obvious implementation of this layer is the
two Elastic-2.0 packages above. ELv2 prohibits providing the software to third parties as a hosted
or managed service where those users get a substantial set of its functionality — which is exactly
[ADR-0001](adr-0001-product-shape-multi-tenant-saas.md)'s product shape.

**ADR-0008 carries a second defect this record does not repair.** Its differentiation sentence —
"Camunda offers determinism with AI attached at the edges; LangGraph offers agency with no
governance" — was not accurate when it was accepted on 2026-09-08. The survey in
[`../80-reference/prior-art-survey.md`](../80-reference/prior-art-survey.md) establishes that the
Camunda capability shipped eleven months earlier, that the agent-runtime half fails of the vendor
rather than the library, and that the "fifteen-year leads" figure is overstated for both incumbents
on primary evidence. That is a defect in the *rationale*, not in the decision, and repairing it is
separate work: this record corrects the build boundary only, and ADR-0008's text is retained
unedited because the reasoning trail is the point of the practice. The rationale defect is named
here so that a reader of the superseded record knows it is on file.

The precise conclusion about licensing matters too, because an earlier and looser statement of that
finding said the layer was unbuildable by licence. It is not. **The licence does not make the architecture
impossible; it makes one particular implementation of that architecture unsafe to compose into
Orchestra's hosted product.**

The deeper point is architectural rather than legal, and it holds whatever the licence says:
**durability at the graph level does not give you durable service-level run orchestration.** A
checkpoint tells you a graph reached state X. It does not tell you which worker owns the run, who
retries it, how many of a Tenant's runs may execute concurrently, what happens when a worker
disappears, who wakes a scheduled run tomorrow, how to drain a worker during deployment, what
happens when a hundred thousand runs arrive at once, which queue takes priority, or how a Tenant's
quota is enforced. Those are control-plane concerns, not graph semantics.

## Decision drivers

- ADR-0008's reduction is the largest single bet in the platform's scope and must be stated
  accurately, because [`../70-delivery/`](../70-delivery/) will scope an MVP against it.
- ADR-0001 fixes a hosted multi-tenant product, which constrains which dependencies are composable.
- Runtime substitution must stay affordable, which is ADR-0005's argument for compilation.
- A vague "we may still need some runtime work" is worse than a concrete boundary, because it cannot
  be sized, planned or reviewed.

## Considered options

1. **Use only the MIT components and build the supervisor.** Orchestra implements run management
   around an MIT execution substrate.
2. **License the vendor's server.** Viable for a self-hosted or internal deployment; commercially
   constrained for a hosted product built on it, and it places a licence dependency on the critical
   path of the thing Orchestra sells.
3. **Reimplement only the supervisory layer**, keeping the graph executor as-is.

Options 1 and 3 describe the same destination from different starting points.

## Decision

**Orchestra is a schema, a compiler and a run supervisor. The runtime is an execution substrate.**

- Orchestra depends only on the **MIT-licensed** execution components. It does not build on
  `langgraph-api` or `langgraph-runtime-inmem`, and no Orchestra component may take a dependency on
  an Elastic-2.0 package.
- Orchestra **does not build**: graph and state semantics, durable execution primitives,
  checkpointing, interrupts and resume. ADR-0008's reduction holds for these, and
  `langgraph-checkpoint` being MIT is what makes it hold.
- Orchestra **does build** the **run supervisor**, a first-class subsystem owning:

| Concern | What it owns |
| --- | --- |
| Run lifecycle | Persisting run intent and status through queued, leased, running, waiting, retrying, cancelling and terminal states |
| Work distribution | Enqueueing runnable work, leasing it to workers, and reclaiming a lease when a worker disappears |
| Concurrency | Per-Tenant limits, priority between queues, and admission under the Quota Envelope |
| Scheduling | Waking a run at a future time, and resuming one that has been waiting on an approval |
| Failure handling | Job-level retry and cancellation, distinct from Step Execution retry, which stays where it is |
| Operations | Draining a worker during deployment, and scaling horizontally |

The supervisor does not need to understand the semantics of every node type. It needs to understand
**runs**. Its contract is: persist the run intent, enqueue runnable work, lease it to a worker,
invoke the compiled graph, observe a checkpoint, an interrupt or completion, persist the outcome, and
either schedule the next work or finalise the run.

## Rationale

Option 2 puts a licence dependency on the critical path of a hosted product and constrains it
commercially against the vendor whose product it competes with. Options 1 and 3 keep the part of the
reduction that is real — nobody should rebuild graph execution, checkpointing or interrupts — while
naming the part that is not.

The correction improves the ADR rather than weakening it. "We do not need a workflow engine" remains
true. "Therefore we mostly need a schema and a compiler" does not follow, and stating the missing
component as a named subsystem converts a vague concern into a boundary that can be reviewed and
sized. **The runtime solves execution correctness; Orchestra solves execution operations.**

It is also worth being honest about direction: owning the supervisor is where run economics and the
operational product surface live. A platform that outsources it does not control its own cost per
run, its own tenancy behaviour under load, or its own deployment story.

## Consequences

### Positive

- The responsibility boundary is explicit and reviewable rather than implied.
- No Elastic-2.0 dependency sits on the path of the hosted product.
- Runtime substitution stays a compiler-and-adapter change, since the supervisor is Orchestra's and
  is not coupled to one executor's server.
- The supervisor is the natural home for per-Tenant concurrency and quota admission, which
  [ADR-0006](adr-0006-model-layer-as-credential-broker.md) requires and which had no owner.

### Negative

- **MVP scope grows, and this is the third time it has.** ADR-0001 pulled multi-tenancy forward,
  [ADR-0007](adr-0007-outbound-connector-for-enterprise-reachability.md) added a connector, and this
  adds a distributed run supervisor. `70-delivery/mvp-definition.md` must account for all three
  rather than discovering them.
- A supervisor is distributed-systems work — leasing, liveness, recovery, backpressure — and it is
  the class of work where subtle bugs are most expensive.
- The size is not yet known. That is the first follow-on below, and it is deliberately unresolved
  here rather than guessed.

### Neutral / follow-on work

- **Enumerate the supervisor's responsibilities precisely enough to size it**, and say whether this
  is glue around an executor or a substantial distributed runtime. That answer changes the delivery
  plan and should be established before an MVP is committed to.
- [ADR-0005](adr-0005-langgraph-as-compilation-target.md) says durability, checkpointing,
  interrupts and resumption "come free". That is true of the MIT library and not of the server tier,
  and ADR-0005 draws no library-versus-server distinction at all. It needs the same correction this
  record makes, which is a separate ADR rather than an edit.
- `50-workflows/execution-semantics.md`, `10-architecture/containers.md` and
  `10-architecture/data-plane.md` state or imply ADR-0008's boundary and must be updated to this one.
- The Run states the supervisor persists must reconcile with the Run lifecycle already drawn in
  `20-domain/lifecycle-state-machines.md`. They are the same entity seen from two levels, not two
  state machines, and the domain lifecycle is authoritative on the states a customer can observe.
- Job-level retry in the supervisor is a different concept from Step Execution retry and MUST NOT be
  conflated with it; `execution-semantics.md` owns the latter.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| The supervisor is larger than assumed and dominates the MVP | Medium | High | Size it before committing to an MVP; the follow-on above exists for this |
| A dependency on an Elastic-2.0 package arrives by transitive install | Medium | High | Assert licences in CI over the dependency tree, not by review |
| Supervisor and domain Run lifecycles drift into two models | Medium | Medium | The domain lifecycle is authoritative; the supervisor's states map onto it |
| Job-level and Step Execution retry are conflated | Medium | High | Named as distinct here and in `execution-semantics.md`; a repeated side effect is the failure mode |

## Revisit criteria

Reopen if the vendor relicenses the run-management packages under terms a hosted product can build
on, which would make option 2 viable and the supervisor optional; if sizing shows the supervisor is
large enough to threaten the positioning in
[ADR-0003](adr-0003-governance-layer-positioning.md), since a platform mostly building a distributed
runtime is not a governance layer; or if a substrate emerges that supplies both layers under a
composable licence.

## References

- [ADR-0008](adr-0008-declarative-workflow-definitions.md) — superseded by this record
- [ADR-0005](adr-0005-langgraph-as-compilation-target.md) — the compilation boundary, unchanged
- [`../80-reference/langgraph-evaluation.md`](../80-reference/langgraph-evaluation.md) — the evidence
- [Elastic License 2.0](https://www.elastic.co/licensing/elastic-license)
