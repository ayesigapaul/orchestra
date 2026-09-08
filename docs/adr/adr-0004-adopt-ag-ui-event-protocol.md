---
title: "ADR-0004: Adopt AG-UI as the client-facing event protocol"
adr_id: ADR-0004
status: Proposed
date: 2026-09-08
deciders: [platform-architecture]
tags: [protocol, sdk, interoperability]
depends_on: [ADR-0003]
---

# ADR-0004: Adopt AG-UI as the client-facing event protocol

## Status

**Proposed** — binding only after the validation spike defined below.

## Context

v0.1 §9 proposed authoring a bespoke agent event protocol: `run.*`, `message.*`, `tool.*`,
`approval.*`, `ui.surface.*`, `error`.

**AG-UI** — the Agent-User Interaction Protocol — is an open, event-based protocol standardising
real-time communication between agents and user-facing applications, over SSE, WebSocket or HTTP. It
defines 16–17 event types across lifecycle, text-message, tool-call, state, and custom categories.
LangGraph, CrewAI and Mastra emit it natively; AWS has published guidance for generative UI on
Bedrock AgentCore using it. It originated from CopilotKit's LangGraph partnership — the same runtime
Orchestra targets, applied to the same problem.

v0.1 §9 is close to a re-derivation of AG-UI, and is missing two things AG-UI already has:

- **State synchronisation** (snapshot and delta events). v0.1 §20 promises reconnection and
  resumption, which is not implementable without it.
- **Event ordering and replay.** No sequence number, no cursor, no replay contract.

## Decision drivers

- Per [ADR-0003](adr-0003-governance-layer-positioning.md), client event streaming is commodity.
- Interoperability with frontends and runtimes that already speak AG-UI is a distribution advantage.
- Protocol authorship carries a permanent maintenance and versioning burden.

## Considered options

1. **Author a bespoke protocol** (v0.1 §9).
2. **Adopt AG-UI wholesale**, carrying governance events in its `CUSTOM` envelope.
3. **Adopt AG-UI's event model but re-specify it under Orchestra names.**

## Decision

Adopt **AG-UI** as the client-facing event protocol. Governance-specific events are carried as
namespaced extensions — `orchestra.approval.required`, `orchestra.policy.denied`,
`orchestra.workflow.step.started` — within AG-UI's custom-event mechanism.

Orchestra publishes a **conformance profile** stating which upstream events it emits and which
extensions it adds.

## Rationale

Option 1 spends months arriving where the ecosystem already is, while being incompatible with every
frontend that already speaks AG-UI. Option 3 takes the interoperability cost of divergence without
the benefit of independence.

Option 2 preserves the protocol-first value from v0.1 §3.2 while removing the cost of inventing the
protocol, and inherits state sync and streaming semantics that v0.1 lacked. Governance events are
genuinely Orchestra-specific and correctly belong in an extension namespace rather than upstream.

## Consequences

### Positive

- Client SDK effort collapses substantially; existing AG-UI React bindings are usable for the first
  release.
- State sync, ordering and reconnection arrive with the protocol rather than being designed twice.
- Interoperable with any AG-UI-aware frontend or runtime.

### Negative

- The public contract is partly governed by a project Orchestra does not control. Upstream breaking
  changes become Orchestra's problem.
- Anything AG-UI cannot express must be pushed through the custom-event escape hatch or proposed
  upstream.

### Neutral / follow-on work

- Orchestra MUST additionally guarantee, on every event: per-run monotonic `seq`, `run_id`,
  `tenant_id`, and a server-assigned `event_id`. These are audit and replay requirements and are
  specified as part of the Orchestra profile whether or not upstream mandates them.
- Governance extension events require their own JSON Schemas and versioning.

## Validation before this ADR becomes Accepted

1. Confirm the current AG-UI specification version, governance model and stability guarantees.
2. Prototype the approval lifecycle over `CUSTOM` events end-to-end and confirm it survives
   disconnect and replay.
3. Confirm the conformance profile can express the ordering guarantees above without forking.
4. Assess CopilotKit React bindings for enterprise fitness: theming, accessibility, bundle size,
   licence, and the cost of replacing them later.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Upstream breaking change | Medium | Medium | Pin a version; adapter at the edge; conformance test suite |
| Governance semantics do not fit the custom envelope | Low | High | Validate in the spike before accepting |
| Project direction diverges from enterprise needs | Medium | Medium | Maintain a translation layer; retain the option to fork the profile |

## Revisit criteria

Reopen if the spike shows the approval and policy lifecycle cannot be expressed without forking, or
if upstream governance proves unstable.

## References

- [AG-UI documentation](https://docs.ag-ui.com/)
- [The 17 AG-UI event types](https://www.copilotkit.ai/blog/master-the-17-ag-ui-event-types-for-building-agents-the-right-way)
- [Generative UI on Amazon Bedrock AgentCore with AG-UI](https://aws.amazon.com/blogs/machine-learning/build-generative-ui-for-ai-agents-on-amazon-bedrock-agentcore-with-the-ag-ui-protocol/)
