---
title: "ADR-0016: The compilation target is the LangGraph library, never its server"
adr_id: ADR-0016
status: Accepted
date: 2026-09-11
deciders: [platform-architecture]
consulted: []
informed: []
supersedes: [ADR-0005]
superseded_by: []
tags: [runtime, architecture, boundaries, licensing]
depends_on: [ADR-0001, ADR-0014]
---

# ADR-0016: The compilation target is the LangGraph library, never its server

## Status

Accepted. Supersedes [ADR-0005](adr-0005-langgraph-as-compilation-target.md).

ADR-0005's decision is carried forward unchanged: Orchestra defines Agents and Workflows
declaratively and compiles them into LangGraph execution graphs, and LangGraph is never a public
contract. What this record corrects is what that decision was said to buy. ADR-0005 names
*LangGraph* without saying which artefact, and three of its consequences hold for one artefact and
not the other.

## Context

ADR-0005 was accepted on 2026-09-08 with no investigation behind its consequence list.
[`../80-reference/langgraph-evaluation.md`](../80-reference/langgraph-evaluation.md) tested it
against primary sources on 2026-09-10 and found five things.

- **Two artefacts, two licences.** The library packages Orchestra compiles onto — `langgraph`,
  `langgraph-checkpoint`, `langgraph-checkpoint-postgres` — are MIT, checked against the shipped
  LICENSE file rather than registry metadata. The server — `langgraph-api` and
  `langgraph-runtime-inmem`, now documented as Agent Server — is Elastic License 2.0, which forbids
  providing the software as a hosted or managed service giving users access to a substantial set of
  its features. [ADR-0001](adr-0001-product-shape-multi-tenant-saas.md) fixes a hosted multi-tenant
  product.
- **The server is where supervision lives.** The queue, the workers, background runs, cron,
  horizontal scale, and the sentence *"if a worker is interrupted, the run can resume from the last
  checkpoint"* all belong to the server. The library supplies a call: nothing in it notices that a
  Run has crashed or is waiting, and nothing re-invokes one.
- **Only one durability mode is a guarantee.** Of `exit`, `async` and `sync`, only `sync` persists
  before the next step starts. The other two are performance settings with documented loss windows.
- **Substitution is a drain, not a recompile.** Persisted state does not migrate between substrates.
  A compiler change moves new Runs; Runs in flight finish where they started.
- **A pin holds an advisory in place.** ADR-0005 mitigates churn by pinning versions. The
  checkpoint store packages have carried advisories including SQL injection and cross-namespace
  matching (evaluation section 4.1), and a pin with no uptake obligation keeps a fixed defect live.

The evaluation bounds the licence finding with two hedges, repeated here because the decision rests
on them. ELv2 constrains the default grant and does not preclude a commercial arrangement —
self-hosted and BYOC deployment are offered on the vendor's Enterprise plan, and no such arrangement
has been sought. And whether a given architecture triggers the limitation is a legal judgement:
**the reading has not been reviewed by counsel.**

[ADR-0014](adr-0014-run-supervisor-is-orchestras.md) has since recorded the run supervisor as
Orchestra's and forbids any Orchestra component from depending on an Elastic-2.0 package. ADR-0005
nonetheless still reads — to anyone following `CLAUDE.md`'s instruction to read an ADR before
proposing against it — as though the whole of LangGraph were the dependency and four capabilities
arrived with it.

## Decision drivers

- An Accepted record that overstates what a dependency supplies misprices the build. M2 in
  [`../70-delivery/milestones.md`](../70-delivery/milestones.md) sizes the run supervisor, and
  ADR-0005's *"come free"* is the sentence that made a supervisor look unnecessary.
- ADR-0005's decision was not found wrong. Compiling declarative definitions keeps the boundary
  structural and is what places the enforcement points
  ([`../40-governance/policy-model.md`](../40-governance/policy-model.md) E2).
- Accepted ADRs are immutable. ADR-0014 registered this correction as a follow-on and said it had to
  be a separate record rather than an edit.

## Considered options

1. **Leave ADR-0005 standing**, with the correction living in ADR-0014's follow-on list.
2. **Supersede ADR-0005**, carrying the decision unchanged and correcting what it buys.
3. **Supersede ADR-0005 and reopen the substrate choice**, on the ground that with the supervisor
   now Orchestra's, the *"multi-year investment in a solved problem"* that excluded a bespoke engine
   is partly being made anyway, and one alternative is materially better at patching in-flight code
   (evaluation section 8).

## Decision

Orchestra defines Agents and Workflows declaratively and compiles them into LangGraph execution
graphs. **The compilation target is the MIT-licensed library, and only the library.** LangGraph
remains an implementation detail and is never named in an API, schema, SDK or customer-facing
document.

- The dependency is the library: graph execution and state, checkpointing through the checkpointer
  interface, interrupts, and the resume mechanism. Orchestra runs its own checkpointer against its
  own datastore.
- The server tier — `langgraph-api`, `langgraph-runtime-inmem`, and anything shipped under
  Elastic-2.0 — is out of bounds, as ADR-0014 already requires. That follows from the default
  licence grant and ADR-0001's product shape, not from a technical judgement about the server.
- What the library supplies is stated as the evidence supports, replacing *"come free"*:

| ADR-0005 said | What holds |
| --- | --- |
| Durability comes free | Inherited as a library mechanism, and a guarantee only in `sync` mode. A definition able to choose another mode would let an author choose a weaker audit trail; which component fixes the mode is a follow-on below |
| Checkpointing comes free | Inherited through the MIT checkpointer interface. The store behind it, and the tenant scoping of what it holds, is Orchestra's |
| Interrupts come free | Inherited. A resume restarts the whole node, so any side effect before an interrupt must be idempotent — an obligation on the compiler |
| Resumption comes free | **Half.** The mechanism is inherited. The supervision — noticing a waiting or crashed Run and re-invoking it — is not, and is ADR-0014's run supervisor |
| Runtime substitution is a compiler change | True of the compile path. Persisted state does not migrate, so substituting a runtime is a drain: new Runs move, Runs in flight finish on the substrate they started on |

