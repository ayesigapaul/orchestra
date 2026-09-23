---
title: Workflow Definition Language
doc_id: DOC-061
version: 0.20.0
status: Draft
last_updated: 2026-09-23
owners: [platform-architecture]
depends_on: [ADR-0003, ADR-0005, ADR-0008, ADR-0011, ADR-0042]
---

# Workflow Definition Language

This document is **informative** under [`../README.md`](../README.md) section 3, which makes
[`../30-protocol/`](../30-protocol/) and [`../40-governance/`](../40-governance/) normative and
everything else informative *unless it says otherwise*.
[`../VERSIONING.md`](../VERSIONING.md) says otherwise on its first line, and this document leans on
it harder than on anything else. The language is nonetheless a permanent public contract:
[ADR-0008](../adr/adr-0008-declarative-workflow-definitions.md) accepts that outright, and
[`../VERSIONING.md`](../VERSIONING.md) section 8 calls customer-authored workflows the platform's
most dangerous versioning problem. [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) keywords
therefore bind where this document specifies the language or the semantics of compilation, and are
used sparingly where another document owns the rule.

Where a governance rule binds this language it is cited, never restated:
[`../40-governance/policy-model.md`](../40-governance/policy-model.md) owns Policy Enforcement
Points, [`../40-governance/approval-workflows.md`](../40-governance/approval-workflows.md) approval
routing, [`../40-governance/tool-authorization.md`](../40-governance/tool-authorization.md) grants,
[`../40-governance/audit-model.md`](../40-governance/audit-model.md) what publication records.
Per-type semantics belong to `step-types.md`, run-time semantics to `execution-semantics.md`.

Orchestra is pre-implementation and pre-customer. **No timeout, retry count, backoff figure, step
limit, nesting depth, payload size or retention period appears here. None has been decided.**

## 1. What a Workflow definition is

A **Workflow** is a versioned, declarative graph of Steps defining a business process
([`../GLOSSARY.md`](../GLOSSARY.md)). Steps may be deterministic or agentic. What a customer authors
is a *definition document*; what executes is a *compiled graph*. Never the same artifact, and only
the first is a contract.

**L1 — Declarative means the author states what, and the compiler decides how.** A definition
declares Steps, their types, their Side-Effect Classes, their bindings and the edges between them.
It MUST NOT contain executable customer code, and no construct may mean "run this". ADR-0005 names
the escape hatch for a pattern the language cannot express: a reviewed custom step type.

**L2 — A definition is tenant-scoped, optionally Workspace-scoped.** Tenant scoping is domain
model I1 and [ADR-0011](../adr/adr-0011-tenant-isolation-shared-schema-rls.md); that a Workspace is
optional and is not an isolation boundary is
[`../20-domain/domain-model.md`](../20-domain/domain-model.md) section 3. A Workspace scopes
administration and visibility, never isolation.

**L3 — Nothing in the language may suppress a Policy Enforcement Point.**
[`../40-governance/policy-model.md`](../40-governance/policy-model.md) E2 states the prohibition and
E3 the coverage, both normative and both binding here. Cited, not restated — it is the rule a
language document is most tempted to soften. What this document adds is only the consequence: the
author has no opt-out to write, because the opt-out is not a construct, and section 4 is how that is
made true rather than promised.

**L4 — No rail vocabulary appears in the language.** The orchestration runtime's, a model provider's
and the tool protocol's vocabularies MUST NOT appear in a key, enum value, step type or diagnostic
(ADR-0005, `gateway-api.md` G17, `audit-model.md` A8), and a Checkpoint is not addressable from a
definition (domain model I6). Durability, checkpointing, interrupts and the resume mechanism are the
runtime library's and absent from the language deliberately
([ADR-0016](../adr/adr-0016-compile-to-the-langgraph-library.md)). Run supervision is absent too,
for the opposite reason: it is Orchestra's own subsystem
([ADR-0014](../adr/adr-0014-run-supervisor-is-orchestras.md)), and a definition declares a process,
not how the platform schedules one. ADR-0008 called what remained "a schema and a compiler"; it was
a schema, a compiler and a run supervisor.

