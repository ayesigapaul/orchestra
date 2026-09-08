---
title: Workflows
doc_id: DOC-060
version: 0.1.0
status: Draft
last_updated: 2026-09-08
owners: [platform-architecture]
---

# Workflows

The declarative workflow definition language and its execution semantics, per [ADR-0008](../adr/adr-0008-declarative-workflow-definitions.md).

## Planned documents

- `workflow-dsl.md` — the definition language and its schema
- `step-types.md` — `agent`, `tool`, `approval`, `condition`, `parallel`, `wait`, `transform`, `subworkflow`
- `execution-semantics.md` — idempotency, compensation, version pinning, cancellation
- `examples/` — worked finance, logistics and procurement processes

> **Status.** This section is scaffolded but not yet written. Content is authored against the
> decisions recorded in [`../adr/`](../adr/) and the vocabulary in
> [`../GLOSSARY.md`](../GLOSSARY.md).
