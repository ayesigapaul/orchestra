---
title: "ADR-0046: A Tool declares its compensating Tool when it is registered, and a Step's own declaration overrides it"
adr_id: ADR-0046
status: Accepted
date: 2026-09-13
deciders: [product-owner, platform-architecture]
consulted: []
informed: []
supersedes: []
superseded_by: []
tags: [workflows, governance, connectivity]
depends_on: [ADR-0008, ADR-0035, ADR-0040, ADR-0042]
---

# ADR-0046: A Tool declares its compensating Tool when it is registered, and a Step's own declaration overrides it

## Status

Accepted.

## Context

[ADR-0008](adr-0008-declarative-workflow-definitions.md) requires that failure after a
side-effecting step triggers a declared compensating action and never a blind retry.
[`execution-semantics.md`](../50-workflows/execution-semantics.md) carries that as X15: a
compensating action MUST be declared for `write`, `destructive` and `financial` Steps. X21 fixes
what the declaration contains — one registered Tool, the arguments as they would execute, and the
schema MAJOR the version pins — and attaches it to the Step it compensates.

A Step is the wrong place for one class of invocation, and section 5 of that document says so
plainly. **An Agent Run has no Steps**, so a `write`, `destructive` or `financial` Tool call in one
has nowhere to declare the compensating action X15 requires. The same hole is reachable from inside
a Workflow Run: an `agent` Step is a Step, but [`step-types.md`](../50-workflows/step-types.md)
section 5 fixes that a definition constrains the delegation and not the order, count or arguments of
the calls the model makes, so a model-chosen invocation inside it has no declaration of its own
either. Section 5 names the two candidates — the Tool's Catalog registration, or the Agent version
beside the declared Tool — observes that either changes a permanent public contract, and registers
the choice as needing an ADR. It is registered again in `step-types.md` section 13, with
[`control-plane.md`](../10-architecture/control-plane.md) and
[`tool-authorization.md`](../40-governance/tool-authorization.md) named alongside.

Three decisions taken with this one bear on the answer.

- **ADR-0040** gives every Run a compensation outcome of `not_required`, `compensated` or
  `unresolved`, and cites this record by number for one thing: where the compensating action for a
  Tool call the model chose is declared. This record carries that, and closes what ADR-0040 left
  open there. What such an invocation is *called* stays open, in
  [`domain-model.md`](../20-domain/domain-model.md) section 11.
- **ADR-0042** makes a version declare every Tool it may call, as a ceiling, and makes a capability
  grant a separate act read at every Tool enforcement point.
- **ADR-0035** supplies an Expression Profile, so an argument mapping has a language to be written
  in that is already checked at publication and bounded in cost.

What is already settled and not reopened: X16 makes a compensating action a new business action with
its own Side-Effect Class, capability grant, enforcement point, Audit Record and metered occurrence
— not a rollback, and able to be denied or gated. X20 forbids recursion. X17 subjects it to the
unknown-outcome rule. The worked example already pairs the capability with its undo:
`erp.purchase_order.create` compensated by `erp.purchase_order.void`.

## Decision drivers

- X15's mandate holds for every invocation that takes an effect, including one no Step declared.
- A compensating action is declared once per capability, not once per caller, if the pairing is a
  property of the capability.
- A compensating call is governed exactly like the call it compensates (X16, X20, ADR-0042).
- A Workflow author keeps the ability to say what undoing *this* Step means (X21).
- Nothing pretends to undo what cannot be undone; an effect left in place is recorded, not hidden
  (X23, ADR-0040).
- A choice that stays cheap to reverse before the first customer (working rule 8).

## Considered options

1. **On the Tool's registration.** A `write`, `destructive` or `financial` Tool declares its
   compensating Tool and an argument mapping once, when it is registered. The registration record
   becomes a richer public contract, and every caller inherits the pairing.
2. **On the Agent version, beside each declared Tool.** The declaration sits where the Agent's
   authority already sits. It is duplicated in every Agent version declaring the same Tool, and
   divergent copies are the ordinary outcome.
