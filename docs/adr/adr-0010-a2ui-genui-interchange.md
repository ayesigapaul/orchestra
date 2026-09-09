---
title: "ADR-0010: A2UI as the GenUI interchange format"
adr_id: ADR-0010
status: Proposed
date: 2026-09-09
deciders: [platform-architecture]
tags: [ui, protocol, interoperability]
depends_on: [ADR-0004]
---

# ADR-0010: A2UI as the GenUI interchange format

## Status

**Proposed** — deferred pending evaluation. Not required for the first vertical slice.

## Context

v0.1 contains an unresolved tension. §16 and §17 describe an Orchestra-defined declarative component
catalog with a client-side allow-listed registry. §18 then states that A2UI should be preferred over
inventing a competing protocol. The document never says which one is the contract.

The safety principle underneath both is correct and not in question: an agent produces declarative
UI descriptions, validated against a schema and rendered by allow-listed native components. It never
produces executable code.

The open question is only whether the wire format is A2UI or Orchestra's own.

## Decision drivers

- Interoperability is worth more than control for a format Orchestra does not need to differentiate
on. - v0.1 records A2UI as pre-1.0 at the time of writing; its current status requires verification.
- GenUI is not on the critical path for the first vertical slice.

## Considered options

1. **Adopt A2UI as both internal and wire format.**
2. **Adopt A2UI as the external interchange, retain an internal normalised surface model behind an
   adapter.**
3. **Define an Orchestra UI protocol.**
4. **Defer GenUI entirely** — text and approval surfaces only at first.

## Decision

**Proposed:** adopt **option 2**. A2UI is the external interchange; an internal normalised surface
model sits behind an adapter, so a specification change is an adapter change rather than a platform
change.

**For the first vertical slice, option 4 applies:** ship text plus a schema-validated approval
surface, and defer the general GenUI catalog.

## Rationale

Option 3 repeats the mistake [ADR-0004](adr-0004-adopt-ag-ui-event-protocol.md) corrects. Option 1
couples the platform's internals to a specification that is not yet stable and that Orchestra does not
govern — and it contradicts v0.1's own Rule 3, which the document did not apply to A2UI. Option 2
gains interoperability while keeping the blast radius of a specification change to one component.

Deferring the catalog is justified because the differentiated value is governance, and an approval
surface — which is genuinely differentiated — needs only a narrow, purpose-built schema.

## Consequences

### Positive

- Interoperability without coupling.
- The first vertical slice is not blocked on a component catalog.

### Negative

- An adapter is a real component with real cost.
- Deferring GenUI may weaken early demonstrations. Mitigated by the approval surface, which is the
  more compelling demonstration for this segment in any case.

### Neutral / follow-on work

- Verify A2UI's current specification version, stability and governance before accepting.
- Specify the approval surface schema regardless of the A2UI outcome — it is required for the slice.
- Custom customer components remain explicitly registered and allow-listed. Executable code from an
  agent is never rendered, under any option.

## Validation before this ADR becomes Accepted

| Step | Status |
| --- | --- |
| 1. Confirm A2UI's current version and stability guarantees | **Done, 2026-09-09.** Not satisfied, and the ADR's judgement is confirmed rather than merely assumed. The current release is pre-1.0; the project's own roadmap places stability guarantees inside an unshipped 1.0 milestone targeted for Q4 2026, and it self-describes as an early-stage public preview. One breaking redesign has already shipped. |
| 2. Confirm the approval surface is expressible without extension | **Outstanding.** Not attempted; it should be attempted against a pinned pre-1.0 version, or deferred until 1.0 ships. |
| 3. Assess renderer availability for React and React Native | **Done, 2026-09-09.** Partial. A first-party React renderer exists, is permissively licensed and is actively maintained, so Orchestra would not write one. There is **no** React Native renderer, first-party or maintained, and none on the roadmap — if a React Native surface is ever required, that renderer is Orchestra's to build. |

A fourth finding was not asked for and is the most useful of the three. The allow-listed component
registry this ADR depends on — an Agent never emitting executable code, only components the host has
registered — **is genuinely supported**: the catalog is host-supplied, and a component type absent
from it fails closed with a visible error rather than rendering. The caveat is that this is enforced
in renderer code rather than by a normative requirement in the specification, so Orchestra MUST
validate agent output against the catalog server-side as well, and not rely on the renderer as the
only enforcement point.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| A2UI does not reach stability | Medium | Medium | Internal model behind the adapter; Orchestra-defined surfaces remain possible |
| A2UI cannot express governance surfaces | Medium | Medium | Purpose-built approval schema, independent of A2UI |
| Two UI paths create inconsistency | Medium | Low | Single internal model; A2UI is a serialisation of it |
| Single-vendor governance | **High** | Medium | The specification is steward-controlled under that vendor's contributor agreement with internal triage, and has not been donated to a foundation. The adapter is the containment; this is the same exposure as [ADR-0004](adr-0004-adopt-ag-ui-event-protocol.md) and is managed the same way |
| A renderer-only safety model is trusted | Medium | High | Validate agent output against the component catalog server-side; never rely on the renderer as the sole enforcement point |

## Revisit criteria

Revisit when GenUI enters the roadmap, or when A2UI ships 1.0 — targeted for Q4 2026. The test for
acceptance is the **published stability guarantee**, not the 1.0 tag on its own: a major version
number without a compatibility policy behind it does not change the exposure this ADR is managing.
