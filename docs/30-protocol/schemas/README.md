---
title: Schemas
doc_id: DOC-041
version: 0.16.0
status: Draft
last_updated: 2026-09-23
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
| [`policy-rule.v1.schema.json`](policy-rule.v1.schema.json) | The envelope one rule lives in: scope, enforcement point, verdict, and a `match` written in the Expression Profile | Binding on the envelope. [ADR-0035](../../adr/adr-0035-cel-profile-for-policies-and-workflow-expressions.md) governs `match`, which publication checks rather than this schema |
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
the `$comment` says which document owns it. The Expression Profile's inputs and functions, how a
definition marks an expression, what satisfies an Approval Chain, and the frame vocabulary on the
Connector tunnel are all left open on purpose. A schema is the worst place to guess, because a guess
published here is a contract. The expression language itself is decided by
[ADR-0035](../../adr/adr-0035-cel-profile-for-policies-and-workflow-expressions.md), and publication
checks it: constraining a member these files left open would tighten it, which VERSIONING §6
forbids in place.

## What is not here

Seven contracts the prose describes have no schema, all named by
[`../gateway-api.md`](../gateway-api.md) section 8: an Agent definition, a Tool registration, a
capability grant, a Model Binding, a Session Token mint, a usage report, and the Workspace, Principal
and Tenant administrative contracts. The error envelope that its section 7 once added as an eighth is
decided by [ADR-0025](../../adr/adr-0025-json-api-http-contract.md), and lives in
[`../http-conventions.md`](../http-conventions.md) and the shared OpenAPI components under
[`../openapi/`](../openapi/) rather than in a JSON Schema here.

**That question was assigned here, and this is the answer: none of the seven can be written yet.**
The endpoint shape they sit under is decided — `gateway-api.md` G26 to G29, by
[ADR-0033](../../adr/adr-0033-gateway-urls-follow-json-api-and-commands-are-created.md) — but all of
them wait on a resource model that `gateway-api.md` section 5 gives in prose and not in fields.
Writing one here would take a decision this directory has no standing to take.

One of the seven carries a standing security question rather than a scheduling one: `gateway-api.md`
section 3 records that a **replayed Session Token mint returns a live bearer credential**. That is a
contract nothing is scheduled to write, and it should be written before it is implemented rather
than after.

## Open questions

| Question | Decided by | ADR required? |
| --- | --- | --- |
| The upstream commit `agent-event.v1` must pin, and the exhaustive type constants that replace its two family prefixes | [`../event-protocol.md`](../event-protocol.md) §3.1, once an implementation exists to pin against | No |
| Schemas for the seven contracts above | [`../gateway-api.md`](../gateway-api.md), once its resource model is expressed in fields | No |
| Whether a Policy version has a drawn lifecycle of its own, which no document draws and `policy-rule.v1` does not assert | [`../../20-domain/lifecycle-state-machines.md`](../../20-domain/lifecycle-state-machines.md), which draws the definition lifecycle P5 says Policies follow | No |
| The Connector tunnel's frame vocabulary, which `connector-envelope.v1` states as a minimum rather than an enumeration | [`../../10-architecture/connector.md`](../../10-architecture/connector.md), and only if ADR-0007 binds | No |
| Whether the `$id` base URI ever moves off GitHub, which would change every `$id` at once | Owning a domain. Staying GitHub-hosted is decided, not pending: `schemas.orchestra.dev` is parked by a third party, so the old base resolved to someone else's lander rather than to nothing. [`../../VERSIONING.md`](../../VERSIONING.md) §6 records why, and that the first external consumer is the deadline | No |