## 2. The document shape

| Key | Required | Meaning |
| --- | --- | --- |
| `name` | Yes | Stable identifier within the Tenant. Never renamed, never reused — a decision this document takes, with its reason in L5 |
| `version` | Assigned | Assigned by publication, not authored. A draft carries none |
| `workspace` | No | Administrative scope. Never an isolation boundary |
| `inputs` | Yes | The declared values a Run supplies at admission. MAY be empty |
| `entry` | Yes | The Step at which execution begins |
| `steps` | Yes | Declared Steps, keyed by author-assigned identifier |
| `edges` | Yes | The graph. Control flow lives here and nowhere else |

**L5 — Identity is a name plus a publication-assigned version**, addressed `purchase-approval@3` in
the form W2 uses. Publication assigns and freezes it (W1). The author writes no version number: an
author-supplied one makes immutability an authoring convention, since two drafts could claim `@3`.
The name is never renamed and never reused. That is taken here rather than inherited — R4's
never-reused rule covers Orchestra's own document, ADR and RFC identifiers, not customer-authored
names — and for one reason: a definition is retained for the full audit-retention period (W4), so a
reused name makes every audit reference to it ambiguous across that period.

**L6 — Every Step declares an identifier unique within the version and a type, and carries a
Side-Effect Class the compiler derives.** The identifier is authored, not generated, being the unit
of traceability (C6) and the anchor of every diagnostic (C5). The class is not authored at all: a
Step carrying `side_effect_class` is rejected under L9, and the compiler derives the value at
publication ([ADR-0045](../adr/adr-0045-the-compiler-derives-a-steps-side-effect-class.md)). A Step
with no business effect carries one too, because the class is an input to policy and never a
precondition for evaluation (E3).

**The derivation is fixed, and nothing in a definition moves it.** On a `tool` Step the value is the
one the Tool Catalog recorded at registration
([`../40-governance/tool-authorization.md`](../40-governance/tool-authorization.md) TA9,
`step-types.md` S2). On `condition`, `transform`, `wait`, `approval` and `parallel` it is `read` by
rule. On an `agent` or `subworkflow` Step the Step carries the set of classes its delegation can
reach, computed from the Tools the pinned version declares and the pinned versions it in turn names,
and the Step's boundary evaluation receives that set. This is the constraint section 11 set on any
answer — the value MUST NOT become a self-issued exemption — met by construction rather than by
checking.

**L7 — A `tool` Step names exactly one Tool to invoke; every other type names none**
([`../20-domain/domain-model.md`](../20-domain/domain-model.md) section 5). It pins the MAJOR
version of that Tool's schema (W5). A Tool MAJOR bump surfaces as an actionable warning in the
Control Plane and MUST NOT alter a published definition. Naming a Tool declares it and grants
nothing: a Run of the Workflow invokes it only under a capability grant naming the Workflow and the
Tool ([ADR-0042](../adr/adr-0042-declared-tools-and-capability-grants.md),
[`../40-governance/tool-authorization.md`](../40-governance/tool-authorization.md) TA19 to TA21).

**A compensating action declared on that Step is a second Tool invocation and is not a second
Step**, which is why L7's count holds with one in the example below. `execution-semantics.md` X21
fixes what the declaration contains — one registered Tool, the arguments as they would execute, the
schema MAJOR the version pins — and X16 fixes what it is: an ordinary business action whose class is
the Tool's own (TA9). It therefore carries no Step identifier, declares no class and adds no Step
boundary. It is governed where every Tool invocation is governed, at the enforcement point
[`../40-governance/policy-model.md`](../40-governance/policy-model.md) E1 places before any Tool
invocation — not by a Step boundary, there being no Step — and section 5 validates the Tool it names
on the same terms as the one it compensates.

**A Step need not declare one, and its declaration overrides the Tool's.** A Tool whose class is
`write`, `destructive` or `financial` names its compensating Tool and an argument mapping when it is
registered, or records that it has none
([ADR-0046](../adr/adr-0046-compensation-is-declared-on-the-tool-registration.md)). Where a `tool`
Step declares a compensating action, that is what is attempted; where it does not, the registered
one is; and a Step whose Tool is registered with none and which declares none is rejected at
publication. Whether the language admits a compensating action that is anything other than a Tool
invocation is open, assigned here by X21 and registered in section 11.

