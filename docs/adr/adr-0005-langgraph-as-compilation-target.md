---
title: "ADR-0005: LangGraph as a compilation target, not a public boundary"
adr_id: ADR-0005
status: Superseded
superseded_by: [ADR-0016]
date: 2026-09-08
deciders: [platform-architecture]
tags: [runtime, architecture, boundaries]
---

# ADR-0005: LangGraph as a compilation target, not a public boundary

## Status

**Superseded by [ADR-0016](adr-0016-compile-to-the-langgraph-library.md).**

The decision below — that Agents and Workflows are compiled into LangGraph execution graphs, and
that LangGraph is never a public contract — is carried forward unchanged. What ADR-0016 corrects is
what the decision was said to buy. This record names *LangGraph* without saying which artefact: its
*"come free"* consequence holds for the MIT library and not for the Elastic-2.0 server tier, only
one durability mode is a guarantee, resumption supplies the mechanism but not the supervision, and
substitution is a drain rather than a recompile. The text below is retained unedited because the
reasoning trail is the point of the practice.

## Context

v0.1 selected LangGraph as the initial runtime and correctly insisted (§3.3, §7, Rule 1) that no
consumer-facing SDK should import LangGraph types. It did not, however, specify what the boundary
*is* — only what must not cross it.

LangGraph supplies durable, checkpointed, interruptible graph execution with resumption and
streaming. Those properties are precisely what a workflow engine provides, and rebuilding them would
be a multi-year effort with no differentiated value.

## Decision drivers

- Durability, checkpointing and interrupts are expensive to build and are already solved.
- Runtime independence must be a real boundary, not an aspiration.
- [ADR-0008](adr-0008-declarative-workflow-definitions.md) requires a well-defined execution target.

## Considered options

1. **Wrap LangGraph behind a thin facade** — customers configure agents; Orchestra translates at
   invocation time.
2. **Compile Orchestra definitions into LangGraph graphs** — the definition is the contract; LangGraph
   is a build output.
3. **Build a bespoke execution engine.**

## Decision

Orchestra defines **Agents and Workflows declaratively** and **compiles them into LangGraph execution
graphs**. LangGraph is a compilation target and an implementation detail. It is never a public
contract, never named in an API, schema, SDK or customer-facing document.

## Rationale

Option 3 is a multi-year investment in a solved problem. Option 1 leaves the boundary informal, and
informal boundaries leak: a facade thin enough to be cheap is thin enough to expose the thing behind
it.

Option 2 makes the boundary structural rather than a matter of discipline. The declarative definition
is the customer-facing artifact and the unit of versioning; the compiler is Orchestra's; the graph is
a build output that can be regenerated for a different runtime without any customer-visible change.
It also creates the natural place to inject Policy Enforcement Points — the compiler emits them at
every step boundary, so governance cannot be bypassed by how a definition is written.

## Consequences

### Positive

- Runtime substitution becomes a compiler change, not a platform rewrite.
- Policy enforcement is injected structurally and is not optional.
- Durability, checkpointing, interrupts and resumption come free.

### Negative

- A compiler is a real component with its own correctness burden: validation, error reporting, and
  golden tests mapping definitions to expected graphs.
- Compilation adds indirection when debugging. Every compiled graph MUST retain a traceable link
  back to its source definition, version and step identifiers.
- Some LangGraph capabilities will be unreachable from the definition language. Deliberate.

### Neutral / follow-on work

- Runtime is Python; the control plane and protocol tooling are TypeScript. The boundary between them
  is a versioned internal contract and must be documented as one.
- Compiler diagnostics are a user-facing surface and require the same care as an API.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Definition language cannot express a needed pattern | High | Medium | Explicit escape hatch: a reviewed custom step type, never raw customer code |
| Compiler bugs produce subtly wrong execution | Medium | High | Golden tests, deterministic compilation, compiled-graph snapshots retained for audit |
| LangGraph API churn | Medium | Medium | Pin versions; isolate all LangGraph contact in the compiler and runtime adapter |

## Revisit criteria

Reopen if LangGraph's durability guarantees prove insufficient at target scale, or if a materially
better execution substrate emerges. The compilation boundary is what makes such a move affordable.
