---
title: "ADR-0008: Customer-defined workflows as declarative definitions"
adr_id: ADR-0008
status: Superseded
date: 2026-09-08
deciders: [product-owner, platform-architecture]
tags: [workflows, scope, product]
depends_on: [ADR-0003, ADR-0005]
---

# ADR-0008: Customer-defined workflows as declarative definitions

## Status

**Superseded by [ADR-0014](adr-0014-run-supervisor-is-orchestras.md).**

The decision below — that customer workflows are declarative and compiled rather than interpreted —
is carried forward unchanged. What ADR-0014 corrects is the boundary of what Orchestra builds: the
reduction to "a schema and a compiler" conflated workflow execution semantics, which the runtime
does supply under a composable licence, with run supervision, which it does not. The text below is
retained unedited because the reasoning trail is the point of the practice.

## Context

The product must serve finance, logistics, procurement and further domains. Each has different
business processes but identical governance requirements. Without a definition layer, each domain
becomes bespoke code, and the platform forks by vertical — which is not a platform.

The product owner therefore requires that **customers define their own workflows.**

This reverses v0.1 §34, which listed "a generic workflow engine for all workloads" as an explicit
non-goal. The reversal must be made deliberately and bounded, because "workflow" denotes three
different products:

| | Meaning | Verdict |
| --- | --- | --- |
| **A** | **Agent definition** — declare tools, instructions, model, bounds; the model chooses the sequence at runtime | Required. Configuration, not orchestration. |
| **B** | **Approval and policy routing** — thresholds, chains, delegation, escalation | Required. The core of the governance thesis, and necessarily per-domain data rather than code. |
| **C** | **Deterministic process orchestration** — an ordered graph of business steps | Required, but strictly bounded. |

C is the dangerous one. Camunda and Temporal have fifteen-year leads. A mediocre workflow engine
loses on both fronts: worse than the incumbents at orchestration, and a distraction from governance.

## Decision drivers

- Multi-domain reach demands configuration, not per-vertical code.
- Approval chains are inherently customer- and domain-specific.
- Building a general workflow engine would consume the roadmap.
- LangGraph already provides durable, checkpointed, interruptible graph execution.

## Considered options

1. **No workflows** — agents plus policy only. Preserves the v0.1 non-goal; fails the requirement.
2. **Full workflow engine** — designer, DSL, engine, migration, compensation, timers, sub-processes.
3. **Declarative definition layer compiled onto the existing runtime.**
4. **Embed a third-party BPM engine** (Camunda, Temporal) alongside the agent runtime.

## Decision

Adopt **option 3**. Customers author versioned, declarative Workflow definitions. Orchestra owns the
definition language, the validating compiler, policy injection and versioning. Execution runs on
LangGraph per [ADR-0005](adr-0005-langgraph-as-compilation-target.md).

**Orchestra builds:** the schema, the compiler, policy enforcement at every step boundary, versioning
and lifecycle, observability, and the audit trail.
**Orchestra does not build:** durability, checkpointing, interrupts, or resumption.

Step types at MVP: `agent`, `tool`, `approval`, `condition`, `parallel`, `wait`, `transform`,
`subworkflow`. Every step declares a Side-Effect Class.

## Rationale

Option 1 fails the requirement. Option 2 is the trap described above. Option 4 introduces a second
execution engine, a second state store and a second failure domain, for capability the first engine
already provides.

Option 3 reduces "build a workflow engine" to "build a schema and a compiler" — roughly the fraction
of the work that is actually differentiated — while making governance structural: the compiler emits
a Policy Enforcement Point at every step boundary, so policy cannot be bypassed by how a definition
is written.

It also produces a defensible position no incumbent occupies. Camunda offers determinism with AI
attached at the edges; LangGraph offers agency with no governance. Orchestra offers a process that is
**deterministic where determinism matters, agentic where judgment matters, and governed at every
step.**

## Consequences

### Positive

- One platform serves finance, logistics and procurement; domains differ only in their definitions.
- Governance is enforced structurally rather than by convention.
- Deterministic steps become auditable and reproducible in a way a free-running agent is not.

### Negative

- **Reverses v0.1 §34.** The non-goal is restated as *"not a general-purpose automation platform"* —
  the boundary being that every Orchestra step executes under policy and audit, and the capability
  catalog is business capabilities exposed via MCP, not a directory of SaaS connectors. This keeps
  Orchestra out of both Camunda's lane and Zapier's.
- The definition language is a permanent public contract with all the versioning obligations that
  implies.
- Compensation semantics are genuinely hard and cannot be deferred indefinitely.

### Neutral / follow-on work — the four that hurt if deferred

1. **In-flight version pinning.** A run started on v3 finishes on v3, forever. Running instances are
   never migrated. See [VERSIONING.md](../VERSIONING.md) §8.
2. **Compensation (saga) semantics.** Steps declare compensating actions; failure after a
   side-effecting step triggers compensation, never blind retry.
3. **Idempotency keys scoped to Step Execution**, not to the Run.
4. **No visual designer at MVP.** Schema-first authoring, reviewed as code. A designer is a later
   product decision, and it is where workflow products most often stall.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Definition language grows into a programming language | High | High | Deny-by-default step-type additions; every new type requires an ADR |
| Customers demand a visual designer to adopt | Medium | Medium | Validate with design partners; schema-first does not preclude one later |
| Compensation is under-specified and corrupts state | Medium | High | Mandatory compensation declaration for `write`, `destructive` and `financial` steps |
| Scope creeps toward general automation | High | High | Restated non-goal above; capability catalog restricted to registered business Tools |

## Revisit criteria

Reopen if customers consistently require orchestration primitives — long timers, complex event
correlation, high-volume non-agentic throughput — that indicate a dedicated BPM engine is the right
tool, in which case option 4 returns as an integration rather than a replacement.
