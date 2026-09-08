---
title: Documentation Changelog
doc_id: DOC-003
version: 0.2.0
status: Draft
last_updated: 2026-09-08
owners: [platform-architecture]
---

# Changelog

All notable changes to the Orchestra documentation set.
Format: [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer 2.0.0](https://semver.org/spec/v2.0.0.html), per [VERSIONING.md](VERSIONING.md).

## [Unreleased]

### Planned

- `00-overview/` — vision, product thesis, personas, scope & non-goals, roadmap
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
