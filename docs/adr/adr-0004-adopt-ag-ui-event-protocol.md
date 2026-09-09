---
title: "ADR-0004: Adopt AG-UI as the internal event format behind an Orchestra profile"
adr_id: ADR-0004
status: Proposed
date: 2026-09-09
deciders: [platform-architecture]
consulted: []
informed: []
supersedes: []
superseded_by: []
tags: [protocol, sdk, interoperability]
depends_on: [ADR-0003]
---

# ADR-0004: Adopt AG-UI as the internal event format behind an Orchestra profile

## Status

**Proposed** — binding only after the validation step defined below. Revised 2026-09-09 after the
desk-checkable validation steps were carried out; three factual claims in the original text were
wrong and are corrected here.

## Context

v0.1 §9 proposed authoring a bespoke agent event protocol: `run.*`, `message.*`, `tool.*`,
`approval.*`, `ui.surface.*`, `error`.

**AG-UI** — the Agent-User Interaction Protocol — is an open, event-based protocol standardising
real-time communication between agents and user-facing applications, over SSE, WebSocket or HTTP.
It defines roughly 30 event types across eight families. It originated from CopilotKit's LangGraph
partnership — the same runtime Orchestra targets, applied to the same problem.

Investigation on 2026-09-09 established the following, and it materially changes the decision.

**There is no version to pin.** No version of the specification has ever been frozen. The only
published artefact is a draft, carrying a banner stating that nothing in it is covered by a
compatibility promise until a version is frozen and that it must not be cited as a stable
reference. The reference implementation is at `0.0.59` on npm — a `0.0.x` line, which under semver
carries no compatibility protection at all. A breaking transition toward 1.0 is in flight.

**Governance is a single company.** `CODEOWNERS` assigns the whole repository to one team. There is
no governance document, no foundation, no steering committee and no RFC process. The vendor's
commercial product sits on top of the protocol.

**Adoption is real and growing, not shrinking.** Roughly 21 integrations now emit it, including
Microsoft Agent Framework, Google ADK, AWS Strands, Bedrock AgentCore, Pydantic AI and LlamaIndex.
Re-deriving a 30-event protocol that several major vendors already emit would be a poor use of a
pre-customer year, which is the ADR-0003 argument unchanged.

**Ordering and replay are not in the protocol.** This corrects the original text, which listed
ordering and replay among the things AG-UI supplies. It does not supply them. The specification
states that arrival order is the protocol's order and that a consumer MUST NOT use `timestamp` to
order events; the SSE binding has an explicit no-resumption section. There is no sequence number,
no cursor, no server-assigned event id and no replay contract. State synchronisation — snapshot and
delta — *is* provided, and that part of the original claim stands.

**The four per-event guarantees Orchestra requires do fit, in `metadata`.** `metadata` is declared
on the base event, so it is present on every event type, it permits additional properties, and the
`ag-ui` key is reserved while every other key is application space. The specification states that
unknown metadata keys are protocol-legal and are never stripped. Top-level extra fields currently
survive parsing in two SDKs, but the specification names that as a defect to be fixed and the
binary binding drops them, so top-level carriage is building on a bug.

## Decision drivers

- Per [ADR-0003](adr-0003-governance-layer-positioning.md), client event streaming is commodity.
- Interoperability with runtimes that already emit AG-UI is a distribution advantage.
- Protocol authorship carries a permanent maintenance and versioning burden.
- Enterprise buyers are offered compatibility promises. Orchestra cannot make one that is stronger
  than the promise of the thing it is derived from, unless the derivation is Orchestra's own
  artefact.
- Per [ADR-0002](adr-0002-enterprise-segment-and-byok.md) and CLAUDE.md working rule 2, no rail may
  appear in a public contract.

## Considered options

1. **Author a bespoke protocol** (v0.1 §9).
2. **Adopt AG-UI directly as the public client-facing contract.**
3. **Adopt AG-UI as the internal wire format, and publish an Orchestra-versioned profile as the
   public contract**, with an adapter at the edge.
4. **Reject AG-UI** and revisit once it freezes a version.

## Decision

Adopt **option 3**.

- AG-UI is the wire format Orchestra emits and consumes internally.
- The **public contract is an Orchestra-versioned profile**: Orchestra's own document, Orchestra's
  own semantic version, Orchestra's own conformance suite. It pins a specific commit of the AG-UI
  draft schema and states exactly which events Orchestra emits and which it does not.
- Governance events are carried as namespaced extensions — `orchestra.approval.required`,
  `orchestra.policy.denied`, `orchestra.workflow.step.started`.
- The four required per-event fields — a per-run monotonic `seq`, `run_id`, `tenant_id` and a
  server-assigned `event_id` — are carried under a vendor-prefixed key in `metadata`, never as
  top-level event fields.
- **Replay and resumption are Orchestra's to build.** They are not inherited.
- **The CopilotKit React bindings are not adopted.** Orchestra consumes the AG-UI client library
  directly behind an Orchestra-owned adapter and writes its own thin React surface.

This is the same shape [ADR-0010](adr-0010-a2ui-genui-interchange.md) chose for A2UI, which makes
the two decisions consistent rather than divergent.

## Rationale

Option 1 spends months arriving where the ecosystem already is, and is incompatible with every
frontend that already speaks AG-UI.

