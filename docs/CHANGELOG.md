---
title: Documentation Changelog
doc_id: DOC-003
version: 0.4.0
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

- `10-architecture/` — C4 context and container views, control plane, data plane, connector,
  multi-tenancy, identity & access, deployment topologies
- `20-domain/` — domain model with ERD, entity lifecycle state machines
- `30-protocol/` — event protocol, gateway API, UI protocol, JSON Schemas
- `40-governance/` — policy model, approval workflows, tool authorization, audit model, threat model
- `50-workflows/` — workflow DSL, step types, execution semantics, worked examples
- `60-operations/` — observability, reliability, quotas & metering
- `70-delivery/` — MVP definition, milestones, testing strategy, compliance roadmap
- `80-reference/` — AG-UI, A2UI, MCP and LangGraph evaluations

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
