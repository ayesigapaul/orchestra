---
title: "ADR-0012: Policy Decisions are a class of Audit Record over versioned Policies"
adr_id: ADR-0012
status: Accepted
date: 2026-09-09
deciders: [product-owner, platform-architecture]
consulted: []
informed: []
supersedes: []
superseded_by: []
tags: [governance, audit, domain, data]
depends_on: [ADR-0001, ADR-0003, ADR-0008, ADR-0009]
---

# ADR-0012: Policy Decisions are a class of Audit Record over versioned Policies

## Status

Accepted

## Context

Writing the five `40-governance/` documents surfaced two questions that each document assumed
another had settled, and that none had.

**Is a Policy Decision an Audit Record, or a separate record that an Audit Record references?**
The documents implied different answers, and
[`20-domain/domain-model.md`](../20-domain/domain-model.md) modelled `POLICY_DECISION` and
`AUDIT_RECORD` as separate entities with no edge between them at all. The answer determines the data
model, the retention rule, the export payload, and what the audit surface returns for a Run.

**Is a Policy identified in a decision record by version, or is the evaluated rule snapshotted into
the record?** One document's normative table required the rule as evaluated — silently choosing the
snapshot — while the same document's prose and the policy model both recorded the question as
unmade.

Both are load-bearing. A Policy Enforcement Point fires at every Step boundary
([ADR-0005](adr-0005-langgraph-as-compilation-target.md),
[ADR-0008](adr-0008-declarative-workflow-definitions.md)), so record shape is multiplied by
execution volume, and audit is a product surface rather than a log level.

## Decision drivers

- GLOSSARY.md already defines an Audit Record as sufficient to reconstruct who did what, when, on
  what basis, **and under which Policy**. The last clause is the content of a Policy Decision.
- [ADR-0009](adr-0009-meter-first-defer-tiering.md) requires meter records to be reconcilable
  against the audit log. One log is materially easier to reconcile against than two.
- Every other definition in the platform is immutably versioned, and a Run pins the version it
  started with for life ([VERSIONING.md](../VERSIONING.md) sections 2 and 8).
- Record size is multiplied by PEP volume.
- Retention obligations are unresolved ([ADR-0001](adr-0001-product-shape-multi-tenant-saas.md)),
  and two record classes would mean two unresolved retention questions rather than one.

## Considered options

**Record model:** (1) Policy Decision is a class of Audit Record. (2) A distinct governance record
referenced by exactly one Audit Record. (3) Leave unmade.

**Policy identification:** (A) Policies immutably versioned and referenced by version.
(B) The evaluated rule snapshotted into every decision record. (C) Leave unmade.

## Decision

**Option 1 and option A.**

- A **Policy Decision is a class of Audit Record.** It is not a separate entity. Everything true of
  an Audit Record — append-only, immutable, tenant-scoped, resolving to exactly one Principal — is
  true of it without restatement.
- **Policies are immutably versioned**, on the same terms as Agent and Workflow definitions under
  VERSIONING.md sections 2 and 8. A published Policy version is frozen.
- A Policy Decision **references the Policy version it evaluated**. It does not embed the rule text.
- A Run pins the Policy versions in force at admission, for the life of the Run, exactly as it pins
  its definition version. Changing a Policy MUST NOT change the verdict a Run in flight receives.

## Rationale

The glossary had already answered the first question without anyone noticing: a record that
establishes *under which Policy* an action proceeded is an audit fact, not a neighbour of one.
Modelling it separately creates two lifetimes, two retention rules, a join on every audit query and
a second unresolved retention question, in exchange for a flexibility no requirement asks for.

Versioning beats snapshotting on three counts. It is what the platform already does to every other
definition, so it needs no new concept. It keeps decision records small where volume is highest.
And it makes the in-flight pinning rule uniform: a Run already pins its definition version for life,
and a Run whose governing Policy could change underneath it would make that guarantee hollow — an
approval threshold edited mid-Run would otherwise apply retroactively to a decision already taken.

The cost is real and accepted: reconstructing an audit trail requires resolving Policy version
references, so Policy versions MUST be retained for at least as long as the decisions that
reference them. Snapshotting would have avoided that join. It would also have put rule text in
every record at PEP volume, and diverged from how everything else in the platform is versioned.

## Consequences

### Positive

- One record class, one lifetime, one retention question, one export format.
- Meter reconciliation under ADR-0009 has a single log to reconcile against.
- In-flight pinning is uniform across definitions and Policies.
- Decision records stay small at the volume a per-Step-boundary PEP generates.

### Negative

- Audit reconstruction requires resolving Policy version references. A Policy version MUST be
  retained at least as long as any Audit Record referencing it, which couples two retention rules
  that would otherwise be independent.
- Policy authoring gains a publish step. Editing a live Policy is no longer possible; editing means
  publishing a new version, exactly as with a Workflow.
- Policy volume is now a versioning surface with its own lifecycle.

### Neutral / follow-on work

- `20-domain/domain-model.md` MUST draw `POLICY_DECISION` as a subtype of `AUDIT_RECORD`.
- `20-domain/lifecycle-state-machines.md` gains a Policy version lifecycle, which should follow the
  Workflow version lifecycle rather than inventing a second shape.
- The retention period remains unmade — see ADR-0001 and `40-governance/audit-model.md`. This ADR
  fixes the record model, not how long records are kept.
- Whether a Policy version is scoped to a Tenant or a Workspace is not decided here.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| A Policy version is deleted while decisions still reference it | Medium | High | Retention of a Policy version is bounded below by the records referencing it; enforce in the datastore, not in application code |
| Publish friction pushes authors toward over-broad Policies | Medium | Medium | A concern for the policy authoring surface; note it there rather than weakening immutability |
| Audit queries become join-heavy at volume | Medium | Low | A query-shape problem, addressed when a datastore is chosen |

## Revisit criteria

Reopen if decision-record volume makes a single audit class operationally unworkable, which would
argue for separating the classes by retention rather than by entity; or if a requirement emerges to
reconstruct an audit trail with no access to Policy versions at all, which snapshotting would serve
and referencing cannot.

## References

- [ADR-0009](adr-0009-meter-first-defer-tiering.md) — meter records reconcilable against audit
- [VERSIONING.md](../VERSIONING.md) sections 2 and 8 — definition versioning and in-flight pinning
- [GLOSSARY.md](../GLOSSARY.md) — Audit Record, Policy, Policy Decision