Option 2 was the original decision and the investigation removed its foundation. Its stated
mitigation is to pin a version, and there is no version to pin. Orchestra would be offering an
enterprise governance contract, with the compatibility promises that segment expects, on top of an
unratified draft that explicitly disclaims compatibility and that one vendor can change
unilaterally. The mismatch is not a risk to be monitored; it is a promise that cannot be kept.

Option 4 discards a genuine distribution advantage over a problem that a thin artefact solves.

Option 3 keeps the interoperability and the saved protocol-design work while making the public
promise something Orchestra actually controls. The profile is a small document and a conformance
suite, not a protocol. When AG-UI freezes a version, the profile pins that version instead of a
commit, and no customer sees a change.

The CopilotKit bindings are refused on three independent grounds, the first of which is decisive:
their public API exports a LangGraph-specific hook and requires the tool-protocol SDK as a peer
dependency, which is precisely the rail leak CLAUDE.md rule 2 and
[ADR-0005](adr-0005-langgraph-as-compilation-target.md) exist to prevent. They also carry no
accessibility position — no VPAT, no conformance claim, no live region on a streaming transcript,
no focus management on the modal — which is a procurement stop rather than a backlog item in the
target segment. Their coupling is at the hook and CSS-class boundary rather than the protocol
boundary, so replacement cost rises with every surface built on them. That cost is zero today,
which is exactly when the decision is cheapest to take.

## Consequences

### Positive

- Interoperable with any AG-UI-aware runtime or frontend.
- State synchronisation semantics arrive with the protocol rather than being designed twice.
- The public contract carries an Orchestra version and an Orchestra compatibility promise, which is
  what an enterprise contract review asks for.
- An upstream breaking change becomes a profile revision and an adapter change, not a customer
  migration.

### Negative

- **Orchestra still writes client bindings.** The original text claimed client SDK effort would
  collapse substantially because existing React bindings were usable. That is withdrawn: the
  protocol is adopted, the bindings are not.
- **Orchestra builds replay and resumption itself.** Net-new work the original decision assumed it
  was inheriting.
- A `seq` in `metadata` is expressible but not enforceable by any third party, since the
  specification tells consumers that arrival order is authoritative. It is data Orchestra carries
  and Orchestra's own client validates.
- The profile is a real artefact with its own versioning, conformance tests and maintenance cost.

### Neutral / follow-on work

- The profile document belongs in `30-protocol/`, with the governance extension schemas.
- Streamed item families merge `metadata` with last-write-wins semantics into the assembled item,
  so a per-event `seq` on those families needs a carriage design that survives merging.
- Whether Orchestra's replay is a custom transport or an out-of-band endpoint is not decided here.

## Validation before this ADR becomes Accepted

| Step | Status |
| --- | --- |
| 1. Confirm the specification version, governance model and stability guarantees | **Done, 2026-09-09.** No frozen version, single-vendor governance, no compatibility promise. This is why the decision changed from option 2 to option 3. |
| 2. Prototype the approval lifecycle end to end and confirm it survives disconnect and replay | **Outstanding.** Prototype the 1.0 draft's interrupt and resume pattern first — an interrupt carried on run completion and tied to a tool call, with resume entries on the run input — which is a better structural fit for an Approval Request than the custom-event envelope. |
| 3. Confirm the profile can carry the four per-event guarantees without forking | **Done, 2026-09-09.** They fit under a vendor-prefixed key in `metadata`, which is a sanctioned extension point. They MUST NOT be top-level fields. |
| 4. Assess the CopilotKit React bindings for enterprise fitness | **Done, 2026-09-09.** Failed. They are not adopted; see the decision above. |

Only step 2 remains, and it requires code rather than research.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Upstream ships a breaking change | **High** | Medium | The profile pins a commit; the adapter absorbs the change; the customer-visible contract does not move |
| The protocol never freezes a stable version | Medium | Medium | The profile is already the public contract, so a frozen upstream version is an improvement rather than a precondition |
| Single-vendor governance diverges from enterprise needs | Medium | Medium | The profile is the divergence point; forking the schema is a contained cost, not a platform change |
| Approval lifecycle does not survive disconnect | Medium | High | Validation step 2; if it fails, replay is designed against Orchestra's own transport rather than upstream's |
| A prototype relies on top-level fields because they currently parse | High | Medium | Normative in this ADR: extension fields live in `metadata`; the binary binding drops top-level extras |

## Revisit criteria

Reopen if validation step 2 shows the approval lifecycle cannot be expressed without forking the
schema; if upstream governance moves to a foundation with a published compatibility policy, which
would make a thinner profile sufficient; or if adoption collapses, which would remove the
interoperability argument that survives everything else in this record.

## References

- [AG-UI documentation](https://docs.ag-ui.com/)
- [AG-UI draft specification: versioning and compatibility](https://docs.ag-ui.com/spec/draft/basic/versioning)
- [AG-UI repository](https://github.com/ag-ui-protocol/ag-ui)
- [AG-UI draft JSON Schema](https://ag-ui.com/spec/draft/schema.json)
- [Generative UI on Amazon Bedrock AgentCore with AG-UI](https://aws.amazon.com/blogs/machine-learning/build-generative-ui-for-ai-agents-on-amazon-bedrock-agentcore-with-the-ag-ui-protocol/)
