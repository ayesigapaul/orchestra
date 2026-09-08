---
title: Architecture
doc_id: DOC-020
version: 0.1.0
status: Draft
last_updated: 2026-09-08
owners: [platform-architecture]
---

# Architecture

C4 views and the design of each major subsystem.

## Planned documents

- `system-context.md` — C4 Level 1
- `containers.md` — C4 Level 2
- `control-plane.md` — the administrative surface Orchestra sells
- `data-plane.md` — gateway, runtime, policy enforcement points
- `connector.md` — enterprise reachability, per [ADR-0007](../adr/adr-0007-outbound-connector-for-enterprise-reachability.md)
- `multi-tenancy.md` — isolation strategy
- `identity-and-access.md` — IdP integration, session tokens, RBAC
- `deployment-topologies.md` — hosted, and the hybrid data-plane variant

> **Status.** This section is scaffolded but not yet written. Content is authored against the
> decisions recorded in [`../adr/`](../adr/) and the vocabulary in
> [`../GLOSSARY.md`](../GLOSSARY.md).
