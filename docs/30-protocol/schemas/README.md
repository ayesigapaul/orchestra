---
title: Schemas
doc_id: DOC-041
version: 0.1.0
status: Draft
last_updated: 2026-09-08
owners: [platform-architecture]
---

# Schemas

JSON Schema is the source of truth for every wire contract. Prose in
[`../`](../) describes intent; these files define the contract.

Naming: `<entity>.v<MAJOR>.schema.json`. The `$id` embeds the major version. Compatibility rules,
including why `additionalProperties` must never be `false` on a wire-facing object, are in
[`../../VERSIONING.md`](../../VERSIONING.md) §6.

## Planned

- `run.v1.schema.json`
- `agent-event.v1.schema.json`
- `workflow-definition.v1.schema.json`
- `policy-rule.v1.schema.json`
- `approval-request.v1.schema.json`
- `audit-record.v1.schema.json`
- `connector-envelope.v1.schema.json`
