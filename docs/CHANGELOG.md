---
title: Documentation Changelog
doc_id: DOC-003
version: 0.8.0
status: Draft
last_updated: 2026-09-09
owners: [platform-architecture]
---

# Changelog

All notable changes to the Orchestra documentation set.
Format: [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer 2.0.0](https://semver.org/spec/v2.0.0.html), per [VERSIONING.md](VERSIONING.md).

## [Unreleased]

### Planned

- `80-reference/` — MCP and LangGraph evaluations, prior-art survey

- `10-architecture/` — connector and deployment topologies, once ADR-0007 and the BYOK question
  are settled
- `30-protocol/` — event protocol, gateway API, UI protocol, JSON Schemas
- `50-workflows/` — workflow DSL, step types, execution semantics, worked examples
- `60-operations/` — observability, reliability, quotas & metering
- `70-delivery/` — MVP definition, milestones, testing strategy, compliance roadmap

---

## [0.8.0] — 2026-09-09

### Added

- `10-architecture/system-context.md`, `containers.md`, `control-plane.md`, `data-plane.md`,
  `multi-tenancy.md` and `identity-and-access.md` — the six unblocked architecture views. The
  Control Plane gets its own document for the first time; v0.1 omitted it entirely, and ADR-0003
  calls it a first-class product surface. `multi-tenancy.md` turns ADR-0011 into an implementable
  design: forced row-level security, tenant context safe under connection pooling, a CI control on
  the tenant-scoped table set, and the promotion path that lets one Tenant move to a dedicated
  database without a schema change.

### Changed

- `40-governance/threat-model.md` — the egress default-deny posture was stated as a normative MUST
  and then, fourteen lines later, registered as undecided. Three architecture documents took the
  second reading. The posture is derived here from the threat analysis and binds; only the shape of
  the allow-list is open, and the register now says so rather than reopening the rule.
- `40-governance/threat-model.md`, `policy-model.md` and `audit-model.md` — whether
  platform-operator work crosses a Policy Enforcement Point was claimed settled in one document,
  unmade in another, and routed in a circle between them. It is unmade, it is the same decision as
  attribution rather than a second one, and `audit-model.md` owns both halves.
- `20-domain/`, `40-governance/` — cross-references corrected where a document described a
  sibling's state as it was during drafting rather than as it is.

---

## [0.7.0] — 2026-09-09

Writes the governance section, and settles three questions it could not have been written honestly
without.

### Added

- [ADR-0012](adr/adr-0012-policy-decisions-are-audit-records.md) — a Policy Decision is a class of
  Audit Record, not a separate entity, and Policies are immutably versioned so a decision record
  references a Policy version rather than embedding the rule text. A Run pins the Policy versions
  in force at admission, so editing a Policy cannot change a verdict a Run in flight already
  received — without which ADR-0008's in-flight pinning guarantee is hollow.
- [ADR-0013](adr/adr-0013-fail-closed-policy-decision-writes.md) — a Policy Decision MUST be durable
  before the gated action is attempted; other Audit Records MAY degrade, provided a degraded period
  is recoverable from the trail rather than silent. Durable means surviving a crash, not reaching
  the audit store: a local append replicated afterwards satisfies the rule and keeps the network
  round-trip off the enforcement path. What is forbidden is proceeding first and writing later,
  where a crash loses the record and nothing shows it is missing. Replication lag becomes a
  governed property, since it bounds how current an audit query can be.
- `scripts/open-questions.mjs` — reads every open-questions register and reports them in one view,
  ADR-required first. The registers stay the single source; nothing is copied. `--check` fails when
  a register defers to a document that neither exists nor appears in a section README's planned
  list, and runs in CI: five questions were once deferred into documents that never received them.
- `40-governance/policy-model.md`, `approval-workflows.md`, `tool-authorization.md`,
  `audit-model.md` and `threat-model.md` — the normative governance specification. Every Step is
  evaluated at a Policy Enforcement Point whatever its Side-Effect Class; the class is an input to
  the Policy, not a precondition for evaluation. Tool Catalog registration and the capability grant
  are inputs to the enforcement point rather than gates in front of it, and a failed precondition
  yields a recorded `deny` that names no Policy.

### Changed

- `GLOSSARY.md` — the Policy Decision entry described the record model ADR-0012 rejected, and the
  Audit Record entry now reads "under which Policy version". The glossary is the set's tie-breaker,
  so leaving it stale would have made every document that followed ADR-0012 the defect.
- `20-domain/domain-model.md` — `POLICY_DECISION` is drawn as a subtype of `AUDIT_RECORD` rather
  than as an unconnected entity.
- `20-domain/lifecycle-state-machines.md` — Evidence Set immutability is settled by
  `approval-workflows.md` and leaves the register.
- `CLAUDE.md` — the decision table carried only ADR-0001 to ADR-0010; ADR-0011, ADR-0012 and
  ADR-0013 are Accepted and now appear in the file loaded into every session.

---

## [0.6.0] — 2026-09-09

### Added

- `20-domain/domain-model.md` — the entities, their relationships and cardinality, stated as
  numbered invariants. Records the Tenant, Workspace, Principal, Platform User, End User and
  Service Account entities that ADR-0009 said the domain model must gain and that no document had
  yet received. Fixes the two points easiest to invert: Step Execution rather than the Run is the
  unit of idempotency, retry and compensation, and a Run pins its definition version for life.
- `20-domain/lifecycle-state-machines.md` — states and transitions for Run, Approval Request,
  Workflow version and Connector, with an open-questions register naming what decides each
  undecided transition rather than inventing one.
- `80-reference/ag-ui-evaluation.md` and `80-reference/a2ui-evaluation.md` — the evidence behind
  ADR-0004 and ADR-0010, with a source for every claim and an explicit record of the claims an
  adversarial verification pass overturned. Written so the reasoning survives independently of the
  decision records, and so a revisit can tell what has changed since.

### Changed

- `20-domain/README.md` and `80-reference/README.md` — indexes rather than scaffold notices.

---

## [0.5.0] — 2026-09-09

Carries out the desk-checkable validation steps on the two protocol ADRs. Both remain Proposed;
one changes its decision as a result.

### Changed

- [ADR-0004](adr/adr-0004-adopt-ag-ui-event-protocol.md) — the decision moves from adopting AG-UI
  as the public client-facing contract to adopting it as the internal wire format behind an
  Orchestra-versioned profile. Investigation established that no version of the specification has
  ever been frozen, that the only published artefact disclaims compatibility and asks not to be
  cited as a stable reference, and that governance is a single vendor with no foundation and no
  proposal process. The ADR's own mitigation was to pin a version, and there is none to pin.
  Three factual claims are corrected: the event count, the citation of a blog post as the event
  reference, and — the material one — the claim that ordering and reconnection arrive with the
  protocol. They do not; only state synchronisation does. Replay and resumption are Orchestra's to
  build. The CopilotKit React bindings are no longer adopted: their public API exports a
  LangGraph-specific hook and requires the tool-protocol SDK as a peer dependency, which is the
  rail leak CLAUDE.md rule 2 and ADR-0005 exist to prevent, and they carry no accessibility
  position. Orchestra consumes the AG-UI client library behind its own adapter instead.
- [ADR-0010](adr/adr-0010-a2ui-genui-interchange.md) — validation steps 1 and 3 are answered and
  the ADR's judgement is confirmed rather than assumed. A2UI is pre-1.0 with stability guarantees
  scheduled into an unshipped 1.0 milestone. A first-party React renderer exists; there is no
  React Native renderer and none planned. The allow-listed component registry the decision depends
  on is genuinely supported, but is enforced in renderer code rather than by the specification, so
  server-side catalog validation is now required. The risk table gains a single-vendor governance
  row, and the revisit criterion is sharpened to the published stability guarantee rather than the
  1.0 tag.
- `README.md` and `CLAUDE.md` — the one-line summary of ADR-0004 follows the changed decision.

---

## [0.4.0] — 2026-09-09

### Added

- [ADR-0011](adr/adr-0011-tenant-isolation-shared-schema-rls.md) — tenant isolation by shared
  schema with row-level security, closing the question ADR-0001 deferred. Isolation is enforced by
  the datastore rather than by application code, a missing policy fails CI rather than relying on
  review, and the schema is designed so a single Tenant can later be promoted to a dedicated
  database without a schema change or a change to any public contract.

### Changed

- `00-overview/vision.md`, `roadmap.md` and `scope-and-non-goals.md` — tenant isolation moves out
  of the open questions. The datastore engine takes its place there: ADR-0011 constrains it to one
  that enforces row-level security, but does not choose it.

---

## [0.3.0] — 2026-09-09

Writes the overview section against the decisions recorded in 0.2.0. No decision changes.

### Added

- `00-overview/vision.md` — the problem, the thesis, what Orchestra is and is not, who it is for
- `00-overview/product-thesis.md` — the governance-layer argument, the defensibility sort, and
  prompt injection as a policy problem rather than a prompt problem
- `00-overview/personas.md` — the five personas, their mapping onto Principal types, and the
  distinction between Platform User and End User that ADR-0009 settled
- `00-overview/scope-and-non-goals.md` — in scope, refused, and deferred, kept as three separate
  classes with the reopening condition named for each
- `00-overview/roadmap.md` — phases with entry and exit criteria rather than dates, and the
  dependencies that gate each

### Changed

- `00-overview/README.md` — now an index of written documents rather than a scaffold notice
- `.markdownlint-cli2.jsonc` — the table pipe convention was pinned to `MD060`, which is
  `table-column-style` and accepts only `aligned | any | compact | tight`. A `MD055` value placed
  there matched nothing, so the rule never ran. Corrected to `MD055`; the whole set still passes
  with it enforcing.

---

## [0.2.0] — 2026-09-08

Restructures the single-file vision brief into a governed documentation set and records ten
decisions that were previously implicit or unmade.

### Added

- `README.md` — documentation index, conventions and reading paths
- `VERSIONING.md` — compatibility policy across nine versioned artifacts
- `GLOSSARY.md` — canonical vocabulary
- `CHANGELOG.md` — this file
- `adr/` — ADR practice, MADR template, index, and ADR-0001 … ADR-0010
- Directory structure `00-overview/` … `80-reference/`, `rfc/`, `archive/`, `assets/`

### Changed

- Product shape fixed as multi-tenant SaaS; multi-tenancy moved from Phase 3 to MVP (ADR-0001)
- Platform repositioned as a governance and connectivity layer (ADR-0003)
- Model abstraction reduced from a capability router to a credential/endpoint broker (ADR-0006)
- Workflow engine moved from an explicit non-goal to a core capability, bounded to a declarative
  definition layer compiled onto the runtime (ADR-0008)

### Removed

- Capability-based and preference-based model routing, unimplementable under BYOK (ADR-0006)
- The proposal to author a bespoke agent event protocol (ADR-0004)

### Superseded

- `agent-integration-platform-vision.md` v0.1 → [`archive/vision-v0.1-2026-09-08.md`](archive/vision-v0.1-2026-09-08.md)

---

## [0.1.0] — 2026-09-08

### Added

- Initial single-file vision and architecture brief