**L8 — Control flow lives in `edges`, never inside a Step body.** The trade-off is real: an explicit
edge list is more verbose than a `next` field per Step. It buys a graph analysable without reading
any Step body — what the reachability, acyclicity and enforcement-point passes need — and a
version-to-version diff a reviewer can read, which schema-first authoring depends on (section 9).
The two types that would otherwise pull a target into a Step body are `condition` and `parallel`:
under L8 such a Step declares the outcome labels and the edges leaving it carry the targets. What
each type declares is `step-types.md`'s; the graph shape is this document's.

**L12 — An edge may leave a Step on a governance refusal rather than on completion**
([ADR-0040](../adr/adr-0040-run-outcomes-for-refusal-and-compensation.md)). Any Step may declare a
refusal edge, which the Run follows when the Step's boundary enforcement point, or the Tool
enforcement point before the invocation a `tool` Step names, returns `deny`, or when a gate raised
at either is rejected or expires. An `approval` Step may also declare a rejection edge and an expiry
edge, which the Run resumes onto when the Step's own gate resolves `Rejected` or `Expired`; that
gate follows only those two, and no other type declares either. An expiry edge is taken when the
request's decision deadline, which the Policy that raises it may set (ADR-0043), passes undecided.
Each is an ordinary edge under L8 and inside the acyclicity rule of L11, and the branch it leads to
is ordinary governed execution (`approval-workflows.md` J2). Where the Step declares no such edge,
the Run ends `Denied`. The labels that spell these edges are notation until the label vocabulary
section 8 registers is decided.

**L9 — An unrecognised construct is rejected, not ignored, and the compiler rejects it rather than
the schema.** R3's must-ignore rule binds *consumers* of an Orchestra contract; the compiler is not
one, but the authority deciding what a definition means. Ignoring an unknown key or step type drops
the author's intent, and where that intent was a governance one the loss is invisible. R3
deliberately does not reach here.

That settles who rejects, not how, and the how is constrained already:
[`../VERSIONING.md`](../VERSIONING.md) section 6 forbids `additionalProperties: false` on any
wire-facing object, and the `workflow-definition` slot reserved there is one. So the closure cannot
live in the schema. It lives where [`../30-protocol/ui-protocol.md`](../30-protocol/ui-protocol.md)
CC3 already put the same closure for the component catalog — closed by lookup, not by a closed
schema: the schema stays open and a compiler pass checks every construct against an allow-list of
recognised ones. Same rejection, and additive evolution survives it.

## 3. A worked example

```yaml
# purchase-approval@3 — published and frozen (VERSIONING W1)
name: purchase-approval
workspace: finance
version: 3
inputs:
  purchase_request_id: { type: string, required: true }
entry: fetch-request
steps:
  fetch-request:
    type: tool
    tool: { name: erp.purchase_request.get, schema_major: 1 }
    arguments: { request_id: "${inputs.purchase_request_id}" }
  assess:
    type: agent
    # Pinned: publishing purchase-approval@3 froze this exact version into it, and the Agent
    # executes inside this Run rather than as a Run of its own (ADR-0041).
    agent: { name: procurement-analyst, version: 2 }
    input: { request: "${steps.fetch-request.output}" }
  route:
    type: condition
    when: "<predicate — an Expression Profile expression, its form here undecided, section 11>"
  approve:
    type: approval
  issue-po:
    type: tool
    tool: { name: erp.purchase_order.create, schema_major: 2 }
    arguments: { request_id: "${inputs.purchase_request_id}" }
    compensation:
      # A Tool invocation, not a second Step — L7, with execution-semantics.md X21 and X16.
      tool: { name: erp.purchase_order.void, schema_major: 2 }
      arguments: { purchase_order_id: "${steps.issue-po.output.purchase_order_id}" }
  notify:
    type: tool
    tool: { name: notify.email.send, schema_major: 1 }
    arguments: { to: "${steps.fetch-request.output.requested_by_email}" }
edges:
  - { from: fetch-request, to: assess }
  - { from: assess, to: route }
  - { from: route, to: approve, branch: satisfied }
  - { from: route, to: notify, branch: otherwise }
  - { from: approve, to: issue-po }
  - { from: issue-po, to: notify }
```

