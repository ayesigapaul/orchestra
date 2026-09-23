---
title: "ADR-0045: The compiler derives a Step's Side-Effect Class, and a delegating Step carries the set of classes its delegation can reach"
adr_id: ADR-0045
status: Accepted
date: 2026-09-13
deciders: [product-owner, platform-architecture]
consulted: []
informed: []
supersedes: []
superseded_by: []
tags: [workflows, governance, domain]
depends_on: [ADR-0005, ADR-0008, ADR-0012, ADR-0041, ADR-0042]
---

# ADR-0045: The compiler derives a Step's Side-Effect Class, and a delegating Step carries the set of classes its delegation can reach

## Status

Accepted.

## Context

A Side-Effect Class is a **primary** input to Policy
([`policy-model.md`](../40-governance/policy-model.md) rule N1), and every Step declares one
([`workflow-dsl.md`](../50-workflows/workflow-dsl.md) L6,
[`step-types.md`](../50-workflows/step-types.md) section 4). On a `tool` Step the value means
something exact: it is the class the Tool Catalog recorded at registration, authoritative at
evaluation and never overridable by the definition, the Run or model output
([`tool-authorization.md`](../40-governance/tool-authorization.md) TA9). On the other seven types it
means nothing that anyone has fixed. `step-types.md` S2 says so and names the sharp case: a
definition cannot constrain which Tools a model calls, so a `read`-classed `agent` Step can reach a
Tool the Catalog classes `financial`.

`workflow-dsl.md` section 11 states the constraint any answer must satisfy, in those words: whatever
the value comes to mean, it **MUST NOT become a self-issued exemption**. E3 already guarantees half
of that — every Step is evaluated whatever its class, so an author writing `read` narrows no
coverage. The other half is not guaranteed at all: an author's `read` on a delegation that can reach
a payment Tool is a false input to the rule that reads it, and a Policy keyed on `financial` does
not fire where it should.

Two decisions taken with this one make derivation possible where it was not before.

- **ADR-0042** makes an Agent or Workflow version declare every Tool it may call, as a ceiling
  frozen at publication. What a delegation can reach is therefore knowable from the version, not
  only at runtime.
- **ADR-0041** pins the Agent or Workflow version an `agent` or `subworkflow` Step names when the
  parent is published, and admits no reference cycle, so every chain of nesting is finite and the
  reachable set is computable at publication.

Nothing consumes the shape this would change.
[`workflow-definition.v1`](../30-protocol/schemas/workflow-definition.v1.schema.json) describes the
document a customer authors; no compiler exists, no definition has been authored, and no consumer
reads one. The registers that carry the question — [`step-types.md`](../50-workflows/step-types.md)
section 13 and [`workflow-dsl.md`](../50-workflows/workflow-dsl.md) section 11, with
[`policy-model.md`](../40-governance/policy-model.md) as the owner of the input — all classify it as
needing an ADR.

## Decision drivers

- The value must not be a self-issued exemption (`workflow-dsl.md` section 11).
- A primary evaluation input means the same thing on every type, or a rule keyed on it is
  conditionally true (N1).
- Whatever the compiler derives, it derives deterministically and at publication (C4, C1).
- Every effect is still evaluated where it happens: E3 at every Step boundary, and the registered
  class at every Tool invocation (TA9). The derived value adds an input, never a substitute for an
  evaluation.
- A published version's behaviour never changes without a new version (W1).
- Nothing is warned and published: a compile-time warning on a governance construct is an unenforced
  rule (`workflow-dsl.md` section 5).
- A choice that stays cheap to reverse before the first customer (working rule 8).

## Considered options

### What constrains the value

1. **Accept the author's assertion.** The compiler checks membership of the enumeration and nothing
   more, which is what it does today. A self-issued label, and the thing section 11 rules out.
2. **Declared and checked.** Effect-free types must declare `read`; a delegating type must declare
   the most consequential class it can reach. It needs a severity order over the five classes that
   nothing in this repository defines, and it keeps the author writing a value the compiler will
   only ever agree or disagree with.
3. **Derived by the compiler.** The author writes nothing; the compiler computes the value from the
   type and, for a delegating type, from what the pinned version can reach.

### Whether an author may still write the value

1. **No member at all.** The class leaves the authored document, and a Step carrying one is
   rejected.