3. **Nowhere.** A model-chosen call takes an effect that nothing can undo, recorded `unresolved` on
   failure. X15 goes unmet for Agent Runs, and for every call inside an `agent` Step.

## Decision

The product owner chose option 1.

### A Tool declares its compensation when it is registered

Registering a Tool whose Side-Effect Class is `write`, `destructive` or `financial` requires a
compensation declaration. It is one of two things, and both are explicit:

- **a compensating Tool and an argument mapping** — one Tool registered in the same Tenant's Tool
  Catalog, and a mapping from the compensated invocation's arguments and result to the compensating
  Tool's arguments; or
- **no compensating action**, stated as such. Some capabilities genuinely cannot be undone, and an
  explicit *none* is a recorded property of the capability that an author and an auditor can see,
  rather than an omission nobody notices.

A `read` Tool declares none, having nothing to undo. An `external-communication` Tool MAY declare a
follow-up action, which is never presented as an undo; the mandate's scope is unchanged and stays
`execution-semantics.md` X15's.

The declaration is part of the registered record, so changing it is a re-registration producing a
new record, audited like any other administrative act — the derivation `control-plane.md` section 10
already makes for the Side-Effect Class. A re-registration never alters a published version (W1).

### The argument mapping is an Expression Profile expression

The mapping is written in the Expression Profile (ADR-0035), over the compensated invocation's
arguments and its result — as `erp.purchase_order.void` takes the `purchase_order_id` the
`erp.purchase_order.create` invocation returned. Registration checks it: it parses, it type-checks
against the profile's inputs, it stays within the profile's cost bound, and it produces arguments
conforming to the compensating Tool's schema.

An expression that raises an error when the compensation is attempted is a failure to compensate.
The call is not made with guessed arguments, and the effect is recorded `unresolved` (ADR-0040,
X23).

### It applies to every invocation of that Tool

A registered compensation is a property of the capability, so it covers every invocation: a `tool`
Step's, and a call the model chose in an Agent Run or inside an `agent` Step. That is what closes
the hole `execution-semantics.md` section 5 named and what ADR-0040 relies on.

**A Workflow Step's own declaration overrides the registered one.** Where a `tool` Step declares a
compensating action under X21, that is what is attempted for that Step Execution; where it does not,
the Tool's registered one is. One invocation has one compensating action, and X15's mandate is
satisfied by either. A publish is rejected where a `write`, `destructive` or `financial` Step names
a Tool registered with *no compensating action* and declares none of its own — X15 unchanged, with
one more way to satisfy it.

Under [ADR-0045](adr-0045-the-compiler-derives-a-steps-side-effect-class.md) only a `tool` Step can
carry one of the three classes, so the Step-level mandate lands there and nowhere else. An `agent`
or `subworkflow` Step declares no compensating action: the effects its delegation takes are
compensated at the Tools that take them.

### The compensating call is an ordinary invocation

X16 is unchanged and is what the rest follows from.

- It crosses the Tool enforcement point before it is attempted, and may be denied or gated
  (`policy-model.md` E1). ADR-0040 fixes what a refusal of one does: it follows no edge, and leaves
  the effect `unresolved`.
- It needs a capability grant like any other invocation, and the version must declare the
  compensating Tool. A version declaring a Tool whose registration names a compensating Tool it does
  not itself declare surfaces as an actionable warning in the Control Plane, on the shape ADR-0042
  gives a stale grant; the remedy is a new version. Until then, a compensation that cannot be
  attempted leaves the effect `unresolved`.
- Its Side-Effect Class is the compensating Tool's own registered class (TA9), never the compensated
  Tool's.
- It has its own Audit Record and its own metered occurrence.
- **Its own registered compensation is never attempted.** X20 forbids recursion, and a registered
  pairing makes that reachable where a Step declaration did not.

### What this does not decide

- **What a Tool invocation in an Agent Run is called**, and what its Policy Decision, Audit Record
  and meter record key on. `domain-model.md` section 11 registers it, X13 answers what governs such
  an invocation and what it anchors, and this record adds only where its compensating action is
  declared.
