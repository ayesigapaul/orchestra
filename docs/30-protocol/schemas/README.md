---
title: Schemas
doc_id: DOC-041
version: 0.15.1
status: Draft
last_updated: 2026-09-11
owners: [platform-architecture]
---

# Schemas

JSON Schema is the source of truth for every wire contract. Prose in [`../`](../) describes intent;
these files define the contract.

Naming: `<entity>.v<MAJOR>.schema.json`. The `$id` embeds the major version. Compatibility rules,
including why `additionalProperties` must never be `false` on a wire-facing object, are in
[`../../VERSIONING.md`](../../VERSIONING.md) §6, and `scripts/validate-schemas.mjs` enforces them in
CI rather than by review.

## The set

| Schema | Defines | Standing |
| --- | --- | --- |
| [`run.v1.schema.json`](run.v1.schema.json) | The Run representation: state, the pinned definition version, the pinned Policy versions, and why it is suspended | Binding |
| [`agent-event.v1.schema.json`](agent-event.v1.schema.json) | One event on a Run's stream, and the four per-event guarantees under `metadata.orchestra` | Rests on **Proposed** [ADR-0004](../../adr/adr-0004-adopt-ag-ui-event-protocol.md) |
| [`workflow-definition.v1.schema.json`](workflow-definition.v1.schema.json) | The document an author writes and publication freezes | Binding on shape only — see below |
| [`policy-rule.v1.schema.json`](policy-rule.v1.schema.json) | The envelope one rule lives in: scope, enforcement point, verdict | Binding on the envelope; the match language is ADR-required |
| [`approval-request.v1.schema.json`](approval-request.v1.schema.json) | The gate: proposed action, Evidence Set with provenance, chain, causing decision, resolution | Binding |
| [`audit-record.v1.schema.json`](audit-record.v1.schema.json) | One governed act, and the Policy Decision as a class of it | Binding |
| [`connector-envelope.v1.schema.json`](connector-envelope.v1.schema.json) | One frame on the Connector tunnel | Rests on **Proposed** [ADR-0007](../../adr/adr-0007-outbound-connector-for-enterprise-reachability.md), and is out of the first slice |

Each file carries its own reasoning in `$comment`, against the rule it derives from. Read a schema
and its prose together; where they disagree, the prose is the defect report and the schema is not
self-justifying.

## Three things these files deliberately do not do

**They do not close.** `additionalProperties` is unset or `true` everywhere, without exception,
because `false` makes additive evolution impossible and breaks rule R3 — the rule that lets a
consumer ignore what it does not recognise. A `false` anywhere in this directory fails CI.

**They do not validate a Workflow definition.** [`../../50-workflows/workflow-dsl.md`](../../50-workflows/workflow-dsl.md)
L9 puts that authority in the compiler, not here: R3's must-ignore rule binds *consumers* of an
Orchestra contract, and a compiler is not one — it is the authority deciding what a definition
means. Ignoring an unknown key would drop the author's intent, and where that intent was a
governance one the loss is invisible. So the closure is by lookup against an allow-list, exactly as
[`../ui-protocol.md`](../ui-protocol.md) CC3 closes the component catalog. `workflow-definition.v1`
fixes the shape; a compiler pass rejects the construct.

**They do not catch everything the prose forbids.** Keeping every object open is what rule R3 needs,
and it means a rule of the form *this field MUST NOT also appear here* cannot be expressed. The
clearest case: `event-protocol.md` EG1 requires the four per-event guarantees under
`metadata.orchestra` and forbids duplicating them at the top level. `agent-event.v1` enforces the
first half and cannot enforce the second, and says so in place. Checks of that shape belong to the
conformance suite the profile requires, which does not exist yet.

**They do not invent what is unmade.** Where a decision is missing the member is unconstrained and
the `$comment` says which document owns it. The policy match language, the expression syntax in a
definition, what satisfies an Approval Chain, and the frame vocabulary on the Connector tunnel are
all left open on purpose. A schema is the worst place to guess, because a guess published here is a
contract.

## What is not here

Eight contracts the prose describes have no schema, seven named by
[`../gateway-api.md`](../gateway-api.md) section 8 and the eighth added by its section 7: an Agent
definition, a Tool registration, a capability grant, a Model Binding, a Session Token mint, a usage
report, the Workspace, Principal and Tenant administrative contracts, and the error envelope.

**That question was assigned here, and this is the answer: none of the eight can be written yet, and
for two different reasons.** The error envelope and the endpoint shape are both marked ADR-required
by `gateway-api.md` section 9 — whether the envelope is [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457)
problem details or Orchestra-defined is a permanent public contract on every endpoint and in every
SDK, and customers branch on codes. Writing either here would take a decision this directory has no
standing to take. The other six wait on nothing so much as a resource model that
`gateway-api.md` section 5 gives in prose and not in fields.

One of the six carries a standing security question rather than a scheduling one: `gateway-api.md`
section 3 records that a **replayed Session Token mint returns a live bearer credential**. That is a
contract nothing is scheduled to write, and it should be written before it is implemented rather
than after.

## Open questions

| Question | Decided by | ADR required? |
| --- | --- | --- |
| The upstream commit `agent-event.v1` must pin, and the exhaustive type constants that replace its two family prefixes | [`../event-protocol.md`](../event-protocol.md) §3.1, once an implementation exists to pin against | No |
| The error envelope and the code vocabulary, and the endpoint shape of the Gateway contract | [`../gateway-api.md`](../gateway-api.md) §9 | **Yes**, both |
| Schemas for the remaining six contracts above | [`../gateway-api.md`](../gateway-api.md), once its resource model is expressed in fields | No |
| The policy match language, which `policy-rule.v1` leaves unconstrained | [`../../40-governance/policy-model.md`](../../40-governance/policy-model.md) §8, which argues it cannot be a later document | **Yes** |
| Rule precedence, which `policy-rule.v1` therefore carries no member for | [`../../40-governance/policy-model.md`](../../40-governance/policy-model.md) D4.3, a prerequisite rather than a later convenience | **Yes** |
| Whether a Policy version has a drawn lifecycle of its own, which no document draws and `policy-rule.v1` does not assert | [`../../20-domain/lifecycle-state-machines.md`](../../20-domain/lifecycle-state-machines.md), which draws the definition lifecycle P5 says Policies follow | No |
| The Connector tunnel's frame vocabulary, which `connector-envelope.v1` states as a minimum rather than an enumeration | [`../../10-architecture/connector.md`](../../10-architecture/connector.md), and only if ADR-0007 binds | No |
| Whether the `$id` base URI ever moves off GitHub, which would change every `$id` at once | Owning a domain. Staying GitHub-hosted is decided, not pending: `schemas.orchestra.dev` is parked by a third party, so the old base resolved to someone else's lander rather than to nothing. [`../../VERSIONING.md`](../../VERSIONING.md) §6 records why, and that the first external consumer is the deadline | No |