2. **A restatement the compiler checks**, as a `tool` Step's is today: equal is accepted, different
   is rejected.
3. **A restatement the compiler warns about.** Excluded by `workflow-dsl.md` section 5 — nothing is
   warned and published.

## Decision

**Option 3 on what constrains the value, and option 1 on whether an author may write it.**

### The compiler derives the class, and the author writes none

A Step's Side-Effect Class is derived at publication. It is not authored, and `side_effect_class`
leaves the definition document: a Step that carries one is rejected by the compiler, through the
allow-list pass that L9 puts in the compiler rather than in the schema. The glossary's *every Step
declares a Side-Effect Class* becomes *every Step carries one*.

| Step type | What the Step carries | Derived from |
| --- | --- | --- |
| `condition`, `transform`, `wait`, `approval`, `parallel` | `read`, by rule | The type. None of them reaches a Tool, a model or anything outside the Run |
| `tool` | The class the Tool Catalog recorded at registration | TA9, which already made this value authoritative and unoverridable |
| `agent`, `subworkflow` | The set of classes its delegation can reach | The Tools the pinned version declares (ADR-0042), and the pinned versions that version in turn names (ADR-0041) |

**Why `read` and not a sixth value.** The five effect-free types take no effect at all, and `read`
is the closest the enumeration comes. Adding a *none* class would be a contract change under R2 and
R3 for a distinction no rule needs: a Policy that must single out these Steps matches on the Step
type, which N1 already supplies as an input.

### A delegating Step carries a set, and its boundary evaluation receives it

For an `agent` Step, the set is the classes of the Tools the pinned Agent version declares. For a
`subworkflow` Step, it is the union of the classes carried by the Steps of the pinned child Workflow
version, computed by these same rules, and so on through the pinned references ADR-0041 makes finite
and acyclic. The set is never empty: a delegation that can reach no Tool carries `{read}`.

The Step-boundary Policy Enforcement Point receives that set as the Side-Effect Class input of N1. A
Policy keyed on `financial` therefore matches an `agent` Step whose delegation can reach a
`financial` Tool — the case S2 named and could not answer. On the six other types the input is a
single value, as it is today.

**The set is a ceiling, never a substitute.** It says what the delegation *can* reach, evaluated
once at the Step boundary. What the delegation *does* is evaluated where it happens: every Tool call
the model chooses crosses the Tool enforcement point with that Tool's registered class (E1, E4,
TA9), and every Step inside a nested Workflow version crosses its own boundary (E3, ADR-0041).
Nothing here narrows a single enforcement point, which is E3's whole argument.

### The derived value is frozen with the version

Publication computes the value and freezes it with the version (W1, C1), and compilation is
deterministic, so the same version derives the same value every time (C4). A Tool re-registered with
a different Side-Effect Class does not alter a published version's derived set: it makes the set
stale, exactly as ADR-0042 makes every grant on that Tool stale, and it surfaces as an actionable
warning in the Control Plane on the versions declaring that Tool. The remedy is a new version.
Nothing is under-enforced meanwhile, because the invocation itself is evaluated with the class the
Catalog records at the time (TA9).

### What the compiler rejects

- A Step carrying `side_effect_class`, on any type.
- Nothing else changes. The check that a `tool` Step's declared class matches the Catalog's
  disappears with the declaration, and the reference checks, the graph checks and the compensation
  check are unaffected.

### Version impact

`workflow-definition.v1` loses `side_effect_class` from `$defs/step`: from its `required` list and
from its `properties`. The `$defs/side_effect_class` enumeration stays, as the set the derived value
draws from and the one `policy-rule.v1` and the glossary share.

- **Mechanically, nothing is tightened.** `additionalProperties` stays open at every depth
  (`VERSIONING.md` section 6), so every document that validated before validates still, and a
  document carrying the member is refused by the compiler rather than by the schema.
- **Under R2 it is a removal, and removals are MAJOR.** The file stays `v1` because the contract has
  no producer and no consumer: no compiler exists, no definition has been authored, and nothing
  reads one. That is free today and stops being free at the first customer definition, which is the
  same argument `VERSIONING.md` section 6 makes for moving the schema base URI.

### What this does not decide

- **How the derived set is presented.** The compiled graph carries it and is never returned (C7), so
  the authoring surface has to render what an author no longer writes. That belongs to
  [`control-plane.md`](../10-architecture/control-plane.md) section 5 with the authoring surface.
