---
title: Testing Strategy
doc_id: DOC-083
version: 0.14.0
status: Draft
last_updated: 2026-09-11
owners: [platform-architecture]
depends_on: [ADR-0005, ADR-0006, ADR-0011, ADR-0012, ADR-0013, ADR-0014, ADR-0015]
---

# Testing Strategy

What has to be tested, and which properties are load-bearing enough that a test is the only thing
standing between a rule and its quiet absence.

## 1. The organising idea

Most of this platform's guarantees are invisible when they fail. A missing row-level security policy
looks like working software until someone reads another Tenant's data. A Policy Decision written
after the action it gates looks identical to one written before, until an audit. An enforcement
point the compiler forgot to emit produces a Run that succeeds.

So the strategy is not organised by test level. It is organised by **which guarantees fail
silently**, because those are the ones where a test is the control rather than a check on one.

## 2. Guarantees a test must enforce

| Guarantee | Source | Why a review cannot enforce it |
| --- | --- | --- |
| Every tenant-scoped table has row-level security enabled **and forced** | [ADR-0011](../adr/adr-0011-tenant-isolation-shared-schema-rls.md) | A new table is added in a diff nobody reads closely. ADR-0011 makes CI the control explicitly |
| Tenant context cannot leak across a pooled connection | [ADR-0011](../adr/adr-0011-tenant-isolation-shared-schema-rls.md) | It passes on a direct connection and fails under the pooler, which is where it runs |
| The compiler emits an enforcement point at **every** Step boundary | [ADR-0014](../adr/adr-0014-run-supervisor-is-orchestras.md) | This is the differentiation ADR-0015 claims. A definition that dodges one is indistinguishable from one that does not |
| A Policy Decision is durable **before** the gated action | [ADR-0013](../adr/adr-0013-fail-closed-policy-decision-writes.md) | Ordering is invisible in a passing test unless the store is made to fail deliberately |
| Allows are audited, not only denials | [`../40-governance/audit-model.md`](../40-governance/audit-model.md) | Nothing breaks when an allow goes unrecorded. It breaks much later, in an audit |
| A Run pins its definition version for life | [`../VERSIONING.md`](../VERSIONING.md) W2, W3 | Only observable by editing a definition mid-Run, which no ordinary test does |
| A partially executed tool call is never blindly retried | CLAUDE.md rule 6, [ADR-0006](../adr/adr-0006-model-layer-as-credential-broker.md) | The failure is a duplicated side effect in production, not a red test |
| No dependency arrives under a licence the product shape forbids | [ADR-0014](../adr/adr-0014-run-supervisor-is-orchestras.md) | A transitive install is nobody's decision |

That last row is not a conventional test and belongs here anyway. ADR-0014 names it: assert licences
over the dependency tree in CI, not by review.

## 3. Test kinds, and what each is for

**Contract tests** over the wire surfaces. [`../30-protocol/`](../30-protocol/) is normative and
[`../VERSIONING.md`](../VERSIONING.md) R3 makes it additive-only, so a contract test is the thing
that stops an accidental breaking change becoming permanent. The Agent Event Profile requires a
conformance suite that does not exist yet; that suite is a deliverable, not a nice-to-have, because
a profile nothing validates is prose.

**Golden tests** mapping definitions to compiled graphs. [ADR-0005](../adr/adr-0005-langgraph-as-compilation-target.md)
requires deterministic compilation and retains compiled graphs for audit. A golden test is how
"deterministic" is enforced rather than asserted, and it is also how the enforcement-point guarantee
above is checked: compile a definition that tries to avoid a boundary, and assert the point is there
anyway.

**Isolation tests**, run as two Tenants rather than one. Any single-Tenant test passes under broken
isolation. These belong in CI and not in a periodic suite.

**Failure-injection tests** for the ordering guarantees. Make the audit store unreachable and assert
the gated action did not proceed. Kill a worker mid-Run and assert the lease is reclaimed and no
side effect repeats. [`../60-operations/reliability.md`](../60-operations/reliability.md) owns the
taxonomy these test against.

**Evaluation testing** for the agentic parts, which is the one kind this repository cannot yet
specify. An `agent` Step's behaviour is not deterministic, so it is not testable in the sense the
rows above are. What is testable is the governance around it: that a persuasive model output never
becomes a verdict, and that the bounds on an agent hold whatever it chooses. Whether Orchestra needs
model-behaviour evaluation beyond that is open, and section 5 registers it.

## 4. What this document does not decide

No coverage target, no test-count threshold, no performance budget and no flake-rate tolerance
appears here, because none is decided and a number invented in a testing document acquires
authority quickly. What is stated is which guarantees must have a test at all — that is the part
that follows from the decisions.

The test framework, the runner, and where the suites live are implementation choices waiting on a
language and datastore neither of which is selected.

## 5. Open questions

| Question | Decided by | ADR required? |
| --- | --- | --- |
| Whether model-behaviour evaluation is in scope, beyond testing the governance around an agent | A design partner, and whether buyers ask for it | No |
| What the Agent Event Profile conformance suite must cover, and whether a third party can run it | [`../30-protocol/event-protocol.md`](../30-protocol/event-protocol.md) | No |
| How a compiled-graph golden test survives a runtime upgrade that changes node naming | [`../50-workflows/workflow-dsl.md`](../50-workflows/workflow-dsl.md) with the compiler design | No |
| Whether isolation tests can be made to fail loudly on a datastore that is not yet chosen | [`../10-architecture/multi-tenancy.md`](../10-architecture/multi-tenancy.md), after the engine decision | No |
| Coverage targets and performance budgets | Nothing yet; deliberately unset | No |
