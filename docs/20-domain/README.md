---
title: Domain Model
doc_id: DOC-030
version: 0.6.0
status: Draft
last_updated: 2026-09-09
owners: [platform-architecture]
---

# Domain Model

The entities, their relationships and their lifecycles.

## Documents

| Document | What it answers |
| --- | --- |
| [`domain-model.md`](domain-model.md) | The entities, their relationships and cardinality, and which entity is the unit of what |
| [`lifecycle-state-machines.md`](lifecycle-state-machines.md) | States and transitions for Run, Approval Request, Workflow version and Connector |

Both are written against [`../GLOSSARY.md`](../GLOSSARY.md), which fixes the terms; these define how
the terms relate. Where a relationship or transition is undecided, the documents say so and name
what decides it — `lifecycle-state-machines.md` carries an open-questions register for exactly that.

> **Status.** This section defines entities and relationships, not a physical schema. Attributes,
> keys, indexes and the datastore engine are out of scope;
> [ADR-0011](../adr/adr-0011-tenant-isolation-shared-schema-rls.md) constrains that engine without
> selecting one. The Connector lifecycle rests on
> [ADR-0007](../adr/adr-0007-outbound-connector-for-enterprise-reachability.md), which is
> **Proposed** and not binding.