- **Whether the Policy Decision records the whole set** or the members a rule matched on. N3
  requires the inputs used; what a Policy Decision holds is `audit-model.md`'s.
- **Whether an Agent Run has a Side-Effect Class of its own.** An Agent Run has no Steps
  (`policy-model.md` E4), and its admission evaluation is not a Step boundary. Nothing here gives
  one, and nothing needs one: every call is evaluated at the Tool enforcement point.
- **Any severity order over the five classes.** None exists, and the set makes one unnecessary: a
  rule matches a member rather than comparing magnitudes.
- **Whether a Policy may match on the set as a set** — membership, size, the whole of it — which is
  the Expression Profile's (ADR-0035).

### What this amends

- The glossary's *Step* and *Side-Effect Class* entries: *declares* becomes *carries* for a Step,
  and the Tool's declaration at registration stays as it is.
- `workflow-dsl.md`: L6 and the paragraph beneath it, the worked example in section 3 and the
  sentence listing what it leaves undecided, two rows of the section 5 table, and the section 11 row
  with the disposition paragraph that assigned the question here.
- `step-types.md`: the opening sentence, the section 2 diagram, the Side-Effect Class row of section
  4, rule S2, the `agent` and `tool` type sections, and two rows of section 13.
- `policy-model.md` rule N1: the Side-Effect Class row states that a delegating Step's input is a
  set.
- `execution-semantics.md` X15: the mandate's second soft edge closes, because only a `tool` Step
  can now carry one of the three classes that require a compensating action.
- `workflow-definition.v1`, as stated above.

## Rationale

**Option 1 is the one the language document already ruled out.** Section 11 of `workflow-dsl.md`
says the value must not become a self-issued exemption, and an accepted assertion is one — not
because it grants an exemption from evaluation, which E3 prevents, but because it feeds a primary
input a value nothing checked. A rule keyed on `financial` that a `read` label defeats is worse than
no rule, because it reads as a control in the Policy the Tenant wrote.

**Option 2 needs an order nobody has.** *The most consequential class it can reach* presupposes a
total order over `read`, `write`, `destructive`, `financial` and `external-communication`. No
document defines one, and inventing one here would be exactly the invention `policy-model.md`'s
preamble warns acquires an authority it was never given. A set needs no order, and loses nothing: a
delegation that can reach both a `financial` and an `external-communication` Tool is described by
both, and a single most-consequential value would have hidden one of them.

**Option 3 is the only one that makes the value true by construction.** ADR-0042 and ADR-0041 supply
what derivation needs — a declared ceiling and a pinned child — and neither existed when the
question was registered, which is why it could not be answered then. Derivation is also the option
that survives an author's mistake, and an author's mistake is the ordinary case: nobody writing
`read` on a delegation intends a false input.

**The author writes nothing, rather than restating.** A restatement checked against a derivation is
a value the author can only get wrong, and it costs a rejected publish to no purpose. It also keeps
a self-issued value in the document a customer's build asserts against, which is where the confusion
would return. The cost is real and stated below: a reviewer reading the definition no longer sees
that a Step is `financial`, which the authoring surface must show instead. The alternative — a
checked restatement — stays available, is additive under R2, and would be the first thing to try if
review proves harder than expected.

## Consequences

### Positive

- A Side-Effect Class is true by construction on every Step, so a rule keyed on one means the same
  thing wherever it matches.
- The sharp case closes: a delegation that can reach a `financial` Tool is seen as one at its own
  boundary, before the delegation begins.
- The constraint `workflow-dsl.md` section 11 set — never a self-issued exemption — is guaranteed
  rather than promised.
- An author has one fewer thing to get right, and one fewer way to weaken their own Policy.
- Two register rows close in `step-types.md`, with one in `workflow-dsl.md`: the meaning on the
  seven types, and whether a `tool` Step may restate the class at all.

### Negative

- **A definition no longer shows what a Step does.** A reviewer reading the document sees a type and
  a Tool name, not a class. Until the authoring surface renders the derived value, review is worse
  than it is today, and the compiled graph that carries it is never returned (C7).
- **A `subworkflow` Step's set is computed through a chain.** It depends on every pinned version
  below it, so a deep nesting makes the derived set harder for an author to predict, and the Control
  Plane has to explain where a member came from.
