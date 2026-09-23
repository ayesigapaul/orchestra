---
title: "ADR-0035: Policies and Workflow expressions are written in CEL behind an Orchestra profile, and matching Policies combine by verdict, never by order"
adr_id: ADR-0035
status: Accepted
date: 2026-09-13
deciders: [product-owner, platform-architecture]
consulted: []
informed: []
supersedes: []
superseded_by: []
tags: [governance, workflows, protocol, security, interoperability]
depends_on: [ADR-0011, ADR-0012, ADR-0013, ADR-0014, ADR-0020, ADR-0034]
---

# ADR-0035: Policies and Workflow expressions are written in CEL behind an Orchestra profile, and matching Policies combine by verdict, never by order

## Status

Accepted.

## Context

[`policy-model.md`](../40-governance/policy-model.md) section 9 registers the policy language, how
thresholds are expressed, and rule precedence as needing an ADR, and calls them three faces of a
single choice. Beside them sit two more rows: whether Tenant-scoped and Workspace-scoped Policies
compose, and whether a Policy may depend on aggregate state.
[`workflow-dsl.md`](../50-workflows/workflow-dsl.md) section 11 registers the expression language
for predicates, data references and `transform` bodies, and asks whether it is the same language.
Every row waits on the others, and so do the schemas: `policy-rule.v1` leaves `match`
unconstrained, and `workflow-definition.v1` treats every expression as notation.

Six facts bear on the choice.

- **Only the predicate is open.** `policy-rule.v1` already fixes a rule's scope — a Tenant and an
  optional Workspace — its enforcement points and its verdict, from a closed set of three (P3).
- **Determinism is a requirement.** The same inputs MUST produce the same verdict, no model may sit
  in the evaluation path, and any input outside N1's table is recorded (D4, N3). Precedence has to
  be specified before overlapping rules may exist (D4), and P4 says a decision names at most one
  Policy version.
- **No customer code.** A definition contains no executable code (`workflow-dsl.md` L1), and
  `policy-model.md` section 8 excludes a general-purpose evaluator on every enforcement path.
- **Evaluation code is duplicated per service.**
  [ADR-0020](adr-0020-monorepo-with-enforced-service-boundaries.md) rule B5 shares no runtime
  library, and Orchestra runs Python services and TypeScript services
  ([`tech-stack.md`](../10-architecture/tech-stack.md) section 1).
- **A decision now commits with what it gates.**
  [ADR-0034](adr-0034-policy-decisions-commit-with-the-gated-change-and-leave-by-outbox.md) writes a
  Policy Decision in the enforcing service's own transaction, which is a place a running total can
  be read and reserved without a race. [`step-types.md`](../50-workflows/step-types.md) section 9
  shows the race a `parallel` Step creates without one.