**Illustrative, and bounded by section 2.** What the example specifies is the shape section 2's
table gives, and nothing past the keys in that table. Everything else is notation chosen to make the
shape readable, and MUST NOT be read as decided: the form of the predicate in `route` and of the
`${…}` references, which are Expression Profile expressions (section 8) written in a notation
section 11 registers, and the branch labels leaving `route`; the `inputs` type notation and the
choice of YAML as the concrete syntax, registered with the type system in section 11; the `tool: {
name, schema_major }` and `agent: { name, version }` object shapes, though the pin on `assess` is
decided ([ADR-0041](../adr/adr-0041-nested-versions-execute-inside-the-parent-run.md)). No Step in
the example declares a Side-Effect Class, because none may: the compiler derives it
([ADR-0045](../adr/adr-0045-the-compiler-derives-a-steps-side-effect-class.md)). A list of
exceptions has to be recounted every time the example changes; the rule that the table is the
specification does not.

[`examples/purchase-approval.md`](examples/purchase-approval.md) walks this definition through as a
Run, enforcement point by enforcement point.

**No threshold appears in `approve`, and none may.** That a gate belongs here is the Step's own
declaration and not Policy's to override — `step-types.md` owns that rule and states it. What the
gate then costs is Policy's: the Approval Chain, the routing and who may satisfy it are owned by
[`../40-governance/approval-workflows.md`](../40-governance/approval-workflows.md) and
[`../40-governance/policy-model.md`](../40-governance/policy-model.md), and unmade in both. A
threshold written into a definition is a control the author moves by publishing, not one an
administrator owns.

## 4. Compilation is the governance mechanism

The language is compiled rather than interpreted for a governance reason, not a performance one. An
interpreter executes the definition the author wrote; a compiler produces the graph that executes,
and can therefore place into it things the author did not write and cannot remove. The Policy
Enforcement Point at every Step boundary is such a thing, and
[ADR-0003](../adr/adr-0003-governance-layer-positioning.md) makes those points the Data Plane's
architectural centre.

**C1 — Compilation happens at publication.** Publication validates, compiles, freezes the version
(W1) and records the act with the acting Principal, the frozen definition and the compiled artifact
([`../10-architecture/control-plane.md`](../10-architecture/control-plane.md) section 5).

**C2 — The compiler emits a Policy Enforcement Point at every Step boundary** (ADR-0005, ADR-0008,
`policy-model.md` E1 and E2). Emission is unconditional: every Step, every type, every Side-Effect
Class, never a function of what the definition says. That is what makes L3 a guarantee, not a
request.

**C3 — Compilation is total.** A definition compiles and publishes or is rejected whole, so nothing
uncompiled reaches the Runtime. A partially governed process is indistinguishable from a governed
one at run time, which is why there is no partial publish.

**C4 — Compilation is deterministic.** The same definition version MUST compile to the same graph;
ADR-0005 mitigates compiler defects with golden tests and retained snapshots, and neither means
anything without it.

```mermaid
flowchart TD
  AUTH["Platform User authors a draft — schema-first, reviewed as code"] --> VAL{"Definition Compiler validates"}
  VAL -->|"rejected"| DIAG["Diagnostics naming the Step identifier and the construct — C5"]
  DIAG --> AUTH
  VAL -->|"accepted"| EMIT["Emit the execution graph — a Policy Enforcement Point at every Step boundary, unconditionally"]
  EMIT --> FREEZE["Publish — the version is frozen, VERSIONING W1"]
  FREEZE --> REC["Publication record — Principal, frozen definition, compiled artifact"]
  REC --> RT["Runtime executes the graph — a Run pins name@version at admission and runs it to completion, W2 and W3"]
  REC --> AUD["Audit retains the artifact and never returns it — C7"]
```

The guarantee has a price, and ADR-0005 accepts it: a compiler carries a correctness burden and
adds indirection when debugging. C5 and C6 pay that down.

