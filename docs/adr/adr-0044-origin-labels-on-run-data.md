---
title: "ADR-0044: Every value in a Run's data carries origin labels, they propagate through references and transforms, and Policy reads them"
adr_id: ADR-0044
status: Accepted
date: 2026-09-13
deciders: [product-owner, platform-architecture]
consulted: []
informed: []
supersedes: []
superseded_by: []
tags: [governance, security, workflows, protocol]
depends_on: [ADR-0001, ADR-0003, ADR-0008, ADR-0012, ADR-0035]
---

# ADR-0044: Every value in a Run's data carries origin labels, they propagate through references and transforms, and Policy reads them

## Status

Accepted.

## Context

[`threat-model.md`](../40-governance/threat-model.md) T1 states the residual of prompt injection
exactly: *everything the Agent may do without a gate is available to an injection*. Its sharpest
variant is capability chaining — the injected text has the Agent call a permitted `read` Tool and
place the result into the argument of a permitted `external-communication` Tool. No single action is
denied, and the composition is exfiltration.

Policy is the control (working rule 5, [`policy-model.md`](../40-governance/policy-model.md) S1 to
S4), and rule S2 already lets a Policy match on the arguments of a proposed action. What it cannot
do today is tell one argument from another by where the value came from. A payee written into a
Workflow definition, a payee typed by an End User and a payee lifted out of a supplier's PDF reach
the enforcement point as the same string. [`step-types.md`](../50-workflows/step-types.md) section
11 names the case that makes this sharp: a `transform` Step can lift an untrusted string into a
field a later Step treats as trusted, and the platform records nothing that would let a Policy
notice.

One provenance mechanism exists and is narrower than it looks.
[`approval-workflows.md`](../40-governance/approval-workflows.md) E6 requires each Evidence Set item
to record its origin and whether it is content the Agent read or text the Agent authored. That is a
property of what an approver is shown, at a gate that has already been raised. It is not an
evaluation input, and it exists only where a `require_approval` verdict was reached — which is
precisely not the chaining case, where every step is permitted.

The question has been registered in five places as one question:
[`policy-model.md`](../40-governance/policy-model.md) section 9,
[`threat-model.md`](../40-governance/threat-model.md) section 14,
[`step-types.md`](../50-workflows/step-types.md) section 13,
[`event-protocol.md`](../30-protocol/event-protocol.md) section 11 and
[`ui-protocol.md`](../30-protocol/ui-protocol.md) section 10 with rule UA6. Each classifies it as an
ADR **if it reaches a public contract**, and a later document otherwise. Two facts bound any answer.

- **The event profile carries no provenance in v1**, and rule C2 of `event-protocol.md` makes a
  change to what the profile promises a MAJOR one. Nothing consumes the profile yet, and R3's
  must-ignore rule means a member added later costs a consumer nothing.
- **A Policy now has somewhere to read an input.** ADR-0035 fixes the expression language and, with
  it, an Expression Profile whose input set is Orchestra's own versioned document. Before that
  decision an evaluation input had no place to be named.

Orchestra is pre-implementation: no Run has executed, no Policy has been authored, and no Tool has
been registered, so nothing is retrofitted by deciding now.

## Decision drivers