- **CEL is a published predicate language.** The
  [Common Expression Language](https://github.com/cel-expr/cel-spec) is developed by Google under
  an open governance model whose Language Council approves changes to syntax and semantics, and is
  released under Apache-2.0 in versioned releases. Its
  [language definition](https://github.com/cel-expr/cel-spec/blob/master/doc/langdef.md) makes an
  expression terminating and side-effect-free, gives it no syntax for defining a function, and
  leaves extension functions to the host. Its repository carries the conformance tests
  implementations run. [Kubernetes](https://kubernetes.io/docs/reference/using-api/cel/) evaluates
  it in its API server, and bounds an expression's cost when it is written and again when it runs.

## Decision drivers

- A verdict that is a function of its inputs, with nothing in the path that could argue for another.
- Evaluation that always terminates, has no side effects and runs within a bound, at every Step.
- No customer code and no function a Tenant can define.
- A permanent public contract carrying Orchestra's own version, not a promise Orchestra cannot keep.
- One language to defend and one evaluator to secure per service language, not two.
- No verdict that depends on the order in which rules were written.
- Delegated administration that can add a control and never remove one.
- A spend threshold that two concurrent branches cannot both pass.
- A decision that explains itself without being evaluated again (D5).

## Considered options

### The language of a Policy's conditions

1. **CEL behind an Orchestra-versioned profile**, as the predicate inside the existing envelope.
2. **An Orchestra-defined predicate schema.**
3. **A full policy language**: Cedar, OPA's Rego, or XACML.

A general-purpose evaluator is excluded by `policy-model.md` section 8 and `workflow-dsl.md` L1.

### Precedence when several rules match

1. **Order-independent.** Any `deny` wins; otherwise any `require_approval` wins, and every matching
   rule's Approval Chain is required; otherwise `allow`; no match is `deny`.
2. **Most restrictive wins, with one deciding Policy chosen by tie-break.**
3. **Priority order, first match wins.**

### Workflow expressions

1. **No expression language**: structured comparisons only.
2. **An Orchestra restricted declarative form.**
3. **The same CEL profile as Policies.**

### Tenant and Workspace Policies

1. **Evaluated together under the same precedence.**
2. **A Workspace Policy overrides a Tenant Policy.**
3. **An `allow` needed at both scopes.**
4. **Tenant-scoped Policies only.**

### Aggregate state

1. **None.**
2. **Platform-defined aggregates only**, each read and reserved in the decision's own transaction,
   with the value used recorded as an input.
3. **Rules that query history directly.**
4. **Aggregates computed asynchronously.**

## Decision

We chose CEL behind an Orchestra-versioned profile, order-independent precedence, the same profile
for Workflow expressions, Tenant and Workspace Policies evaluated together, and platform-defined
aggregates only.

**The Expression Profile.** The profile is Orchestra's own document, with its own semantic version.
It pins a CEL specification release and re-exports none of CEL's promises. It fixes the inputs an
expression may read, named in Orchestra's vocabulary and never a rail's; the functions and macros
admitted; and the bound on evaluation cost. It admits no user-defined function: CEL has no syntax
for one, a Tenant cannot register one, and Orchestra adds a function only in a profile version.
Every admitted function is side-effect-free and deterministic, and the evaluation time is an input
recorded like any other (N3).

**A published version keeps its profile.** A Policy version or a Workflow version is checked at
publication against the profile version in force, and is evaluated under that profile major for its
whole life. A new profile major never alters a published version
([`VERSIONING.md`](../VERSIONING.md) W1, `policy-model.md` P5), as W5 keeps a Tool schema's new
major from altering a published Workflow version.

**A rule's `match` is one CEL expression** under the profile, yielding a boolean. Publication
refuses a rule that does not parse, does not type-check against the profile's inputs, or exceeds
the cost bound.

**An error is not a non-match.** An expression that raises an error — an absent field, a type
mismatch, an overflow, the cost bound reached — does not make its rule a non-match. The evaluation
has not completed, and A3 forbids `allow`, so an absent or malformed value never selects the more
permissive branch (S2). Inside one expression, CEL's own rules for `&&` and `||` apply.

**Precedence is order-independent.** A rule matches when its scope applies to the evaluation and
its `match` yields true. Over every matching rule:

- any `deny` wins;
- otherwise any `require_approval` wins, and the Approval Chain requires the chain of every matching
  `require_approval` rule;
- otherwise the verdict is `allow`;
- and no matching rule means `deny` (A1).

The verdict is a function of which rules match, never of their order, and `policy-rule.v1` has no
member that orders rules. The Policy Decision names every matching Policy version with the verdict
each contributed, so the record explains itself without evaluating anything again (D5), and P4 is
replaced. A failed precondition still denies and names no Policy (A4), and an `approval` Step's
boundary still never returns `allow` (V4). How a rule names its chain, and what satisfies a chain,
stay with [`approval-workflows.md`](../40-governance/approval-workflows.md).

**Tenant and Workspace Policies are evaluated together.** A Policy has a Tenant reference and may
have a Workspace reference (P2). An evaluation considers the Tenant's Policies that name no
Workspace and those that name the evaluation's Workspace, from the versions the Run pinned (P6), all
under the precedence above. A Workspace Policy can add a `deny` or a gate, and never removes a
Tenant's: its `allow` permits only what no matching Tenant rule refuses or gates.

**Workflow expressions use the same profile.** A `condition` predicate, a data reference and a
`transform` body are Expression Profile expressions: a reference is field selection, and a transform
is map and list construction. The compiler checks each at publication, as it checks every construct
(`workflow-dsl.md` L9 and C3). A predicate that raises an error is a contained fault and never
selects a branch ([`reliability.md`](../60-operations/reliability.md) F12). The profile's macros
over finite lists, such as `map` and `all`, terminate within the cost bound and repeat no Step, so
they are not the iteration `workflow-dsl.md` L11 forbids.

**Aggregates are the platform's.** A Policy reads only an aggregate the platform defines, and a rule
can neither define nor query one of its own. Which aggregates exist, and what each totals over which
scope and period, is the profile's, so adding one is a profile change. The enforcing service reads
and reserves an aggregate in the transaction that writes the decision (ADR-0034): the proposed
action's contribution is added before the commit, and the value read is recorded among the
decision's inputs (N3). The branches of a `parallel` Step therefore take turns on the aggregate, and
neither decides on a total that leaves out the other. An aggregate is kept by the service that
commits the decisions it counts, because a total held by another service cannot be read inside that
transaction (ADR-0020 rule B4). A reservation is never released on an outcome that is unknown,
since unknown is not the same as not done
([`execution-semantics.md`](../50-workflows/execution-semantics.md) X9). When it is released
otherwise — on a refusal, a rejected gate or a compensated action — is not decided here.

**Evaluators pass CEL's conformance tests.** Each enforcing service evaluates with a third-party CEL
evaluator for its own language, pinned exactly and never shared (ADR-0020 rule B5). An evaluator
that does not pass CEL's conformance tests is not used, in Python or in TypeScript. No evaluator is
chosen here.

**Evaluation runs in process.** A Policy reads only its inputs, and aggregates in the transaction of
its own decision, so each enforcing service evaluates in process, over the Policy versions the Run
pinned, and no decision service exists. [`data-plane.md`](../10-architecture/data-plane.md) section
11 classifies that choice as a document once evaluation needs no datastore access of its own, so it
is recorded there rather than in a record of its own.

### What this amends

- `policy-model.md`: P4 is replaced; P2, P5, V2, N3, D2, D4, S2 and sections 6, 7 and 8 record the
  decision; section 9's rows for the language, thresholds, precedence, scope composition, aggregate
  state and where evaluation executes are discharged.
- `audit-model.md` A4 and sections 3, 4 and 8, `tool-authorization.md` section 9, `domain-model.md`
  section 6 with its Policy-scope row in section 11, and the glossary's Policy Decision entry,
  beside a new entry for the Expression Profile.
- `workflow-dsl.md` sections 3, 5, 8 and 11, `step-types.md` sections 8, 9, 11 and 13,
  `reliability.md` F12, the workflows section's README and the worked examples.
- `policy-rule.v1`, `audit-record.v1`, `approval-request.v1` and `workflow-definition.v1`, and
  `schemas/README.md`.
- Evaluation in process: `data-plane.md` sections 2, 5 and 11, `containers.md` sections 2, 3, 5 and
  12, `system-context.md` sections 6 and 7, and `deployment-topologies.md` sections 6, 7, 11 and 12.
- `threat-model.md` T1 and section 14, `approval-workflows.md` C1, `tech-stack.md`,
  `testing-strategy.md`, `product-thesis.md`, `vision.md`, `compliance-roadmap.md` and
  `mvp-definition.md`.

## Rationale

**CEL fits the envelope that already exists.** `policy-rule.v1` leaves only a predicate open, and
CEL is a predicate language: an expression computes one value from its inputs, terminates, has no
side effects and cannot define a function. D4 and L1 then hold by construction rather than by
review. A published specification behind an Orchestra-versioned profile is the shape
[ADR-0004](adr-0004-adopt-ag-ui-event-protocol.md) and [ADR-0010](adr-0010-a2ui-genui-interchange.md)
propose for other contracts, and a pinned third-party evaluator in each service is what ADR-0020
rule B5 allows. That Kubernetes bounds CEL's cost in production shows the bound can be enforced.

**An Orchestra predicate schema would be defended forever.** Every addition would look small, and
under rule B5 its evaluator would be written again in every enforcing service, in each language,
tested against no suite but Orchestra's own.

**A full policy language brings an effect model of its own.** Cedar, Rego and XACML each decide
with their own effects, which collide with the closed set of three verdicts (P3). None has
`require_approval`, and XACML could only approximate it with obligations. Two verdict models inside
one decision is one too many.

**Order-independent precedence makes the verdict a function of the matching set.** It is XACML's
deny-overrides with a middle verdict. No authoring order can make a matching Policy ineffective, and
a second matching gate is never dropped, as it would be under a tie-break. A first-match rule makes
the verdict depend on an authoring history nobody reviews, which D4 cannot accept.

**One language serves Workflows too.** `workflow-dsl.md` section 8 puts it plainly: one language is
one surface to defend and one evaluator to secure. Structured comparisons alone are the likeliest to
fail a real process and push the pressure onto the escape hatch, and an Orchestra form costs what an
Orchestra predicate schema costs.

**Evaluating both scopes together needs no second rule.** It follows from the precedence, and it
matches [`identity-and-access.md`](../10-architecture/identity-and-access.md) section 4: narrowed to
a Workspace, never widened beyond the Tenant. A Workspace override would let a delegated
administrator weaken a Tenant's control, an `allow` at both scopes would have Tenant administrators
author every Workspace `allow`, and Tenant-only Policies would end delegated policy administration.

**Platform-defined aggregates keep D4 and close the race.** N3 already requires the value used to be
recorded, and reserving it in ADR-0034's transaction makes concurrent decisions take turns. With no
aggregates, a payment split below a threshold passes. Rules that query history would give the
evaluator datastore access and put a query in every rule. Asynchronous totals would let two
branches both pass.

## Consequences

### Positive

- Every verdict is a function of recorded inputs, with no model, no rule order and no unbounded
  evaluation in the path.
- One language, under one versioned profile, across Policies and Workflows, with a published
  specification and conformance tests behind it.
- A decision records every Policy version that shaped it, and the verdict each contributed.
- Workspace administration can add controls and cannot remove a Tenant's.
- A spend threshold is expressible without a race.
- Evaluation needs no service of its own and no network hop.

### Negative

- **Two evaluators must agree exactly.** Python and TypeScript evaluators must return the same result
  for the same inputs, including where implementations are known to drift: CEL's regular expressions
  follow RE2 syntax, which neither language's native engine is, and overflow and time handling are
  easy to get subtly wrong. Conformance tests are necessary and not sufficient.
- **A cost bound measured differently would break determinism.** If each evaluator counted cost its
  own way, the same inputs could pass in one service and fail in another, so the profile must define
  the measure itself.
- CEL has no decimal type, so an amount has to be represented so that comparison is exact.
- CEL's specification is governed outside Orchestra. Orchestra pins a release and adopts a change only
  in a profile version of its own.
- Every decision that reads an aggregate waits on one row, the contention
  [ADR-0019](adr-0019-postgres-run-supervisor.md) already warns of.
- `approval-request.v1` carries one chain with one mode, and cannot yet show the chains of several
  matching rules.
- A fix to an evaluator rolls out to every enforcing service, and a partly rolled-out fleet is a
  correctness problem.
- A Workspace `allow` can permit what no Tenant rule mentions, so a Tenant that must forbid
  something writes a Tenant `deny`.
- Constraining `match` to a string in `policy-rule.v1` would tighten an existing constraint, which
  [`VERSIONING.md`](../VERSIONING.md) section 6 forbids in place, so publication rather than the
  schema checks a rule.

### Neutral / follow-on work

- Specify the Expression Profile in `docs/30-protocol/`: the pinned CEL release, the inputs, the
  functions and macros, the cost measure and bound, and how an amount with its ISO 4217 currency and
  a time with its RFC 3339 form and IANA time zone are represented. CEL's duration strings are not
  ISO 8601 durations, and the profile says which form an author writes.
- Choose an evaluator for Python and one for TypeScript, pin each in `tech-stack.md` section 1.1, and
  run CEL's conformance tests against both before either evaluates anything. Each must be a **stable
  release**, which `tech-stack.md` section 1.1 requires, and the maturity of each candidate is
  checked against its registry rather than remembered: the TypeScript candidate nearest to hand,
  `@bufbuild/cel`, published 0.6.1 as its latest release on 2026-09-23, so its interface may still
  change before it reaches 1.0.
- Publish the profile's own conformance cases beside it in `docs/30-protocol/`, errors and the cost
  bound included, as contract data every enforcing service runs in its own tests (ADR-0020 rules B3
  and B5).
- Record the profile among the artefacts `VERSIONING.md` versions.
- Define the first aggregates, and when a reservation is released.
- Settle how a `require_approval` rule names its chain, and how one Approval Request records the
  chains of several rules, with the decision on what satisfies a chain.
- Decide how a definition document marks a value as an expression rather than a literal
  (`workflow-dsl.md` section 11).

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| The Python and TypeScript evaluators disagree on a result | Medium | High | Both run CEL's conformance tests and the profile's own cases; the profile admits a function only once both agree on it |
| No evaluator in one language passes CEL's conformance tests | Medium | High | None is used until one does; the revisit criteria name an Orchestra predicate schema as the fallback |
| Evaluators count cost differently, so a bound passes in one service and fails in another | Medium | High | The profile defines the cost measure, and its conformance cases include the bound |
| An amount compared as a binary floating-point number misjudges a threshold | Medium | High | The profile represents amounts so that comparison is exact, with their ISO 4217 currency |
| A change to CEL alters a result a published version relies on | Low | High | The profile pins a CEL release; a published version keeps its profile major |
| Aggregate reservation serialises decisions until throughput suffers | Medium | Medium | Aggregates are few and platform-defined; contention is measured before the first production load |
| A Workspace `allow` permits what the Tenant meant to forbid | Medium | Medium | A Tenant `deny` wins over any Workspace rule; administration surfaces show which rules match |
| An expression error is read as a non-match and allows | Low | High | The profile makes an error an incomplete evaluation, and conformance cases include errors inside `deny` rules |

## Revisit criteria

Reopen this decision in any of these cases:

- No Python or TypeScript evaluator can be made to pass CEL's conformance tests with the profile's
  functions, which would return an Orchestra predicate schema to consideration.
- CEL changes a semantic the profile relies on in a way a pinned release cannot hold off.
- A design partner needs a condition the profile cannot express without a user-defined function.
- Contention on aggregates is measured to bound governed throughput.
- A Policy needs an aggregate that spans services.

## References

- [`../40-governance/policy-model.md`](../40-governance/policy-model.md) P2 to P6, N1, N3, A1 to A4,
  D2 to D5, S2 and sections 8 and 9: the envelope, determinism and the register this discharges
- [`../50-workflows/workflow-dsl.md`](../50-workflows/workflow-dsl.md) L1, L9, L11 and section 8, and
  [`../50-workflows/step-types.md`](../50-workflows/step-types.md) section 9: expressions and the
  `parallel` race
- [ADR-0012](adr-0012-policy-decisions-are-audit-records.md): Policy versions referenced, never
  embedded
- [ADR-0034](adr-0034-policy-decisions-commit-with-the-gated-change-and-leave-by-outbox.md): the
  transaction an aggregate is reserved in
- [ADR-0020](adr-0020-monorepo-with-enforced-service-boundaries.md) rules B3 to B5: contracts, data
  ownership and duplicated evaluation code
- [CEL specification](https://github.com/cel-expr/cel-spec),
  [language definition](https://github.com/cel-expr/cel-spec/blob/master/doc/langdef.md),
  [governance](https://github.com/cel-expr/cel-spec/blob/master/GOVERNANCE.md) and
  [conformance tests](https://github.com/cel-expr/cel-spec/tree/master/tests/simple)
- [CEL in Kubernetes](https://kubernetes.io/docs/reference/using-api/cel/): cost bounds at write
  time and at evaluation