## 5. What the compiler validates, and what it rejects

| Class | What is checked | On failure |
| --- | --- | --- |
| Construct recognition | The document conforms to the published definition schema, and every key, closed-set value and step type is one the compiler recognises — checked against an allow-list, the schema itself staying open | Rejected — L9 |
| Step-type membership | Every `type` is in the closed set of section 7 | Rejected — L10 |
| Side-Effect Class | No Step declares one. The compiler derives the value: `read` on `condition`, `transform`, `wait`, `approval` and `parallel`; the registered class on a `tool` Step; the set its delegation can reach on an `agent` or `subworkflow` Step | A Step carrying `side_effect_class` is rejected — L6, L9, [ADR-0045](../adr/adr-0045-the-compiler-derives-a-steps-side-effect-class.md) |
| Compensation | Every `write`, `destructive` and `financial` Step has a compensating action: the one it declares, or the one its Tool's registration names | Rejected — `execution-semantics.md` X15, [ADR-0046](../adr/adr-0046-compensation-is-declared-on-the-tool-registration.md) |
| Tool reference | Every Tool named — the Step's own and the one in its compensating action — is registered in this Tenant's Tool Catalog, pins its schema MAJOR, and passes arguments conforming to that major | Rejected — L7, W5, `execution-semantics.md` X21 |
| Agent and Workflow reference | An `agent` or `subworkflow` Step names an exact version, already published within the Tenant and not `Archived`, and publication pins it. A reference naming no exact version, or a version not yet published, is rejected, so no reference cycle across definitions can form | Rejected — `step-types.md` sections 5 and 12; [ADR-0041](../adr/adr-0041-nested-versions-execute-inside-the-parent-run.md) |
| Graph well-formedness | Step identifiers unique, `entry` names a declared Step, every edge names declared Steps, every Step reachable from `entry`, and the graph acyclic | Rejected — L8, L11 |
| Refusal, rejection and expiry edges | A rejection or expiry edge leaves only an `approval` Step; a refusal edge may leave any Step; each counts toward reachability and acyclicity like any other edge | Rejected — L12, L9, L11 |
| Expressions | Every predicate, data reference and `transform` body parses and type-checks under the Expression Profile version in force at publication, within the profile's cost bound | Rejected — section 8, [ADR-0035](../adr/adr-0035-cel-profile-for-policies-and-workflow-expressions.md) |
| Rail vocabulary | No runtime, provider or tool-protocol vocabulary in any name or value | Rejected — L4 |

One absence is deliberate: **nothing is warned and published**, a compile-time warning on a
governance construct being an unenforced rule. Acyclicity is not an absence. It is the
deny-by-default of L11, taken because declining to check would itself have decided the question, in
the direction W1 makes hardest to reverse.

**C5 — Diagnostics are a user-facing surface and MUST be built as one**, which ADR-0005 says in
those words. A diagnostic MUST identify the Step by the author's identifier and the construct by its
path, MUST state what was expected, and MUST NOT contain rail vocabulary (L4) — one naming the
runtime leaks it as surely as an API field would.

## 6. Traceability, and the artifact that is never returned

**C6 — Every compiled graph MUST retain a traceable link back to its source definition, its version
and its Step identifiers** (ADR-0005). Without it, an operator debugging a Run is debugging the
runtime rather than the process — the experience the developer persona refuses on.

**C7 — The compiled artifact is retained for audit and never returned.** The publication record
keeps it so a Run's process can be reconstructed, and the tenant-readable surface MUST NOT return it
(`audit-model.md` sections 3 and 8, A8, `gateway-api.md` G17): returning it would put the
orchestration runtime's vocabulary into a customer-facing contract. A Tenant reads back the version
it published and the identifiers resolving to it. The definition is retained for the full
audit-retention period (W4); that period is undecided, owned by `audit-model.md` section 11.

## 7. The step-type set is closed, and stays closed