- **The registration record's schema and syntax**, and how the Control Plane presents a pairing.
  `control-plane.md` section 10 specifies the surface no further than the two administrative acts,
  and `gateway-api.md` section 8 lists no Tool schema.
- **Whether a compensating action may be anything other than a Tool invocation** — a `subworkflow`,
  for instance. `workflow-dsl.md` section 11 keeps that, and this record is written to survive
  either answer.
- **Whether one Tool may have more than one compensating Tool**, chosen by a condition. One is
  enough for the pairing the worked example shows, and more is additive under R2.
- **What the compensating call's idempotency key is derived from.** X10's question — whether the
  Catalog records that an origin honours a key — is unchanged and still registered.
- **Whether a re-registration that changes only the compensation leaves grants satisfying.**
  ADR-0042 stales grants on a changed Side-Effect Class and registers the wider re-registration
  question; nothing here narrows it.

### What this amends

- `execution-semantics.md`: section 5's closing paragraph, which named the two candidates; X15,
  which gains the second way to satisfy the mandate; X21, which gains the override; and three rows
  of section 11 — the declaration row is discharged, the `external-communication` row records that
  no compensating action is mandated, and the compensation-failure rows are ADR-0040's.
- `tool-authorization.md` section 4: what a registration records, beside the Side-Effect Class.
- `control-plane.md` section 10: the Tool Catalog surface records the pairing, and a re-registration
  changes it.
- `step-types.md`: the compensating-action row of section 4, the `agent` failure-modes cell that
  called the question unmade, the `tool` type's declaration cell, and the section 13 row.
- `workflow-dsl.md`: L7's compensation paragraph and the Compensation row of section 5.
- The glossary's *Tool* entry gains the compensating Tool.

## Rationale

**Compensation is a property of the capability.** `purchase_order.create` is undone by `void`
wherever it is called from, and by whoever calls it. Option 2 records that fact once per Agent
version, which is once per caller: the same pairing is written many times, the copies diverge, and
the Tool that acquires a proper undo has to be found in every definition that names it. Option 1
records it where the class, the schema and the authorization binding already are, which is also
where TA9 already puts the value a Policy keys on — the registration is the Catalog's statement
about what this capability is.

**Option 3 leaves X15 unmet for the whole agentic half of the platform.** ADR-0003 makes the
platform *agentic where judgment matters*, and an Agent Run is exactly where a model-chosen
`financial` call happens. A compensation outcome of `unresolved` is an honest record of a failure to
undo; it is not an answer to *where is the undo declared*.

**The override keeps the author's hand.** X21 exists because undoing *this* Step can mean something
narrower than undoing the capability in general — a void with a reason code, a refund to a
particular account. Making the registered pairing the default and the Step's declaration the
override keeps both properties: a model-chosen call gets an undo without an author, and an author
who has one in mind still writes it.

**An explicit *none* beats an implied one.** Refusing to register a `write` Tool with no undo would
have kept the mandate absolute at the cost of making some capabilities unregisterable, and would
have pushed customers to mis-class a Tool to get it registered — the exact failure TA9 exists to
prevent. Recording *no compensating action* keeps the class honest, makes the gap visible at
authoring time rather than at compensation time, and still refuses the publish where a Step relies
on a compensation nobody declared.

## Consequences

### Positive

- A `write`, `destructive` or `financial` Tool call the model chose has a declared compensating
  action, which X15 required and nothing supplied.
- One pairing per capability, authored once and inherited by every Agent and Workflow version.
- ADR-0040's compensation outcome becomes meaningful for an Agent Run, not only for a Workflow Run.
- A capability with no undo is visible as one, at registration and at authoring, rather than at the
  moment compensation is needed.
- X16, X20 and ADR-0042 apply unchanged: the compensating call is an ordinary governed invocation.

### Negative

- **The Tool registration becomes a richer public contract.** It now carries a second Tool reference
  and an expression, which is more to specify, more to version and more to get wrong — and section 5
  of `execution-semantics.md` named that cost when it registered the question.
- **An author cannot see the compensation in the definition.** A `tool` Step that declares none is
  compensated by something written elsewhere, so reading a definition no longer tells a reviewer
  what undoing a Step does. The Control Plane has to show it.