- **A set can be large and unspecific.** An Agent version that declares many Tools yields a set
  containing most of the enumeration, which a Policy keyed on `financial` then matches on every
  delegation. The answer is a narrower declaration, which is ADR-0042's ceiling doing its job, but
  the pressure lands on authors.
- **The derived set goes stale on re-registration.** A Tool re-registered with a different class
  leaves published versions carrying a set computed under the old one, correctable only by
  publishing again. The staleness is visible and nothing is under-enforced, but a stale input is
  still a wrong input at a Step boundary.
- **A removal from a wire schema.** It is free only while `workflow-definition.v1` has no producer
  and no consumer, and this record spends that freedom.

### Neutral / follow-on work

- Amend the documents listed above, and change *declares* to *carries* in the glossary's *Step*
  entry.
- Remove `side_effect_class` from `$defs/step` in `workflow-definition.v1`, keeping the enumeration.
- Specify how the Control Plane renders a derived class and a derived set, including where a set's
  members came from, with the authoring surface in `control-plane.md` section 5.
- Decide, with the Expression Profile, how a rule matches on a set.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| A reviewer cannot see a Step's class in the definition and approves a change they would have caught | Medium | High | The authoring surface renders the derived value, which is follow-on work this record names; until it does, the class is in the publication record with the compiled artifact |
| A delegating Step's set is so wide that Policies keyed on it gate everything | Medium | Medium | The set follows the version's declared Tools, so narrowing the declaration narrows the set (ADR-0042); the alternative is the `read` label that was never true |
| A published version's set is stale after a Tool is re-registered with a different class | Medium | Medium | Staleness is surfaced on the versions declaring the Tool, as ADR-0042 surfaces stale grants; every invocation is still evaluated with the registered class (TA9) |
| An author expects to declare a class and finds the publish rejected | High | Low | The compiler's diagnostic names the Step and the construct (C5), and the rejection is the point: nothing is warned and published |
| Removing the member proves premature once a first customer authors definitions | Low | High | The removal happens while nothing produces or consumes the schema; re-admitting a checked restatement later is additive under R2 |
| A `subworkflow` chain makes derivation expensive at publication | Low | Low | Every chain is finite and acyclic (ADR-0041), and compilation is a publication-time act, not a per-Run one |

## Revisit criteria

Reopen this decision in any of these cases:

- Review practice shows authors need the class visible in the document itself, which would admit the
  checked restatement of option 2 without disturbing the derivation.
- A step type is admitted whose class cannot be derived from its type or its pinned references,
  which its own ADR must then answer under the criteria `step-types.md` section 3 sets.
- Policies keyed on a delegating Step's set prove unusable in practice — too wide to discriminate —
  which would argue for a most-consequential value and the severity order it needs.
- A customer-authored definition exists, at which point the schema change stops being free and the
  question becomes one of migration rather than of shape.

## References

- [`../50-workflows/workflow-dsl.md`](../50-workflows/workflow-dsl.md) L6, L9, C1, C4, sections 5
  and 11: what a Step declares, who rejects an unrecognised construct, and the self-issued-exemption
  constraint
- [`../50-workflows/step-types.md`](../50-workflows/step-types.md) S1, S2, sections 4, 5 and 13: the
  class on the seven types that reach no Tool, and the `agent` Step as the sharp case
- [`../40-governance/policy-model.md`](../40-governance/policy-model.md) N1, E1, E3 and E4: the
  class as a primary input, and why coverage is never narrowed by it
- [`../40-governance/tool-authorization.md`](../40-governance/tool-authorization.md) TA9: the
  registered class is authoritative at evaluation
- ADR-0042: a version declares the Tools it may call, as a ceiling frozen at publication
- ADR-0041: an `agent` or `subworkflow` Step's version is pinned at publication, and every chain of
  nesting is finite
- [`workflow-definition.v1`](../30-protocol/schemas/workflow-definition.v1.schema.json) and
  [`../VERSIONING.md`](../VERSIONING.md) R2, R3 and section 6: what the schema may change, and what
  it costs
- [ADR-0008](adr-0008-declarative-workflow-definitions.md) and
  [ADR-0005](adr-0005-langgraph-as-compilation-target.md): the declarative language, and compilation
  as the governance mechanism