**L10 — The step types are `agent`, `tool`, `approval`, `condition`, `parallel`, `wait`, `transform`
and `subworkflow`, and additions are deny-by-default. Every new type requires its own ADR**
([`../00-overview/scope-and-non-goals.md`](../00-overview/scope-and-non-goals.md) section 2.4). This
is a rule of this document, not a note attached to one: ADR-0008 rates *the definition language
grows into a programming language* its highest risk on both axes, and L10 is the whole mitigation.

The arithmetic explains why the gate is an ADR and not a schema review. Adding a type is MINOR under
R2 and costs a customer nothing. Removing one is MAJOR, and VERSIONING section 10 gives a step type
24 months of notice — matching a Gateway API major version, the longest in that table. Cheap to add,
close to irreversible: the profile that belongs in an ADR. ADR-0005's escape hatch is itself a step
type, gated identically — it admits a capability under review rather than around it.

**A reviewed custom step type is a platform-wide type that Orchestra implements**, available to
every Tenant on the same terms as the eight and admitted by an ADR of its own — never raw customer
code, as [ADR-0016](../adr/adr-0016-compile-to-the-langgraph-library.md) carries the hatch forward.
It is not a Tenant-private type, which would make the language a different contract in each Tenant,
and it is not a customer plugin, which is executable customer code and what L1 forbids. Every ADR
admitting one is reviewed against the same fixed criteria, so that one can be compared with the
next: no construct that suppresses an enforcement point (E2); a Side-Effect Class rule consistent
with ADR-0045's derivation, with compensation semantics; deterministic compilation (C4) with no rail
vocabulary (L4); and the 24-month deprecation liability above. `step-types.md` section 3 states
them, being where a ninth-type proposal starts.

## 8. Expressions — where a definition language becomes a programming language

L10 is necessary and it is not sufficient. The step-type set can stay closed while the language
becomes a programming language anyway, because the pressure does not arrive as a step type. It
arrives as an expression, through three doors into one room. A `condition` Step needs a predicate. A
Step consuming an earlier Step's output needs a reference. A `transform` Step is, by its name, a
body of expression.

Each door opens the same way. A predicate needs a comparison, then a conjunction, then a null check,
then a date comparison, then arithmetic on an amount, then a string function "just for
normalisation". No step in that sequence is unreasonable and none adds a step type, so none trips
L10. By the time it is visible as a language it is a contract under W1, additive-only under R3, and
frozen into every definition already written against it.

The options are different products, not points on a scale:

| Option | What it is | What it costs |
| --- | --- | --- |
| No expression language | Predicates are structured comparisons in the schema — a reference, an operator from a closed set, a literal. References are static paths | Narrowest surface, and the likeliest not to express a real process. Pressure moves to the escape hatch, where each relief costs an ADR |
| A restricted declarative form | A closed operator set. No user-defined functions, no iteration, no I/O, evaluation total by construction | The most specification work, and a boundary defended forever, because every proposed addition looks small |
| An existing expression language | Adopt a third-party specification and its evaluator | Inherits someone else's versioning and someone else's escape hatches, and puts a third-party evaluator on the path of every Step |
| A general-purpose evaluator | Embed a scripting engine | Reverses L1 — the definition would contain code — and places arbitrary evaluation inside the very Step boundary the enforcement point exists to govern |

**It is decided, and not here.**
[ADR-0035](../adr/adr-0035-cel-profile-for-policies-and-workflow-expressions.md) takes the third
option and makes it the policy language as well: predicates, data references and `transform` bodies
are expressions in the Expression Profile, the Orchestra-versioned profile of CEL that Policies are
written in. A reference is field selection, and a transform is map and list construction. The
profile admits no user-defined function and bounds evaluation cost, which keeps the language on the
right side of L1, and the compiler checks every expression at publication (section 5). It needed an
ADR on exactly the grounds `policy-model.md` section 8 gives for the policy language: it became a
permanent public contract the moment a customer could author against it, and it constrains the
compiler, the authoring surface, the audit representation and the `workflow-definition` schema slot
reserved in VERSIONING section 6. One language is one surface to defend and one evaluator to secure.