## Rationale

Option 1 fails the reader ADR-0005 was written for. `CLAUDE.md` sends every agent and engineer to
an ADR before they propose against it. A correction that lives only in another record's follow-on
list is invisible from where that reader stands, and the sentence it corrects is the one most likely
to be quoted into a sizing estimate.

Option 3 reopens what the evidence does not reopen. The evaluation tested both limbs of ADR-0005's
revisit criterion and established neither. No scale ceiling was found, and none could be measured
pre-implementation. One alternative is better on one axis, but LangGraph has a first-class agent
model the durable-execution engines lack — the axis the `agent` Step depends on — and no comparison
of the eight Step types against any alternative was made. Superseding a decision on an argument
nobody has done the work for is the error this record corrects in ADR-0005, made in the other
direction.

Option 2 changes nothing that was right and names the one thing that was not: *which* artefact. The
boundary argument is untouched. What shrinks is the list of capabilities Orchestra was told it would
not have to build, and it shrinks to what was always true.

## Consequences

### Positive

- The Accepted record agrees with ADR-0014 and with the evidence, so M2 sizes the supervisor
  against a record that no longer implies it is unnecessary.
- The licence boundary is stated where the dependency is declared, not only where the supervisor is.
- The substitution argument is honest about its cost. A drain is routine under the version-pinning
  rules W2 and W3 in [`../VERSIONING.md`](../VERSIONING.md); a recompile-only swap was never real.

### Negative

- Orchestra operates a checkpointer against its own datastore, including the tenant scoping of
  checkpoint data. ADR-0005's wording implied that arrived with the dependency.
- `sync` durability puts a checkpoint write on the latency path of every Step, on top of the
  fail-closed Policy Decision write [ADR-0013](adr-0013-fail-closed-policy-decision-writes.md)
  already puts there. Two durable writes per Step is the price of a trail that means anything.
- A commercial arrangement for the server is excluded by default rather than evaluated. If the
  supervisor sizes large, that arrangement becomes worth pricing, and nothing here prices it.
- The whole server exclusion rests on a licence reading counsel has not reviewed.

### Neutral / follow-on work

Carried forward from ADR-0005 unchanged:

- Runtime is Python; the control plane and protocol tooling are TypeScript. The boundary between
  them is a versioned internal contract and must be documented as one. Which side of it the compiler
  sits on is unmade, and [`../10-architecture/data-plane.md`](../10-architecture/data-plane.md)
  registers it.
- Compiler diagnostics are a user-facing surface and require the same care as an API.
- The escape hatch for a pattern the language cannot express is a reviewed custom step type, never
  raw customer code — a ninth type, gated by
  [`../50-workflows/step-types.md`](../50-workflows/step-types.md) section 3.

Named by the evidence and not decided here, each costly to reverse and each needing its own record:

- **Compiler rules.** The durability mode fixed outside the definition language; an `approval` Step
  compiled as an interrupt-only node, so that no action double-executes on resume; retry policy
  emitted per Side-Effect Class rather than set globally, since the library retries by default; and
  node names byte-identical across recompiles, as a golden-test invariant (evaluation sections 5
  to 7).
- **The Approval Request inbox** as an Orchestra-owned, tenant-scoped table (evaluation section 7).
- **A review of [ADR-0011](adr-0011-tenant-isolation-shared-schema-rls.md)'s row-level-security
  design** against the store-isolation and filter-key defect classes the checkpointer advisories
  show (evaluation section 4.1).

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Definition language cannot express a needed pattern | High | Medium | Carried forward: a reviewed custom step type, never raw customer code |
| Compiler bugs produce subtly wrong execution | Medium | High | Carried forward: golden tests, deterministic compilation, compiled-graph snapshots retained for audit |
| LangGraph API churn | Medium | Medium | Pin versions and isolate all contact in the compiler and runtime adapter — **with a security-uptake obligation beside the pin**, since a pin alone holds a fixed advisory live |
| An Elastic-2.0 package arrives by transitive install | Medium | High | Licence assertion over the dependency tree in CI, as ADR-0014 already requires |
| The licence reading is wrong in either direction | Low | High | Counsel review before any commercial commitment; until then the conservative reading governs |
| A durability mode other than `sync` reaches production | Medium | High | Unmitigated until the compiler-rules follow-on is recorded |

## Revisit criteria

Reopen if the vendor relicenses the server under terms a hosted product can build on; if a
commercial arrangement for the server is priced and found cheaper than the supervisor ADR-0014
sizes; if LangGraph's durability guarantees prove insufficient at target scale; or if a materially
better execution substrate emerges — tested, as the evaluation requires, against the eight Step
types rather than asserted.

## References

- [ADR-0005](adr-0005-langgraph-as-compilation-target.md) — superseded by this record
- [ADR-0014](adr-0014-run-supervisor-is-orchestras.md) — the run supervisor, and the Elastic-2.0
  exclusion this record restates where the dependency is declared
- [ADR-0001](adr-0001-product-shape-multi-tenant-saas.md) — the product shape the licence finding
  rests on
- [`../80-reference/langgraph-evaluation.md`](../80-reference/langgraph-evaluation.md) — the
  evidence, especially sections 3, 5, 6, 8 and 9
- [Elastic License 2.0](https://www.elastic.co/licensing/elastic-license)