- **A second Tool to declare and grant.** A version that declares a Tool usually has to declare its
  compensating Tool too, and hold a grant for it. A version that does not cannot compensate, and the
  effect is recorded `unresolved` — a new way for a Run to end with work undone.
- **Two places to look when a compensation misbehaves**, and a precedence rule between them. The
  rule is simple, and it is still a rule an operator must know during an incident.
- **A mapping is an expression on a governed path.** It is bounded by the profile and checked at
  registration, and it is still evaluation happening between a failure and its undo.

### Neutral / follow-on work

- Amend the documents listed above, and add the compensating Tool to the glossary's *Tool* entry.
- Specify the registration record's shape, including the pairing and the mapping, with the Tool
  Catalog surface in `control-plane.md` section 10.
- Show the effective compensating action for each `tool` Step in the authoring surface, whether it
  came from the Step or from the registration.
- Warn, in the Control Plane, where a version declares a Tool whose registered compensating Tool it
  does not declare.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| A registered mapping is wrong, and the compensating call undoes the wrong thing | Medium | High | The mapping is checked at registration against the compensating Tool's schema, the call crosses its own enforcement point with its own class and arguments (X16), and it is audited as its own action |
| A version cannot call the compensating Tool, because it does not declare it or holds no grant | Medium | High | The Control Plane warns on the versions concerned; where it happens, the effect is recorded `unresolved` under ADR-0040 rather than silently skipped |
| An operator reads the registered pairing as a guarantee that the effect was undone | Medium | High | X16 keeps *compensation is not rollback*, and ADR-0040's compensation outcome is what says whether the work was undone |
| A Tool is registered with *no compensating action* to get past registration, and the gap is found only during an incident | Medium | Medium | The value is explicit, visible in the Catalog and at authoring, and a `tool` Step relying on it is refused at publication |
| A re-registration changes the pairing under versions already published | Low | Medium | A published version is never altered (W1); the change is a new registered record, audited, and surfaced as staleness on the versions declaring the Tool |
| The mapping expression becomes a place to put logic | Low | Medium | It is an Expression Profile expression: no user-defined functions, no iteration, a cost bound, and every addition is a profile version (ADR-0035) |
| A compensating Tool's own registered compensation is attempted, and recursion begins | Low | High | X20 forbids it, and this record states it of the registered pairing explicitly |

## Revisit criteria

Reopen this decision in any of these cases:

- A capability needs more than one compensating action, chosen by a condition, often enough that a
  single pairing misleads.
- Customers routinely override the registered pairing on every Step, which would mean the pairing is
  not a property of the capability after all.
- A compensating action that is not a Tool invocation is admitted by `workflow-dsl.md`, which would
  extend what a registration may declare.
- Registrations carrying *no compensating action* become common enough that the mandate is a
  formality, which is a signal about the Tools customers actually hold rather than about this
  record.

## References

- [`../50-workflows/execution-semantics.md`](../50-workflows/execution-semantics.md) section 5, X13,
  X15 to X21 and section 11: the Agent Run hole, the mandate, and what a declaration contains
- [`../50-workflows/step-types.md`](../50-workflows/step-types.md) sections 4, 5, 6 and 13: what
  every Step declares, and the `agent` Step's declaration covering the delegation
- [`../40-governance/tool-authorization.md`](../40-governance/tool-authorization.md) section 4 and
  TA9: what registration records, and the authoritative class
- [`../10-architecture/control-plane.md`](../10-architecture/control-plane.md) section 10: the Tool
  Catalog surface, and why a registered value changes only by re-registration
- ADR-0040: the compensation outcome, and the `unresolved` value this record's failures land in
- ADR-0042: declared Tools and capability grants, which a compensating call needs like any other
- ADR-0035: the Expression Profile the argument mapping is written in
- [`../20-domain/domain-model.md`](../20-domain/domain-model.md) section 11: what a Tool invocation
  in an Agent Run is called, which stays open
- [ADR-0008](adr-0008-declarative-workflow-definitions.md): compensation rather than blind retry