**Expressions are one pressure on the closed set; iteration is the other.** It is the same risk in
other clothes: a cycle plus a predicate is a loop, and a loop is where step limits, iteration bounds
and non-termination arrive — none decided, and none this document may invent. The Expression
Profile's macros over finite lists, such as `map` and `all`, are not that loop: they terminate
within the cost bound and repeat no Step (ADR-0035).

**L11 — A cyclic graph is rejected at compile time, and the language admits no iteration until an
ADR admits one.** Declining to check would not have been neutral. It would have decided the question
in the permissive direction, and W1 then freezes every definition written under it: admitting cycles
later is MINOR under R2, while withdrawing them is MAJOR and needs deprecation under R5 against
every definition already published. Deny-by-default is the reversible direction, and it is the rule
this document already applies to an unrecognised construct (L9) and to a ninth step type (L10).
What it costs an author is every process a loop expresses.

**What an ADR admitting cycles has to supply.** L11 stands, and section 11 no longer holds the
question open. What would restore those processes is an ADR admitting cycles, and a language that
admits non-termination with no bound decided anywhere is not a governed one, so that ADR has to
supply four things besides the permission:

- **A per-cycle iteration bound**, so that no cycle iterates without limit.
- **A platform maximum**, holding across every definition, so that the limit on iteration is never
  left to each definition alone.
- **A terminal outcome when a bound is exceeded.** ADR-0009 meters Runs by outcome, and
  `execution-semantics.md` section 10 holds that the outcomes it enumerates stay distinguishable and
  cannot be added retroactively, so the outcome is named before any Run can reach it.
- **Rejection of cycles across definitions.** Definitions nest only as pinned references: the child
  definition version an `agent` or `subworkflow` Step names is pinned when its parent is published
  (ADR-0041). A pinned version is therefore always published before the version that pins it, so
  no chain of pinned references returns to a version already on it, and an ADR admitting cycles
  inside one definition keeps that property rather than admitting a cycle through a reference.

No figure for either bound is decided, and none appears here.

## 9. Schema-first authoring, and why there is no designer at MVP

ADR-0008 follow-on 4 rules out a visual designer at MVP. Authoring is schema-first: a definition is
a document, reviewed as code, published through the Control Plane (`control-plane.md` section 5).

The reason is not that a designer is undesirable — ADR-0008 says plainly it is *where workflow
products most often stall*. A designer is a second complete representation of the language: every
construct needs a visual form, every diagnostic a place on a canvas, every language change becomes
two. Building one first freezes the language around what the canvas can draw, and section 8 is open.

Nothing here says a designer will never exist. ADR-0008 records the countervailing risk — customers
may demand one to adopt — rates it Medium on both axes, and states that schema-first does not
preclude one later. What is fixed is the ordering: the document is the contract, a designer is a
client of it, and a definition authored in one MUST be the same document as one typed by hand.

## 10. What VERSIONING already fixed, seen from the author's chair

Cited, not decided here. [`../VERSIONING.md`](../VERSIONING.md) section 8 is where these live.

| Rule | What an author sees |
| --- | --- |
| W1 | A published version cannot be edited. Editing opens a draft, which publishes as a new version |
| W2 | A Run started on `purchase-approval@3` executes `@3` to completion — after `@4` is published, and after `@3` retires |
| W3 | An in-flight execution is never migrated, and the request to migrate one is refused rather than scheduled |
| W4 | Retirement drains rather than kills, and the definition is retained for the full audit-retention period |
| W5 | A version pins each referenced Tool schema's MAJOR. A bump warns and never alters |
| W6 | A version pins the exact version of each Agent and Workflow its Steps name, which executes inside the Run. When one moves on, the Control Plane warns and a new version adopts it |

## 11. Open questions

Every row is a decision this document could not make. **ADR** means costly to reverse or spanning
components. Rows marked *repeated* carry another document's classification unchanged.