- T1's invoice case needs an input Policy can key on. A defence that depends on the model preserving
  a marking is not a control (T1's first control, S4).
- No control may rest on model output being trusted, whatever the surrounding text asserts (S1).
- An evaluation input must be recordable (N3) and deterministic (D4), or the Policy Decision stops
  being reconstructible.
- The label must survive a `transform`, which is where the platform would otherwise launder it.
- A permanent public contract is not widened for a consumer that does not exist (R2, R3, C2).
- A choice that stays cheap to reverse before the first customer (working rule 8).

## Considered options

1. **Nothing beyond Evidence Set item provenance.** E6 stays the whole answer. A Policy cannot tell
   an argument lifted from a supplier's PDF from one a Platform User wrote, and the chaining variant
   of T1 has no control aimed at it.
2. **Origin labels on Run data.** Every value carries where it came from; labels propagate through
   data references and `transform` bodies; Policy receives them as an evaluation input. Nothing is
   added to the event stream.
3. **Option 2, plus marking inside the model's context treated as a control.** T1 forbids relying on
   a marking the model is free to drop, reorder or restate.
4. **Option 2, plus labels on the public event profile.** A change to a permanent contract, made for
   no consumer, and MAJOR under C2 if the profile is to promise it.

## Decision

The product owner chose option 2.

### Every value in a Run's data carries a set of origin labels

A value in a Run's data carries a non-empty set of origin labels, drawn from a closed set of six.

| Origin label | What it marks |
| --- | --- |
| Admission input | A value the Run was admitted with |
| Definition literal | A value written into the Agent or Workflow version the Run pinned |
| Tool result | Content returned by a Tool invocation |
| Retrieved content | Content fetched into the Run for the model to read, rather than as a Tool's result |
| Model output | Anything a model produced |
| UI Action text | Free text carried by a UI Action ([`ui-protocol.md`](../30-protocol/ui-protocol.md) UA6) |

The set is closed: adding a label is a change to the Expression Profile's input set, on that
profile's terms (ADR-0035), and never something a Tenant, a definition or a model can do. How a
label is spelled, and the grain a value is labelled at, belong to the Expression Profile
specification and to the type system `workflow-dsl.md` section 11 registers; the rule is stated over
values so that it holds whatever grain that decision takes.

### Labels propagate, and the model neither preserves nor launders them

- A data reference carries the labels of the value it refers to.
- A `transform` output carries the union of the labels of every value its expression reads. This is
  the case `step-types.md` section 11 named: a transform moves a value, and it moves the value's
  origins with it.
- A Tool invocation's result carries *Tool result*, whatever its arguments carried. The result is
  new content from the origin, not a derivation of what was sent.
- **A model's output carries *Model output*, and only that.** Passing a value through a model
  neither launders it nor preserves what it was: the output is untrusted by construction, so what
  went into the context adds nothing a Policy could rely on. This is what keeps the mechanism from
  depending on the model, which is the failure options 3 and 4 of T1's control list are written
  against.

A label says where a value came from. It never says a value is safe, and no label is *trusted*: what
each origin is worth is the Tenant's Policy to decide.

### Policy receives the labels as an evaluation input

The origin labels of the proposed action — of its arguments, and of the data it references — are an
evaluation input at every Policy Enforcement Point, added to `policy-model.md` rule N1. In the
Expression Profile they are inputs an expression may read, so *a payment whose payee came from a
Tool result requires a human* is a rule a Tenant can write. Like every other input they are recorded
in the Policy Decision (N3, D2), so the decision stays reconstructible.

Nothing about enforcement changes. Every Step is evaluated whatever its class or its labels (E3),
every Tool invocation crosses its enforcement point (E1, E4), and a label is an input to the verdict
rather than a precondition for evaluating one.

### The public event profile is unchanged

No origin label is added to `agent-event.v1`, to the Orchestra profile
([`event-protocol.md`](../30-protocol/event-protocol.md)) or to
[`ui-protocol.md`](../30-protocol/ui-protocol.md). The labels are an evaluation input and an audit
input, not a wire fact for a renderer. Adding one later is MINOR under R2 and costs a consumer
nothing under R3, so the reversible direction is to add nothing now.

### Marking inside the model's context stays defence in depth

Delimiting or labelling untrusted content inside a model's context MAY be done. It MUST NOT be
relied upon, and MUST NOT be recorded as the mitigating control for any threat — the rule T1 already
states of better prompting, applied to the same idea in another form. That answers the register rows
that ask whether untrusted content carries provenance *inside the model context*: it may, and it is
never a control.

### What this does not decide

- **How a label is represented**, and whether a value's labels are addressable as one input or
  several. That is the Expression Profile specification's, with the type system.
- **The grain of a labelled value** — a document, a field or a scalar — which follows the type
  system `workflow-dsl.md` section 11 registers.
- **Whether a Policy may require an origin**, and how such a rule is written. A rule is written in
  the profile's language, and `policy-model.md` section 9 keeps the unverifiable-value question.
- **Whether labels reach the Evidence Set** beyond the item provenance E6 already requires.
- **Whether labels ever reach the event profile or the UI protocol.** Both stay registered, and both
  would be additive.
- **Whether a value reaching Orchestra through a Connector is labelled more narrowly** than *Tool
  result*, which waits on ADR-0007 binding.

### What this amends

- `policy-model.md`: rule N1 gains an origin-labels input, S2 records what the labels supply, and
  the provenance row in section 9 is discharged and narrowed to what stays open.
- `threat-model.md`: T1 gains the labels among its controls and states the residual they narrow, and
  its section 14 row is discharged.
- `step-types.md`: the `transform` boundary cell in section 11 states what a transform now carries,
  and the section 13 row is discharged.
- `event-protocol.md` section 11 and `ui-protocol.md` UA6 and section 10 record that the labels
  exist and that neither contract carries them.
- The glossary gains *Origin label*.
- `policy-rule.v1`'s `match` annotation lists the new input. No schema validates differently.

## Rationale

**Option 1 leaves T1's chaining variant with no control aimed at it.** E6 is a property of a gate,
and chaining is the case where no gate is raised. It is worth keeping and it is not an answer.

**Option 2 puts the defence where working rule 5 puts it.** The invoice case in `policy-model.md`
section 7 turns on the enforcement point having a fact the model cannot argue past. *This payee came
from a supplier's document* is such a fact: the platform observed it, the model did not assert it,
and it survives the `transform` that would otherwise have hidden it. It also costs nothing in
coverage, because E3 already evaluates every Step and E1 every Tool invocation; the labels make an
existing evaluation sharper rather than adding a control to be maintained.

**Option 3 is the mistake T1 already names.** A marking inside the context is text among text. The
model may drop it, restate it, or be instructed by the injected content to ignore it. Recording it
as a control would be recording better prompting as a control, which T1 forbids in those words.
Keeping it as defence in depth costs nothing and promises nothing.

**Option 4 spends a permanent contract on no consumer.** The profile carries no provenance in v1, C2
makes the promise expensive to change, and R3 means adding the member the day a consumer needs it
breaks nobody. Deciding not to publish is the reversible direction; publishing is not.

**The model neither preserves nor launders.** The alternative — carrying the labels of a model's
context into its output — would be a claim about what the model did with the content, which is the
class of claim S1 refuses. Labelling every model output *Model output* says only what the platform
observed, and it is the conservative reading: a value that passed through a model is untrusted
whatever went in.

## Consequences

### Positive

- A Tenant can write the rule T1's invoice case needs, keyed on where a value came from rather than
  on what the model says about it.
- A `transform` no longer hides an untrusted value's origin, which was the specific gap
  `step-types.md` section 11 recorded.
- The chaining variant of T1 becomes addressable: a rule can gate an `external-communication` Tool
  whose arguments carry *Tool result* or *Retrieved content*.
- The Policy Decision records the labels it saw, so a dispute about why an action was gated is
  answerable from the record (D2, N3).
- No public contract changes, and adding the labels to one later stays additive.

### Negative

- **Every value carries a set.** Run data acquires a property that every component moving data has
  to carry correctly. A component that drops the labels degrades a control silently, which is the
  failure mode this decision otherwise avoids: the conformance suite has to test propagation, and
  nothing in a schema enforces it.
- **A label is not a taint proof.** Labels record origins the platform observed. A value that leaves
  the platform and returns through a Tool comes back as *Tool result* with its earlier origins gone,
  so a determined chain can still shed a label by round-tripping through a permitted `write` Tool.
- **Rules keyed on labels are only as good as their author.** A Tenant that writes none is exactly
  where it was, and T1's residual — the ungated capability set — is unchanged for them.
- **A model output cannot be distinguished by what it read.** Treating every model output alike is
  conservative, and it means a Policy cannot tell a summary of a trusted record from a summary of an
  attacker's PDF.
- **A new evaluation input to keep recordable.** N3 requires the values used to be captured, so a
  Policy Decision grows by whatever the labels of the referenced data amount to.

### Neutral / follow-on work

- Amend the documents listed above, and add *Origin label* to the glossary.
- Name the labels and their grain in the Expression Profile specification, with the type system.
- Test propagation through references, `transform` bodies, Tool results and model outputs in the
  conformance suite; a dropped label has no other detector.
- Decide, when a consumer exists, whether the event profile or the approval surface carries the
  labels.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| A component drops or resets a label, and a rule keyed on it silently stops matching | Medium | High | Propagation is a conformance requirement with tests; the labels are recorded in the Policy Decision, so a decision that saw the wrong set is visible after the fact |
| A label is read as a trust decision — *definition literal* taken to mean safe | Medium | Medium | The labels record origin only; the glossary entry and N1 say so, and no default rule is shipped that treats any origin as trusted |
| An attacker launders an origin by round-tripping a value through a permitted Tool | Medium | High | Each invocation still crosses its own enforcement point with the Tool's registered class; the residual is stated in T1 rather than mitigated |
| A Tenant writes no rule keyed on labels and believes the mechanism protects them | High | Medium | T1 keeps its residual — the ungated capability set — and the labels are an input a Policy may match, never an enforcement of their own |
| The labels are expected on the event stream by a customer integration | Low | Medium | The profile promises none in v1 and says so; adding one is MINOR under R2 and must-ignore under R3 |
| The Policy Decision grows large where a rule references much labelled data | Medium | Low | N3 requires the values used, not the whole of the Run's data; what a Policy Decision holds is `audit-model.md`'s |

## Revisit criteria

Reopen this decision in any of these cases:

- A design partner's process needs a distinction the six labels cannot express, which would be a
  change to the Expression Profile's input set rather than to this record.
- A consumer of the event profile or the approval surface needs the labels, which makes option 4's
  addition worth its cost.
- Propagation proves unimplementable at the grain the type system chooses, so that the labels are
  present but unreliable — which would be worse than not having them.
- Evidence appears that in-context marking survives adversarial content reliably enough to be a
  control, which would be a change to T1 rather than to this record alone.

## References

- [`../40-governance/threat-model.md`](../40-governance/threat-model.md) T1 and section 14: prompt
  injection, capability chaining, and why better prompting is not a control
- [`../40-governance/policy-model.md`](../40-governance/policy-model.md) N1, N3, S1 to S4, E1, E3,
  E4 and section 7: the evaluation inputs, and why the decision is not the model's to make
- [`../50-workflows/step-types.md`](../50-workflows/step-types.md) section 11: a `transform` lifting
  an untrusted string into a field a later Step trusts
- [`../40-governance/approval-workflows.md`](../40-governance/approval-workflows.md) E2, E5 and E6:
  Evidence Set item provenance, and why it is not an evaluation input
- [`../30-protocol/event-protocol.md`](../30-protocol/event-protocol.md) C2 and section 11, and
  [`../30-protocol/ui-protocol.md`](../30-protocol/ui-protocol.md) UA6 and section 10: the public
  contracts that carry no provenance in v1
- ADR-0035: the Expression Profile, whose input set the labels join
- [`../VERSIONING.md`](../VERSIONING.md) R2 and R3: why adding to a contract later is cheap and
  promising now is not
- [ADR-0003](adr-0003-governance-layer-positioning.md): Policy Enforcement Points as the Data
  Plane's centre
