---
title: "ADR-0010: A2UI as the GenUI interchange format"
adr_id: ADR-0010
status: Proposed
date: 2026-09-08
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

1. Confirm A2UI's current version and stability guarantees.
2. Confirm the approval surface — evidence set, proposed action, decision affordances — is
   expressible in A2UI without extension.
3. Assess renderer availability and quality for React and React Native.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| A2UI does not reach stability | Medium | Medium | Internal model behind the adapter; Orchestra-defined surfaces remain possible |
| A2UI cannot express governance surfaces | Medium | Medium | Purpose-built approval schema, independent of A2UI |
| Two UI paths create inconsistency | Medium | Low | Single internal model; A2UI is a serialisation of it |

## Revisit criteria

Revisit when GenUI enters the roadmap, or when A2UI reaches a stable release.