| Question | ADR required? | Decided by |
| --- | --- | --- |
| Whether the Step-boundary and Tool enforcement points collapse into one evaluation for a `tool` Step | Document — *repeated* | [`../40-governance/policy-model.md`](../40-governance/policy-model.md) section 9, with a later revision of that document. Disposition below |
| Graph shape past well-formedness — whether a `condition` branch set must be exhaustive, and whether nesting depth is bounded | Document | This document, which owns schema and graph shape; assigned here by `step-types.md` section 13. L11 rejects a cycle inside one definition, and [ADR-0041](../adr/adr-0041-nested-versions-execute-inside-the-parent-run.md) makes a reference cycle across definitions impossible to form, since a reference names only a version already published |
| Whether a newly published version may name a version of another definition that is already `Retired` | Document | This document, with section 5's reference check. [ADR-0041](../adr/adr-0041-nested-versions-execute-inside-the-parent-run.md) fixes only that an `Archived` version cannot be named, and W4 stops only the Runs that target a Retired version |
| Whether concurrent branches of a `parallel` Step may write the same data, and what wins if they do | Document | This document with the type-system row below, data flow being a schema question; assigned here by `step-types.md` section 9 |
| The type system for `inputs` and Step outputs, whether the schema borrows an existing schema language, and which concrete syntax is canonical | Document | This document with the `workflow-definition` schema slot reserved in [`../VERSIONING.md`](../VERSIONING.md) section 6. W1 needs one canonical form to freeze and to diff. Now that [ADR-0035](../adr/adr-0035-cel-profile-for-policies-and-workflow-expressions.md) has fixed the expression language, this row includes how a document marks a value as an expression rather than a literal, and the branch labels leaving a `condition` or `parallel` Step |
| Whether a `wait` condition is an Expression Profile expression or a structured time value, such as an ISO 8601 duration or an RFC 3339 time | Document | This document with [`step-types.md`](step-types.md) section 10. [ADR-0035](../adr/adr-0035-cel-profile-for-policies-and-workflow-expressions.md) covers predicates, data references and `transform` bodies, not the `wait` condition |
| Whether compiler diagnostics are a versioned contract with stable codes a customer's build can assert against | Document | This document with the error-envelope decision registered in [`../30-protocol/gateway-api.md`](../30-protocol/gateway-api.md). C5 fixes a diagnostic's content, not its stability |
| Whether the language admits a compensating action that is anything other than a Tool invocation | Document | This document, assigned here by `execution-semantics.md` X21. That document's section 6 now fixes what a declaration contains and what executing one means — X15 to X21 — leaving only what the language admits, which L7 does not widen |
| Whether a definition may be imported from a customer-held repository rather than authored in the Control Plane | Document | A product decision with `control-plane.md` in [`../10-architecture/`](../10-architecture/); ADR-0008 requires only that authoring be schema-first and reviewed as code |

**Questions assigned here, and their disposition.** `tool-authorization.md` section 10 assigned the
grant-subject question jointly to this document, which contributed L7 and one constraint: domain
model I5 separates registration from permission, and were naming granting, publication would become
an authorization-granting act, and any Platform User who may publish would hold every grant a
definition can name. [ADR-0042](../adr/adr-0042-declared-tools-and-capability-grants.md) settles it
on that constraint: naming a Tool declares it, a capability grant naming the Workflow permits it,
and the row is gone. `policy-model.md` section 9 assigns the collapsed-enforcement-point
question jointly. Taking that one: the language expresses neither answer, since a `tool` Step
declares a Tool and a Side-Effect Class and says nothing about enforcement, so the choice is
invisible to an author and visible only in the audit trail as one Policy Decision or two. The
constraint added here is that E6 must survive the collapse — the action evaluated must be the action
executed — so one evaluation works only where it has the Tool's arguments in hand. The
classification stays Document, with its owner.

`step-types.md` section 13 assigned the Side-Effect Class question jointly, and it is now answered.
The constraint the language contributed decided it: whatever the value came to mean, it MUST NOT
become a self-issued exemption, and only a derived value guarantees that.
[ADR-0045](../adr/adr-0045-the-compiler-derives-a-steps-side-effect-class.md) therefore takes the
value out of the document — L6 and section 5 above — and the compiler computes it at publication
from the type, the Tool Catalog and, for a delegating Step, the Tools its pinned version declares.
E3 still evaluates every Step whatever the class, so nothing about coverage rested on the answer;
what rested on it was whether a rule keyed on `financial` could be defeated by an author writing
`read`, and it can no longer be.
